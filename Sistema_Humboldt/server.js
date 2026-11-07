require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const {
    pool,
    initializeDatabase,
    DEFAULT_MOZOS_PRICES,
    createEmptyMozosOrder,
    calculatePizzaPrice,
    humboldtItemsToMozosOrder,
    mozosOrderToHumboldtItems,
    buildMenuFromMozosPrices
} = require('./db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let dbReadyPromise = null;
app.use('/api', async (req, res, next) => {
    try {
        if (!dbReadyPromise) {
            dbReadyPromise = initializeDatabase().catch(err => {
                dbReadyPromise = null;
                throw err;
            });
        }
        await dbReadyPromise;
        next();
    } catch (error) {
        console.error('Database init middleware error:', error);
        res.status(500).json({ error: 'Error conectando a la base de datos.' });
    }
});

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastSyncEvent(eventType = 'STATE_UPDATED', payload = {}) {
    const message = JSON.stringify({
        type: eventType,
        timestamp: Date.now(),
        payload
    });
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() }));
});

function extractTableNumber(tableName) {
    if (!tableName) return '1';
    const str = String(tableName).trim();
    const match = str.match(/(\d+)/);
    return match ? match[1] : str;
}

function formatTableName(tableNum) {
    const clean = String(tableNum).trim();
    if (/^mesa\s+/i.test(clean)) return clean.replace(/^mesa\s+/i, 'Mesa ');
    return `Mesa ${clean}`;
}

function getLocalDateString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Envía únicamente las pizzas y empanadas (y/o rondas de Pizza Libre)
 * a la cola de espera de `sistema_pedidos` en Neon PostgreSQL.
 */
