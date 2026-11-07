const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
        console.error('Error en pool PostgreSQL (sistema_pedidos):', err.message);
    });
}

// Rutas de archivos locales (respaldo offline y backups)
const DATA_PATH = app.getPath('userData');
const BACKUP_PATH = path.join(DATA_PATH, 'backups');

const FILES = {
    orders:  path.join(DATA_PATH, 'orders.json'),
    libres:  path.join(DATA_PATH, 'libres.json'),
    prices:  path.join(DATA_PATH, 'prices.json'),
    history: path.join(DATA_PATH, 'history.json')
};

// Control de sincronización con Neon DB
const knownOrderIds = new Set();
const knownLibreMap = new Map();
const lastSyncHashes = {
    orders: '',
    libres: '',
    prices: '',
    history: ''
};
let isWritingToDb = false;
let dbPollingTimer = null;

async function ensureBackupDir() {
    try { await fs.mkdir(BACKUP_PATH, { recursive: true }); } catch (_) {}
}

async function readJSON(filePath, defaultValue) {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return defaultValue;
    }
}

async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error(`Error escribiendo ${filePath}:`, err);
        return false;
    }
}

async function writeBackup(key, data) {
    if (!['orders', 'libres', 'history'].includes(key)) return;
    try {
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        const backupFile = path.join(BACKUP_PATH, `${key}_${stamp}.json`);
        try { await fs.access(backupFile); } catch (_) {
            await fs.writeFile(backupFile, JSON.stringify(data, null, 2), 'utf-8');
            await cleanOldBackups(key);
        }
    } catch (err) {
        console.error('Error escribiendo backup:', err);
    }
}

async function cleanOldBackups(key) {
    try {
        const files = (await fs.readdir(BACKUP_PATH))
            .filter(f => f.startsWith(`${key}_`) && f.endsWith('.json'))
            .sort();
        if (files.length > 10) {
            const toDelete = files.slice(0, files.length - 10);
            await Promise.all(toDelete.map(f => fs.unlink(path.join(BACKUP_PATH, f)).catch(() => {})));
        }
    } catch (_) {}
}

async function writeFullBackup() {
    try {
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
        const [orders, libres, prices, history] = await Promise.all([
            readJSON(FILES.orders, []),
            readJSON(FILES.libres, []),
            readJSON(FILES.prices, {}),
            readJSON(FILES.history, [])
        ]);
        const fullBackupFile = path.join(BACKUP_PATH, `full_backup_${stamp}.json`);
        await fs.writeFile(fullBackupFile, JSON.stringify({ orders, libres, prices, history }, null, 2), 'utf-8');
        const fullFiles = (await fs.readdir(BACKUP_PATH))
            .filter(f => f.startsWith('full_backup_'))
            .sort();
        if (fullFiles.length > 5) {
            const toDelete = fullFiles.slice(0, fullFiles.length - 5);
            await Promise.all(toDelete.map(f => fs.unlink(path.join(BACKUP_PATH, f)).catch(() => {})));
        }
    } catch (err) {
        console.error('Error en backup completo:', err);
    }
}

function hasConfiguredPrices(p) {
    if (!p || typeof p !== 'object') return false;
    if (Number(p.box) > 0 || Number(p.empanada) > 0 || Number(p.pizzaLibreH) > 0) return true;
    if (p.flavors && Object.values(p.flavors).some(f => Number(f?.entera) > 0 || Number(f?.media) > 0)) return true;
    if (p.drinks && Object.values(p.drinks).some(v => Number(v) > 0)) return true;
    return false;
}

function recordKnownOrders(orders) {
    if (!Array.isArray(orders)) return;
    for (const o of orders) {
        if (o && o.id) knownOrderIds.add(o.id);
    }
}

function recordKnownLibres(libres) {
    if (!Array.isArray(libres)) return;
    for (const l of libres) {
        if (l && l.id) {
            knownLibreMap.set(l.id, Number(l.round) || 1);
        }
    }
}

