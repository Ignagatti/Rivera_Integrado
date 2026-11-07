const fs = require('fs');
const path = require('path');

const envPaths = [
    path.join(__dirname, '.env'),
    path.join(process.cwd(), '.env')
];
for (const ep of envPaths) {
    if (fs.existsSync(ep)) {
        require('dotenv').config({ path: ep });
        break;
    }
}

const { Pool } = require('pg');

function getCleanConnectionString(rawUrl) {
    if (!rawUrl) return '';
    try {
        const u = new URL(rawUrl);
        u.searchParams.delete('sslmode');
        u.searchParams.delete('channel_binding');
        return u.toString();
    } catch (e) {
        return rawUrl;
    }
}

const connectionString = getCleanConnectionString(process.env.DATABASE_URL);

if (!connectionString) {
    console.warn('⚠️ DATABASE_URL no definida en variables de entorno.');
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

const DEFAULT_MOZOS_PRICES = {
    pizzaLibreH: 0,
    pizzaLibreM: 0,
    pizzaLibreG: 0,
    empanada: 0,
    precioPostre: 0,
    precioMenuMartes: 0,
    precioMenuMiercoles: 0,
    precioMenuViernes: 0,
    precioMenuDomingo: 0,
    preciosPizzas: [],
    beverages: []
};

const DEFAULT_GENERIC_DATA = {
    establishmentName: 'Club Rivera',
    address: '',
    phone: '',
    email: '',
    footer: '',
    alias: ''
};

const DEFAULT_PEDIDOS_PRICES = {
    box: 0,
    empanada: 0,
    pizzaLibreH: 0,
    flavors: {},
    drinks: {}
};

function createEmptyMozosOrder() {
    return {
        pizzaLibreH: 0,
        pizzaLibreM: 0,
        pizzaLibreG: 0,
        libreObs: '',
        menores: 0,
        menorPrice: 0,
        empanadas: 0,
        postres: 0,
        menu: 0,
        beverages: [],
        pizzasPersonalizadas: []
    };
}

function getPizzaPrice(topping, size, prices) {
    if (!prices || !Array.isArray(prices.preciosPizzas)) return 0;
    const item = prices.preciosPizzas.find(p => p.name.toLowerCase() === String(topping || '').toLowerCase());
    if (!item) return 0;
    if (size === 'entera') return Number(item.precioEntera) || 0;
    const media = Number(item.precioMedia) || 0;
    return media > 0 ? media : (Number(item.precioEntera) ? Number(item.precioEntera) / 2 : 0);
}

function calculatePizzaPrice(pizza, prices) {
    if (!pizza || !Array.isArray(pizza.toppings) || pizza.toppings.length === 0) return 0;
    const valid = pizza.toppings.filter(t => t && t !== 'ninguno');
    if (valid.length === 0) return 0;

    if (pizza.size === 'entera') {
        if (valid.length === 1) return getPizzaPrice(valid[0], 'entera', prices);
        if (valid.length === 2) return getPizzaPrice(valid[0], 'media', prices) + getPizzaPrice(valid[1], 'media', prices);
        if (valid.length === 3) return valid.reduce((s, t) => s + getPizzaPrice(t, 'media', prices) / 2, 0);
    } else if (pizza.size === 'media') {
        if (valid.length === 1) return getPizzaPrice(valid[0], 'media', prices);
        if (valid.length === 2) return (getPizzaPrice(valid[0], 'media', prices) / 2) + (getPizzaPrice(valid[1], 'media', prices) / 2);
    }
    return 0;
}

/**
 * Convierte la lista de items de Sistema_Humboldt al objeto `order` de Sistema_mozos.
 */
function humboldtItemsToMozosOrder(items, existingOrder, prices) {
    const order = createEmptyMozosOrder();
    if (existingOrder) {
        order.menores = Number(existingOrder.menores) || 0;
        order.menorPrice = Number(existingOrder.menorPrice) || 0;
        order.menu = Number(existingOrder.menu) || 0;
        order.libreObs = existingOrder.libreObs || '';
    }

    if (!Array.isArray(items)) return order;

    for (const item of items) {
        const qty = Number(item.qty) || 0;
        if (qty <= 0) continue;

        // Rondas adicionales de pizza libre tienen precio 0 y no suman comensales extra, pero sí pueden actualizar la observación
        if (item.isLibreRound) {
            if (item.note || item.libreExclusions) {
                order.libreObs = item.note || (item.libreExclusions ? `NO QUIEREN: ${item.libreExclusions}` : order.libreObs);
            }
            continue;
        }

        if (item.isPizzaLibre) {
            const lType = item.libreType || 'G';
            if (lType === 'H') {
                order.pizzaLibreH += qty;
            } else if (lType === 'M') {
                order.pizzaLibreM += qty;
            } else {
                if ((prices?.pizzaLibreG || 0) === 0 && (prices?.pizzaLibreH || 0) > 0) {
                    order.pizzaLibreH += qty;
                } else {
                    order.pizzaLibreG += qty;
                }
            }
            if (item.note || item.libreExclusions) {
                order.libreObs = item.note || (item.libreExclusions ? `NO QUIEREN: ${item.libreExclusions}` : '');
            }
            continue;
        }

        if (item.isEmpanada || item.id === 'item_empanada' || /^empanada/i.test(item.name || '')) {
            order.empanadas += qty;
            continue;
        }

        if (item.isPostre || item.id === 'item_postre' || /^postre/i.test(item.name || '')) {
            order.postres += qty;
            continue;
        }

        if (item.isMenor) {
            order.menores += qty;
            order.menorPrice = Number(item.price) || order.menorPrice || 0;
            continue;
        }

        if (item.isMenu) {
            order.menu += qty;
            continue;
        }

        if (item.isPizza) {
            const size = item.pizzaSize === 'media' ? 'media' : 'entera';
            let toppings = Array.isArray(item.toppings) && item.toppings.length > 0 ? item.toppings : [];
            if (toppings.length === 0 && item.name) {
                const match = item.name.match(/\(([^)]+)\)/);
                if (match && !/^(entera|media)$/i.test(match[1].trim())) {
                    toppings = match[1].split(/\s+y\s+|\s*\/\s*|,\s*/).map(s => s.trim()).filter(Boolean);
                } else {
                    const cleaned = item.name
                        .replace(/^Media\s+Pizza:?\s*/i, '')
                        .replace(/^Pizza\s+(Entera|Media|\d\s*Gustos):?\s*/i, '')
                        .replace(/^Pizza:?\s*/i, '')
                        .replace(/\((Entera|Media)\)/gi, '')
                        .trim();
                    toppings = cleaned.split(/\s*\/\s*|\s+y\s+|,\s*/).map(s => s.replace(/^1\/[23]\s+/i, '').trim()).filter(Boolean);
                }
            }
            const pizzaObs = (item.note || item.obs || '').trim();
            for (let i = 0; i < qty; i++) {
                order.pizzasPersonalizadas.push({
                    id: (item.pizzaIds && item.pizzaIds[i]) ? item.pizzaIds[i] : `${item.pizzaId || Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`,
                    size,
                    toppings,
                    obs: pizzaObs
                });
            }
            continue;
        }

        // Bebidas
        const existingBev = order.beverages.find(b => b.name === item.name);
        if (existingBev) {
            existingBev.quantity += qty;
        } else {
            order.beverages.push({
                name: item.name,
                quantity: qty
            });
        }
    }

    return order;
}