async function enqueueToPedidosKitchen(client, tableName, newItems, mozosOrder, libreRound, note) {
    if (!Array.isArray(newItems) || newItems.length === 0) return;

    const formattedClient = formatTableName(extractTableNumber(tableName));
    const nowTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const todayStr = getLocalDateString();

    const pedidosPizzas = [];
    let empQty = 0;
    let hasLibreItem = false;
    const libreItemNotes = [];

    for (const item of newItems) {
        const sendQty = Number(item.sendQty ?? item.qty) || 0;
        if (sendQty <= 0) continue;

        if (item.isPizzaLibre || item.isLibreRound) {
            hasLibreItem = true;
            const itemNote = String(item.note || item.obs || '').trim();
            if (itemNote && !libreItemNotes.includes(itemNote)) {
                libreItemNotes.push(itemNote);
            } else if (Array.isArray(item.libreExclusions) && item.libreExclusions.length > 0) {
                const exStr = `NO QUIEREN: ${item.libreExclusions.join(', ')}`;
                if (!libreItemNotes.includes(exStr)) libreItemNotes.push(exStr);
            }
            continue;
        }

        if (item.isEmpanada || item.id === 'item_empanada' || /^empanada/i.test(item.name || '')) {
            empQty += sendQty;
            continue;
        }

        if (item.isPizza) {
            const isMedia = item.pizzaSize === 'media' || item.pizzaConfigType === 'media';
            let toppings = Array.isArray(item.toppings) && item.toppings.length > 0 ? item.toppings : [];
            if (toppings.length === 0 && item.name) {
                const match = item.name.match(/\(([^)]+)\)/);
                if (match) {
                    toppings = match[1].split(/\s+y\s+|,\s*/).map(s => s.trim()).filter(Boolean);
                } else {
                    toppings = [item.name.replace(/^Pizza\s+(Entera|Media)\s*/i, '').trim()];
                }
            }
            let flavorText = '';
            if (toppings.length === 1) {
                flavorText = toppings[0];
            } else if (toppings.length === 2) {
                flavorText = toppings.join(' y ');
            } else if (toppings.length >= 3) {
                flavorText = `${toppings.slice(0, -1).join(', ')} y ${toppings[toppings.length - 1]}`;
            } else {
                flavorText = item.name || 'Muzzarella';
            }

            const desc = isMedia ? `Media ${flavorText}` : flavorText;
            const unitPrice = Number(item.price) || 0;
            const pizzaObs = String(item.note || item.obs || '').trim();

            pedidosPizzas.push({
                id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                description: desc,
                qty: sendQty,
                type: isMedia ? 'mitad' : 'entera',
                flavors: toppings,
                price: unitPrice,
                unitPrice: unitPrice,
                boxPrice: 0,
                obs: pizzaObs,
                withBox: false
            });
        }
    }

    // 1. Si hay pizzas a la carta o empanadas, agregarlas a la cola de espera (inKitchen: false) de sistema_pedidos
    if (pedidosPizzas.length > 0 || empQty > 0) {
        const ordersRes = await client.query(
            `SELECT value FROM rivera_pedidos_state WHERE key = 'orders' FOR UPDATE`
        );
        const currentOrders = (ordersRes.rowCount > 0 && Array.isArray(ordersRes.rows[0].value))
            ? ordersRes.rows[0].value
            : [];

        const orderLevelObsParts = [];
        if (note && String(note).trim()) orderLevelObsParts.push(String(note).trim());
        for (const pz of pedidosPizzas) {
            if (pz.obs && !orderLevelObsParts.includes(pz.obs)) {
                orderLevelObsParts.push(`${pz.description}: ${pz.obs}`);
            }
        }

        const newPedidosOrder = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            client: formattedClient,
            destination: 'salon',
            pizzas: pedidosPizzas,
            drinks: [],
            empanadas: empQty,
            timestamp: nowTime,
            date: todayStr,
            type: 'normal',
            totalPrice: 0,
            inKitchen: false,
            orderNumber: null,
            obs: String(note || '').trim(),
            fromWaiter: true
        };

        currentOrders.push(newPedidosOrder);
        await client.query(
            `INSERT INTO rivera_pedidos_state (key, value, updated_at)
             VALUES ('orders', $1::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(currentOrders)]
        );
    }

    // 2. Si hay Pizza Libre (1ra ronda o siguiente ronda), actualizar `libres` en sistema_pedidos
    if (hasLibreItem) {
        const libresRes = await client.query(
            `SELECT value FROM rivera_pedidos_state WHERE key = 'libres' FOR UPDATE`
        );
        const currentLibres = (libresRes.rowCount > 0 && Array.isArray(libresRes.rows[0].value))
            ? libresRes.rows[0].value
            : [];

        const totalLibrePeople =
            (Number(mozosOrder?.pizzaLibreG) || 0) +
            (Number(mozosOrder?.pizzaLibreH) || 0) +
            (Number(mozosOrder?.pizzaLibreM) || 0) || 1;

        const combinedLibreObsParts = [...libreItemNotes];
        if (mozosOrder?.libreObs && !combinedLibreObsParts.includes(mozosOrder.libreObs.trim())) {
            combinedLibreObsParts.push(mozosOrder.libreObs.trim());
        }
        if (note && String(note).trim() && !combinedLibreObsParts.includes(String(note).trim())) {
            combinedLibreObsParts.push(String(note).trim());
        }
        const combinedLibreObs = combinedLibreObsParts.filter(Boolean).join(' | ');

        const existingIdx = currentLibres.findIndex(
            l => formatTableName(extractTableNumber(l.client)).toLowerCase() === formattedClient.toLowerCase()
        );

        if (existingIdx !== -1) {
            currentLibres[existingIdx] = {
                ...currentLibres[existingIdx],
                people: totalLibrePeople,
                round: Number(libreRound) || (currentLibres[existingIdx].round || 1),
                status: 'esperando',
                timestamp: nowTime,
                obs: combinedLibreObs || currentLibres[existingIdx].obs || ''
            };
        } else {
            currentLibres.push({
                id: `libre_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                client: formattedClient,
                people: totalLibrePeople,
                pricePerPerson: 0,
                totalPrice: 0,
                round: Number(libreRound) || 1,
                status: 'esperando',
                timestamp: nowTime,
                date: todayStr,
                obs: combinedLibreObs
            });
        }

        await client.query(
            `INSERT INTO rivera_pedidos_state (key, value, updated_at)
             VALUES ('libres', $1::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(currentLibres)]
        );
    }
}

async function fetchFullAppState() {
    const client = await pool.connect();
    try {
        // 1. Precios y configuración desde rivera_mozos_config
        const cfgRes = await client.query(`SELECT key, value FROM rivera_mozos_config`);
        const cfgMap = {};
        for (const r of cfgRes.rows) {
            cfgMap[r.key] = r.value;
        }
        const prices = cfgMap.prices || DEFAULT_MOZOS_PRICES;
        const currentMode = cfgMap.currentMode || 'sabado';
        const genericData = cfgMap.genericData || {};

        // 2. Construir catálogo de menú sincronizado con Sistema_mozos
        const menuData = buildMenuFromMozosPrices(prices);

        // 3. Staff
        const staffRes = await client.query(`SELECT name FROM pos_staff WHERE active = true ORDER BY id ASC`);
        const staffList = staffRes.rows.map(r => r.name);

        // 4. Mesas desde rivera_tables
        const tablesRes = await client.query(`SELECT table_number, table_data FROM rivera_tables`);
        const sortedRows = tablesRes.rows.sort((a, b) => {
            const na = parseInt(a.table_number, 10);
            const nb = parseInt(b.table_number, 10);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return String(a.table_number).localeCompare(String(b.table_number));
        });

        const tablesList = [];
        const ordersByTable = {};

        for (const row of sortedRows) {
            const tData = row.table_data || {};
            const tNum = String(tData.number || row.table_number);
            const tName = formatTableName(tNum);
            tablesList.push(tName);

            // Sincronizar items con los precios actuales de Sistema_mozos
            const syncedItems = mozosOrderToHumboldtItems(
                tData.order || createEmptyMozosOrder(),
                prices,
                currentMode,
                tData.humboldtItems || []
            );

            ordersByTable[tName] = {
                waiter: tData.waiterName || 'Sin asignar',
                items: syncedItems,
                note: tData.note || '',
                libreRounds: Number(tData.libreRounds) || 1,
                isPaid: !!tData.isPaid,
                paidAmount: Number(tData.paidAmount) || 0,
                tipAmount: Number(tData.tipAmount) || 0
            };
        }

        // 5. Historial de pagos y pozo de propinas
        const payRes = await client.query(`SELECT * FROM pos_payment_history ORDER BY paid_at DESC`);
        const paymentHistory = payRes.rows.map(p => ({
            id: p.id,
            table: p.table_name,
            waiter: p.waiter_name,
            method: p.payment_method,
            subtotal: parseFloat(p.subtotal),
            tip: parseFloat(p.tip_amount),
            cashAmount: parseFloat(p.cash_amount),
            transferAmount: parseFloat(p.transfer_amount),
            totalPaid: parseFloat(p.total_paid),
            items: p.items_json,
            timestamp: new Date(p.paid_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        }));

        const tipRes = await client.query(`SELECT value FROM pos_config WHERE key = 'general_tips_pool'`);
        const dbTipsPool = tipRes.rowCount > 0 ? parseFloat(tipRes.rows[0].value) || 0 : 0;

        // También calcular propina activa en mesas pagadas de Sistema_mozos
        let activeTablesTip = 0;
        for (const row of sortedRows) {
            const td = row.table_data || {};
            if (td.isPaid && Number(td.tipAmount) > 0) {
                activeTablesTip += Number(td.tipAmount) || 0;
            }
        }
        const archivedSales = Array.isArray(cfgMap.archivedSales) ? cfgMap.archivedSales : [];
        for (const arch of archivedSales) {
            if (arch && arch.isPaid && Number(arch.tipAmount) > 0) {
                activeTablesTip += Number(arch.tipAmount) || 0;
            }
        }
        const generalTipsPool = Math.max(dbTipsPool, activeTablesTip);

        // 6. Cierres de noche
        const reportsRes = await client.query(`SELECT * FROM pos_night_reports ORDER BY closed_at DESC LIMIT 30`);
        const nightReports = reportsRes.rows.map(r => ({
            id: r.id,
            closedAt: new Date(r.closed_at).toLocaleString('es-AR'),
            totalOrders: r.total_orders,
            totalRevenue: parseFloat(r.total_revenue),
            totalCash: parseFloat(r.total_cash),
            totalTransfer: parseFloat(r.total_transfer),
            totalTips: parseFloat(r.total_tips),
            summary: r.summary_json
        }));

        return {
            menuData,
            mozosPrices: prices,
            currentMode,
            genericData,
            staffList,
            tablesList,
            ordersByTable,
            paymentHistory,
            generalTipsPool,
            nightReports
        };
    } finally {
        client.release();
    }
}

// ============================================================================
// ENDPOINTS REST API
// ============================================================================

app.get('/api/state', async (req, res) => {
    try {
        const state = await fetchFullAppState();
        res.json(state);
    } catch (error) {
        console.error('Error en GET /api/state:', error);
        res.status(500).json({ error: 'Error al obtener el estado del servidor' });
    }
});

app.post('/api/verify-admin', async (req, res) => {
    const { password } = req.body;
    try {
        const result = await pool.query(`SELECT value FROM pos_config WHERE key = 'admin_password'`);
        const storedPass = result.rowCount > 0 ? result.rows[0].value : '1234';
        if (password === storedPass) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error verificando contraseña' });
    }
});

app.put('/api/auth/admin-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 4) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres.' });
    }
    try {
        const result = await pool.query(`SELECT value FROM pos_config WHERE key = 'admin_password'`);
        const storedPass = result.rowCount > 0 ? result.rows[0].value : '1234';
        if (currentPassword !== storedPass) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        }
        await pool.query(
            `INSERT INTO pos_config (key, value) VALUES ('admin_password', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [String(newPassword).trim()]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
});

