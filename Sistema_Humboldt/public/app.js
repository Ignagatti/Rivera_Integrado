// ============================================================================
// SISTEMA HUMBOLDT - POS MOBILE MOZOS (SINCRONIZADO CON SISTEMA MOZOS Y PEDIDOS)
// ============================================================================

let menuData = [];
let mozosPrices = null;
let currentMode = 'sabado';
let genericData = {};
let staffList = [];
let tablesList = [];
let ordersByTable = {};
let paymentHistory = [];
let generalTipsPool = 0;
let nightReports = [];

let currentUser = null;
let currentRole = null; // 'waiter' | 'admin'
let currentTable = null;
let currentCategoryId = null;
let isMobileDrawerOpen = false;

// Modales y selectores directos de Pizza en grilla
let currentPizzaConfigType = '1_flavor'; // '1_flavor' | '2_flavors' | '3_flavors' | 'media_1' | 'media_2'
let selectedPizzaFlavors = []; // Gustos que se van marcando directamente en las tarjetas de la grilla
let inlinePizzaNote = ''; // Observación o ingrediente excluido (ej: "Sin cebolla") para la pizza que se está armando
let pizzaModalSize = 'entera'; // 'entera' | 'media'
let pizzaModalFlavorsCount = 1; // 1 | 2 | 3
let pizzaModalQty = 1;

// Estado Pizza Libre
let pizzaLibreModalType = 'G';
let pizzaLibreModalPrice = 16000;
let pizzaLibreModalName = 'Pizza Libre General';
let pizzaLibreCount = 1;
let selectedLibreExclusions = [];
let selectedNextRoundFlavors = [];

// Estado de cobro
let checkoutTableTarget = null;
let selectedPaymentMethod = 'Efectivo';
let currentCheckoutSubtotal = 0;

// Estado Admin y Confirmación
let currentAdminSubTab = 'menu';
let confirmModalCallback = null;

// Polling y WebSocket
let syncPollingInterval = null;
let wsConnection = null;
let isSavingOrder = false;

// ============================================================================
// CÁLCULO EXACTO DE PRECIOS DE PIZZA (IDÉNTICO A SISTEMA_MOZOS)
// ============================================================================
function calculateMozosPizzaPrice(size, toppings) {
    const prices = mozosPrices || {};
    const catalog = Array.isArray(prices.preciosPizzas) ? prices.preciosPizzas : [];
    const getFlavorObj = (name) => catalog.find(p => p.name.toLowerCase() === String(name).toLowerCase());

    if (!Array.isArray(toppings) || toppings.length === 0) return 0;

    if (size === 'entera') {
        if (toppings.length === 1) {
            const p = getFlavorObj(toppings[0]);
            return p ? Number(p.precioEntera) || 0 : 0;
        }
        if (toppings.length === 2) {
            const p1 = getFlavorObj(toppings[0]);
            const p2 = getFlavorObj(toppings[1]);
            return (p1 ? Number(p1.precioMedia) || 0 : 0) + (p2 ? Number(p2.precioMedia) || 0 : 0);
        }
        if (toppings.length >= 3) {
            const p1 = getFlavorObj(toppings[0]);
            const p2 = getFlavorObj(toppings[1]);
            const p3 = getFlavorObj(toppings[2]);
            const sumMedias =
                (p1 ? Number(p1.precioMedia) || 0 : 0) +
                (p2 ? Number(p2.precioMedia) || 0 : 0) +
                (p3 ? Number(p3.precioMedia) || 0 : 0);
            return sumMedias / 2;
        }
    } else if (size === 'media') {
        if (toppings.length === 1) {
            const p = getFlavorObj(toppings[0]);
            return p ? Number(p.precioMedia) || 0 : 0;
        }
        if (toppings.length >= 2) {
            const p1 = getFlavorObj(toppings[0]);
            const p2 = getFlavorObj(toppings[1]);
            return ((p1 ? Number(p1.precioMedia) || 0 : 0) + (p2 ? Number(p2.precioMedia) || 0 : 0)) / 2;
        }
    }
    return 0;
}

function getCategoryIcon(catId) {
    if (catId === 'pizzas') return 'fa-pizza-slice';
    if (catId === 'empanadas_postres') return 'fa-utensils';
    return 'fa-wine-glass';
}

function getPizzaFlavorsCatalog() {
    const pizzaCat = menuData.find(c => c.id === 'pizzas');
    if (pizzaCat && Array.isArray(pizzaCat.items)) {
        const flavors = pizzaCat.items.filter(i => i.isPizza && !i.isPizzaLibre);
        if (flavors.length > 0) return flavors;
    }
    return (mozosPrices?.preciosPizzas || []).map((p, idx) => ({
        id: `pizza_flavor_${idx}`,
        name: p.name,
        price: Number(p.precioEntera) || 0,
        precioEntera: Number(p.precioEntera) || 0,
        precioMedia: Number(p.precioMedia) || 0,
        isPizza: true,
        isPizzaLibre: false
    }));
}

// ============================================================================
// CONEXIÓN CON EL SERVIDOR Y SINCRONIZACIÓN EN TIEMPO REAL
// ============================================================================
async function fetchServerState(silent = false) {
    if (isSavingOrder) return;
    try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (!res.ok) throw new Error('Error HTTP obteniendo estado');
        const data = await res.json();

        mozosPrices = data.mozosPrices || {};
        currentMode = data.currentMode || 'sabado';
        genericData = data.genericData || {};

        const rawMenu = Array.isArray(data.menuData)
            ? data.menuData
            : (data.menuData && typeof data.menuData === 'object')
                ? Object.entries(data.menuData).map(([id, cat]) => ({ id, ...cat }))
                : [];

        menuData = rawMenu.map(cat => ({
            id: cat.id,
            name: cat.title || cat.name || cat.id,
            icon: getCategoryIcon(cat.id),
            items: Array.isArray(cat.items) ? cat.items : []
        }));

        if (!currentCategoryId && menuData.length > 0) {
            currentCategoryId = menuData[0].id;
        }

        const rawStaff = Array.isArray(data.staffList) ? data.staffList : [];
        staffList = rawStaff.map((s, idx) =>
            typeof s === 'string'
                ? { id: `staff_${idx}`, name: s, role: 'Mozo' }
                : s
        );

        tablesList = Array.isArray(data.tablesList) ? data.tablesList : [];
        ordersByTable = data.ordersByTable || {};
        paymentHistory = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
        generalTipsPool = Number(data.generalTipsPool) || 0;
        nightReports = Array.isArray(data.nightReports) ? data.nightReports : [];

        // Actualizar indicador de conexión con Neon DB
        const pill = document.getElementById('db-connection-pill');
        if (pill) {
            pill.className = 'text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold';
            pill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Conectado';
        }

        updateHeaderCounters();
        refreshActiveViews();
    } catch (err) {
        const pill = document.getElementById('db-connection-pill');
        if (pill) {
            pill.className = 'text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold';
            pill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Reconectando...';
        }
        if (!silent) {
            console.error('Error sincronizando estado:', err);
        }
    }
}

function updateHeaderCounters() {
    const tipsEl = document.getElementById('header-tips-summary');
    if (tipsEl) {
        tipsEl.textContent = `Caja Propinas: $${generalTipsPool.toLocaleString('es-AR')}`;
    }
    const payCountEl = document.getElementById('header-payments-count');
    if (payCountEl) {
        payCountEl.textContent = String(paymentHistory.length);
    }
}

function refreshActiveViews() {
    const loginView = document.getElementById('login-view');
    if (loginView && !loginView.classList.contains('hidden')) {
        renderStaffLoginList();
    }

    if (!currentUser) return;

    const tablesView = document.getElementById('waiter-tables-view');
    const orderView = document.getElementById('waiter-order-view');
    const adminView = document.getElementById('admin-workspace');

    if (tablesView && !tablesView.classList.contains('hidden')) {
        renderTablesGrid();
    }
    if (orderView && !orderView.classList.contains('hidden')) {
        renderCategories();
        const activeId = document.activeElement ? document.activeElement.id : '';
        const isTypingMenu = activeId === 'inline-pizza-note-input' || activeId === 'menu-search-input';
        if (!isTypingMenu && selectedPizzaFlavors.length === 0) {
            renderMenuItems();
        }
        const noteInput = document.getElementById('order-note');
        const isTypingNote = document.activeElement === noteInput;
        renderOrder(isTypingNote);
    }
    if (adminView && !adminView.classList.contains('hidden')) {
        renderAdminActiveSubTab();
    }
}

function setupRealtimeSync() {
    if (syncPollingInterval) clearInterval(syncPollingInterval);
    syncPollingInterval = setInterval(() => {
        fetchServerState(true);
    }, 2500);

    try {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsConnection = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsConnection.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg && msg.type && msg.type !== 'CONNECTED') {
                    fetchServerState(true);
                }
            } catch (e) { /* ignore */ }
        };
        wsConnection.onclose = () => {
            wsConnection = null;
        };
    } catch (e) {
        // En Vercel Serverless el polling periódico mantiene todo sincronizado
    }
}

// ============================================================================
// INICIO DE SESIÓN Y SELECCIÓN DE PERFIL (MOZO / ENCARGADO)
// ============================================================================
function renderStaffLoginList() {
    const container = document.getElementById('staff-selection-list');
    if (!container) return;

    if (staffList.length === 0) {
        container.innerHTML = `
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                No hay mozos registrados. Ingresa al Panel Admin para agregarlos.
            </div>
        `;
        return;
    }

    container.innerHTML = staffList.map(staff => {
        const safeName = staff.name.replace(/'/g, "\\'");
        return `
            <button onclick="loginAsWaiter('${safeName}')"
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 transition-all group text-left cursor-pointer active:scale-[0.99]">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 text-[#2563eb] flex items-center justify-center font-bold text-sm group-hover:bg-[#2563eb] group-hover:text-white transition-colors">
                        <i class="fa-solid fa-user-check"></i>
                    </div>
                    <div>
                        <p class="font-bold text-slate-900 text-sm group-hover:text-[#2563eb] transition-colors">${staff.name}</p>
                        <p class="text-[11px] text-slate-500">Salón y Mesas • Sincronizado</p>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-400 group-hover:text-[#2563eb] text-xs transition-colors"></i>
            </button>
        `;
    }).join('');
}

function loginAsWaiter(name) {
    currentUser = name;
    currentRole = 'waiter';
    localStorage.setItem('humboldt_user', name);
    localStorage.setItem('humboldt_role', 'waiter');

    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-header').classList.remove('hidden');
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('waiter-order-view').classList.add('hidden');
    document.getElementById('waiter-tables-view').classList.remove('hidden');

    updateHeaderUserBadge();
    renderTablesGrid();
}

function openAdminDirect() {
    const modal = document.getElementById('admin-auth-modal');
    const input = document.getElementById('admin-auth-input');
    const err = document.getElementById('admin-auth-error');
    if (err) {
        err.textContent = '';
        err.classList.add('hidden');
    }
    if (input) input.value = '';
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => input && input.focus(), 80);
}