/**
 * Convierte el objeto `order` de Sistema_mozos a la lista de items de Sistema_Humboldt.
 */
function mozosOrderToHumboldtItems(order, prices, currentMode = 'sabado', prevHumboldtItems = []) {
    if (!order) return [];
    const items = [];
    const p = prices || DEFAULT_MOZOS_PRICES;

    const findPrevSentQty = (matchFn, totalQty) => {
        const prev = (prevHumboldtItems || []).find(matchFn);
        if (!prev) return totalQty; // Si fue cargado desde Sistema_mozos, asumimos enviado
        return Math.min(totalQty, Number(prev.sentQty ?? prev.qty) || 0);
    };

    const findPrevLibreNote = (matchFn) => {
        const prev = (prevHumboldtItems || []).find(matchFn);
        if (prev && (prev.note || prev.libreExclusions)) {
            return {
                note: prev.note || (prev.libreExclusions ? `NO QUIEREN: ${prev.libreExclusions}` : ''),
                libreExclusions: prev.libreExclusions || ''
            };
        }
        return {
            note: order.libreObs || '',
            libreExclusions: (order.libreObs || '').replace(/^NO QUIEREN:\s*/i, '')
        };
    };

    if ((order.pizzaLibreG || 0) > 0) {
        const qty = Number(order.pizzaLibreG);
        const libreMeta = findPrevLibreNote(x => x.isPizzaLibre && (x.libreType === 'G' || !x.libreType) && !x.isLibreRound);
        items.push({
            id: 'pizza_libre_g',
            name: 'Pizza Libre General',
            price: Number(p.pizzaLibreG || p.pizzaLibreH) || 0,
            qty,
            sentQty: findPrevSentQty(x => x.isPizzaLibre && (x.libreType === 'G' || !x.libreType) && !x.isLibreRound, qty),
            isPizza: true,
            isPizzaLibre: true,
            libreType: 'G',
            libreRound: 1,
            librePersons: qty,
            libreExclusions: libreMeta.libreExclusions,
            note: libreMeta.note,
            isLibreRound: false
        });
    }

    if ((order.pizzaLibreH || 0) > 0) {
        const qty = Number(order.pizzaLibreH);
        const libreMeta = findPrevLibreNote(x => x.isPizzaLibre && x.libreType === 'H' && !x.isLibreRound);
        items.push({
            id: 'pizza_libre_h',
            name: 'Pizza Libre Hombres',
            price: Number(p.pizzaLibreH) || 0,
            qty,
            sentQty: findPrevSentQty(x => x.isPizzaLibre && x.libreType === 'H' && !x.isLibreRound, qty),
            isPizza: true,
            isPizzaLibre: true,
            libreType: 'H',
            libreRound: 1,
            librePersons: qty,
            libreExclusions: libreMeta.libreExclusions,
            note: libreMeta.note,
            isLibreRound: false
        });
    }

    if ((order.pizzaLibreM || 0) > 0) {
        const qty = Number(order.pizzaLibreM);
        const libreMeta = findPrevLibreNote(x => x.isPizzaLibre && x.libreType === 'M' && !x.isLibreRound);
        items.push({
            id: 'pizza_libre_m',
            name: 'Pizza Libre Mujeres',
            price: Number(p.pizzaLibreM) || 0,
            qty,
            sentQty: findPrevSentQty(x => x.isPizzaLibre && x.libreType === 'M' && !x.isLibreRound, qty),
            isPizza: true,
            isPizzaLibre: true,
            libreType: 'M',
            libreRound: 1,
            librePersons: qty,
            libreExclusions: libreMeta.libreExclusions,
            note: libreMeta.note,
            isLibreRound: false
        });
    }

    // Preservar marcadores de rondas adicionales de Pizza Libre si hay Pizza Libre activa
    const totalLibre = (order.pizzaLibreG || 0) + (order.pizzaLibreH || 0) + (order.pizzaLibreM || 0);
    if (totalLibre > 0 && Array.isArray(prevHumboldtItems)) {
        for (const prev of prevHumboldtItems) {
            if (prev.isLibreRound) {
                items.push({ ...prev });
            }
        }
    }

    // Pizzas personalizadas
    if (Array.isArray(order.pizzasPersonalizadas) && order.pizzasPersonalizadas.length > 0) {
        // Agrupar pizzas iguales (mismo tamaño, mismos gustos y misma observación)
        const grouped = new Map();
        for (const pz of order.pizzasPersonalizadas) {
            const size = pz.size === 'media' ? 'media' : 'entera';
            const toppings = (pz.toppings || []).filter(t => t && t !== 'ninguno');
            if (toppings.length === 0) continue;
            const obsText = (pz.obs || pz.note || '').trim();
            const key = `${size}::${toppings.join('|')}::${obsText}`;
            if (!grouped.has(key)) {
                const sizeLabel = size === 'media' ? 'Media' : 'Entera';
                let configType = 'entera';
                if (size === 'media') configType = 'media';
                else if (toppings.length === 2) configType = 'mitad';
                else if (toppings.length >= 3) configType = 'tercios';

                const displayName = size === 'entera' && toppings.length === 1
                    ? `Pizza ${toppings[0]} (Entera)`
                    : `Pizza ${sizeLabel} (${toppings.join(' / ')})`;

                grouped.set(key, {
                    id: `pizza_custom_${key}`,
                    name: displayName,
                    price: calculatePizzaPrice({ size, toppings }, p),
                    qty: 0,
                    isPizza: true,
                    isPizzaLibre: false,
                    pizzaSize: size,
                    toppings,
                    note: obsText,
                    obs: obsText,
                    pizzaConfigType: configType,
                    pizzaIds: []
                });
            }
            const g = grouped.get(key);
            g.qty += 1;
            g.pizzaIds.push(pz.id);
        }

        for (const g of grouped.values()) {
            g.sentQty = findPrevSentQty(
                x => x.isPizza && !x.isPizzaLibre && x.name === g.name && (x.note || x.obs || '') === (g.note || ''),
                g.qty
            );
            items.push(g);
        }
    }

    // Empanadas
    if ((order.empanadas || 0) > 0) {
        const qty = Number(order.empanadas);
        items.push({
            id: 'item_empanada',
            name: 'Empanadas',
            price: Number(p.empanada) || 0,
            qty,
            sentQty: findPrevSentQty(x => x.isEmpanada || x.id === 'item_empanada', qty),
            isPizza: false,
            isEmpanada: true
        });
    }

    // Postres
    if ((order.postres || 0) > 0) {
        const qty = Number(order.postres);
        items.push({
            id: 'item_postre',
            name: 'Postres',
            price: Number(p.precioPostre) || 0,
            qty,
            sentQty: findPrevSentQty(x => x.isPostre || x.id === 'item_postre', qty),
            isPizza: false,
            isPostre: true
        });
    }

    // Menores
    if ((order.menores || 0) > 0) {
        const qty = Number(order.menores);
        items.push({
            id: 'item_menor',
            name: 'Menor',
            price: Number(order.menorPrice) || 0,
            qty,
            sentQty: qty,
            isPizza: false,
            isMenor: true
        });
    }

    // Menú
    if ((order.menu || 0) > 0) {
        const qty = Number(order.menu);
        const menuPrices = {
            martes: p.precioMenuMartes || 0,
            miercoles: p.precioMenuMiercoles || 0,
            viernes: p.precioMenuViernes || 0,
            domingo: p.precioMenuDomingo || 0
        };
        items.push({
            id: 'item_menu',
            name: 'Menú del Día',
            price: Number(menuPrices[currentMode]) || 0,
            qty,
            sentQty: qty,
            isPizza: false,
            isMenu: true
        });
    }

    // Bebidas
    if (Array.isArray(order.beverages)) {
        for (const bev of order.beverages) {
            const qty = Number(bev.quantity) || 0;
            if (qty <= 0) continue;
            const bevInfo = (p.beverages || []).find(b => b.name === bev.name) || { price: 0, category: 'otro' };
            items.push({
                id: `bev_${bev.name}`,
                name: bev.name,
                price: Number(bevInfo.price) || 0,
                qty,
                sentQty: findPrevSentQty(x => x.name === bev.name && !x.isPizza, qty),
                isPizza: false,
                isBeverage: true,
                bevCategory: bevInfo.category || 'otro'
            });
        }
    }

    return items;
}