// Staff
app.post('/api/staff', async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    try {
        await pool.query(
            `INSERT INTO pos_staff (name, active) VALUES ($1, true)
             ON CONFLICT (name) DO UPDATE SET active = true`,
            [name.trim()]
        );
        broadcastSyncEvent('STAFF_UPDATED');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al agregar mozo' });
    }
});

app.delete('/api/staff/:name', async (req, res) => {
    const { name } = req.params;
    try {
        await pool.query(`DELETE FROM pos_staff WHERE name = $1`, [name]);
        broadcastSyncEvent('STAFF_UPDATED');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar mozo' });
    }
});

app.put('/api/staff/List', async (req, res) => {
    const { staffList } = req.body;
    if (!Array.isArray(staffList)) return res.status(400).json({ error: 'Lista inválida' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM pos_staff`);
        for (const name of staffList) {
            if (name && name.trim()) {
                await client.query(`INSERT INTO pos_staff (name, active) VALUES ($1, true)`, [name.trim()]);
            }
        }
        await client.query('COMMIT');
        broadcastSyncEvent('STAFF_UPDATED');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error sincronizando personal' });
    } finally {
        client.release();
    }
});

// Mesas (Sincronizadas con Sistema_mozos via rivera_tables)
app.post('/api/tables', async (req, res) => {
    const { name } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const allRes = await client.query(`SELECT table_number FROM rivera_tables`);
        let nextNum = 1;
        if (name && String(name).trim()) {
            nextNum = extractTableNumber(name);
        } else {
            const nums = allRes.rows.map(r => parseInt(r.table_number, 10)).filter(n => !isNaN(n));
            while (nums.includes(nextNum)) nextNum++;
            nextNum = String(nextNum);
        }

        const idx = allRes.rowCount;
        const col = idx % 5;
        const row = Math.floor(idx / 5);

        const newTableData = {
            id: `table-${Date.now()}`,
            number: String(nextNum),
            x: 40 + col * 130,
            y: 40 + row * 130,
            width: 100,
            height: 100,
            isPaid: false,
            paidAmount: 0,
            tipAmount: 0,
            waiterName: 'Sin asignar',
            note: '',
            libreRounds: 1,
            order: createEmptyMozosOrder(),
            humboldtItems: [],
            sentSnapshot: { empanadas: 0, pizzaIds: [], librePersons: 0, libreRounds: 0 }
        };

        await client.query(
            `INSERT INTO rivera_tables (table_number, table_data, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (table_number) DO NOTHING`,
            [String(nextNum), JSON.stringify(newTableData)]
        );
        await client.query('COMMIT');
        broadcastSyncEvent('TABLES_UPDATED');
        res.json({ success: true, tableName: formatTableName(nextNum) });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al crear mesa' });
    } finally {
        client.release();
    }
});

app.delete('/api/tables/:name', async (req, res) => {
    const tableNum = extractTableNumber(req.params.name);
    try {
        const check = await pool.query(`SELECT table_data FROM rivera_tables WHERE table_number = $1`, [tableNum]);
        if (check.rowCount > 0) {
            const td = check.rows[0].table_data || {};
            const items = td.humboldtItems || [];
            if (items.length > 0 && !td.isPaid) {
                return res.status(400).json({ error: 'No se puede eliminar una mesa con pedido activo sin cobrar.' });
            }
        }
        await pool.query(`DELETE FROM rivera_tables WHERE table_number = $1`, [tableNum]);
        broadcastSyncEvent('TABLES_UPDATED');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar mesa' });
    }
});

// Guardar pedido de una mesa y sincronizar con Sistema_mozos
app.post('/api/tables/:name/save', async (req, res) => {
    const tableNum = extractTableNumber(req.params.name);
    const { waiter, items, note, libreRounds } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices'`);
        const prices = pricesRes.rowCount > 0 ? pricesRes.rows[0].value : DEFAULT_MOZOS_PRICES;

        const existingRes = await client.query(`SELECT table_data FROM rivera_tables WHERE table_number = $1 FOR UPDATE`, [tableNum]);
        const existingData = existingRes.rowCount > 0 ? existingRes.rows[0].table_data : {
            id: `table-${Date.now()}`,
            number: String(tableNum),
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            isPaid: false,
            paidAmount: 0,
            tipAmount: 0
        };

        const safeItems = Array.isArray(items) ? items : [];
        const mozosOrder = humboldtItemsToMozosOrder(safeItems, existingData.order, prices);
        if (note && String(note).trim() && !mozosOrder.libreObs) {
            mozosOrder.libreObs = String(note).trim();
        }
        const finalNote = (note !== undefined && String(note).trim())
            ? String(note).trim()
            : (mozosOrder.libreObs || existingData.note || '');

        const hasPizzaItems = ((mozosOrder.pizzaLibreG || 0) + (mozosOrder.pizzaLibreH || 0) + (mozosOrder.pizzaLibreM || 0) > 0) ||
            ((mozosOrder.pizzasPersonalizadas || []).length > 0);
        if (hasPizzaItems) {
            const modeRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'currentMode'`);
            const curMode = modeRes.rowCount > 0 ? modeRes.rows[0].value : 'sabado';
            if (curMode !== 'jueves' && curMode !== 'sabado') {
                const day = new Date().getDay();
                const targetMode = day === 4 ? 'jueves' : 'sabado';
                await client.query(
                    `INSERT INTO rivera_mozos_config (key, value, updated_at)
                     VALUES ('currentMode', $1::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                    [JSON.stringify(targetMode)]
                );
            }
        }

        // Si la mesa se vació por completo, resetear estado de pago
        const hasAnyItems = safeItems.length > 0;
        const updatedTableData = {
            ...existingData,
            number: String(tableNum),
            waiterName: waiter || existingData.waiterName || 'Sin asignar',
            note: hasAnyItems ? finalNote : '',
            libreRounds: Number(libreRounds) || existingData.libreRounds || 1,
            order: mozosOrder,
            humboldtItems: safeItems,
            isPaid: hasAnyItems ? !!existingData.isPaid : false,
            paidAmount: hasAnyItems ? (Number(existingData.paidAmount) || 0) : 0,
            tipAmount: hasAnyItems ? (Number(existingData.tipAmount) || 0) : 0,
            lastUpdatedBy: 'humboldt'
        };

        await client.query(
            `INSERT INTO rivera_tables (table_number, table_data, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (table_number)
             DO UPDATE SET table_data = EXCLUDED.table_data, updated_at = CURRENT_TIMESTAMP`,
            [String(tableNum), JSON.stringify(updatedTableData)]
        );

        await client.query('COMMIT');
        broadcastSyncEvent('TABLE_SAVED', { tableName: formatTableName(tableNum) });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error guardando mesa:', error);
        res.status(500).json({ error: 'Error al guardar pedido de la mesa' });
    } finally {
        client.release();
    }
});

