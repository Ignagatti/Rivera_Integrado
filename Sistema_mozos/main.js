const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Cargar variables de entorno (.env en desarrollo o empaquetado en resources)
const envPaths = [
  path.join(__dirname, '.env'),
  process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
  process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', '.env') : null
].filter(Boolean);

for (const envPath of envPaths) {
  if (fsSync.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

function getCleanConnectionString(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('channel_binding');
    return parsed.toString();
  } catch (e) {
    return rawUrl;
  }
}

const connectionString = getCleanConnectionString(process.env.DATABASE_URL);
const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Error en pool PostgreSQL (Sistema_mozos):', err.message);
  });
}

let isSavingToDb = false;
let lastDbSnapshotHash = '';
let pollInterval = null;

function calculatePizzaPrice(pizza, prices) {
  const catalog = Array.isArray(prices?.preciosPizzas) ? prices.preciosPizzas : [];
  const getPizzaPriceObj = (name) =>
    catalog.find(p => p.name.toLowerCase() === String(name).toLowerCase());

  if (!pizza || !Array.isArray(pizza.toppings) || pizza.toppings.length === 0) return 0;

  if (pizza.size === 'entera') {
    if (pizza.toppings.length === 1) {
      const p1 = getPizzaPriceObj(pizza.toppings[0]);
      return p1 ? Number(p1.precioEntera) || 0 : 0;
    }
    if (pizza.toppings.length === 2) {
      const p1 = getPizzaPriceObj(pizza.toppings[0]);
      const p2 = getPizzaPriceObj(pizza.toppings[1]);
      return (p1 ? Number(p1.precioMedia) || 0 : 0) + (p2 ? Number(p2.precioMedia) || 0 : 0);
    }
    if (pizza.toppings.length === 3) {
      const p1 = getPizzaPriceObj(pizza.toppings[0]);
      const p2 = getPizzaPriceObj(pizza.toppings[1]);
      const p3 = getPizzaPriceObj(pizza.toppings[2]);
      const sumMedias =
        (p1 ? Number(p1.precioMedia) || 0 : 0) +
        (p2 ? Number(p2.precioMedia) || 0 : 0) +
        (p3 ? Number(p3.precioMedia) || 0 : 0);
      return sumMedias / 2;
    }
  } else if (pizza.size === 'media') {
    if (pizza.toppings.length === 1) {
      const p1 = getPizzaPriceObj(pizza.toppings[0]);
      return p1 ? Number(p1.precioMedia) || 0 : 0;
    }
    if (pizza.toppings.length === 2) {
      const p1 = getPizzaPriceObj(pizza.toppings[0]);
      const p2 = getPizzaPriceObj(pizza.toppings[1]);
      return ((p1 ? Number(p1.precioMedia) || 0 : 0) + (p2 ? Number(p2.precioMedia) || 0 : 0)) / 2;
    }
  }
  return 0;
}