async function initAndLoadFromDatabase(localState) {
    if (!pool) return localState;
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS rivera_pedidos_state (
                key VARCHAR(100) PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        const res = await client.query(`SELECT key, value FROM rivera_pedidos_state`);
        const dbMap = {};
        for (const row of res.rows) {
            dbMap[row.key] = row.value;
        }

        const finalState = {
            orders: Array.isArray(dbMap.orders) ? dbMap.orders : localState.orders,
            libres: Array.isArray(dbMap.libres) ? dbMap.libres : localState.libres,
            prices: dbMap.prices || localState.prices,
            history: Array.isArray(dbMap.history) ? dbMap.history : localState.history
        };

        // Si la lista de precios Para Llevar local tiene precios configurados y la BDD está en 0, preservar la local y subirla
        if (!hasConfiguredPrices(dbMap.prices) && hasConfiguredPrices(localState.prices)) {
            finalState.prices = localState.prices;
        }

        for (const k of ['orders', 'libres', 'prices', 'history']) {
            if (dbMap[k] === undefined || (k === 'prices' && finalState.prices === localState.prices)) {
                await client.query(
                    `INSERT INTO rivera_pedidos_state (key, value, updated_at)
                     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                    [k, JSON.stringify(finalState[k])]
                );
            }
            lastSyncHashes[k] = JSON.stringify(finalState[k]);
            await writeJSON(FILES[k], finalState[k]);
        }

        recordKnownOrders(finalState.orders);
        recordKnownLibres(finalState.libres);

        return finalState;
    } catch (err) {
        console.error('Error cargando estado inicial desde Neon DB (usando respaldo local):', err.message);
        return localState;
    } finally {
        client.release();
    }
}

async function pollRemotePedidosState() {
    if (!pool || isWritingToDb) return;
    try {
        const res = await pool.query(`SELECT key, value FROM rivera_pedidos_state`);
        for (const row of res.rows) {
            const { key, value } = row;
            if (!FILES[key]) continue;

            const serialized = JSON.stringify(value);
            if (serialized !== lastSyncHashes[key]) {
                lastSyncHashes[key] = serialized;
                if (key === 'orders') recordKnownOrders(value);
                if (key === 'libres') recordKnownLibres(value);
                await writeJSON(FILES[key], value);
                BrowserWindow.getAllWindows().forEach(w => {
                    if (!w.isDestroyed()) {
                        w.webContents.send('storage:update', { key, value });
                    }
                });
            }
        }
    } catch (err) {
        // Ignorar errores transitorios de red durante el polling
    }
}

function createWindow() {
    const iconPath = path.join(__dirname, 'icono.ico');
    const win = new BrowserWindow({
        width: 1280,
        height: 900,
        title: "Sistema Club de Bochas",
        autoHideMenuBar: true,
        ...(fsSync.existsSync(iconPath) && { icon: iconPath }),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    win.loadFile('index.html');
}

// IPC Handlers
ipcMain.handle('window:new', () => {
    createWindow();
    return true;
});

ipcMain.handle('storage:loadInitial', async () => {
    const [orders, libres, prices, history] = await Promise.all([
        readJSON(FILES.orders, []),
        readJSON(FILES.libres, []),
        readJSON(FILES.prices, {}),
        readJSON(FILES.history, [])
    ]);
    const localState = { orders, libres, prices, history };
    return await initAndLoadFromDatabase(localState);
});

ipcMain.handle('storage:set', async (event, { key, value }) => {
    if (!FILES[key]) return false;

    let finalValue = value;

    if (pool) {
        isWritingToDb = true;
        const client = await pool.connect().catch(() => null);
        if (client) {
            try {
                await client.query('BEGIN');

                // Si se están guardando `orders`, preservar cualquier comanda nueva enviada por un mozo desde Humboldt/Mozos que aún no haya sido vista
                if (key === 'orders' && Array.isArray(value)) {
                    const dbRes = await client.query(
                        `SELECT value FROM rivera_pedidos_state WHERE key = 'orders' FOR UPDATE`
                    );
                    if (dbRes.rowCount > 0 && Array.isArray(dbRes.rows[0].value)) {
                        const dbOrders = dbRes.rows[0].value;
                        const currentIds = new Set(value.map(o => o.id));
                        const unseenWaiterOrders = dbOrders.filter(
                            dbo => dbo && dbo.id && dbo.fromWaiter && !knownOrderIds.has(dbo.id) && !currentIds.has(dbo.id)
                        );
                        if (unseenWaiterOrders.length > 0) {
                            finalValue = [...value, ...unseenWaiterOrders];
                        }
                    }
                    recordKnownOrders(finalValue);
                } else if (key === 'libres' && Array.isArray(value)) {
                    const dbRes = await client.query(
                        `SELECT value FROM rivera_pedidos_state WHERE key = 'libres' FOR UPDATE`
                    );
                    if (dbRes.rowCount > 0 && Array.isArray(dbRes.rows[0].value)) {
                        const dbLibres = dbRes.rows[0].value;
                        const currentIds = new Set(value.map(l => l.id));
                        const unseenLibres = dbLibres.filter(
                            dbl => dbl && dbl.id && !knownLibreMap.has(dbl.id) && !currentIds.has(dbl.id)
                        );
                        if (unseenLibres.length > 0) {
                            finalValue = [...value, ...unseenLibres];
                        }
                    }
                    recordKnownLibres(finalValue);
                }

                await client.query(
                    `INSERT INTO rivera_pedidos_state (key, value, updated_at)
                     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                    [key, JSON.stringify(finalValue)]
                );

                await client.query('COMMIT');
                lastSyncHashes[key] = JSON.stringify(finalValue);
            } catch (err) {
                await client.query('ROLLBACK').catch(() => {});
                console.error(`Error sincronizando ${key} con Neon DB:`, err.message);
            } finally {
                client.release();
                isWritingToDb = false;
            }
        } else {
            isWritingToDb = false;
        }
    }

    const success = await writeJSON(FILES[key], finalValue);
    writeBackup(key, finalValue).catch(() => {});
    BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
            w.webContents.send('storage:update', { key, value: finalValue });
        }
    });
    return success;
});