// Enviar pedido a cocina (agrega pizzas y empanadas a la cola de sistema_pedidos y actualiza Sistema_mozos)
app.post('/api/orders/send-kitchen', async (req, res) => {
    const { table, waiter, note, items, newItemsToSend, libreRound } = req.body;
    const tableNum = extractTableNumber(table);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices'`);
        const prices = pricesRes.rowCount > 0 ? pricesRes.rows[0].value : DEFAULT_MOZOS_PRICES;

        const existingRes = await client.query(`SELECT table_data FROM rivera_tables WHERE table_number = $1 FOR UPDATE`, [tableNum]);
        const existingData = existingRes.rowCount > 0 ? existingRes.rows[0].table_data : {
            id: `table-${Date.now()}`,
            number: String(tableNum),
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            isPaid: false,
            paidAmount: 0,
            tipAmount: 0
        };

        const safeItems = (Array.isArray(items) ? items : []).map(it => ({
            ...it,
            sentQty: Number(it.qty) || 0
        }));

        const mozosOrder = humboldtItemsToMozosOrder(safeItems, existingData.order, prices);
        if (note && String(note).trim() && !mozosOrder.libreObs) {
            mozosOrder.libreObs = String(note).trim();
        }
        const finalNote = (note !== undefined && String(note).trim())
            ? String(note).trim()
            : (mozosOrder.libreObs || existingData.note || '');

        // Si se pide Pizza Libre o Pizzas en un día distinto a jueves/sábado en Sistema_mozos, asegurar modo sábado/jueves
        const hasPizzaItems = ((mozosOrder.pizzaLibreG || 0) + (mozosOrder.pizzaLibreH || 0) + (mozosOrder.pizzaLibreM || 0) > 0) ||
            ((mozosOrder.pizzasPersonalizadas || []).length > 0);
        if (hasPizzaItems) {
            const modeRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'currentMode'`);
            const curMode = modeRes.rowCount > 0 ? modeRes.rows[0].value : 'sabado';
            if (curMode !== 'jueves' && curMode !== 'sabado') {
                const day = new Date().getDay();
                const targetMode = day === 4 ? 'jueves' : 'sabado';
                await client.query(
                    `INSERT INTO rivera_mozos_config (key, value, updated_at)
                     VALUES ('currentMode', $1::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                    [JSON.stringify(targetMode)]
                );
            }
        }

        const updatedTableData = {
            ...existingData,
            number: String(tableNum),
            waiterName: waiter || existingData.waiterName || 'Sin asignar',
            note: finalNote,
            libreRounds: Number(libreRound) || existingData.libreRounds || 1,
            order: mozosOrder,
            humboldtItems: safeItems,
            sentSnapshot: {
                empanadas: mozosOrder.empanadas || 0,
                pizzaIds: (mozosOrder.pizzasPersonalizadas || []).map(p => p.id),
                librePersons: (mozosOrder.pizzaLibreG || 0) + (mozosOrder.pizzaLibreH || 0) + (mozosOrder.pizzaLibreM || 0),
                libreRounds: Number(libreRound) || existingData.libreRounds || 1
            },
            lastUpdatedBy: 'humboldt'
        };

        await client.query(
            `INSERT INTO rivera_tables (table_number, table_data, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (table_number)
             DO UPDATE SET table_data = EXCLUDED.table_data, updated_at = CURRENT_TIMESTAMP`,
            [String(tableNum), JSON.stringify(updatedTableData)]
        );

        // Enviar SOLO pizzas y empanadas (y/o ronda de pizza libre) a la cola de espera de sistema_pedidos
        await enqueueToPedidosKitchen(
            client,
            formatTableName(tableNum),
            Array.isArray(newItemsToSend) ? newItemsToSend : [],
            mozosOrder,
            libreRound,
            note
        );

        await client.query('COMMIT');
        broadcastSyncEvent('ORDER_SENT_TO_KITCHEN', { table: formatTableName(tableNum) });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/orders/send-kitchen:', error);
        res.status(500).json({ error: 'Error al enviar comanda a cocina y mozos' });
    } finally {
        client.release();
    }
});