function closeAdminAuthModal() {
    const modal = document.getElementById('admin-auth-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitAdminAuth() {
    const input = document.getElementById('admin-auth-input');
    const err = document.getElementById('admin-auth-error');
    const password = input ? input.value : '';

    try {
        const res = await fetch('/api/verify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeAdminAuthModal();
            loginAsAdmin();
        } else {
            if (err) {
                err.textContent = data.error || 'Contraseña incorrecta.';
                err.classList.remove('hidden');
            }
        }
    } catch (e) {
        showToast('Error al verificar contraseña', 'error');
    }
}

function loginAsAdmin() {
    currentUser = 'Encargado';
    currentRole = 'admin';
    localStorage.setItem('humboldt_user', 'Encargado');
    localStorage.setItem('humboldt_role', 'admin');

    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-header').classList.remove('hidden');
    switchToAdminWorkspace();
}

function switchToAdminWorkspace() {
    document.getElementById('waiter-tables-view').classList.add('hidden');
    document.getElementById('waiter-order-view').classList.add('hidden');
    document.getElementById('admin-workspace').classList.remove('hidden');
    updateHeaderUserBadge();
    switchAdminTab(currentAdminSubTab || 'menu');
}

function switchToWaiterTables() {
    currentTable = null;
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('waiter-order-view').classList.add('hidden');
    document.getElementById('waiter-tables-view').classList.remove('hidden');
    updateHeaderUserBadge();
    renderTablesGrid();
}

function updateHeaderUserBadge() {
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-role-badge');
    const adminNavBtn = document.getElementById('header-admin-nav-btn');
    const salonNavBtn = document.getElementById('header-salon-nav-btn');
    const salonBackAdminBtn = document.getElementById('salon-back-admin-btn');
    const orderBackAdminBtn = document.getElementById('order-back-admin-btn');

    if (nameEl) nameEl.textContent = currentUser || 'Mozo';
    if (roleEl) {
        roleEl.textContent = currentRole === 'admin' ? 'Admin' : 'Mozo';
    }

    const isAdmin = currentRole === 'admin';
    const isAdminViewOpen = !document.getElementById('admin-workspace').classList.contains('hidden');

    if (adminNavBtn) {
        if (isAdmin && !isAdminViewOpen) adminNavBtn.classList.remove('hidden');
        else adminNavBtn.classList.add('hidden');
    }
    if (salonNavBtn) {
        if (isAdmin && isAdminViewOpen) salonNavBtn.classList.remove('hidden');
        else salonNavBtn.classList.add('hidden');
    }
    if (salonBackAdminBtn) {
        if (isAdmin) salonBackAdminBtn.classList.remove('hidden');
        else salonBackAdminBtn.classList.add('hidden');
    }
    if (orderBackAdminBtn) {
        if (isAdmin) orderBackAdminBtn.classList.remove('hidden');
        else orderBackAdminBtn.classList.add('hidden');
    }

    updateHeaderCounters();
}

function logoutStaff() {
    currentUser = null;
    currentRole = null;
    currentTable = null;
    localStorage.removeItem('humboldt_user');
    localStorage.removeItem('humboldt_role');

    document.getElementById('main-header').classList.add('hidden');
    document.getElementById('waiter-tables-view').classList.add('hidden');
    document.getElementById('waiter-order-view').classList.add('hidden');
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    renderStaffLoginList();
}

// ============================================================================
// MAPA DE MESAS DEL SALÓN (SINCRONIZADO CON SISTEMA_MOZOS)
// ============================================================================
function renderTablesGrid() {
    const grid = document.getElementById('tables-grid-cards');
    if (!grid) return;

    let html = '';

    tablesList.forEach(tableName => {
        const order = ordersByTable[tableName] || {
            waiter: 'Sin asignar',
            items: [],
            note: '',
            libreRounds: 1,
            isPaid: false,
            paidAmount: 0,
            tipAmount: 0
        };

        const items = Array.isArray(order.items) ? order.items : [];
        const hasItems = items.length > 0;
        const isPaid = !!order.isPaid;

        const total = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
        const unsentCount = items.reduce((acc, it) => {
            const diff = (Number(it.qty) || 0) - (Number(it.sentQty) || 0);
            return acc + (diff > 0 ? diff : 0);
        }, 0);

        const safeTable = tableName.replace(/'/g, "\\'");

        let cardClasses = 'bg-white border-slate-200 hover:border-blue-400';
        let badgeHtml = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Libre</span>`;

        if (isPaid) {
            cardClasses = 'bg-emerald-50/90 border-2 border-emerald-500 shadow-md shadow-emerald-500/10';
            badgeHtml = `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white">✓ PAGADA</span>`;
        } else if (unsentCount > 0) {
            cardClasses = 'bg-amber-50/70 border-2 border-amber-400';
            badgeHtml = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">Sin enviar (${unsentCount})</span>`;
        } else if (hasItems) {
            cardClasses = 'bg-blue-50/50 border-2 border-[#2563eb]';
            badgeHtml = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2563eb] text-white">Ocupada</span>`;
        }

        html += `
            <div onclick="selectTableAndOpenPOS('${safeTable}')"
                class="rounded-2xl border ${cardClasses} p-3.5 sm:p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[150px] shadow-sm hover:shadow-md">
                <div>
                    <div class="flex items-start justify-between gap-1.5 mb-2">
                        <div>
                            <h3 class="font-extrabold text-slate-900 text-sm sm:text-base">${tableName}</h3>
                            <p class="text-[11px] text-slate-500 truncate max-w-[110px]">
                                <i class="fa-solid fa-user text-[9px] mr-1"></i>${hasItems || isPaid ? (order.waiter || 'Mozo') : 'Disponible'}
                            </p>
                        </div>
                        ${badgeHtml}
                    </div>

                    ${isPaid ? `
                        <div class="mt-2 p-2 rounded-xl bg-emerald-100/80 border border-emerald-300 text-xs">
                            <div class="flex justify-between font-bold text-emerald-900">
                                <span>Cobrado:</span>
                                <span>$${(order.paidAmount || total).toLocaleString('es-AR')}</span>
                            </div>
                            ${order.tipAmount > 0 ? `
                                <div class="flex justify-between text-[11px] text-emerald-800 mt-0.5">
                                    <span>Propina:</span>
                                    <span>+$${Number(order.tipAmount).toLocaleString('es-AR')}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : hasItems ? `
                        <p class="text-xs text-slate-600 font-medium line-clamp-2 mt-1">
                            ${items.slice(0, 3).map(i => `${i.qty}x ${i.name}`).join(', ')}${items.length > 3 ? '...' : ''}
                        </p>
                    ` : `
                        <p class="text-xs text-slate-400 mt-3 italic">Toca para cargar pedido</p>
                    `}
                </div>

                <div class="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-1">
                    <div>
                        <span class="text-[10px] text-slate-400 uppercase font-semibold block">Total</span>
                        <span class="text-sm sm:text-base font-extrabold ${isPaid ? 'text-emerald-700' : hasItems ? 'text-slate-900' : 'text-slate-400'}">
                            $${total.toLocaleString('es-AR')}
                        </span>
                    </div>

                    ${isPaid ? `
                        <div class="flex items-center gap-1">
                            <button onclick="freePaidTable('${safeTable}', event)"
                                title="Liberar mesa para nuevos clientes (conserva la venta en el cierre)"
                                class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all">
                                <i class="fa-solid fa-broom mr-1"></i>Liberar
                            </button>
                            <button onclick="unpayTable('${safeTable}', event)"
                                title="Desmarcar pago"
                                class="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 text-xs border border-slate-300">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        </div>
                    ` : hasItems ? `
                        <button onclick="openPaymentByTable('${safeTable}', event)"
                            class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all">
                            <i class="fa-solid fa-cash-register mr-1"></i>Cobrar
                        </button>
                    ` : `
                        <button onclick="deleteTable('${safeTable}', event)"
                            title="Eliminar mesa vacía"
                            class="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all text-xs">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function openAddTableModal() {
    const modal = document.getElementById('add-table-modal');
    const input = document.getElementById('new-table-name-input');
    const nextNum = tablesList.length + 1;
    if (input) input.value = `Mesa ${nextNum}`;
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => input && input.focus(), 80);
}

function closeAddTableModal() {
    const modal = document.getElementById('add-table-modal');
    if (modal) modal.classList.add('hidden');
}

async function submitAddNewTable() {
    const input = document.getElementById('new-table-name-input');
    const name = input ? input.value.trim() : '';
    try {
        const res = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeAddTableModal();
            await fetchServerState(true);
            showToast(`${data.tableName || 'Nueva mesa'} creada y sincronizada con Sistema Mozos`, 'success');
        } else {
            showToast(data.error || 'No se pudo crear la mesa', 'error');
        }
    } catch (e) {
        showToast('Error de red al crear mesa', 'error');
    }
}

async function deleteTable(tableName, event) {
    if (event) event.stopPropagation();
    openConfirmModal(
        'Eliminar Mesa',
        `¿Deseas eliminar ${tableName} del plano del salón?`,
        async () => {
            try {
                const res = await fetch(`/api/tables/${encodeURIComponent(tableName)}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok && data.success) {
                    await fetchServerState(true);
                    showToast(`${tableName} eliminada`, 'info');
                } else {
                    showToast(data.error || 'No se puede eliminar una mesa con pedido activo', 'error');
                }
            } catch (e) {
                showToast('Error al eliminar mesa', 'error');
            }
        }
    );
}

async function freePaidTable(tableName, event) {
    if (event) event.stopPropagation();
    try {
        const res = await fetch(`/api/tables/${encodeURIComponent(tableName)}/free`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            await fetchServerState(true);
            showToast(`${tableName} liberada para nuevos clientes (venta archivada)`, 'success');
            if (currentTable === tableName) {
                renderOrder();
            }
        }
    } catch (e) {
        showToast('Error al liberar la mesa', 'error');
    }
}

async function unpayTable(tableName, event) {
    if (event) event.stopPropagation();
    try {
        const res = await fetch(`/api/tables/${encodeURIComponent(tableName)}/unpay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
            await fetchServerState(true);
            showToast(`Pago desmarcado en ${tableName}`, 'info');
            if (currentTable === tableName) {
                renderOrder();
            }
        }
    } catch (e) {
        showToast('Error al desmarcar pago', 'error');
    }
}

function selectTableAndOpenPOS(tableName) {
    currentTable = tableName;
    if (!ordersByTable[currentTable]) {
        ordersByTable[currentTable] = {
            waiter: currentUser || 'Mozo',
            items: [],
            note: '',
            libreRounds: 1,
            isPaid: false,
            paidAmount: 0,
            tipAmount: 0
        };
    } else if (
        (!ordersByTable[currentTable].waiter || ordersByTable[currentTable].waiter === 'Sin asignar') &&
        currentUser
    ) {
        ordersByTable[currentTable].waiter = currentUser;
    }

    document.getElementById('waiter-tables-view').classList.add('hidden');
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('waiter-order-view').classList.remove('hidden');

    const tableIndicator = document.getElementById('active-table-indicator');
    const orderHeader = document.getElementById('current-order-title');

    if (tableIndicator) tableIndicator.textContent = tableName;
    if (orderHeader) orderHeader.textContent = `Pedido ${tableName}`;

    if (!currentCategoryId && menuData.length > 0) {
        currentCategoryId = menuData[0].id;
    }

    updateHeaderUserBadge();
    renderCategories();
    renderMenuItems();
    renderOrder();
}

function backToTablesView() {
    currentTable = null;
    isMobileDrawerOpen = false;
    const content = document.getElementById('order-drawer-content');
    if (content) content.classList.add('hidden');

    document.getElementById('waiter-order-view').classList.add('hidden');
    document.getElementById('waiter-tables-view').classList.remove('hidden');
    renderTablesGrid();
}

function toggleOrderDrawer() {
    const content = document.getElementById('order-drawer-content');
    const chevron = document.getElementById('drawer-chevron');
    if (!content) return;

    isMobileDrawerOpen = !isMobileDrawerOpen;
    if (isMobileDrawerOpen) {
        content.classList.remove('hidden');
        content.classList.add('flex');
        if (chevron) chevron.classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        content.classList.remove('flex');
        if (chevron) chevron.classList.remove('rotate-180');
    }
}

// ============================================================================
// CATEGORÍAS Y PRODUCTOS DEL MENÚ (PRECIOS DE SISTEMA_MOZOS)
// ============================================================================
function renderCategories() {
    const container = document.getElementById('category-tabs');
    if (!container) return;

    container.innerHTML = menuData.map(cat => {
        const isActive = cat.id === currentCategoryId;
        return `
            <button onclick="selectCategory('${cat.id}')"
                class="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    isActive
                        ? 'bg-[#2563eb] text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }">
                <i class="fa-solid ${cat.icon || getCategoryIcon(cat.id)}"></i>
                <span>${cat.name}</span>
            </button>
        `;
    }).join('');
}

function selectCategory(catId) {
    currentCategoryId = catId;
    renderCategories();
    renderMenuItems();
}

function setPizzaConfigMode(mode) {
    currentPizzaConfigType = mode;
    selectedPizzaFlavors = [];
    renderMenuItems();
}

function getPizzaSelectionParams() {
    if (currentPizzaConfigType === '2_flavors') return { size: 'entera', count: 2 };
    if (currentPizzaConfigType === '3_flavors') return { size: 'entera', count: 3 };
    if (currentPizzaConfigType === 'media' || currentPizzaConfigType === 'media_1') return { size: 'media', count: 1 };
    if (currentPizzaConfigType === 'media_2') return { size: 'media', count: 2 };
    return { size: 'entera', count: 1 };
}

function cancelPizzaFlavorSelection() {
    selectedPizzaFlavors = [];
    renderMenuItems();
}

function onInlinePizzaNoteInput(val) {
    inlinePizzaNote = val;
}

function toggleInlinePizzaExclusionChip(chipText) {
    const currentParts = inlinePizzaNote
        ? inlinePizzaNote.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    const idx = currentParts.findIndex(p => p.toLowerCase() === chipText.toLowerCase());
    if (idx !== -1) {
        currentParts.splice(idx, 1);
    } else {
        currentParts.push(chipText);
    }
    inlinePizzaNote = currentParts.join(', ');
    const inp = document.getElementById('inline-pizza-note-input');
    if (inp) inp.value = inlinePizzaNote;
    renderMenuItems();
}

function filterMenuItems() {
    const input = document.getElementById('menu-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn && input) {
        if (input.value.trim().length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    renderMenuItems();
}

function clearSearchInput() {
    const input = document.getElementById('menu-search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    if (input) input.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    renderMenuItems();
}

function renderMenuItems() {
    const container = document.getElementById('menu-grid');
    const modesBar = document.getElementById('pizza-modes-bar');
    const libreBanner = document.getElementById('pizza-libre-active-banner');
    if (!container) return;

    const category = menuData.find(c => c.id === currentCategoryId) || menuData[0];
    if (!category) {
        container.innerHTML = `<p class="text-slate-400 text-xs col-span-full text-center py-8">Cargando carta de precios...</p>`;
        return;
    }

    const searchInput = document.getElementById('menu-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const { size: activePizzaSize, count: requiredFlavorsCount } = getPizzaSelectionParams();

    // Mostrar barra de modo de pizza y observación directa cuando estamos en la categoría Pizzas
    if (modesBar) {
        if (category.id === 'pizzas') {
            modesBar.classList.remove('hidden');
            const quickChips = ['Sin Cebolla', 'Sin Aceitunas', 'Sin Ajo', 'Sin Morrón', 'Sin Anchoas', 'Bien Cocida'];
            const currentNoteParts = inlinePizzaNote
                ? inlinePizzaNote.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                : [];
            const escapedNote = String(inlinePizzaNote || '').replace(/"/g, '&quot;');

            modesBar.innerHTML = `
                <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <i class="fa-solid fa-pizza-slice text-[#2563eb]"></i> Tocá el modo y luego los gustos en la grilla:
                        </span>
                        <div class="flex flex-wrap gap-1.5">
                            <button onclick="setPizzaConfigMode('1_flavor')"
                                class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    currentPizzaConfigType === '1_flavor'
                                        ? 'bg-[#2563eb] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }">1 Gusto (Entera)</button>
                            <button onclick="setPizzaConfigMode('2_flavors')"
                                class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    currentPizzaConfigType === '2_flavors'
                                        ? 'bg-[#2563eb] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }">2 Gustos (Mitad/Mitad)</button>
                            <button onclick="setPizzaConfigMode('3_flavors')"
                                class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    currentPizzaConfigType === '3_flavors'
                                        ? 'bg-[#2563eb] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }">3 Gustos</button>
                            <button onclick="setPizzaConfigMode('media_1')"
                                class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    currentPizzaConfigType === 'media' || currentPizzaConfigType === 'media_1'
                                        ? 'bg-[#2563eb] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }">Media Pizza (1 Gusto)</button>
                            <button onclick="setPizzaConfigMode('media_2')"
                                class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    currentPizzaConfigType === 'media_2'
                                        ? 'bg-[#2563eb] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }">Media Pizza (2 Gustos)</button>
                        </div>
                    </div>

                    ${selectedPizzaFlavors.length > 0 ? `
                        <div class="bg-blue-50 border border-blue-300 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                            <div class="text-xs font-bold text-[#2563eb]">
                                <i class="fa-solid fa-check-double mr-1"></i>
                                Seleccionados (${selectedPizzaFlavors.length}/${requiredFlavorsCount}):
                                <span class="underline">${selectedPizzaFlavors.join(' / ')}</span>
                                — Tocá el ${selectedPizzaFlavors.length + 1}º gusto en la grilla
                            </div>
                            <button onclick="cancelPizzaFlavorSelection()"
                                class="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold shrink-0">
                                Cancelar
                            </button>
                        </div>
                    ` : ''}

                    <div class="pt-1 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
                        <div class="relative flex-1">
                            <i class="fa-solid fa-comment-dots text-amber-500 text-xs absolute left-3 top-1/2 -translate-y-1/2"></i>
                            <input id="inline-pizza-note-input" type="text"
                                value="${escapedNote}"
                                oninput="onInlinePizzaNoteInput(this.value)"
                                placeholder="Observación para la pizza (ej: sin cebolla, sin aceitunas)..."
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#2563eb]">
                        </div>
                        <div class="flex flex-wrap gap-1">
                            ${quickChips.map(chip => {
                                const isChipSelected = currentNoteParts.includes(chip.toLowerCase());
                                return `
                                    <button type="button" onclick="toggleInlinePizzaExclusionChip('${chip}')"
                                        class="px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                            isChipSelected
                                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                                                : 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100'
                                        }">
                                        ${chip}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            modesBar.classList.add('hidden');
        }
    }

    // Mostrar banner de Rondas de Pizza Libre si la mesa tiene Pizza Libre activa
    if (libreBanner && currentTable && ordersByTable[currentTable]) {
        const tableOrder = ordersByTable[currentTable];
        const hasLibre = (tableOrder.items || []).some(it => it.isPizzaLibre);
        if (hasLibre && !tableOrder.isPaid) {
            libreBanner.classList.remove('hidden');
            libreBanner.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                    <div>
                        <span class="text-[10px] font-extrabold uppercase text-[#2563eb] block">Pizza Libre Activa • Ronda #${tableOrder.libreRounds || 1}</span>
                        <p class="text-xs text-slate-600">¿Los clientes quieren otra tanda de pizza libre?</p>
                    </div>
                    <button onclick="openNextRoundModal()"
                        class="bg-[#2563eb] hover:bg-blue-600 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-sm shrink-0 cursor-pointer">
                        <i class="fa-solid fa-arrows-rotate mr-1"></i>Pedir Ronda ($0)
                    </button>
                </div>
            `;
        } else {
            libreBanner.classList.add('hidden');
        }
    }

    // Si hay búsqueda, buscar en todas las categorías
    let items = [];
    if (query) {
        menuData.forEach(c => {
            (c.items || []).forEach(it => {
                if (it.name.toLowerCase().includes(query)) items.push(it);
            });
        });
    } else {
        items = category.items || [];
    }

    if (items.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-xs col-span-full text-center py-8">No se encontraron productos.</p>`;
        return;
    }

    const renderCard = (item) => {
        const isLibre = !!item.isPizzaLibre;
        const isPizza = !!item.isPizza && !isLibre;
        const displayPrice = (isPizza && activePizzaSize === 'media' && item.precioMedia)
            ? Number(item.precioMedia)
            : Number(item.price) || 0;

        const safeId = String(item.id).replace(/'/g, "\\'");

        // Verificar si este gusto está marcado en la selección actual
        const selectedPositions = [];
        if (isPizza && selectedPizzaFlavors.length > 0) {
            selectedPizzaFlavors.forEach((flav, idx) => {
                if (flav.toLowerCase() === item.name.toLowerCase()) {
                    selectedPositions.push(`${idx + 1}º Gusto`);
                }
            });
        }
        const isSelectedFlavor = selectedPositions.length > 0;

        return `
            <div onclick="onMenuItemClicked('${safeId}')"
                class="rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between min-h-[104px] select-none active:scale-[0.98] shadow-sm ${
                    isSelectedFlavor
                        ? 'bg-blue-50/90 border-2 border-[#2563eb] ring-2 ring-[#2563eb]/30'
                        : isLibre
                            ? 'bg-blue-50/80 border-2 border-[#2563eb] hover:bg-blue-50'
                            : 'bg-white hover:border-blue-300 border-slate-200'
                }">
                <div>
                    <div class="flex items-start justify-between gap-2">
                        <h4 class="font-bold text-slate-900 text-xs sm:text-sm leading-snug">${item.name}</h4>
                        ${isSelectedFlavor
                            ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#2563eb] text-white shrink-0">✓ ${selectedPositions.join(', ')}</span>`
                            : isLibre
                                ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#2563eb] text-white shrink-0">LIBRE</span>`
                                : ''
                        }
                    </div>
                    ${item.desc ? `<p class="text-[11px] text-slate-500 mt-1 line-clamp-1">${item.desc}</p>` : ''}
                </div>
                <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-sm font-extrabold text-[#2563eb]">$${displayPrice.toLocaleString('es-AR')}</span>
                    <div class="w-7 h-7 rounded-xl ${isSelectedFlavor ? 'bg-[#2563eb] text-white' : 'bg-blue-50 text-[#2563eb]'} flex items-center justify-center text-xs font-bold border border-blue-200">
                        <i class="fa-solid ${isSelectedFlavor ? 'fa-check' : 'fa-plus'}"></i>
                    </div>
                </div>
            </div>
        `;
    };

    if (category.id === 'bebidas' && !query) {
        const bevGroups = [
            { id: 'cerveza', label: 'Cervezas', icon: 'fa-beer-mug-empty' },
            { id: 'gaseosa', label: 'Gaseosas y Saborizadas', icon: 'fa-bottle-water' },
            { id: 'agua', label: 'Aguas y Sodas', icon: 'fa-glass-water' },
            { id: 'jarro', label: 'Tragos', icon: 'fa-martini-glass-citrus' },
            { id: 'vino', label: 'Vinos', icon: 'fa-wine-glass' },
            { id: 'otro', label: 'Otras Bebidas', icon: 'fa-wine-bottle' }
        ];

        container.innerHTML = bevGroups.map(group => {
            const groupItems = items.filter(it => {
                const cat = it.bevCategory || 'otro';
                if (group.id === 'agua') return cat === 'agua' || cat === 'saborizada';
                if (group.id === 'jarro') return cat === 'jarro' || cat === 'trago';
                return cat === group.id;
            });
            if (groupItems.length === 0) return '';
            const countText = groupItems.length === 1 ? '1 opción' : `${groupItems.length} opciones`;
            return `
                <div class="col-span-full space-y-2.5 mb-2">
                    <div class="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid ${group.icon} text-[#2563eb] text-sm"></i>
                            <span class="font-extrabold text-slate-900 text-xs sm:text-sm">${group.label}</span>
                        </div>
                        <span class="text-[11px] font-bold text-[#2563eb] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">${countText}</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                        ${groupItems.map(renderCard).join('')}
                    </div>
                </div>
            `;
        }).join('');
        return;
    }

    container.innerHTML = items.map(renderCard).join('');
}

function onMenuItemClicked(itemId) {
    if (!currentTable) {
        showToast('Selecciona una mesa primero', 'error');
        return;
    }

    let foundItem = null;
    for (const cat of menuData) {
        const it = (cat.items || []).find(i => String(i.id) === String(itemId));
        if (it) {
            foundItem = it;
            break;
        }
    }
    if (!foundItem) return;

    if (foundItem.isPizzaLibre) {
        openPizzaLibreModal(foundItem);
        return;
    }

    if (foundItem.isPizza) {
        onPizzaItemClicked(foundItem);
        return;
    }

    addDirectItemToOrder({
        id: foundItem.id,
        name: foundItem.name,
        price: Number(foundItem.price) || 0,
        isPizza: false,
        isPizzaLibre: false,
        isEmpanada: !!foundItem.isEmpanada || foundItem.id === 'item_empanada',
        isPostre: !!foundItem.isPostre || foundItem.id === 'item_postre',
        isBeverage: !!foundItem.isBeverage
    });
}

function onPizzaItemClicked(pizzaItem) {
    const { size, count } = getPizzaSelectionParams();
    selectedPizzaFlavors.push(pizzaItem.name);

    if (selectedPizzaFlavors.length < count) {
        renderMenuItems();
        showToast(`Marcado ${selectedPizzaFlavors.length}º gusto: ${pizzaItem.name}. Tocá el ${selectedPizzaFlavors.length + 1}º gusto.`, 'info');
        return;
    }

    const toppings = [...selectedPizzaFlavors];
    const unitPrice = calculateMozosPizzaPrice(size, toppings);
    const sizeLabel = size === 'media' ? 'Media Pizza' : 'Pizza Entera';
    const itemName = `${sizeLabel} (${toppings.join(' / ')})`;
    const noteToAttach = (inlinePizzaNote || '').trim();

    selectedPizzaFlavors = [];
    inlinePizzaNote = '';

    addDirectItemToOrder({
        id: `pizza_${size}_${toppings.join('_')}`,
        name: itemName,
        price: unitPrice,
        qty: 1,
        note: noteToAttach,
        isPizza: true,
        isPizzaLibre: false,
        pizzaSize: size,
        pizzaConfigType: size === 'media' ? 'media' : `${count}_flavors`,
        toppings
    });
}

// ============================================================================
// MODAL CONFIGURADOR DE PIZZAS (ENTERA / MEDIA, 1 / 2 / 3 GUSTOS)
// ============================================================================
function openPizzaBuilderModal(initialSize = 'entera', initialCount = 1, preselectedFlavor = null) {
    pizzaModalSize = initialSize === 'media' ? 'media' : 'entera';
    pizzaModalFlavorsCount = initialCount || 1;
    if (pizzaModalSize === 'media' && pizzaModalFlavorsCount > 2) {
        pizzaModalFlavorsCount = 2;
    }
    pizzaModalQty = 1;

    const subtitle = document.getElementById('pizza-modal-subtitle');
    if (subtitle) subtitle.textContent = currentTable || 'Mesa';

    const qtyIn = document.getElementById('pizza-qty-input');
    if (qtyIn) qtyIn.value = '1';

    const noteIn = document.getElementById('pizza-note-input');
    if (noteIn) noteIn.value = '';

    const customIn = document.getElementById('pizza-custom-flavor-input');
    if (customIn) customIn.value = '';

    const flavors = getPizzaFlavorsCatalog();
    [1, 2, 3].forEach(idx => {
        const sel = document.getElementById(`select-pizza-flavor-${idx}`);
        if (!sel) return;
        sel.innerHTML = flavors.map(f =>
            `<option value="${f.name}">${f.name} ($${Number(f.price).toLocaleString('es-AR')})</option>`
        ).join('');
        if (idx === 1 && preselectedFlavor) {
            sel.value = preselectedFlavor;
        } else if (flavors[idx - 1]) {
            sel.value = flavors[idx - 1].name;
        }
    });

    const modal = document.getElementById('pizza-builder-modal');
    if (modal) modal.classList.remove('hidden');

    syncPizzaModalButtonsUI();
    onPizzaFlavorSelectChange();
}

function closePizzaBuilderModal() {
    const modal = document.getElementById('pizza-builder-modal');
    if (modal) modal.classList.add('hidden');
}

function setPizzaModalSize(size) {
    pizzaModalSize = size === 'media' ? 'media' : 'entera';
    if (pizzaModalSize === 'media' && pizzaModalFlavorsCount > 2) {
        pizzaModalFlavorsCount = 2;
    }
    syncPizzaModalButtonsUI();
    onPizzaFlavorSelectChange();
}

function setPizzaFlavorsCount(count) {
    if (pizzaModalSize === 'media' && count > 2) {
        showToast('En Media Pizza se pueden combinar hasta 2 gustos', 'info');
        count = 2;
    }
    pizzaModalFlavorsCount = count;
    syncPizzaModalButtonsUI();
    onPizzaFlavorSelectChange();
}

function syncPizzaModalButtonsUI() {
    const btnEntera = document.getElementById('btn-pizza-size-entera');
    const btnMedia = document.getElementById('btn-pizza-size-media');

    if (btnEntera && btnMedia) {
        btnEntera.className = pizzaModalSize === 'entera'
            ? 'py-2 px-3 rounded-xl border-2 border-[#2563eb] bg-blue-50/80 text-[#2563eb] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm'
            : 'py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all';
        btnMedia.className = pizzaModalSize === 'media'
            ? 'py-2 px-3 rounded-xl border-2 border-[#2563eb] bg-blue-50/80 text-[#2563eb] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm'
            : 'py-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all';
    }

    [1, 2, 3].forEach(n => {
        const btn = document.getElementById(`btn-pizza-gustos-${n}`);
        if (!btn) return;
        if (n === pizzaModalFlavorsCount) {
            btn.className = 'py-2.5 px-2 rounded-2xl border-2 border-[#2563eb] bg-blue-50/80 text-[#2563eb] font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-sm';
        } else {
            btn.className = 'py-2.5 px-2 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all';
        }
    });

    const c2 = document.getElementById('container-gusto-2');
    const c3 = document.getElementById('container-gusto-3');
    if (c2) {
        if (pizzaModalFlavorsCount >= 2) c2.classList.remove('hidden');
        else c2.classList.add('hidden');
    }
    if (c3) {
        if (pizzaModalFlavorsCount >= 3) c3.classList.remove('hidden');
        else c3.classList.add('hidden');
    }
}

function getSelectedModalToppings() {
    const s1 = document.getElementById('select-pizza-flavor-1')?.value;
    const s2 = document.getElementById('select-pizza-flavor-2')?.value;
    const s3 = document.getElementById('select-pizza-flavor-3')?.value;

    const toppings = [];
    if (s1) toppings.push(s1);
    if (pizzaModalFlavorsCount >= 2 && s2) toppings.push(s2);
    if (pizzaModalFlavorsCount >= 3 && s3) toppings.push(s3);
    return toppings;
}

function onPizzaFlavorSelectChange() {
    const toppings = getSelectedModalToppings();
    const unitPrice = calculateMozosPizzaPrice(pizzaModalSize, toppings);
    const totalPrice = unitPrice * pizzaModalQty;

    const sizeLabel = pizzaModalSize === 'media' ? 'Media Pizza' : 'Pizza Entera';
    const previewName = document.getElementById('pizza-preview-name');
    const previewCalc = document.getElementById('pizza-preview-calculation');
    const previewTotal = document.getElementById('pizza-preview-total');

    if (previewName) {
        previewName.textContent = `${sizeLabel} (${toppings.join(' / ')})`;
    }
    if (previewCalc) {
        previewCalc.textContent = `$${unitPrice.toLocaleString('es-AR')} c/u × ${pizzaModalQty}`;
    }
    if (previewTotal) {
        previewTotal.textContent = `$${totalPrice.toLocaleString('es-AR')}`;
    }
}

function changePizzaModalQty(delta) {
    pizzaModalQty = Math.max(1, pizzaModalQty + delta);
    const qtyIn = document.getElementById('pizza-qty-input');
    if (qtyIn) qtyIn.value = String(pizzaModalQty);
    onPizzaFlavorSelectChange();
}

function confirmAddPizzaToOrder() {
    const toppings = getSelectedModalToppings();
    if (toppings.length === 0) {
        showToast('Selecciona al menos un gusto de pizza', 'error');
        return;
    }

    const unitPrice = calculateMozosPizzaPrice(pizzaModalSize, toppings);
    const noteIn = document.getElementById('pizza-note-input');
    const customIn = document.getElementById('pizza-custom-flavor-input');
    const extraCustom = customIn ? customIn.value.trim() : '';
    const rawNote = noteIn ? noteIn.value.trim() : '';
    const note = [extraCustom, rawNote].filter(Boolean).join(' - ');

    const sizeLabel = pizzaModalSize === 'media' ? 'Media Pizza' : 'Pizza Entera';
    const itemName = `${sizeLabel} (${toppings.join(' / ')})`;

    addDirectItemToOrder({
        id: `pizza_${pizzaModalSize}_${toppings.join('_')}`,
        name: itemName,
        price: unitPrice,
        qty: pizzaModalQty,
        note,
        isPizza: true,
        isPizzaLibre: false,
        pizzaSize: pizzaModalSize,
        pizzaConfigType: pizzaModalSize === 'media' ? 'media' : `${pizzaModalFlavorsCount}_flavors`,
        toppings
    });

    closePizzaBuilderModal();
}

// ============================================================================
// MODAL PIZZA LIBRE (1RA RONDA Y SIGUIENTES RONDAS)
// ============================================================================
function openPizzaLibreModal(item) {
    pizzaLibreModalType = item.libreType || 'G';
    pizzaLibreModalPrice = Number(item.price) || Number(mozosPrices?.pizzaLibreG || mozosPrices?.pizzaLibreH) || 16000;
    pizzaLibreModalName = item.name || 'Pizza Libre General';
    pizzaLibreCount = 1;
    selectedLibreExclusions = [];

    const countEl = document.getElementById('pizza-libre-count');
    if (countEl) countEl.textContent = '1';

    const totalEl = document.getElementById('pizza-libre-total-display');
    if (totalEl) totalEl.textContent = `$${pizzaLibreModalPrice.toLocaleString('es-AR')}`;

    const textEl = document.getElementById('pizza-libre-exclusions-text');
    if (textEl) textEl.value = '';

    const chipsContainer = document.getElementById('pizza-libre-exclusion-chips');
    if (chipsContainer) {
        const flavors = getPizzaFlavorsCatalog();
        chipsContainer.innerHTML = flavors.map(f => {
            const safe = f.name.replace(/'/g, "\\'");
            return `
                <button type="button" onclick="toggleLibreExclusionChip('${safe}')"
                    id="excl-chip-${f.name}"
                    class="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 transition-all">
                    Sin ${f.name}
                </button>
            `;
        }).join('');
    }

    const modal = document.getElementById('pizza-libre-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePizzaLibreModal() {
    const modal = document.getElementById('pizza-libre-modal');
    if (modal) modal.classList.add('hidden');
}

function changePizzaLibreCount(delta) {
    pizzaLibreCount = Math.max(1, pizzaLibreCount + delta);
    const countEl = document.getElementById('pizza-libre-count');
    if (countEl) countEl.textContent = String(pizzaLibreCount);
    const totalEl = document.getElementById('pizza-libre-total-display');
    if (totalEl) totalEl.textContent = `$${(pizzaLibreModalPrice * pizzaLibreCount).toLocaleString('es-AR')}`;
}

function toggleLibreExclusionChip(flavorName) {
    const idx = selectedLibreExclusions.indexOf(flavorName);
    if (idx !== -1) selectedLibreExclusions.splice(idx, 1);
    else selectedLibreExclusions.push(flavorName);

    const chipBtn = document.getElementById(`excl-chip-${flavorName}`);
    if (chipBtn) {
        const isSel = selectedLibreExclusions.includes(flavorName);
        chipBtn.className = isSel
            ? 'px-2.5 py-1 rounded-full text-[11px] font-bold border border-rose-500 bg-rose-500 text-white transition-all shadow-sm'
            : 'px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 transition-all';
    }

    const textEl = document.getElementById('pizza-libre-exclusions-text');
    if (textEl) {
        textEl.value = selectedLibreExclusions.length > 0
            ? `NO QUIEREN: ${selectedLibreExclusions.map(f => `Sin ${f}`).join(', ')}`
            : '';
    }
}

function confirmAddPizzaLibre() {
    const textEl = document.getElementById('pizza-libre-exclusions-text');
    const rawNote = textEl ? textEl.value.trim() : '';
    const note = (rawNote && selectedLibreExclusions.length > 0 && !/^no quieren/i.test(rawNote))
        ? `NO QUIEREN: ${rawNote}`
        : rawNote;

    if (note && currentTable && ordersByTable[currentTable] && !ordersByTable[currentTable].note) {
        ordersByTable[currentTable].note = note;
    }

    addDirectItemToOrder({
        id: `pizza_libre_${pizzaLibreModalType.toLowerCase()}`,
        name: pizzaLibreModalName,
        price: pizzaLibreModalPrice,
        qty: pizzaLibreCount,
        note,
        isPizza: true,
        isPizzaLibre: true,
        libreType: pizzaLibreModalType,
        libreExclusions: [...selectedLibreExclusions]
    });

    closePizzaLibreModal();
}

function openNextRoundModal() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    const nextRound = (Number(tableOrder.libreRounds) || 1) + 1;
    selectedNextRoundFlavors = [];

    const titleEl = document.getElementById('next-round-modal-title');
    if (titleEl) titleEl.textContent = `Pedir Ronda #${nextRound}`;

    const exclIn = document.getElementById('next-round-exclusions-input');
    if (exclIn) exclIn.value = tableOrder.note || '';

    const notesIn = document.getElementById('next-round-notes');
    if (notesIn) notesIn.value = '';

    const chipsEl = document.getElementById('next-round-flavor-chips');
    if (chipsEl) {
        const flavors = getPizzaFlavorsCatalog();
        chipsEl.innerHTML = flavors.map(f => {
            const safe = f.name.replace(/'/g, "\\'");
            return `
                <button type="button" onclick="toggleNextRoundChip('${safe}')"
                    class="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-blue-200 bg-blue-50 text-[#2563eb]">
                    + ${f.name}
                </button>
            `;
        }).join('');
    }

    const modal = document.getElementById('pizza-libre-next-round-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeNextRoundModal() {
    const modal = document.getElementById('pizza-libre-next-round-modal');
    if (modal) modal.classList.add('hidden');
}

function toggleNextRoundChip(flavorName) {
    selectedNextRoundFlavors.push(flavorName);
    const notesIn = document.getElementById('next-round-notes');
    if (notesIn) {
        notesIn.value = selectedNextRoundFlavors.join(', ');
    }
}

async function confirmAddNextRound() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    tableOrder.libreRounds = (Number(tableOrder.libreRounds) || 1) + 1;

    const exclIn = document.getElementById('next-round-exclusions-input');
    const notesIn = document.getElementById('next-round-notes');
    const combinedNote = [exclIn ? exclIn.value.trim() : '', notesIn ? notesIn.value.trim() : ''].filter(Boolean).join(' | ');

    isSavingOrder = true;
    try {
        const res = await fetch('/api/orders/send-kitchen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table: currentTable,
                waiter: tableOrder.waiter || currentUser || 'Mozo',
                note: combinedNote || tableOrder.note || '',
                items: tableOrder.items,
                newItemsToSend: [{
                    id: 'pizza_libre_round',
                    name: `Ronda #${tableOrder.libreRounds} Pizza Libre`,
                    isPizza: true,
                    isPizzaLibre: true,
                    isLibreRound: true,
                    sendQty: 1,
                    price: 0,
                    note: combinedNote
                }],
                libreRound: tableOrder.libreRounds
            })
        });
        if (res.ok) {
            closeNextRoundModal();
            renderMenuItems();
            renderOrder();
            showToast(`Ronda #${tableOrder.libreRounds} enviada a la cola de Sistema Pedidos`, 'success');
        }
    } catch (e) {
        showToast('Error al enviar siguiente ronda', 'error');
    } finally {
        isSavingOrder = false;
        await fetchServerState(true);
    }
}

// ============================================================================
// GESTIÓN DE LA COMANDA DE LA MESA Y ENVÍO A COCINA + SISTEMA_MOZOS
// ============================================================================
async function addDirectItemToOrder(newItem) {
    if (!currentTable) return;
    const tableOrder = ordersByTable[currentTable];
    if (!tableOrder) return;

    if (tableOrder.isPaid) {
        showToast('Esta mesa figura PAGADA. Libérala o desmarca el pago antes de agregar productos.', 'error');
        return;
    }

    const addQty = Number(newItem.qty) || 1;
    const existing = tableOrder.items.find(it =>
        it.name === newItem.name &&
        (it.note || '') === (newItem.note || '') &&
        (it.pizzaSize || 'entera') === (newItem.pizzaSize || 'entera')
    );

    if (existing) {
        existing.qty = (Number(existing.qty) || 0) + addQty;
        existing.price = Number(newItem.price) || existing.price;
    } else {
        tableOrder.items.push({
            id: newItem.id || `item_${Date.now()}`,
            name: newItem.name,
            price: Number(newItem.price) || 0,
            qty: addQty,
            sentQty: 0,
            note: newItem.note || '',
            isPizza: !!newItem.isPizza,
            isPizzaLibre: !!newItem.isPizzaLibre,
            libreType: newItem.libreType || null,
            isEmpanada: !!newItem.isEmpanada,
            isPostre: !!newItem.isPostre,
            isBeverage: !!newItem.isBeverage,
            pizzaSize: newItem.pizzaSize || 'entera',
            pizzaConfigType: newItem.pizzaConfigType || '1_flavor',
            toppings: Array.isArray(newItem.toppings) ? newItem.toppings : []
        });
    }

    renderOrder();
    renderMenuItems();
    await saveCurrentTableToServer();
    showToast(`Agregado: ${newItem.name}`, 'success');
}

async function changeOrderItemQty(index, delta) {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    if (tableOrder.isPaid) {
        showToast('La mesa está marcada como pagada.', 'error');
        return;
    }

    const item = tableOrder.items[index];
    if (!item) return;

    item.qty = (Number(item.qty) || 0) + delta;
    if (item.qty <= 0) {
        tableOrder.items.splice(index, 1);
    } else if (item.sentQty > item.qty) {
        item.sentQty = item.qty;
    }

    renderOrder();
    renderMenuItems();
    await saveCurrentTableToServer();
}

function saveCurrentNote(val) {
    if (!currentTable || !ordersByTable[currentTable]) return;
    ordersByTable[currentTable].note = val;
    saveCurrentTableToServer();
}

async function saveCurrentTableToServer() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    isSavingOrder = true;
    try {
        await fetch(`/api/tables/${encodeURIComponent(currentTable)}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                waiter: tableOrder.waiter || currentUser || 'Mozo',
                items: tableOrder.items,
                note: tableOrder.note || '',
                libreRounds: tableOrder.libreRounds || 1
            })
        });
    } catch (e) {
        console.error('Error guardando mesa:', e);
    } finally {
        isSavingOrder = false;
    }
}

function renderOrder(skipNoteUpdate = false) {
    const listEl = document.getElementById('order-items-list');
    const totalEl = document.getElementById('order-total-price');
    const noteInput = document.getElementById('order-note');
    const countBadge = document.getElementById('item-count-badge');
    const drawerTitleMobile = document.getElementById('drawer-title-mobile');
    const drawerTotalPreview = document.getElementById('drawer-total-preview');
    const payBtn = document.getElementById('pay-table-btn');
    const sendBtn = document.getElementById('send-order-btn');
    const unsentBanner = document.getElementById('table-unsent-alert-banner');

    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    const items = Array.isArray(tableOrder.items) ? tableOrder.items : [];

    if (noteInput && !skipNoteUpdate) {
        noteInput.value = tableOrder.note || '';
    }

    let total = 0;
    let totalItemsCount = 0;
    let unsentCount = 0;

    items.forEach(it => {
        const q = Number(it.qty) || 0;
        const sq = Number(it.sentQty) || 0;
        total += (Number(it.price) || 0) * q;
        totalItemsCount += q;
        if (q > sq) unsentCount += (q - sq);
    });

    if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')}`;
    if (countBadge) countBadge.textContent = `${totalItemsCount} ítems`;
    if (drawerTitleMobile) drawerTitleMobile.textContent = `Ver Comanda (${totalItemsCount} ítems)`;
    if (drawerTotalPreview) drawerTotalPreview.textContent = `$${total.toLocaleString('es-AR')}`;

    if (payBtn) payBtn.disabled = totalItemsCount === 0 || !!tableOrder.isPaid;
    if (sendBtn) sendBtn.disabled = unsentCount === 0 || !!tableOrder.isPaid;

    if (unsentBanner) {
        if (unsentCount > 0 && !tableOrder.isPaid) {
            unsentBanner.className = 'bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-xs text-amber-900';
            unsentBanner.innerHTML = `
                <span><i class="fa-solid fa-bell text-amber-600 mr-1.5"></i>Tienes <strong>${unsentCount} producto(s)</strong> sin enviar a cocina.</span>
                <button onclick="sendOrderToKitchen()" class="bg-amber-500 hover:bg-amber-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px]">Enviar Ahora</button>
            `;
        } else {
            unsentBanner.className = 'hidden';
            unsentBanner.innerHTML = '';
        }
    }

    if (!listEl) return;

    let html = '';

    if (tableOrder.isPaid) {
        const safeTable = currentTable.replace(/'/g, "\\'");
        html += `
            <div class="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 mb-2">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-extrabold text-xs uppercase text-emerald-700">
                        <i class="fa-solid fa-circle-check mr-1"></i> MESA PAGADA
                    </span>
                    <span class="font-extrabold text-sm">$${(tableOrder.paidAmount || total).toLocaleString('es-AR')}</span>
                </div>
                <p class="text-[11px] text-emerald-700 mb-2.5">
                    El ticket se puede imprimir desde la PC de Sistema Mozos. Cuando se retiren los clientes, libera la mesa.
                </p>
                <div class="flex gap-2">
                    <button onclick="freePaidTable('${safeTable}', event)"
                        class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm">
                        <i class="fa-solid fa-broom mr-1"></i> Liberar Mesa
                    </button>
                    <button onclick="unpayTable('${safeTable}', event)"
                        class="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300">
                        Desmarcar
                    </button>
                </div>
            </div>
        `;
    }

    if (items.length === 0) {
        html += `
            <div class="text-center py-8 text-slate-400">
                <i class="fa-solid fa-receipt text-2xl mb-2 opacity-40"></i>
                <p class="text-xs">La comanda de esta mesa está vacía.</p>
            </div>
        `;
    } else {
        html += items.map((it, idx) => {
            const qty = Number(it.qty) || 0;
            const sentQty = Number(it.sentQty) || 0;
            const pending = Math.max(0, qty - sentQty);
            const lineTotal = (Number(it.price) || 0) * qty;

            return `
                <div class="py-2.5 flex items-center justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-slate-900 text-xs sm:text-sm">${it.name}</span>
                            ${pending > 0
                                ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">${pending} sin enviar</span>`
                                : `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Enviado</span>`
                            }
                            ${it.isPizza ? `
                                <button onclick="editOrderItemNote(${idx})"
                                    title="Agregar o editar observación / qué gusto no quiere"
                                    class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 transition-colors cursor-pointer">
                                    <i class="fa-solid fa-pen text-[9px] mr-0.5"></i>Obs
                                </button>
                            ` : ''}
                        </div>
                        ${it.note ? `<p class="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 inline-block mt-1">⚠️ ${it.note}</p>` : ''}
                        <p class="text-xs font-extrabold text-[#2563eb] mt-0.5">$${lineTotal.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="changeOrderItemQty(${idx}, -1)"
                            class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <span class="w-6 text-center font-extrabold text-slate-900 text-xs sm:text-sm">${qty}</span>
                        <button onclick="changeOrderItemQty(${idx}, 1)"
                            class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563eb] font-bold text-xs flex items-center justify-center border border-blue-200">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    listEl.innerHTML = html;
}

async function editOrderItemNote(index) {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    const item = tableOrder.items[index];
    if (!item) return;

    const currentNote = item.note || '';
    const updated = window.prompt(`Observación / Qué gusto o ingrediente NO quiere en ${item.name}:`, currentNote);
    if (updated === null) return;
    item.note = updated.trim();
    if (item.isPizzaLibre && item.note) {
        tableOrder.note = item.note;
    }
    renderOrder();
    await saveCurrentTableToServer();
    showToast('Observación actualizada', 'success');
}

async function sendOrderToKitchen() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    if (tableOrder.isPaid) {
        showToast('La mesa ya está pagada.', 'error');
        return;
    }

    const items = Array.isArray(tableOrder.items) ? tableOrder.items : [];
    const newItemsToSend = [];
    items.forEach(it => {
        const diff = (Number(it.qty) || 0) - (Number(it.sentQty) || 0);
        if (diff > 0) {
            newItemsToSend.push({
                ...it,
                sendQty: diff
            });
        }
    });

    if (newItemsToSend.length === 0) {
        showToast('Todos los productos actuales ya fueron enviados.', 'info');
        return;
    }

    isSavingOrder = true;
    try {
        const res = await fetch('/api/orders/send-kitchen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table: currentTable,
                waiter: tableOrder.waiter || currentUser || 'Mozo',
                note: tableOrder.note || '',
                items: tableOrder.items,
                newItemsToSend,
                libreRound: tableOrder.libreRounds || 1
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            tableOrder.items.forEach(it => {
                it.sentQty = Number(it.qty) || 0;
            });
            renderOrder();
            showToast('¡Enviado! Pizzas y empanadas en cola de Sistema Pedidos y mesa actualizada en Sistema Mozos.', 'success');
        } else {
            showToast(data.error || 'Error al enviar comanda', 'error');
        }
    } catch (e) {
        showToast('Error de red al enviar comanda', 'error');
    } finally {
        isSavingOrder = false;
        await fetchServerState(true);
    }
}

// ============================================================================
// COBRO DE MESA (SINCRONIZADO CON SISTEMA_MOZOS)
// ============================================================================
function openPaymentByTable(tableName, event) {
    if (event) event.stopPropagation();
    const target = tableName || currentTable;
    if (!target || !ordersByTable[target]) return;

    const tableOrder = ordersByTable[target];
    const items = Array.isArray(tableOrder.items) ? tableOrder.items : [];
    if (items.length === 0) {
        showToast('La mesa no tiene productos cargados para cobrar', 'error');
        return;
    }

    checkoutTableTarget = target;
    currentCheckoutSubtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    selectedPaymentMethod = 'Efectivo';

    const subtitleEl = document.getElementById('pay-modal-subtitle');
    const totalEl = document.getElementById('pay-modal-total');
    const waiterSel = document.getElementById('pay-waiter-select');
    const cashIn = document.getElementById('cash-paid-input');
    const tipEl = document.getElementById('tip-calculated-display');
    const freeCheck = document.getElementById('free-table-after-pay-checkbox');

    if (subtitleEl) subtitleEl.textContent = target;
    if (totalEl) totalEl.textContent = `$${currentCheckoutSubtotal.toLocaleString('es-AR')}`;

    if (waiterSel) {
        const names = staffList.map(s => s.name);
        if (currentUser && !names.includes(currentUser)) names.unshift(currentUser);
        waiterSel.innerHTML = names.map(n =>
            `<option value="${n}" ${n === (tableOrder.waiter || currentUser) ? 'selected' : ''}>${n}</option>`
        ).join('');
    }

    if (cashIn) cashIn.value = String(currentCheckoutSubtotal);
    if (tipEl) tipEl.textContent = '$0';
    if (freeCheck) freeCheck.checked = false;

    selectPaymentMethod('Efectivo');

    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('hidden');
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    const btnEf = document.getElementById('btn-method-efectivo');
    const btnTr = document.getElementById('btn-method-transferencia');

    if (btnEf && btnTr) {
        if (method === 'Efectivo') {
            btnEf.className = 'py-2.5 px-3 rounded-xl border-2 border-[#2563eb] bg-blue-50/70 text-[#2563eb] font-bold text-xs flex items-center justify-center space-x-2 transition-all';
            btnTr.className = 'py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center space-x-2 transition-all';
        } else {
            btnTr.className = 'py-2.5 px-3 rounded-xl border-2 border-[#2563eb] bg-blue-50/70 text-[#2563eb] font-bold text-xs flex items-center justify-center space-x-2 transition-all';
            btnEf.className = 'py-2.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center space-x-2 transition-all';
        }
    }
}

function onCashPaidInput() {
    const cashIn = document.getElementById('cash-paid-input');
    const tipEl = document.getElementById('tip-calculated-display');
    const paid = Number(cashIn ? cashIn.value : 0) || 0;
    const tip = Math.max(0, paid - currentCheckoutSubtotal);
    if (tipEl) tipEl.textContent = `$${tip.toLocaleString('es-AR')}`;
}

async function confirmPaymentAndFinish() {
    const target = checkoutTableTarget || currentTable;
    if (!target || !ordersByTable[target]) return;
    const tableOrder = ordersByTable[target];

    const cashIn = document.getElementById('cash-paid-input');
    const waiterSel = document.getElementById('pay-waiter-select');
    const freeCheck = document.getElementById('free-table-after-pay-checkbox');

    const rawPaid = Number(cashIn ? cashIn.value : 0);
    const totalPaid = (!isNaN(rawPaid) && rawPaid >= currentCheckoutSubtotal) ? rawPaid : currentCheckoutSubtotal;
    const tipAmount = Math.max(0, totalPaid - currentCheckoutSubtotal);
    const waiter = waiterSel ? waiterSel.value : (tableOrder.waiter || currentUser || 'Mozo');
    const freeTableAfterPay = freeCheck ? !!freeCheck.checked : false;

    const cashAmount = selectedPaymentMethod === 'Efectivo' ? totalPaid : 0;
    const transferAmount = selectedPaymentMethod === 'Transferencia' ? totalPaid : 0;

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table: target,
                waiter,
                paymentMethod: selectedPaymentMethod,
                subtotal: currentCheckoutSubtotal,
                tipAmount,
                cashAmount,
                transferAmount,
                totalPaid,
                items: tableOrder.items,
                freeTableAfterPay
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            closePaymentModal();
            await fetchServerState(true);
            if (freeTableAfterPay) {
                showToast(`${target} cobrada y liberada para nuevos clientes`, 'success');
            } else {
                showToast(`${target} marcada como PAGADA en Sistema Mozos y Humboldt`, 'success');
            }
            if (currentTable === target) {
                backToTablesView();
            }
        } else {
            showToast(data.error || 'Error al registrar el cobro', 'error');
        }
    } catch (e) {
        showToast('Error de red al procesar el cobro', 'error');
    }
}

// ============================================================================
// MODALES DE HISTORIAL DE PAGOS Y CAJA DE PROPINAS
// ============================================================================
function openPaymentHistoryModal() {
    renderPaymentHistoryModalContent();
    const modal = document.getElementById('payment-history-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePaymentHistoryModal() {
    const modal = document.getElementById('payment-history-modal');
    if (modal) modal.classList.add('hidden');
}

function renderPaymentHistoryModalContent() {
    let sales = 0, cash = 0, trans = 0;
    paymentHistory.forEach(p => {
        sales += Number(p.subtotal) || 0;
        cash += Number(p.cashAmount) || 0;
        trans += Number(p.transferAmount) || 0;
    });

    const elSales = document.getElementById('reg-total-sales');
    const elCash = document.getElementById('reg-total-cash');
    const elTrans = document.getElementById('reg-total-transfer');
    const elTips = document.getElementById('reg-total-tips');

    if (elSales) elSales.textContent = `$${sales.toLocaleString('es-AR')}`;
    if (elCash) elCash.textContent = `$${cash.toLocaleString('es-AR')}`;
    if (elTrans) elTrans.textContent = `$${trans.toLocaleString('es-AR')}`;
    if (elTips) elTips.textContent = `$${generalTipsPool.toLocaleString('es-AR')}`;

    const listEl = document.getElementById('payment-history-list');
    if (!listEl) return;

    if (paymentHistory.length === 0) {
        listEl.innerHTML = `<p class="text-slate-400 text-xs text-center py-6">No hay pagos registrados en este turno.</p>`;
        return;
    }

    listEl.innerHTML = paymentHistory.map(p => `
        <div class="py-2.5 flex items-center justify-between text-xs">
            <div>
                <span class="font-bold text-slate-900">${p.table}</span>
                <span class="text-slate-500 ml-1">• ${p.waiter} (${p.method})</span>
                <span class="text-[10px] text-slate-400 block">${p.timestamp || ''}</span>
            </div>
            <div class="text-right">
                <span class="font-bold text-emerald-600 block">$${Number(p.totalPaid).toLocaleString('es-AR')}</span>
                ${p.tip > 0 ? `<span class="text-[10px] text-[#2563eb] font-semibold">Propina: $${Number(p.tip).toLocaleString('es-AR')}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function openTipsModal() {
    const totalEl = document.getElementById('tips-grand-total');
    if (totalEl) totalEl.textContent = `$${generalTipsPool.toLocaleString('es-AR')}`;
    const modal = document.getElementById('tips-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeTipsModal() {
    const modal = document.getElementById('tips-modal');
    if (modal) modal.classList.add('hidden');
}

function openPaymentHistoryFromTips() {
    closeTipsModal();
    openPaymentHistoryModal();
}

// ============================================================================
// PANEL DE ADMINISTRACIÓN (CARTA DE PRECIOS MOZOS, REPORTES, PERSONAL)
// ============================================================================
function switchAdminTab(tab) {
    currentAdminSubTab = tab;
    const tabs = ['menu', 'report', 'staff'];
    tabs.forEach(t => {
        const btn = document.getElementById(`admin-tab-${t}`);
        const view = document.getElementById(`admin-subview-${t}`);
        if (btn) {
            btn.className = t === tab
                ? 'flex-1 min-w-fit px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-[#2563eb] shadow-sm transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap active:scale-95'
                : 'flex-1 min-w-fit px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap active:scale-95';
        }
        if (view) {
            if (t === tab) view.classList.remove('hidden');
            else view.classList.add('hidden');
        }
    });
    renderAdminActiveSubTab();
}

function renderAdminActiveSubTab() {
    if (currentAdminSubTab === 'menu') {
        renderAdminMenuManager();
    } else if (currentAdminSubTab === 'report') {
        renderAdminNightReport();
    } else if (currentAdminSubTab === 'staff') {
        renderAdminStaffManager();
    }
}

function renderAdminMenuManager() {
    const catSelect = document.getElementById('new-item-cat');
    if (catSelect) {
        catSelect.innerHTML = menuData.map(c =>
            `<option value="${c.id}">${c.name}</option>`
        ).join('');
    }

    const catList = document.getElementById('admin-categories-list');
    if (catList) {
        catList.innerHTML = menuData.map(c => `
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <span class="font-semibold text-slate-700"><i class="fa-solid ${c.icon} text-[#2563eb] mr-1.5"></i>${c.name}</span>
                <span class="text-[10px] font-bold text-slate-500">${(c.items || []).length} ítems</span>
            </div>
        `).join('');
    }

    const totalBadge = document.getElementById('admin-total-products-badge');
    const totalCount = menuData.reduce((acc, c) => acc + (c.items ? c.items.length : 0), 0);
    if (totalBadge) totalBadge.textContent = `${totalCount} ítems`;

    const listEl = document.getElementById('admin-menu-items-list');
    if (!listEl) return;

    listEl.innerHTML = menuData.map(cat => `
        <div class="space-y-2">
            <h5 class="font-bold text-xs text-[#2563eb] uppercase tracking-wider flex items-center gap-1.5">
                <i class="fa-solid ${cat.icon}"></i>
                <span>${cat.name}</span>
            </h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${(cat.items || []).map(item => {
                    const safeId = String(item.id).replace(/'/g, "\\'");
                    const safeName = String(item.name).replace(/'/g, "\\'");
                    const safeDesc = String(item.desc || '').replace(/'/g, "\\'");
                    const canDelete = String(item.id).startsWith('pizza_flavor_') || String(item.id).startsWith('bev_');

                    return `
                        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <p class="font-bold text-slate-900 text-xs truncate">${item.name}</p>
                                <p class="text-xs font-extrabold text-[#2563eb]">$${Number(item.price).toLocaleString('es-AR')}</p>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="openEditMenuItemModal('${cat.id}', '${safeId}', '${safeName}', ${Number(item.price) || 0}, '${safeDesc}')"
                                    class="p-2 rounded-lg bg-white hover:bg-blue-50 text-slate-600 hover:text-[#2563eb] border border-slate-200 text-xs">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                ${canDelete ? `
                                    <button onclick="deleteAdminMenuItem('${safeId}')"
                                        class="p-2 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 text-xs">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function createNewCategory() {
    showToast('Las categorías principales están sincronizadas con la estructura de Sistema Mozos (Pizzas, Empanadas/Postres y Bebidas).', 'info');
}

async function addNewMenuItem() {
    const catEl = document.getElementById('new-item-cat');
    const nameEl = document.getElementById('new-item-name');
    const priceEl = document.getElementById('new-item-price');
    const descEl = document.getElementById('new-item-desc');

    const category = catEl ? catEl.value : 'pizzas';
    const name = nameEl ? nameEl.value.trim() : '';
    const price = priceEl ? Number(priceEl.value) : 0;

    if (!name || price <= 0) {
        showToast('Completa nombre y precio válido', 'error');
        return;
    }

    try {
        const res = await fetch('/api/menu/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, name, price })
        });
        if (res.ok) {
            if (nameEl) nameEl.value = '';
            if (priceEl) priceEl.value = '';
            if (descEl) descEl.value = '';
            await fetchServerState(true);
            showToast('Producto agregado y sincronizado con Sistema Mozos', 'success');
        }
    } catch (e) {
        showToast('Error al agregar producto', 'error');
    }
}

function openEditMenuItemModal(catId, itemId, name, price, desc = '') {
    const catIn = document.getElementById('edit-item-cat');
    const idIn = document.getElementById('edit-item-id');
    const nameIn = document.getElementById('edit-item-name');
    const priceIn = document.getElementById('edit-item-price');
    const descIn = document.getElementById('edit-item-desc');

    if (catIn) catIn.value = catId;
    if (idIn) idIn.value = itemId;
    if (nameIn) nameIn.value = name;
    if (priceIn) priceIn.value = String(price);
    if (descIn) descIn.value = desc;

    const modal = document.getElementById('admin-edit-item-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditMenuItemModal() {
    const modal = document.getElementById('admin-edit-item-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveEditedMenuItem() {
    const idIn = document.getElementById('edit-item-id');
    const nameIn = document.getElementById('edit-item-name');
    const priceIn = document.getElementById('edit-item-price');

    const itemId = idIn ? idIn.value : '';
    const name = nameIn ? nameIn.value.trim() : '';
    const price = priceIn ? Number(priceIn.value) : 0;
    if (!itemId) return;

    try {
        const res = await fetch(`/api/menu/items/${encodeURIComponent(itemId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, price })
        });
        if (res.ok) {
            closeEditMenuItemModal();
            await fetchServerState(true);
            showToast('Precio actualizado y sincronizado con Sistema Mozos', 'success');
        }
    } catch (e) {
        showToast('Error al actualizar precio', 'error');
    }
}

async function deleteAdminMenuItem(itemId) {
    openConfirmModal(
        'Eliminar Producto',
        '¿Deseas eliminar este producto de la carta sincronizada con Sistema Mozos?',
        async () => {
            try {
                const res = await fetch(`/api/menu/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
                if (res.ok) {
                    await fetchServerState(true);
                    showToast('Producto eliminado', 'info');
                }
            } catch (e) {
                showToast('Error al eliminar producto', 'error');
            }
        }
    );
}

// ============================================================================
// REPORTES Y CIERRE DE NOCHE
// ============================================================================
function renderAdminNightReport() {
    const totalOrders = paymentHistory.length;
    let totalRevenue = 0;
    let totalCash = 0;
    let totalTransfer = 0;
    const productCounts = {};
    const waiterStats = {};

    paymentHistory.forEach(p => {
        const sub = Number(p.subtotal) || 0;
        const tip = Number(p.tip) || 0;
        totalRevenue += sub;
        totalCash += Number(p.cashAmount) || 0;
        totalTransfer += Number(p.transferAmount) || 0;

        const w = p.waiter || 'Sin asignar';
        if (!waiterStats[w]) waiterStats[w] = { tables: 0, sales: 0, tips: 0 };
        waiterStats[w].tables += 1;
        waiterStats[w].sales += sub;
        waiterStats[w].tips += tip;

        (Array.isArray(p.items) ? p.items : []).forEach(it => {
            const k = it.name || 'Producto';
            if (!productCounts[k]) productCounts[k] = { qty: 0, revenue: 0 };
            productCounts[k].qty += Number(it.qty) || 0;
            productCounts[k].revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
        });
    });

    const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const waitersCount = Math.max(1, staffList.length);
    const tipPerWaiter = Math.round(generalTipsPool / waitersCount);

    const kpiTotal = document.getElementById('rep-kpi-total');
    const kpiOrders = document.getElementById('rep-kpi-orders');
    const kpiCash = document.getElementById('rep-kpi-cash');
    const kpiTrans = document.getElementById('rep-kpi-transfer');
    const kpiTips = document.getElementById('rep-kpi-tips');
    const kpiSplit = document.getElementById('rep-kpi-tip-split');
    const kpiAvg = document.getElementById('rep-kpi-avg');
    const badgeTickets = document.getElementById('rep-tickets-badge');

    if (kpiTotal) kpiTotal.textContent = `$${totalRevenue.toLocaleString('es-AR')}`;
    if (kpiOrders) kpiOrders.textContent = `${totalOrders} mesas cobradas`;
    if (kpiCash) kpiCash.textContent = `$${totalCash.toLocaleString('es-AR')}`;
    if (kpiTrans) kpiTrans.textContent = `$${totalTransfer.toLocaleString('es-AR')}`;
    if (kpiTips) kpiTips.textContent = `$${generalTipsPool.toLocaleString('es-AR')}`;
    if (kpiSplit) kpiSplit.textContent = `$${tipPerWaiter.toLocaleString('es-AR')} por mozo`;
    if (kpiAvg) kpiAvg.textContent = `$${avgTicket.toLocaleString('es-AR')}`;
    if (badgeTickets) badgeTickets.textContent = `${totalOrders} cobros`;

    const topEl = document.getElementById('rep-top-products-list');
    if (topEl) {
        const sortedProds = Object.entries(productCounts).sort((a, b) => b[1].qty - a[1].qty);
        if (sortedProds.length === 0) {
            topEl.innerHTML = `<p class="text-slate-400 text-xs text-center py-6">Sin ventas registradas aún.</p>`;
        } else {
            topEl.innerHTML = sortedProds.map(([name, info], idx) => `
                <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <span class="font-bold text-slate-800 truncate">${idx + 1}. ${name}</span>
                    <span class="font-extrabold text-[#2563eb] shrink-0">${info.qty} u. ($${info.revenue.toLocaleString('es-AR')})</span>
                </div>
            `).join('');
        }
    }

    const waiterEl = document.getElementById('rep-waiter-breakdown');
    if (waiterEl) {
        const entries = Object.entries(waiterStats);
        if (entries.length === 0) {
            waiterEl.innerHTML = `<p class="text-slate-400 text-xs text-center py-6">Sin actividad de mozos aún.</p>`;
        } else {
            waiterEl.innerHTML = entries.map(([w, st]) => `
                <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                        <span class="font-bold text-slate-900">${w}</span>
                        <span class="text-slate-500 block text-[10px]">${st.tables} mesa(s) cobradas</span>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-slate-900 block">$${st.sales.toLocaleString('es-AR')}</span>
                        <span class="text-[10px] text-[#2563eb] font-semibold">Propinas: $${st.tips.toLocaleString('es-AR')}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    const tableEl = document.getElementById('rep-payments-table');
    if (tableEl) {
        if (paymentHistory.length === 0) {
            tableEl.innerHTML = `<p class="text-slate-400 text-xs text-center py-6">Sin cobros registrados.</p>`;
        } else {
            tableEl.innerHTML = paymentHistory.map(p => `
                <div class="py-2.5 flex items-center justify-between text-xs">
                    <div>
                        <span class="font-bold text-slate-900">${p.table}</span>
                        <span class="text-slate-500 ml-1">(${p.waiter}) • ${p.method}</span>
                        <span class="text-[10px] text-slate-400 block">${p.timestamp || ''}</span>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-emerald-600 block">$${Number(p.totalPaid).toLocaleString('es-AR')}</span>
                        ${p.tip > 0 ? `<span class="text-[10px] text-[#2563eb]">Propina: $${Number(p.tip).toLocaleString('es-AR')}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
    }

    const archiveEl = document.getElementById('saved-nights-archive-list');
    if (archiveEl) {
        if (nightReports.length === 0) {
            archiveEl.innerHTML = `<p class="text-slate-400 text-xs text-center py-4">No hay cierres anteriores archivados.</p>`;
        } else {
            archiveEl.innerHTML = nightReports.map(r => `
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                        <span class="font-bold text-slate-900 block">${r.closedAt}</span>
                        <span class="text-slate-500">${r.totalOrders} mesas cobradas</span>
                    </div>
                    <div class="text-right">
                        <span class="font-extrabold text-[#2563eb] block">$${Number(r.totalRevenue).toLocaleString('es-AR')}</span>
                        <span class="text-[10px] text-slate-500">Propinas: $${Number(r.totalTips).toLocaleString('es-AR')}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

function openCloseNightModal() {
    let totalRevenue = 0;
    paymentHistory.forEach(p => { totalRevenue += Number(p.subtotal) || 0; });

    const salesEl = document.getElementById('close-modal-sales');
    const tipsEl = document.getElementById('close-modal-tips');
    if (salesEl) salesEl.textContent = `$${totalRevenue.toLocaleString('es-AR')}`;
    if (tipsEl) tipsEl.textContent = `$${generalTipsPool.toLocaleString('es-AR')}`;

    const modal = document.getElementById('close-night-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeNightModalCancel() {
    const modal = document.getElementById('close-night-modal');
    if (modal) modal.classList.add('hidden');
}

async function confirmNightClosure() {
    const noteIn = document.getElementById('close-night-note');
    const note = noteIn ? noteIn.value.trim() : '';

    try {
        if (paymentHistory.length > 0) {
            try {
                downloadNightReportPDF();
            } catch (pdfErr) {
                console.warn('Error descargando PDF automático:', pdfErr);
            }
        }
        const res = await fetch('/api/close-night', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary: { closedBy: currentUser, note } })
        });
        if (res.ok) {
            closeNightModalCancel();
            await fetchServerState(true);
            showToast('PDF descargado, cierre nocturno guardado y mesas reiniciadas', 'success');
        }
    } catch (e) {
        showToast('Error al realizar el cierre nocturno', 'error');
    }
}

function downloadNightReportPDF() {
    const container = document.getElementById('pdf-report-container');
    if (!container || typeof html2pdf === 'undefined') {
        showToast('Generador PDF no disponible', 'error');
        return;
    }
    html2pdf()
        .set({
            margin: 10,
            filename: `Reporte_Rivera_${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(container)
        .save();
}

function copyNightReportText() {
    let totalRevenue = 0;
    paymentHistory.forEach(p => { totalRevenue += Number(p.subtotal) || 0; });
    const text = `Resumen Rivera POS (${new Date().toLocaleDateString('es-AR')}): ${paymentHistory.length} mesas cobradas | Facturación: $${totalRevenue.toLocaleString('es-AR')} | Propinas: $${generalTipsPool.toLocaleString('es-AR')}`;
    navigator.clipboard?.writeText(text);
    showToast('Resumen copiado al portapapeles', 'success');
}

function downloadNightReportCSV() {
    const headers = ['Mesa', 'Mozo', 'Metodo', 'Subtotal', 'Propina', 'Total', 'Hora'];
    const rows = paymentHistory.map(p => [
        p.table,
        p.waiter,
        p.method,
        p.subtotal,
        p.tip,
        p.totalPaid,
        p.timestamp || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Rivera_${Date.now()}.csv`;
    a.click();
}

// ============================================================================
// GESTIÓN DE PERSONAL (MOZOS Y CONTRASEÑA ADMIN)
// ============================================================================
function renderAdminStaffManager() {
    const badge = document.getElementById('staff-count-badge');
    if (badge) badge.textContent = `${staffList.length} usuarios`;

    const listEl = document.getElementById('admin-staff-list');
    if (!listEl) return;

    listEl.innerHTML = staffList.map(w => {
        const safeName = w.name.replace(/'/g, "\\'");
        return `
            <div class="py-3 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center font-bold border border-blue-200">
                        <i class="fa-solid fa-user-tie text-xs"></i>
                    </div>
                    <div>
                        <span class="font-bold text-slate-900 text-sm block">${w.name}</span>
                        <span class="text-[11px] text-slate-500">Mozo / Salón</span>
                    </div>
                </div>
                <button onclick="deleteStaffMember('${safeName}')"
                    class="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 text-xs transition-all">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

async function addNewStaffMember() {
    const input = document.getElementById('new-staff-name');
    const name = input ? input.value.trim() : '';
    if (!name) {
        showToast('Ingresa el nombre del mozo', 'error');
        return;
    }

    try {
        const res = await fetch('/api/staff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            if (input) input.value = '';
            await fetchServerState(true);
            showToast(`Mozo ${name} agregado`, 'success');
        }
    } catch (e) {
        showToast('Error al agregar mozo', 'error');
    }
}

async function deleteStaffMember(name) {
    openConfirmModal(
        'Eliminar Personal',
        `¿Deseas quitar a ${name} de la lista de mozos activos?`,
        async () => {
            try {
                const res = await fetch(`/api/staff/${encodeURIComponent(name)}`, { method: 'DELETE' });
                if (res.ok) {
                    await fetchServerState(true);
                    showToast('Mozo eliminado', 'info');
                }
            } catch (e) {
                showToast('Error al eliminar mozo', 'error');
            }
        }
    );
}

async function updateAdminPassword() {
    const curr = document.getElementById('change-pwd-current');
    const next = document.getElementById('change-pwd-new');
    const conf = document.getElementById('change-pwd-confirm');

    const currentPassword = curr ? curr.value : '';
    const newPassword = next ? next.value : '';
    const confirmPassword = conf ? conf.value : '';

    if (!newPassword || newPassword !== confirmPassword) {
        showToast('La nueva contraseña y su confirmación no coinciden', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/admin-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (curr) curr.value = '';
            if (next) next.value = '';
            if (conf) conf.value = '';
            showToast('Contraseña actualizada correctamente', 'success');
        } else {
            showToast(data.error || 'No se pudo cambiar la contraseña', 'error');
        }
    } catch (e) {
        showToast('Error al cambiar contraseña', 'error');
    }
}

// ============================================================================
// MODALES AUXILIARES Y TOASTS
// ============================================================================
function closeModal() {
    const m = document.getElementById('custom-modal');
    if (m) m.classList.add('hidden');
}

function openConfirmModal(title, message, onConfirm) {
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const modal = document.getElementById('confirm-modal');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    confirmModalCallback = onConfirm;
    if (modal) modal.classList.remove('hidden');
}

function closeConfirmModal(confirmed) {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    if (confirmed && typeof confirmModalCallback === 'function') {
        const fn = confirmModalCallback;
        confirmModalCallback = null;
        fn();
    } else {
        confirmModalCallback = null;
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const styles = {
        success: 'bg-emerald-600 text-white border-emerald-700',
        error: 'bg-rose-600 text-white border-rose-700',
        info: 'bg-[#0f172a] text-white border-slate-700'
    };

    const toast = document.createElement('div');
    toast.className = `px-4 py-2.5 rounded-2xl border shadow-lg text-xs font-bold flex items-center gap-2 transition-all pointer-events-auto ${styles[type] || styles.info}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

// ============================================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
    await fetchServerState();
    setupRealtimeSync();

    const savedUser = localStorage.getItem('humboldt_user');
    const savedRole = localStorage.getItem('humboldt_role');
    if (savedUser && savedRole === 'waiter') {
        loginAsWaiter(savedUser);
    } else if (savedUser && savedRole === 'admin') {
        loginAsAdmin();
    } else {
        renderStaffLoginList();
    }
});