function mozosOrderToHumboldtItems(order, prices, existingHumboldtItems = []) {
  if (!order) return [];
  const items = [];
  const prevList = Array.isArray(existingHumboldtItems) ? existingHumboldtItems : [];
  const findPrev = (predicate) => prevList.find(predicate);
  const libreNote = order.libreObs || '';

  if ((order.pizzaLibreG || 0) > 0) {
    const prev = findPrev(i => i.isPizzaLibre && (i.libreType === 'G' || !i.libreType));
    const qty = Number(order.pizzaLibreG);
    items.push({
      id: 'pizza_libre_g',
      name: 'Pizza Libre General',
      price: Number(prices?.pizzaLibreG || prices?.pizzaLibreH) || 0,
      qty,
      sentQty: prev ? Math.min(qty, Number(prev.sentQty ?? qty)) : qty,
      note: libreNote || prev?.note || '',
      isPizza: true,
      isPizzaLibre: true,
      libreType: 'G'
    });
  }
  if ((order.pizzaLibreH || 0) > 0) {
    const prev = findPrev(i => i.isPizzaLibre && i.libreType === 'H');
    const qty = Number(order.pizzaLibreH);
    items.push({
      id: 'pizza_libre_h',
      name: 'Pizza Libre Hombres',
      price: Number(prices?.pizzaLibreH) || 0,
      qty,
      sentQty: prev ? Math.min(qty, Number(prev.sentQty ?? qty)) : qty,
      note: libreNote || prev?.note || '',
      isPizza: true,
      isPizzaLibre: true,
      libreType: 'H'
    });
  }
  if ((order.pizzaLibreM || 0) > 0) {
    const prev = findPrev(i => i.isPizzaLibre && i.libreType === 'M');
    const qty = Number(order.pizzaLibreM);
    items.push({
      id: 'pizza_libre_m',
      name: 'Pizza Libre Mujeres',
      price: Number(prices?.pizzaLibreM) || 0,
      qty,
      sentQty: prev ? Math.min(qty, Number(prev.sentQty ?? qty)) : qty,
      note: libreNote || prev?.note || '',
      isPizza: true,
      isPizzaLibre: true,
      libreType: 'M'
    });
  }

  if (Array.isArray(order.pizzasPersonalizadas)) {
    const grouped = new Map();
    for (const pz of order.pizzasPersonalizadas) {
      const size = pz.size === 'media' ? 'media' : 'entera';
      const toppings = Array.isArray(pz.toppings) ? pz.toppings.filter(t => t && t !== 'ninguno') : ['Muzzarella'];
      const pzObs = String(pz.obs || '').trim();
      const key = `${size}:${toppings.join('|')}:${pzObs}`;
      const unitPrice = calculatePizzaPrice({ size, toppings }, prices);
      if (grouped.has(key)) {
        grouped.get(key).qty += 1;
        grouped.get(key).sentQty += 1;
      } else {
        const sizeLabel = size === 'media' ? 'Media Pizza' : 'Pizza Entera';
        grouped.set(key, {
          id: `pizza_${size}_${toppings.join('_')}`,
          name: `${sizeLabel} (${toppings.join(' / ')})`,
          price: unitPrice,
          qty: 1,
          sentQty: 1,
          note: pzObs,
          isPizza: true,
          isPizzaLibre: false,
          pizzaSize: size,
          pizzaConfigType: size === 'media' ? 'media' : `${toppings.length}_flavors`,
          toppings
        });
      }
    }
    for (const val of grouped.values()) {
      const prev = findPrev(
        i => i.isPizza && !i.isPizzaLibre && i.name === val.name && (i.note || '') === (val.note || '')
      );
      if (prev) {
        val.sentQty = Math.min(val.qty, Number(prev.sentQty ?? val.qty));
      }
      items.push(val);
    }
  }

  if ((order.empanadas || 0) > 0) {
    const prev = findPrev(i => i.isEmpanada || i.id === 'item_empanada');
    const qty = Number(order.empanadas);
    items.push({
      id: 'item_empanada',
      name: 'Empanada',
      price: Number(prices?.empanada) || 0,
      qty,
      sentQty: prev ? Math.min(qty, Number(prev.sentQty ?? qty)) : qty,
      isEmpanada: true
    });
  }

  if ((order.postres || 0) > 0) {
    const prev = findPrev(i => i.isPostre || i.id === 'item_postre');
    const qty = Number(order.postres);
    items.push({
      id: 'item_postre',
      name: 'Postre',
      price: Number(prices?.precioPostre) || 0,
      qty,
      sentQty: prev ? Math.min(qty, Number(prev.sentQty ?? qty)) : qty,
      isPostre: true
    });
  }

  if (Array.isArray(order.beverages)) {
    for (const bev of order.beverages) {
      const q = Number(bev.quantity) || 0;
      if (q <= 0) continue;
      const pInfo = (prices?.beverages || []).find(
        b => b.name.toLowerCase() === String(bev.name).toLowerCase()
      );
      const prev = findPrev(i => i.isBeverage && String(i.name).toLowerCase() === String(bev.name).toLowerCase());
      items.push({
        id: `bev_${bev.name}`,
        name: bev.name,
        price: pInfo ? Number(pInfo.price) || 0 : 0,
        qty: q,
        sentQty: prev ? Math.min(q, Number(prev.sentQty ?? q)) : q,
        isBeverage: true
      });
    }
  }

  // Conservar rondas adicionales de Pizza Libre
  for (const prevItem of prevList) {
    if (prevItem.isLibreRound) {
      items.push(prevItem);
    }
  }

  return items;
}