// Cobrar Mesa (Checkout sincronizado con Sistema_mozos)
app.post('/api/checkout', async (req, res) => {
    const {
        table,
        waiter,
        paymentMethod,
        subtotal,
        tipAmount,
        cashAmount,
        transferAmount,
        totalPaid,
        items,
        freeTableAfterPay
    } = req.body;

    const tableNum = extractTableNumber(table);
    const formattedTable = formatTableName(tableNum);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Registrar en historial de pagos de Humboldt
        await client.query(
            `INSERT INTO pos_payment_history 
             (table_name, waiter_name, payment_method, subtotal, tip_amount, cash_amount, transfer_amount, total_paid, items_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
            [
                formattedTable,
                waiter || 'Sin asignar',
                paymentMethod || 'Efectivo',
                Number(subtotal) || 0,
                Number(tipAmount) || 0,
                Number(cashAmount) || 0,
                Number(transferAmount) || 0,
                Number(totalPaid) || 0,
                JSON.stringify(items || [])
            ]
        );

        // 2. Actualizar fondo de propinas
        if (Number(tipAmount) > 0) {
            await client.query(
                `UPDATE pos_config SET value = (CAST(value AS NUMERIC) + $1)::TEXT WHERE key = 'general_tips_pool'`,
                [Number(tipAmount)]
            );
        }

        // 3. Actualizar la mesa en rivera_tables para Sistema_mozos
        const existingRes = await client.query(`SELECT table_data FROM rivera_tables WHERE table_number = $1 FOR UPDATE`, [tableNum]);
        if (existingRes.rowCount > 0) {
            const existingData = existingRes.rows[0].table_data || {};
            const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices'`);
            const prices = pricesRes.rowCount > 0 ? pricesRes.rows[0].value : DEFAULT_MOZOS_PRICES;

            const currentItems = Array.isArray(items) && items.length > 0 ? items : (existingData.humboldtItems || []);
            const mozosOrder = humboldtItemsToMozosOrder(currentItems, existingData.order, prices);

            if (freeTableAfterPay) {
                // Archivar la venta para que Sistema_mozos la mantenga en su total y reporte PDF
                const archRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'archivedSales' FOR UPDATE`);
                const archived = (archRes.rowCount > 0 && Array.isArray(archRes.rows[0].value)) ? archRes.rows[0].value : [];
                archived.push({
                    id: `arch-${Date.now()}`,
                    number: `${tableNum} (Cobrada)`,
                    isPaid: true,
                    paidAmount: Number(totalPaid) || 0,
                    tipAmount: Number(tipAmount) || 0,
                    order: mozosOrder,
                    paidAt: new Date().toISOString()
                });
                await client.query(
                    `INSERT INTO rivera_mozos_config (key, value, updated_at)
                     VALUES ('archivedSales', $1::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                    [JSON.stringify(archived)]
                );

                // Limpiar la mesa para nuevos clientes
                const resetData = {
                    ...existingData,
                    isPaid: false,
                    paidAmount: 0,
                    tipAmount: 0,
                    waiterName: 'Sin asignar',
                    note: '',
                    libreRounds: 1,
                    order: createEmptyMozosOrder(),
                    humboldtItems: [],
                    sentSnapshot: { empanadas: 0, pizzaIds: [], librePersons: 0, libreRounds: 0 },
                    lastUpdatedBy: 'humboldt'
                };
                await client.query(
                    `UPDATE rivera_tables SET table_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE table_number = $2`,
                    [JSON.stringify(resetData), tableNum]
                );
            } else {
                // Dejar la mesa marcada como PAGADA (verde) en Sistema_mozos y Sistema_Humboldt
                // para poder imprimir el ticket desde Sistema_mozos y ver su estado en el salón
                const paidData = {
                    ...existingData,
                    order: mozosOrder,
                    humboldtItems: currentItems,
                    isPaid: true,
                    paidAmount: Number(totalPaid) || 0,
                    tipAmount: Number(tipAmount) || 0,
                    lastUpdatedBy: 'humboldt'
                };
                await client.query(
                    `UPDATE rivera_tables SET table_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE table_number = $2`,
                    [JSON.stringify(paidData), tableNum]
                );
            }
        }

        await client.query('COMMIT');
        broadcastSyncEvent('TABLE_CHECKOUT', { table: formattedTable });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/checkout:', error);
        res.status(500).json({ error: 'Error al procesar el cobro de la mesa' });
    } finally {
        client.release();
    }
});