/**
 * Construye el catálogo de menú de Sistema_Humboldt a partir de los precios de Sistema_mozos.
 */
function buildMenuFromMozosPrices(prices) {
    const p = prices || DEFAULT_MOZOS_PRICES;

    const pizzaItems = [];
    // Pizza Libre General / Hombres / Mujeres
    pizzaItems.push({
        id: 'pizza_libre_g',
        name: 'Pizza Libre General',
        price: Number(p.pizzaLibreG || p.pizzaLibreH) || 0,
        desc: 'Tenedor libre de pizzas por persona',
        isPizza: true,
        isPizzaLibre: true,
        libreType: 'G'
    });
    if ((Number(p.pizzaLibreH) || 0) > 0 && Number(p.pizzaLibreH) !== Number(p.pizzaLibreG)) {
        pizzaItems.push({
            id: 'pizza_libre_h',
            name: 'Pizza Libre Hombres',
            price: Number(p.pizzaLibreH) || 0,
            desc: 'Tenedor libre de pizzas (Hombres)',
            isPizza: true,
            isPizzaLibre: true,
            libreType: 'H'
        });
    }
    if ((Number(p.pizzaLibreM) || 0) > 0 && Number(p.pizzaLibreM) !== Number(p.pizzaLibreG)) {
        pizzaItems.push({
            id: 'pizza_libre_m',
            name: 'Pizza Libre Mujeres',
            price: Number(p.pizzaLibreM) || 0,
            desc: 'Tenedor libre de pizzas (Mujeres)',
            isPizza: true,
            isPizzaLibre: true,
            libreType: 'M'
        });
    }

    // Pizzas por gusto
    (p.preciosPizzas || []).forEach((pz, idx) => {
        const entera = Number(pz.precioEntera) || 0;
        const media = Number(pz.precioMedia) || (entera ? entera / 2 : 0);
        pizzaItems.push({
            id: `pizza_flavor_${idx}`,
            name: pz.name,
            price: entera,
            precioEntera: entera,
            precioMedia: media,
            desc: `Entera: $${entera.toLocaleString('es-AR')} | Media: $${media.toLocaleString('es-AR')}`,
            isPizza: true,
            isPizzaLibre: false
        });
    });

    const empanadasYOtros = [
        {
            id: 'item_empanada',
            name: 'Empanadas',
            price: Number(p.empanada) || 0,
            desc: 'Precio por unidad (se envía a cocina)',
            isPizza: false,
            isEmpanada: true
        },
        {
            id: 'item_postre',
            name: 'Postres',
            price: Number(p.precioPostre) || 0,
            desc: 'Precio por unidad',
            isPizza: false,
            isPostre: true
        }
    ];

    const resolveBevCat = (name, category) => {
        if (category && category !== 'otro') {
            if (category === 'trago') return 'jarro';
            if (category === 'agua_saborizada' || category === 'saborizada') return 'agua';
            return category;
        }
        const n = (name || '').toLowerCase();
        if (n.includes('fernet') || n.includes('gancia') || n.includes('jarro') || n.includes('trago') || n.includes('campari') || n.includes('gin') || n.includes('vodka') || n.includes('piña') || n.includes('whisky') || n.includes('ginebra') || n.includes('medida')) return 'jarro';
        if (n.includes('agua') || n.includes('soda') || n.includes('saborizada')) return 'agua';
        if (n.includes('cerveza') || n.includes('heineken') || n.includes('pilsen') || n.includes('santa fe') || n.includes('corona') || n.includes('stella')) return 'cerveza';
        if (n.includes('vino') || n.includes('malbec') || n.includes('cabernet') || n.includes('valentin') || n.includes('latitud') || n.includes('cordero') || n.includes('alma mora') || n.includes('cosecha') || n.includes('portillo') || n.includes('salentein') || n.includes('rutini')) return 'vino';
        if (n.includes('lata') || n.includes('coca') || n.includes('sprite') || n.includes('zero') || n.includes('pepsi') || n.includes('fanta') || n.includes('gaseosa')) return 'gaseosa';
        return category || 'otro';
    };

    const bevCategoryLabels = {
        cerveza: 'Cervezas',
        gaseosa: 'Gaseosas y Saborizadas',
        agua: 'Aguas y Sodas',
        saborizada: 'Aguas y Sodas',
        jarro: 'Tragos',
        vino: 'Vinos',
        otro: 'Otras Bebidas'
    };

    const bebidasItems = (p.beverages || []).map((b, idx) => {
        const catId = resolveBevCat(b.name, b.category);
        return {
            id: `bev_${idx}`,
            name: b.name,
            price: Number(b.price) || 0,
            desc: bevCategoryLabels[catId] || 'Otras Bebidas',
            isPizza: false,
            isBeverage: true,
            bevCategory: catId
        };
    });

    return [
        {
            id: 'pizzas',
            title: 'Pizzas y Pizza Libre',
            icon: 'fa-pizza-slice',
            items: pizzaItems
        },
        {
            id: 'empanadas_postres',
            title: 'Empanadas y Postres',
            icon: 'fa-utensils',
            items: empanadasYOtros
        },
        {
            id: 'bebidas',
            title: 'Bebidas',
            icon: 'fa-wine-glass',
            items: bebidasItems
        }
    ];
}