async function fetchDbState() {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rivera_mozos_config (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rivera_tables (
        table_number VARCHAR(50) PRIMARY KEY,
        table_data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS rivera_pedidos_state (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const cfgRes = await client.query(`SELECT key, value FROM rivera_mozos_config`);
    const cfg = {};
    for (const r of cfgRes.rows) {
      cfg[r.key] = r.value;
    }

    const tablesRes = await client.query(`SELECT table_number, table_data FROM rivera_tables`);
    const sortedRows = tablesRes.rows.sort((a, b) => {
      const na = parseInt(a.table_number, 10);
      const nb = parseInt(b.table_number, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a.table_number).localeCompare(String(b.table_number));
    });

    const tables = sortedRows.map((row, idx) => {
      const td = row.table_data || {};
      const col = idx % 5;
      const rIdx = Math.floor(idx / 5);
      return {
        id: td.id || `table-${row.table_number}`,
        number: String(td.number || row.table_number),
        x: td.x !== undefined ? td.x : 40 + col * 130,
        y: td.y !== undefined ? td.y : 40 + rIdx * 130,
        width: td.width || 100,
        height: td.height || 100,
        isPaid: !!td.isPaid,
        paidAmount: Number(td.paidAmount) || 0,
        tipAmount: Number(td.tipAmount) || 0,
        waiterName: td.waiterName || 'Sin asignar',
        note: td.note || '',
        libreRounds: Number(td.libreRounds) || 1,
        order: td.order ? {
          libreObs: td.order.libreObs || td.note || '',
          ...td.order
        } : {
          pizzaLibreH: 0, pizzaLibreM: 0, pizzaLibreG: 0,
          menores: 0, menorPrice: 0,
          empanadas: 0, postres: 0, menu: 0,
          libreObs: td.note || '',
          beverages: [], pizzasPersonalizadas: []
        }
      };
    });

    const result = {
      tables,
      barOrders: Array.isArray(cfg.barOrders) ? cfg.barOrders : null,
      prices: cfg.prices || null,
      currentMode: cfg.currentMode || null,
      genericData: cfg.genericData || null,
      numeroCocina: cfg.numeroCocina || null,
      archivedSales: Array.isArray(cfg.archivedSales) ? cfg.archivedSales : []
    };

    return result;
  } finally {
    client.release();
  }
}

async function pollRemoteMozosState() {
  if (!pool || isSavingToDb) return;
  try {
    const remote = await fetchDbState();
    if (!remote) return;
    const hash = JSON.stringify({
      tables: remote.tables,
      barOrders: remote.barOrders,
      prices: remote.prices,
      currentMode: remote.currentMode,
      genericData: remote.genericData,
      archivedSales: remote.archivedSales
    });

    if (hash !== lastDbSnapshotHash) {
      lastDbSnapshotHash = hash;
      BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
          w.webContents.send('db:remote-update', remote);
        }
      });
    }
  } catch (err) {
    // Ignorar errores transitorios de red durante polling
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'logo_rivera.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  const backupPath = path.join(app.getPath('userData'), 'backup.json');

  ipcMain.on('save-backup', async (event, data) => {
    try {
      await fs.writeFile(backupPath, data, 'utf-8');
    } catch (err) {
      console.error('Failed to save backup:', err);
    }
  });

  ipcMain.handle('load-backup', async () => {
    try {
      return await fs.readFile(backupPath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      console.error('Failed to load backup:', err);
      return null;
    }
  });

  ipcMain.handle('db:load-state', async () => {
    try {
      const state = await fetchDbState();
      if (state) {
        lastDbSnapshotHash = JSON.stringify({
          tables: state.tables,
          barOrders: state.barOrders,
          prices: state.prices,
          currentMode: state.currentMode,
          genericData: state.genericData,
          archivedSales: state.archivedSales
        });
      }
      return state;
    } catch (err) {
      console.error('Error en db:load-state:', err.message);
      return null;
    }
  });

  ipcMain.handle('db:save-state', async (event, stateObj) => {
    if (!pool || !stateObj) return { success: false };
    isSavingToDb = true;
    const client = await pool.connect().catch(() => null);
    if (!client) {
      isSavingToDb = false;
      return { success: false };
    }

    try {
      await client.query('BEGIN');

      const configEntries = [
        ['prices', stateObj.prices],
        ['genericData', stateObj.genericData],
        ['currentMode', stateObj.currentMode],
        ['barOrders', stateObj.barOrders || []],
        ['archivedSales', stateObj.archivedSales || []],
        ['numeroCocina', stateObj.numeroCocina || '']
      ];

      for (const [k, v] of configEntries) {
        if (v !== undefined) {
          await client.query(
            `INSERT INTO rivera_mozos_config (key, value, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [k, JSON.stringify(v)]
          );
        }
      }

      if (Array.isArray(stateObj.tables)) {
        const existingRes = await client.query(`SELECT table_number, table_data FROM rivera_tables FOR UPDATE`);
        const existingMap = new Map();
        for (const r of existingRes.rows) {
          existingMap.set(String(r.table_number), r.table_data || {});
        }

        const incomingNums = new Set();
        let anyTableHasItems = false;

        for (const t of stateObj.tables) {
          const tNum = String(t.number).trim();
          incomingNums.add(tNum);
          const prevData = existingMap.get(tNum) || {};
          const humboldtItems = mozosOrderToHumboldtItems(t.order, stateObj.prices, prevData.humboldtItems || []);
          if (humboldtItems.length > 0 || t.isPaid) anyTableHasItems = true;

          const tableNote = humboldtItems.length > 0
            ? (t.order?.libreObs || t.note || prevData.note || '')
            : '';

          const mergedTableData = {
            ...prevData,
            id: t.id || prevData.id || `table-${tNum}`,
            number: tNum,
            x: t.x,
            y: t.y,
            width: t.width,
            height: t.height,
            isPaid: !!t.isPaid,
            paidAmount: Number(t.paidAmount) || 0,
            tipAmount: Number(t.tipAmount) || 0,
            waiterName: t.waiterName || prevData.waiterName || 'Sin asignar',
            note: tableNote,
            libreRounds: humboldtItems.length > 0 ? (t.libreRounds || prevData.libreRounds || 1) : 1,
            order: t.order,
            humboldtItems,
            lastUpdatedBy: 'mozos'
          };

          await client.query(
            `INSERT INTO rivera_tables (table_number, table_data, updated_at)
             VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
             ON CONFLICT (table_number)
             DO UPDATE SET table_data = EXCLUDED.table_data, updated_at = CURRENT_TIMESTAMP`,
            [tNum, JSON.stringify(mergedTableData)]
          );
        }

        // Eliminar mesas que fueron borradas en Sistema_mozos
        for (const oldNum of existingMap.keys()) {
          if (!incomingNums.has(oldNum)) {
            await client.query(`DELETE FROM rivera_tables WHERE table_number = $1`, [oldNum]);
          }
        }

        // Si se limpiaron todas las mesas y las ventas archivadas (cambio de día / limpiar todo),
        // reiniciar también el historial de cobros y pozo de propinas de Humboldt POS
        const archivedEmpty = !Array.isArray(stateObj.archivedSales) || stateObj.archivedSales.length === 0;
        const barEmpty = !Array.isArray(stateObj.barOrders) || stateObj.barOrders.every(b => !b.isPaid && (!b.order || mozosOrderToHumboldtItems(b.order, stateObj.prices).length === 0));
        if (!anyTableHasItems && archivedEmpty && barEmpty) {
          await client.query(`DELETE FROM pos_payment_history`).catch(() => {});
          await client.query(`UPDATE pos_config SET value = '0' WHERE key = 'general_tips_pool'`).catch(() => {});
        }
      }

      await client.query('COMMIT');

      lastDbSnapshotHash = JSON.stringify({
        tables: stateObj.tables,
        barOrders: stateObj.barOrders,
        prices: stateObj.prices,
        currentMode: stateObj.currentMode,
        genericData: stateObj.genericData,
        archivedSales: stateObj.archivedSales || []
      });

      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Error en db:save-state:', err.message);
      return { success: false, error: err.message };
    } finally {
      client.release();
      isSavingToDb = false;
    }
  });

  // Enviar pizzas y empanadas agregadas desde Sistema_mozos a la cola de espera de sistema_pedidos
  ipcMain.handle('db:send-table-to-pedidos', async (event, { tableNumber, oldOrder, newOrder, prices }) => {
    if (!pool || !newOrder) return { success: false };
    const client = await pool.connect().catch(() => null);
    if (!client) return { success: false };

    try {
      await client.query('BEGIN');

      const formattedClient = /^mesa\s+/i.test(String(tableNumber))
        ? String(tableNumber)
        : `Mesa ${tableNumber}`;
      const nowTime = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dEmp = Math.max(0, (Number(newOrder.empanadas) || 0) - (Number(oldOrder?.empanadas) || 0));
      const oldPizzaIds = new Set((oldOrder?.pizzasPersonalizadas || []).map(p => p.id));
      const addedPizzas = (newOrder.pizzasPersonalizadas || []).filter(p => !oldPizzaIds.has(p.id));

      const pedidosPizzas = addedPizzas.map(pz => {
        const isMedia = pz.size === 'media';
        const toppings = Array.isArray(pz.toppings) ? pz.toppings.filter(t => t && t !== 'ninguno') : ['Muzzarella'];
        const flavorText = toppings.length === 1
          ? toppings[0]
          : toppings.length === 2
            ? toppings.join(' y ')
            : `${toppings.slice(0, -1).join(', ')} y ${toppings[toppings.length - 1]}`;
        const desc = isMedia ? `Media ${flavorText}` : flavorText;
        const unitPrice = calculatePizzaPrice(pz, prices);
        return {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          description: desc,
          qty: 1,
          type: isMedia ? 'mitad' : 'entera',
          flavors: toppings,
          price: unitPrice,
          unitPrice,
          boxPrice: 0,
          obs: String(pz.obs || '').trim(),
          withBox: false
        };
      });

      if (pedidosPizzas.length > 0 || dEmp > 0) {
        const ordersRes = await client.query(
          `SELECT value FROM rivera_pedidos_state WHERE key = 'orders' FOR UPDATE`
        );
        const currentOrders = (ordersRes.rowCount > 0 && Array.isArray(ordersRes.rows[0].value))
          ? ordersRes.rows[0].value
          : [];

        currentOrders.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          client: formattedClient,
          destination: 'salon',
          pizzas: pedidosPizzas,
          drinks: [],
          empanadas: dEmp,
          timestamp: nowTime,
          date: todayStr,
          type: 'normal',
          totalPrice: 0,
          inKitchen: false,
          orderNumber: null,
          obs: String(newOrder.libreObs || '').trim(),
          fromWaiter: true
        });

        await client.query(
          `INSERT INTO rivera_pedidos_state (key, value, updated_at)
           VALUES ('orders', $1::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(currentOrders)]
        );
      }

      const oldLibre = (Number(oldOrder?.pizzaLibreG) || 0) + (Number(oldOrder?.pizzaLibreH) || 0) + (Number(oldOrder?.pizzaLibreM) || 0);
      const newLibre = (Number(newOrder.pizzaLibreG) || 0) + (Number(newOrder.pizzaLibreH) || 0) + (Number(newOrder.pizzaLibreM) || 0);
      const libreObsChanged = (newOrder.libreObs || '') !== (oldOrder?.libreObs || '');

      if (newLibre > oldLibre || (newLibre > 0 && libreObsChanged)) {
        const libresRes = await client.query(
          `SELECT value FROM rivera_pedidos_state WHERE key = 'libres' FOR UPDATE`
        );
        const currentLibres = (libresRes.rowCount > 0 && Array.isArray(libresRes.rows[0].value))
          ? libresRes.rows[0].value
          : [];

        const existingIdx = currentLibres.findIndex(
          l => String(l.client).toLowerCase() === formattedClient.toLowerCase()
        );
        const libreObsStr = String(newOrder.libreObs || '').trim();
        if (existingIdx !== -1) {
          currentLibres[existingIdx].people = newLibre;
          currentLibres[existingIdx].status = 'esperando';
          if (libreObsStr) currentLibres[existingIdx].obs = libreObsStr;
        } else {
          currentLibres.push({
            id: `libre_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            client: formattedClient,
            people: newLibre,
            pricePerPerson: 0,
            totalPrice: 0,
            round: 1,
            status: 'esperando',
            timestamp: nowTime,
            date: todayStr,
            obs: libreObsStr
          });
        }

        await client.query(
          `INSERT INTO rivera_pedidos_state (key, value, updated_at)
           VALUES ('libres', $1::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(currentLibres)]
        );
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Error en db:send-table-to-pedidos:', err.message);
      return { success: false };
    } finally {
      client.release();
    }
  });

  ipcMain.handle('save-pdf', async (event, { html, defaultFilename }) => {
    let pdfWin = null;
    try {
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Descargar Reporte de Ventas (PDF)',
        defaultPath: defaultFilename || `Reporte-Ventas-${new Date().toISOString().slice(0, 10)}.pdf`,
        filters: [
          { name: 'Documento PDF (*.pdf)', extensions: ['pdf'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      pdfWin = new BrowserWindow({
        show: false,
        width: 1000,
        height: 1400,
        webPreferences: {
          sandbox: true
        }
      });

      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise(resolve => setTimeout(resolve, 350));

      const pdfBuffer = await pdfWin.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: {
          top: 0.3,
          bottom: 0.3,
          left: 0.3,
          right: 0.3
        }
      });

      await fs.writeFile(filePath, pdfBuffer);
      return { success: true, filePath };
    } catch (err) {
      console.error('Error al generar PDF:', err);
      return { success: false, error: err.message };
    } finally {
      if (pdfWin) {
        pdfWin.destroy();
      }
    }
  });

  ipcMain.on('show-item-in-folder', (event, filePath) => {
    if (filePath) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.on('open-external-link', (event, url) => {
    if (url.startsWith('whatsapp://')) {
      shell.openExternal(url);
    }
  });

  createWindow();

  if (pool) {
    pollInterval = setInterval(pollRemoteMozosState, 2000);
  }
});

app.on('window-all-closed', () => {
  if (pollInterval) clearInterval(pollInterval);
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