// Liberar una mesa ya pagada para que se siente gente nueva (archivando la venta para el reporte de Sistema_mozos)
app.post('/api/tables/:name/free', async (req, res) => {
    const tableNum = extractTableNumber(req.params.name);
    const formattedTable = formatTableName(tableNum);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existingRes = await client.query(`SELECT table_data FROM rivera_tables WHERE table_number = $1 FOR UPDATE`, [tableNum]);
        if (existingRes.rowCount > 0) {
            const td = existingRes.rows[0].table_data || {};
            if (td.isPaid && td.order) {
                const archRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'archivedSales' FOR UPDATE`);
                const archived = (archRes.rowCount > 0 && Array.isArray(archRes.rows[0].value)) ? archRes.rows[0].value : [];
                archived.push({
                    id: `arch-${Date.now()}`,
                    number: `${tableNum} (Cobrada)`,
                    isPaid: true,
                    paidAmount: Number(td.paidAmount) || 0,
                    tipAmount: Number(td.tipAmount) || 0,
                    order: td.order,
                    paidAt: new Date().toISOString()
                });
                await client.query(
                    `INSERT INTO rivera_mozos_config (key, value, updated_at)
                     VALUES ('archivedSales', $1::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                    [JSON.stringify(archived)]
                );
            }

            const resetData = {
                ...td,
                isPaid: false,
                paidAmount: 0,
                tipAmount: 0,
                waiterName: 'Sin asignar',
                note: '',
                libreRounds: 1,
                order: createEmptyMozosOrder(),
                humboldtItems: [],
                sentSnapshot: { empanadas: 0, pizzaIds: [], librePersons: 0, libreRounds: 0 },
                lastUpdatedBy: 'humboldt'
            };

            await client.query(
                `UPDATE rivera_tables SET table_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE table_number = $2`,
                [JSON.stringify(resetData), tableNum]
            );
        }

        // Si había mesa libre activa en sistema_pedidos para esta mesa, quitarla de libres activos
        const libresRes = await client.query(`SELECT value FROM rivera_pedidos_state WHERE key = 'libres' FOR UPDATE`);
        if (libresRes.rowCount > 0 && Array.isArray(libresRes.rows[0].value)) {
            const filtered = libresRes.rows[0].value.filter(
                l => formatTableName(extractTableNumber(l.client)).toLowerCase() !== formattedTable.toLowerCase()
            );
            await client.query(
                `UPDATE rivera_pedidos_state SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = 'libres'`,
                [JSON.stringify(filtered)]
            );
        }

        await client.query('COMMIT');
        broadcastSyncEvent('TABLE_FREED', { table: formattedTable });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error liberando mesa:', error);
        res.status(500).json({ error: 'Error al liberar la mesa' });
    } finally {
        client.release();
    }
});