let isInitialized = false;

async function initializeDatabase() {
    if (isInitialized) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Configuración compartida de Sistema_mozos y Sistema_Humboldt
        await client.query(`
            CREATE TABLE IF NOT EXISTS rivera_mozos_config (
                key VARCHAR(100) PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Mesas compartidas entre Sistema_mozos y Sistema_Humboldt
        await client.query(`
            CREATE TABLE IF NOT EXISTS rivera_tables (
                table_number VARCHAR(50) PRIMARY KEY,
                table_data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Estado sincronizado de sistema_pedidos (cola de espera, cocina, libres, precios llevar, historial)
        await client.query(`
            CREATE TABLE IF NOT EXISTS rivera_pedidos_state (
                key VARCHAR(100) PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Tablas auxiliares de Sistema_Humboldt (staff, pagos, cierres, config)
        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_staff (
                id SERIAL PRIMARY KEY,
                name VARCHAR(150) UNIQUE NOT NULL,
                active BOOLEAN DEFAULT true
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_payment_history (
                id SERIAL PRIMARY KEY,
                table_name VARCHAR(50) NOT NULL,
                waiter_name VARCHAR(150),
                payment_method VARCHAR(50) NOT NULL,
                subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
                tip_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                transfer_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
                total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
                items_json JSONB NOT NULL DEFAULT '[]',
                paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pos_night_reports (
                id SERIAL PRIMARY KEY,
                closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_orders INTEGER NOT NULL DEFAULT 0,
                total_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
                total_cash NUMERIC(14, 2) NOT NULL DEFAULT 0,
                total_transfer NUMERIC(14, 2) NOT NULL DEFAULT 0,
                total_tips NUMERIC(14, 2) NOT NULL DEFAULT 0,
                summary_json JSONB NOT NULL DEFAULT '{}'
            );
        `);

        // Inicializar claves de estructura en rivera_mozos_config solo si no existen en la BDD
        const pricesRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'prices'`);
        if (pricesRes.rowCount === 0) {
            await client.query(
                `INSERT INTO rivera_mozos_config (key, value) VALUES ('prices', $1::jsonb)`,
                [JSON.stringify(DEFAULT_MOZOS_PRICES)]
            );
        }

        const genericRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'genericData'`);
        if (genericRes.rowCount === 0) {
            await client.query(
                `INSERT INTO rivera_mozos_config (key, value) VALUES ('genericData', $1::jsonb)`,
                [JSON.stringify(DEFAULT_GENERIC_DATA)]
            );
        }

        const modeRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'currentMode'`);
        if (modeRes.rowCount === 0) {
            await client.query(
                `INSERT INTO rivera_mozos_config (key, value) VALUES ('currentMode', $1::jsonb)`,
                [JSON.stringify('sabado')]
            );
        }

        const barRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'barOrders'`);
        if (barRes.rowCount === 0) {
            await client.query(
                `INSERT INTO rivera_mozos_config (key, value) VALUES ('barOrders', '[]'::jsonb)`
            );
        }

        const archRes = await client.query(`SELECT value FROM rivera_mozos_config WHERE key = 'archivedSales'`);
        if (archRes.rowCount === 0) {
            await client.query(
                `INSERT INTO rivera_mozos_config (key, value) VALUES ('archivedSales', '[]'::jsonb)`
            );
        }

        // Inicializar claves de estructura en rivera_pedidos_state solo si no existen en la BDD
        const pedKeys = [
            ['orders', []],
            ['libres', []],
            ['prices', DEFAULT_PEDIDOS_PRICES],
            ['history', []]
        ];
        for (const [k, defVal] of pedKeys) {
            const r = await client.query(`SELECT key FROM rivera_pedidos_state WHERE key = $1`, [k]);
            if (r.rowCount === 0) {
                await client.query(
                    `INSERT INTO rivera_pedidos_state (key, value) VALUES ($1, $2::jsonb)`,
                    [k, JSON.stringify(defVal)]
                );
            }
        }

        // Inicializar configuración base en pos_config
        const passRes = await client.query(`SELECT value FROM pos_config WHERE key = 'admin_password'`);
        if (passRes.rowCount === 0) {
            await client.query(`INSERT INTO pos_config (key, value) VALUES ('admin_password', '1234')`);
        }
        const tipPoolRes = await client.query(`SELECT value FROM pos_config WHERE key = 'general_tips_pool'`);
        if (tipPoolRes.rowCount === 0) {
            await client.query(`INSERT INTO pos_config (key, value) VALUES ('general_tips_pool', '0')`);
        }

        await client.query('COMMIT');
        isInitialized = true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error inicializando base de datos:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    pool,
    initializeDatabase,
    DEFAULT_MOZOS_PRICES,
    DEFAULT_GENERIC_DATA,
    DEFAULT_PEDIDOS_PRICES,
    createEmptyMozosOrder,
    getPizzaPrice,
    calculatePizzaPrice,
    humboldtItemsToMozosOrder,
    mozosOrderToHumboldtItems,
    buildMenuFromMozosPrices
};
