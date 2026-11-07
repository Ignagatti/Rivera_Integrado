// Valores por defecto — se usan al arrancar y como base para el merge al cargar
const DEFAULT_PRICES = {
    pizzaLibreH: 10500, pizzaLibreM: 9500, pizzaLibreG: 10000,
    empanada: 200, precioPostre: 0,
    precioMenuMartes: 0, precioMenuMiercoles: 0, precioMenuViernes: 0, precioMenuDomingo: 0,
    preciosPizzas: [
        { name: 'Muzzarella', precioEntera: 0, precioMedia: 0 },
        { name: 'Provenzal',  precioEntera: 0, precioMedia: 0 },
        { name: 'Cebollada',  precioEntera: 0, precioMedia: 0 },
        { name: 'Margarita',  precioEntera: 0, precioMedia: 0 },
        { name: 'Rucula',     precioEntera: 0, precioMedia: 0 },
        { name: 'Calabresa',  precioEntera: 0, precioMedia: 0 },
        { name: 'Especial',   precioEntera: 0, precioMedia: 0 },
        { name: 'Napolitana', precioEntera: 0, precioMedia: 0 },
        { name: '3 Quesos',   precioEntera: 0, precioMedia: 0 },
        { name: 'Roquefort',  precioEntera: 0, precioMedia: 0 },
        { name: 'Anchoas',    precioEntera: 0, precioMedia: 0 }
    ],
    beverages: [
        { name: 'Lata de Coca',                 price: 0, category: 'gaseosa'    },
        { name: 'Lata de Sprite',               price: 0, category: 'gaseosa'    },
        { name: 'Coca-Cola 1.5L',               price: 0, category: 'gaseosa'    },
        { name: 'Sprite 1.5L',                  price: 0, category: 'gaseosa'    },
        { name: 'Coca-Cola Zero 1.5L',          price: 0, category: 'gaseosa'    },
        { name: 'Agua 1.5L',                    price: 0, category: 'agua'       },
        { name: 'Agua Saborizada Naranja',       price: 0, category: 'saborizada' },
        { name: 'Agua Saborizada Pomelo',        price: 0, category: 'saborizada' },
        { name: 'Agua Saborizada Manzana',       price: 0, category: 'saborizada' },
        { name: 'Jarro Fernet',                  price: 0, category: 'jarro'      },
        { name: 'Jarro Gancia',                  price: 0, category: 'jarro'      },
        { name: 'Vino Latitud 33',               price: 0, category: 'vino'       },
        { name: 'Vino Valentin Lacrado',         price: 0, category: 'vino'       },
        { name: 'Vino Alma Mora',                price: 0, category: 'vino'       },
        { name: 'Vino Cordero con Piel de Lobo', price: 0, category: 'vino'       },
        { name: 'Vino Valentin Blanco',          price: 0, category: 'vino'       },
        { name: 'Vaso de Vino con Soda',         price: 0, category: 'vino'       },
        { name: 'Vaso de Vino Solo',             price: 0, category: 'vino'       },
        { name: 'Cerveza Pilsen',                price: 0, category: 'cerveza'    },
        { name: 'Cerveza Santa Fe',              price: 0, category: 'cerveza'    },
        { name: 'Cerveza Heineken',              price: 0, category: 'cerveza'    }
    ]
};

const DEFAULT_GENERIC_DATA = {
    establishmentName: 'Club Bochas',
    address: '', phone: '', email: '', footer: '', alias: ''
};

// Fuente única de verdad de la aplicación
const appState = {
    tables:          [],
    barOrders:       [],
    archivedSales:   [],
    genericData:     Object.assign({}, DEFAULT_GENERIC_DATA),
    prices:          JSON.parse(JSON.stringify(DEFAULT_PRICES)),
    currentMode:     'miercoles',
    numeroCocina:    '',
    nextTableNumber: 1
};

function getNewOrderObject() {
    return {
        pizzaLibreH: 0, pizzaLibreM: 0, pizzaLibreG: 0,
        menores: 0, menorPrice: 0,
        empanadas: 0, postres: 0, menu: 0,
        beverages: [], pizzasPersonalizadas: []
    };
}

// Persistencia: localStorage (rápido) + archivo en userData + Neon PostgreSQL compartido
async function saveState() {
    const snapshot = {
        tables:          appState.tables,
        barOrders:       appState.barOrders,
        archivedSales:   appState.archivedSales || [],
        prices:          appState.prices,
        nextTableNumber: appState.nextTableNumber,
        currentMode:     appState.currentMode,
        numeroCocina:    appState.numeroCocina,
        genericData:     appState.genericData
    };
    const dataStr = JSON.stringify(snapshot);
    localStorage.setItem('restaurantState', dataStr);
    if (window.electronAPI && window.electronAPI.saveBackup) {
        await window.electronAPI.saveBackup(dataStr);
    }
    if (window.electronAPI && window.electronAPI.saveDbState) {
        window.electronAPI.saveDbState(snapshot).catch(err => {
            console.error('Error sincronizando estado con Neon DB:', err);
        });
    }
}