// Desmarcar mesa pagada (si se marcó pagada por error)
app.post('/api/tables/:name/unpay', async (req, res) => {
    const tableNum = extractTableNumber(req.params.name);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existingRes = await client.query(`SELECT table_data FROM rivera_tables WHERE table_number = $1 FOR UPDATE`, [tableNum]);
        if (existingRes.rowCount > 0) {
            const td = existingRes.rows[0].table_data || {};
            td.isPaid = false;
            td.paidAmount = 0;
            td.tipAmount = 0;
            td.lastUpdatedBy = 'humboldt';
            await client.query(
                `UPDATE rivera_tables SET table_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE table_number = $2`,
                [JSON.stringify(td), tableNum]
            );
        }
        await client.query('COMMIT');
        broadcastSyncEvent('TABLE_SAVED', { tableName: formatTableName(tableNum) });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al desmarcar pago' });
    } finally {
        client.release();
    }
});

// ============================================================================
// GESTIÓN DE PRECIOS Y MENÚ (Sincronizado con rivera_mozos_config -> 'prices')
// ============================================================================

app.post('/api/menu/items', async (req, res) => {
    const { category, name, price, precioMedia, bevCategory } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'Datos incompletos' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices' FOR UPDATE`);
        const prices = pricesRes.rowCount > 0 ? pricesRes.rows[0].value : { ...DEFAULT_MOZOS_PRICES };

        const numPrice = Number(price) || 0;
        const cleanName = name.trim();

        if (category === 'pizzas') {
            if (/pizza\s*libre/i.test(cleanName)) {
                prices.pizzaLibreG = numPrice;
                prices.pizzaLibreH = numPrice;
                prices.pizzaLibreM = numPrice;
            } else {
                prices.preciosPizzas = prices.preciosPizzas || [];
                const existing = prices.preciosPizzas.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
                const mediaVal = precioMedia !== undefined ? Number(precioMedia) : Math.round(numPrice / 2);
                if (existing) {
                    existing.precioEntera = numPrice;
                    existing.precioMedia = mediaVal;
                } else {
                    prices.preciosPizzas.push({
                        name: cleanName,
                        precioEntera: numPrice,
                        precioMedia: mediaVal
                    });
                }
            }
        } else if (category === 'empanadas_postres') {
            if (/postre/i.test(cleanName)) {
                prices.precioPostre = numPrice;
            } else {
                prices.empanada = numPrice;
            }
        } else {
            prices.beverages = prices.beverages || [];
            const resolveCategory = (n, c) => {
                if (c && c !== 'otro') return c;
                const low = (n || '').toLowerCase();
                if (low.includes('fernet') || low.includes('gancia') || low.includes('jarro') || low.includes('trago') || low.includes('gin') || low.includes('piña') || low.includes('whisky') || low.includes('ginebra') || low.includes('medida')) return 'jarro';
                if (low.includes('agua') || low.includes('soda') || low.includes('saborizada')) return 'agua';
                if (low.includes('cerveza') || low.includes('heineken') || low.includes('pilsen') || low.includes('santa fe')) return 'cerveza';
                if (low.includes('vino') || low.includes('valentin') || low.includes('latitud') || low.includes('cordero') || low.includes('alma mora') || low.includes('cosecha') || low.includes('portillo') || low.includes('salentein') || low.includes('rutini')) return 'vino';
                if (low.includes('lata') || low.includes('coca') || low.includes('sprite') || low.includes('gaseosa')) return 'gaseosa';
                return c || 'otro';
            };
            const targetCat = resolveCategory(cleanName, bevCategory);
            const existing = prices.beverages.find(b => b.name.toLowerCase() === cleanName.toLowerCase());
            if (existing) {
                existing.price = numPrice;
                existing.category = targetCat;
            } else {
                const newBev = {
                    name: cleanName,
                    price: numPrice,
                    category: targetCat
                };
                let insertIdx = -1;
                for (let i = prices.beverages.length - 1; i >= 0; i--) {
                    if (resolveCategory(prices.beverages[i].name, prices.beverages[i].category) === targetCat) {
                        insertIdx = i + 1;
                        break;
                    }
                }
                if (insertIdx !== -1) {
                    prices.beverages.splice(insertIdx, 0, newBev);
                } else {
                    prices.beverages.push(newBev);
                }
            }
        }

        await client.query(
            `INSERT INTO rivera_mozos_config (key, value, updated_at)
             VALUES ('prices', $1::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(prices)]
        );

        await client.query('COMMIT');
        broadcastSyncEvent('MENU_UPDATED');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al agregar producto a la lista de precios de mozos' });
    } finally {
        client.release();
    }
});

app.put('/api/menu/items/:id', async (req, res) => {
    const { id } = req.params;
    const { name, price, precioMedia } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices' FOR UPDATE`);
        const prices = pricesRes.rowCount > 0 ? pricesRes.rows[0].value : { ...DEFAULT_MOZOS_PRICES };
        const numPrice = Number(price) || 0;

        if (id === 'pizza_libre_g') {
            prices.pizzaLibreG = numPrice;
        } else if (id === 'pizza_libre_h') {
            prices.pizzaLibreH = numPrice;
        } else if (id === 'pizza_libre_m') {
            prices.pizzaLibreM = numPrice;
        } else if (id === 'item_empanada') {
            prices.empanada = numPrice;
        } else if (id === 'item_postre') {
            prices.precioPostre = numPrice;
        } else if (id.startsWith('pizza_flavor_')) {
            const idx = parseInt(id.replace('pizza_flavor_', ''), 10);
            if (prices.preciosPizzas && prices.preciosPizzas[idx]) {
                if (name) prices.preciosPizzas[idx].name = name.trim();
                prices.preciosPizzas[idx].precioEntera = numPrice;
                prices.preciosPizzas[idx].precioMedia = precioMedia !== undefined
                    ? Number(precioMedia)
                    : Math.round(numPrice / 2);
            }
        } else if (id.startsWith('bev_')) {
            const idx = parseInt(id.replace('bev_', ''), 10);
            if (prices.beverages && prices.beverages[idx]) {
                if (name) prices.beverages[idx].name = name.trim();
                prices.beverages[idx].price = numPrice;
            }
        }

        await client.query(
            `UPDATE rivera_mozos_config SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = 'prices'`,
            [JSON.stringify(prices)]
        );
        await client.query('COMMIT');
        broadcastSyncEvent('MENU_UPDATED');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al actualizar precio' });
    } finally {
        client.release();
    }
});

