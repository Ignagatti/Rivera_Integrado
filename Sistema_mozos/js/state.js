// Valores estructurales base — los precios y bebidas reales viven en la BDD Neon PostgreSQL
const DEFAULT_PRICES = {
    pizzaLibreH: 0, pizzaLibreM: 0, pizzaLibreG: 0,
    empanada: 0, precioPostre: 0,
    precioMenuMartes: 0, precioMenuMiercoles: 0, precioMenuViernes: 0, precioMenuDomingo: 0,
    preciosPizzas: [],
    beverages: []
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
        libreObs: '',
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
    if (category && category !== 'otro') {
        if (category === 'trago') return 'jarro';
        return category;
    }
    const n = (name || '').toLowerCase();
    if (n.includes('fernet') || n.includes('gancia') || n.includes('jarro') || n.includes('trago') || n.includes('campari') || n.includes('gin') || n.includes('vodka') || n.includes('piña') || n.includes('whisky') || n.includes('ginebra') || n.includes('medida')) return 'jarro';
    if ((n.includes('agua') || n.includes('soda')) && !n.includes('saborizada')) return 'agua';
    if (n.includes('saborizada') || n.includes('naranja') || n.includes('pomelo') || n.includes('manzana')) return 'agua';
    if (n.includes('lata') || n.includes('coca') || n.includes('sprite') || n.includes('zero') || n.includes('pepsi') || n.includes('fanta') || n.includes('gaseosa')) return 'gaseosa';
    if (n.includes('cerveza') || n.includes('heineken') || n.includes('corona') || n.includes('pilsen') || n.includes('stella') || n.includes('brahma') || n.includes('quilmes') || n.includes('santa fe')) return 'cerveza';
    if (n.includes('vino') || n.includes('malbec') || n.includes('cabernet') || n.includes('tintillo') || n.includes('chardonnay') || n.includes('syrah') || n.includes('merlot') || n.includes('valentin') || n.includes('latitud') || n.includes('cordero') || n.includes('alma mora') || n.includes('cosecha') || n.includes('portillo') || n.includes('salentein') || n.includes('rutini')) return 'vino';
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
                const orderHasItems = (ord) => {
                    if (!ord) return false;
                    return (
                        (ord.pizzaLibreH || 0) > 0 ||
                        (ord.pizzaLibreM || 0) > 0 ||
                        (ord.pizzaLibreG || 0) > 0 ||
                        (ord.menores || 0) > 0 ||
                        (ord.empanadas || 0) > 0 ||
                        (ord.postres || 0) > 0 ||
                        (ord.menu || 0) > 0 ||
                        (Array.isArray(ord.beverages) && ord.beverages.length > 0) ||
                        (Array.isArray(ord.pizzasPersonalizadas) && ord.pizzasPersonalizadas.length > 0)
                    );
                };

                let needsSyncBackToDb = false;

                if (Array.isArray(dbState.tables) && dbState.tables.length > 0) {
                    if (appState.tables.length > 0) {
                        const dbMap = new Map(dbState.tables.map(t => [String(t.number), t]));
                        const localNums = new Set(appState.tables.map(t => String(t.number)));
                        const dbNums = new Set(dbState.tables.map(t => String(t.number)));

                        if (localNums.size !== dbNums.size || [...localNums].some(n => !dbNums.has(n))) {
                            needsSyncBackToDb = true;
                        }

                        // Conservar las mesas y números del plano local de Sistema_mozos, actualizando pedidos desde la DB
                        appState.tables = appState.tables.map(loc => {
                            const dbt = dbMap.get(String(loc.number));
                            if (!dbt) return { ...loc, order: Object.assign(getNewOrderObject(), loc.order || {}) };
                            const useDbOrder = orderHasItems(dbt.order) || dbt.isPaid || !orderHasItems(loc.order);
                            return {
                                ...loc,
                                isPaid: useDbOrder ? !!dbt.isPaid : !!loc.isPaid,
                                paidAmount: useDbOrder ? (Number(dbt.paidAmount) || 0) : (Number(loc.paidAmount) || 0),
                                tipAmount: useDbOrder ? (Number(dbt.tipAmount) || 0) : (Number(loc.tipAmount) || 0),
                                waiterName: dbt.waiterName || loc.waiterName || 'Sin asignar',
                                note: dbt.note || loc.note || '',
                                libreRounds: dbt.libreRounds || loc.libreRounds || 1,
                                order: Object.assign(getNewOrderObject(), useDbOrder ? (dbt.order || {}) : (loc.order || {}))
                            };
                        });

                        // Si en el POS se cargó un pedido en una mesa nueva que no estaba en local, sumarla
                        for (const dbt of dbState.tables) {
                            if (!localNums.has(String(dbt.number)) && (orderHasItems(dbt.order) || dbt.isPaid)) {
                                appState.tables.push({
                                    ...dbt,
                                    order: Object.assign(getNewOrderObject(), dbt.order || {})
                                });
                            }
                        }
                    } else {
                        appState.tables = dbState.tables.map(dbt => ({
                            ...dbt,
                            order: Object.assign(getNewOrderObject(), dbt.order || {})
                        }));
                    }
                } else if (appState.tables.length > 0) {
                    needsSyncBackToDb = true;
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

                if (needsSyncBackToDb) {
                    await saveState();
                } else {
                    const snapshotStr = JSON.stringify({
                        tables:          appState.tables,
                        barOrders:       appState.barOrders,
                        archivedSales:   appState.archivedSales || [],
                        prices:          appState.prices,
                        nextTableNumber: appState.nextTableNumber,
                        currentMode:     appState.currentMode,
                        numeroCocina:    appState.numeroCocina,
                        genericData:     appState.genericData
                    });
                    localStorage.setItem('restaurantState', snapshotStr);
                    if (window.electronAPI && window.electronAPI.saveBackup) {
                        await window.electronAPI.saveBackup(snapshotStr);
                    }
                }
            }
        } catch (err) {
            console.error('Error cargando estado desde Neon DB:', err);
        }
    }
}