function resolveBeverageCategory(name, category) {
    if (category && category !== 'otro') return category;
    const n = (name || '').toLowerCase();
    if (n.includes('agua') && !n.includes('saborizada')) return 'agua';
    if (n.includes('saborizada') || n.includes('naranja') || n.includes('pomelo') || n.includes('manzana')) return 'saborizada';
    if (n.includes('lata') || n.includes('coca') || n.includes('sprite') || n.includes('zero') || n.includes('pepsi') || n.includes('fanta') || n.includes('gaseosa')) return 'gaseosa';
    if (n.includes('cerveza') || n.includes('heineken') || n.includes('corona') || n.includes('pilsen') || n.includes('stella') || n.includes('brahma') || n.includes('quilmes') || n.includes('santa fe')) return 'cerveza';
    if (n.includes('vino') || n.includes('malbec') || n.includes('cabernet') || n.includes('tintillo') || n.includes('chardonnay') || n.includes('syrah') || n.includes('merlot') || n.includes('valentin') || n.includes('latitud') || n.includes('cordero') || n.includes('alma mora')) return 'vino';
    if (n.includes('fernet') || n.includes('gancia') || n.includes('jarro') || n.includes('trago') || n.includes('campari') || n.includes('gin') || n.includes('vodka')) return 'jarro';
    return category || 'otro';
}

function applyPricesObject(rawPrices) {
    if (!rawPrices) return;
    appState.prices = Object.assign(JSON.parse(JSON.stringify(DEFAULT_PRICES)), rawPrices);
    if (rawPrices.beverages) {
        appState.prices.beverages = rawPrices.beverages.map(bev => ({
            name: bev.name,
            price: Number(bev.price) || 0,
            category: resolveBeverageCategory(bev.name, bev.category)
        }));
    }
    if (rawPrices.preciosPizzas) {
        appState.prices.preciosPizzas = rawPrices.preciosPizzas;
    }
}

async function loadState() {
    let raw = localStorage.getItem('restaurantState');
    if (!raw && window.electronAPI && window.electronAPI.loadBackup) {
        raw = await window.electronAPI.loadBackup();
    }

    if (raw) {
        try {
            const saved = JSON.parse(raw);
            appState.tables          = saved.tables          || [];
            appState.barOrders       = saved.barOrders       || [];
            appState.archivedSales   = saved.archivedSales   || [];
            appState.nextTableNumber = saved.nextTableNumber || 1;
            appState.currentMode     = saved.currentMode     || 'miercoles';
            appState.numeroCocina    = saved.numeroCocina    || '';
            appState.genericData     = saved.genericData     || Object.assign({}, DEFAULT_GENERIC_DATA);
            applyPricesObject(saved.prices);
        } catch (e) {
            console.error('Error al parsear el estado guardado local:', e);
        }
    }

    // Sincronizar con la base de datos compartida (Neon PostgreSQL)
    if (window.electronAPI && window.electronAPI.loadDbState) {
        try {
            const dbState = await window.electronAPI.loadDbState();
            if (dbState) {
                if (Array.isArray(dbState.tables) && dbState.tables.length > 0) {
                    const localMap = new Map(appState.tables.map(t => [String(t.number), t]));
                    appState.tables = dbState.tables.map(dbt => {
                        const loc = localMap.get(String(dbt.number));
                        return {
                            ...dbt,
                            x: loc && loc.x !== undefined ? loc.x : dbt.x,
                            y: loc && loc.y !== undefined ? loc.y : dbt.y,
                            width: loc && loc.width ? loc.width : dbt.width,
                            height: loc && loc.height ? loc.height : dbt.height,
                            order: Object.assign(getNewOrderObject(), dbt.order || {})
                        };
                    });
                }
                if (dbState.prices) {
                    applyPricesObject(dbState.prices);
                }
                if (dbState.currentMode) {
                    appState.currentMode = dbState.currentMode;
                }
                if (dbState.genericData && Object.keys(dbState.genericData).length > 0) {
                    appState.genericData = Object.assign({}, DEFAULT_GENERIC_DATA, dbState.genericData);
                }
                if (Array.isArray(dbState.barOrders)) {
                    appState.barOrders = dbState.barOrders;
                }
                if (Array.isArray(dbState.archivedSales)) {
                    appState.archivedSales = dbState.archivedSales;
                }
                if (dbState.numeroCocina) {
                    appState.numeroCocina = dbState.numeroCocina;
                }
                appState.nextTableNumber = appState.tables.length > 0
                    ? Math.max(...appState.tables.map(t => parseInt(t.number, 10) || 0)) + 1
                    : 1;
            }
        } catch (err) {
            console.error('Error cargando estado desde Neon DB:', err);
        }
    }
}