app.delete('/api/menu/items/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices' FOR UPDATE`);
        const prices = pricesRes.rowCount > 0 ? pricesRes.rows[0].value : { ...DEFAULT_MOZOS_PRICES };

        if (id.startsWith('pizza_flavor_')) {
            const idx = parseInt(id.replace('pizza_flavor_', ''), 10);
            if (prices.preciosPizzas && prices.preciosPizzas[idx]) {
                prices.preciosPizzas.splice(idx, 1);
            }
        } else if (id.startsWith('bev_')) {
            const idx = parseInt(id.replace('bev_', ''), 10);
            if (prices.beverages && prices.beverages[idx]) {
                prices.beverages.splice(idx, 1);
            }
        }

        await client.query(
            `UPDATE rivera_mozos_config SET value = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = 'prices'`,
            [JSON.stringify(prices)]
        );
        await client.query('COMMIT');
        broadcastSyncEvent('MENU_UPDATED');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Error al eliminar producto' });
    } finally {
        client.release();
    }
});

// Cierre de noche
app.post('/api/close-night', async (req, res) => {
    const { summary } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const payRes = await client.query(`SELECT * FROM pos_payment_history`);
        const payments = payRes.rows;

        let totalRevenue = 0;
        let totalCash = 0;
        let totalTransfer = 0;
        let totalTips = 0;

        payments.forEach(p => {
            totalRevenue += parseFloat(p.subtotal) || 0;
            totalCash += parseFloat(p.cash_amount) || 0;
            totalTransfer += parseFloat(p.transfer_amount) || 0;
            totalTips += parseFloat(p.tip_amount) || 0;
        });

        await client.query(
            `INSERT INTO pos_night_reports (total_orders, total_revenue, total_cash, total_transfer, total_tips, summary_json)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
            [payments.length, totalRevenue, totalCash, totalTransfer, totalTips, JSON.stringify(summary || {})]
        );

        await client.query(`DELETE FROM pos_payment_history`);
        await client.query(`UPDATE pos_config SET value = '0' WHERE key = 'general_tips_pool'`);
        await client.query(`UPDATE rivera_mozos_config SET value = '[]'::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = 'archivedSales'`);
        await client.query(`UPDATE rivera_mozos_config SET value = '[]'::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = 'barOrders'`);

        // Limpiar todas las mesas en rivera_tables
        const tablesRes = await client.query(`SELECT table_number, table_data FROM rivera_tables FOR UPDATE`);
        for (const row of tablesRes.rows) {
            const td = row.table_data || {};
            const cleaned = {
                ...td,
                isPaid: false,
                paidAmount: 0,
                tipAmount: 0,
                waiterName: 'Sin asignar',
                note: '',
                libreRounds: 1,
                order: createEmptyMozosOrder(),
                humboldtItems: [],
                sentSnapshot: { empanadas: 0, pizzaIds: [], librePersons: 0, libreRounds: 0 },
                lastUpdatedBy: 'humboldt'
            };
            await client.query(
                `UPDATE rivera_tables SET table_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE table_number = $2`,
                [JSON.stringify(cleaned), row.table_number]
            );
        }

        await client.query('COMMIT');
        broadcastSyncEvent('NIGHT_CLOSED');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en /api/close-night:', error);
        res.status(500).json({ error: 'Error al realizar el cierre de noche' });
    } finally {
        client.release();
    }
});

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    initializeDatabase()
        .then(() => {
            server.listen(PORT, () => {
                console.log(`🚀 Servidor Humboldt sincronizado ejecutándose en http://localhost:${PORT}`);
            });
        })
        .catch(err => {
            console.error('Fallo crítico al inicializar la base de datos:', err);
            process.exit(1);
        });
}

module.exports = app;