ipcMain.handle('storage:clearAll', async () => {
    await writeFullBackup();

    try {
        const allFiles = await fs.readdir(BACKUP_PATH);
        const opKeys = ['orders', 'libres', 'history'];
        const toDelete = allFiles.filter(f =>
            opKeys.some(k => f.startsWith(`${k}_`)) && f.endsWith('.json')
        );
        await Promise.all(toDelete.map(f => fs.unlink(path.join(BACKUP_PATH, f)).catch(() => {})));
    } catch (_) {}

    const defaults = { orders: [], libres: [], history: [] };
    knownOrderIds.clear();
    knownLibreMap.clear();

    if (pool) {
        isWritingToDb = true;
        try {
            for (const k of ['orders', 'libres', 'history']) {
                await pool.query(
                    `INSERT INTO rivera_pedidos_state (key, value, updated_at)
                     VALUES ($1, '[]'::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = '[]'::jsonb, updated_at = CURRENT_TIMESTAMP`,
                    [k]
                );
                lastSyncHashes[k] = '[]';
            }
        } catch (err) {
            console.error('Error limpiando estado en Neon DB:', err.message);
        } finally {
            isWritingToDb = false;
        }
    }

    await Promise.all([
        writeJSON(FILES.orders, defaults.orders),
        writeJSON(FILES.libres, defaults.libres),
        writeJSON(FILES.history, defaults.history)
    ]);
    BrowserWindow.getAllWindows().forEach(w => {
        if (!w.isDestroyed()) {
            w.webContents.send('storage:update', { key: 'orders',  value: defaults.orders });
            w.webContents.send('storage:update', { key: 'libres',  value: defaults.libres });
            w.webContents.send('storage:update', { key: 'history', value: defaults.history });
        }
    });
    return true;
});

// Guardar reporte como PDF directamente sin diálogo de impresión
ipcMain.handle('report:savePDF', async (event, { defaultFilename = 'reporte_caja.pdf' } = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'Ventana no disponible' };

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Guardar Reporte como PDF',
        defaultPath: path.join(app.getPath('downloads'), defaultFilename),
        filters: [{ name: 'Documento PDF (*.pdf)', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    try {
        const pdfBuffer = await event.sender.printToPDF({
            pageSize: 'A4',
            landscape: false,
            margins: {
                top: 0.59,
                bottom: 0.59,
                left: 0.59,
                right: 0.59
            },
            printBackground: true,
            preferCSSPageSize: true
        });

        await fs.writeFile(filePath, pdfBuffer);
        return { success: true, filePath };
    } catch (err) {
        console.error('Error al generar PDF:', err);
        return { success: false, error: err.message };
    }
});

app.whenReady().then(async () => {
    await ensureBackupDir();
    createWindow();
    if (pool) {
        dbPollingTimer = setInterval(pollRemotePedidosState, 2000);
    }
});

let quitting = false;
app.on('before-quit', (event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    if (dbPollingTimer) clearInterval(dbPollingTimer);
    writeFullBackup().finally(() => app.exit(0));
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
