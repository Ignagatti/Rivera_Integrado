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

// Modales y selectores de Pizza
let currentPizzaConfigType = '1_flavor'; // '1_flavor' | '2_flavors' | '3_flavors' | 'media'
let pizzaModalSize = 'entera'; // 'entera' | 'media'
let pizzaModalFlavorsCount = 1; // 1 | 2 | 3
let selectedPizzaFlavors = [];
let pizzaModalQty = 1;

// Estado de cobro
let selectedPaymentMethod = 'Efectivo';
let selectedTipPercent = 0;
let currentCheckoutSubtotal = 0;

// Estado Admin
let currentAdminSubTab = 'menu';
let currentAdminMenuCatId = 'pizzas';
let editingMenuItemId = null;

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
                ? { id: `staff_${idx}`, name: s, role: 'waiter' }
                : s
        );

        tablesList = Array.isArray(data.tablesList) ? data.tablesList : [];
        ordersByTable = data.ordersByTable || {};
        paymentHistory = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
        generalTipsPool = Number(data.generalTipsPool) || 0;
        nightReports = Array.isArray(data.nightReports) ? data.nightReports : [];

        refreshActiveViews();
    } catch (err) {
        if (!silent) {
            console.error('Error sincronizando estado:', err);
        }
    }
}

function refreshActiveViews() {
    const loginOverlay = document.getElementById('login-overlay');
    if (loginOverlay && !loginOverlay.classList.contains('hidden')) {
        renderStaffLoginList();
    }

    if (!currentUser) return;

    if (currentRole === 'waiter') {
        const tablesView = document.getElementById('waiter-tables-view');
        const posView = document.getElementById('waiter-pos-view');
        if (tablesView && !tablesView.classList.contains('hidden')) {
            renderTablesGrid();
        }
        if (posView && !posView.classList.contains('hidden')) {
            renderCategories();
            renderMenuItems();
            // No pisar el input de notas si el usuario está escribiendo
            const noteInput = document.getElementById('order-note-input');
            const isTypingNote = document.activeElement === noteInput;
            renderOrder(isTypingNote);
        }
    } else if (currentRole === 'admin') {
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
    const container = document.getElementById('login-staff-list');
    if (!container) return;

    const waiters = staffList.filter(s => s.role !== 'admin');
    let html = '';

    waiters.forEach(staff => {
        const safeName = staff.name.replace(/'/g, "\\'");
        html += `
            <button onclick="loginAsWaiter('${safeName}')"
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/90 hover:bg-orange-500/15 border border-slate-700/80 hover:border-orange-500/50 transition-all group text-left">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-base group-hover:scale-105 transition-transform">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <div>
                        <p class="font-bold text-white text-sm group-hover:text-orange-300 transition-colors">${staff.name}</p>
                        <p class="text-[11px] text-slate-400">Mozo de Salón • Sincronizado</p>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-500 group-hover:text-orange-400 transition-colors"></i>
            </button>
        `;
    });

    html += `
        <div class="pt-2 mt-2 border-t border-slate-800">
            <button onclick="openAdminPasswordModal()"
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 hover:bg-amber-500/15 border border-slate-700/70 hover:border-amber-500/40 transition-all group text-left">
                <div class="flex items-center gap-3.5">
                    <div class="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <p class="font-bold text-amber-300 text-sm">Encargado / Administración</p>
                        <p class="text-[11px] text-slate-400">Precios Mozos, Reportes y Personal</p>
                    </div>
                </div>
                <i class="fa-solid fa-lock text-slate-500 group-hover:text-amber-400 transition-colors"></i>
            </button>
        </div>
    `;

    container.innerHTML = html;
}

function loginAsWaiter(name) {
    currentUser = name;
    currentRole = 'waiter';
    localStorage.setItem('humboldt_user', name);
    localStorage.setItem('humboldt_role', 'waiter');

    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('waiter-workspace').classList.remove('hidden');

    updateHeaderUserBadge();
    backToTablesGrid();
}

function openAdminPasswordModal() {
    const modal = document.getElementById('admin-password-modal');
    const input = document.getElementById('admin-password-input');
    const err = document.getElementById('admin-password-error');
    if (err) err.classList.add('hidden');
    if (input) input.value = '';
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => input && input.focus(), 80);
}

function closeAdminPasswordModal() {
    const modal = document.getElementById('admin-password-modal');
    if (modal) modal.classList.add('hidden');
}

async function verifyAdminPassword() {
    const input = document.getElementById('admin-password-input');
    const err = document.getElementById('admin-password-error');
    const password = input ? input.value : '';

    try {
        const res = await fetch('/api/verify-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeAdminPasswordModal();
            loginAsAdmin();
        } else {
            if (err) err.classList.remove('hidden');
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

    document.getElementById('login-overlay').classList.add('hidden');
    document.getElementById('waiter-workspace').classList.add('hidden');
    document.getElementById('admin-workspace').classList.remove('hidden');

    updateHeaderUserBadge();
    switchAdminSubTab(currentAdminSubTab || 'menu');
}

function updateHeaderUserBadge() {
    const nameEl = document.getElementById('active-user-name');
    const roleEl = document.getElementById('active-user-role-badge');
    const avatarEl = document.getElementById('user-avatar-icon');

    if (nameEl) nameEl.textContent = currentUser || '-';
    if (roleEl) {
        if (currentRole === 'admin') {
            roleEl.textContent = 'ADMIN';
            roleEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
        } else {
            roleEl.textContent = 'MOZO';
            roleEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30';
        }
    }
    if (avatarEl) {
        avatarEl.innerHTML = currentRole === 'admin'
            ? '<i class="fa-solid fa-user-shield text-xs"></i>'
            : '<i class="fa-solid fa-user-tie text-xs"></i>';
    }
}

function logoutRole() {
    currentUser = null;
    currentRole = null;
    currentTable = null;
    localStorage.removeItem('humboldt_user');
    localStorage.removeItem('humboldt_role');

    document.getElementById('waiter-workspace').classList.add('hidden');
    document.getElementById('admin-workspace').classList.add('hidden');
    document.getElementById('login-overlay').classList.remove('hidden');
    renderStaffLoginList();
}

// ============================================================================
// MAPA DE MESAS DEL SALÓN (SINCRONIZADO CON SISTEMA_MOZOS)
// ============================================================================
function renderTablesGrid() {
    const grid = document.getElementById('tables-grid');
    if (!grid) return;

    let occupiedCount = 0;
    let freeCount = 0;
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

        if (hasItems || isPaid) occupiedCount++;
        else freeCount++;

        const total = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
        const unsentCount = items.reduce((acc, it) => {
            const diff = (Number(it.qty) || 0) - (Number(it.sentQty) || 0);
            return acc + (diff > 0 ? diff : 0);
        }, 0);

        const safeTable = tableName.replace(/'/g, "\\'");

        let cardBorder = 'border-slate-800 hover:border-slate-600 bg-slate-900/90';
        let statusBadge = `<span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Libre</span>`;

        if (isPaid) {
            cardBorder = 'border-emerald-500/70 bg-emerald-950/30 hover:border-emerald-400 shadow-lg shadow-emerald-950/30';
            statusBadge = `<span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 shadow">✓ PAGADA</span>`;
        } else if (unsentCount > 0) {
            cardBorder = 'border-amber-500/60 bg-amber-950/20 hover:border-amber-400';
            statusBadge = `<span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">Por Enviar (${unsentCount})</span>`;
        } else if (hasItems) {
            cardBorder = 'border-orange-500/50 bg-slate-900 hover:border-orange-400';
            statusBadge = `<span class="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">Ocupada</span>`;
        }

        html += `
            <div onclick="selectTableAndOpenPOS('${safeTable}')"
                class="rounded-2xl border ${cardBorder} p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[155px] relative group">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                            <div class="w-9 h-9 rounded-xl ${isPaid ? 'bg-emerald-500 text-slate-950' : hasItems ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'} flex items-center justify-center font-black text-sm">
                                ${tableName.replace(/[^0-9]/g, '') || 'M'}
                            </div>
                            <div>
                                <h3 class="font-extrabold text-white text-base leading-tight">${tableName}</h3>
                                <p class="text-[11px] text-slate-400 truncate max-w-[110px]">
                                    <i class="fa-solid fa-user text-[9px] mr-1"></i>${hasItems || isPaid ? (order.waiter || 'Mozo') : 'Disponible'}
                                </p>
                            </div>
                        </div>
                        ${statusBadge}
                    </div>

                    ${isPaid ? `
                        <div class="mt-2 p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs">
                            <div class="flex justify-between font-bold text-emerald-300">
                                <span>Cobrado:</span>
                                <span>$${(order.paidAmount || total).toLocaleString('es-AR')}</span>
                            </div>
                            ${order.tipAmount > 0 ? `
                                <div class="flex justify-between text-[11px] text-emerald-400/90 mt-0.5">
                                    <span>Propina:</span>
                                    <span>+$${Number(order.tipAmount).toLocaleString('es-AR')}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : hasItems ? `
                        <div class="mt-2 space-y-1">
                            <p class="text-xs text-slate-300 font-medium line-clamp-2">
                                ${items.slice(0, 3).map(i => `${i.qty}x ${i.name}`).join(', ')}${items.length > 3 ? '...' : ''}
                            </p>
                        </div>
                    ` : `
                        <p class="text-xs text-slate-500 mt-4 italic">Toque para abrir mesa</p>
                    `}
                </div>

                <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                        <span class="text-[10px] text-slate-400 uppercase block">Total Mesa</span>
                        <span class="text-base font-black ${isPaid ? 'text-emerald-400' : hasItems ? 'text-white' : 'text-slate-500'}">
                            $${total.toLocaleString('es-AR')}
                        </span>
                    </div>

                    ${isPaid ? `
                        <div class="flex items-center gap-1.5">
                            <button onclick="freePaidTable('${safeTable}', event)"
                                title="Liberar mesa para nuevos clientes (guarda la venta en el cierre)"
                                class="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px] shadow transition-all">
                                <i class="fa-solid fa-broom mr-1"></i>Liberar
                            </button>
                            <button onclick="unpayTable('${safeTable}', event)"
                                title="Desmarcar pago"
                                class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        </div>
                    ` : !hasItems ? `
                        <button onclick="deleteTable('${safeTable}', event)"
                            title="Eliminar mesa vacía"
                            class="opacity-70 hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : `
                        <span class="text-xs font-bold text-orange-400 group-hover:translate-x-0.5 transition-transform">
                            Abrir <i class="fa-solid fa-arrow-right ml-0.5"></i>
                        </span>
                    `}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;

    const occBadge = document.getElementById('tables-occupied-count');
    const freeBadge = document.getElementById('tables-free-count');
    if (occBadge) occBadge.textContent = `${occupiedCount} Ocupadas`;
    if (freeBadge) freeBadge.textContent = `${freeCount} Libres`;
}

async function promptAddNewTable() {
    try {
        const res = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await res.json();
        if (res.ok && data.success) {
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
    if (!confirm(`¿Eliminar ${tableName} del plano de mesas?`)) return;
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
    document.getElementById('waiter-pos-view').classList.remove('hidden');

    const titleBadge = document.getElementById('pos-active-table-badge');
    const waiterBadge = document.getElementById('pos-table-waiter-label');
    const orderHeader = document.getElementById('current-table-display');

    if (titleBadge) titleBadge.textContent = tableName;
    if (waiterBadge) waiterBadge.textContent = `Atiende: ${ordersByTable[currentTable].waiter || currentUser}`;
    if (orderHeader) orderHeader.textContent = tableName;

    if (!currentCategoryId && menuData.length > 0) {
        currentCategoryId = menuData[0].id;
    }

    renderCategories();
    renderMenuItems();
    renderOrder();
}

function backToTablesGrid() {
    currentTable = null;
    document.getElementById('waiter-pos-view').classList.add('hidden');
    document.getElementById('waiter-tables-view').classList.remove('hidden');
    closeMobileCartDrawer();
    renderTablesGrid();
}

function openMobileCartDrawer() {
    const panel = document.getElementById('pos-order-panel');
    if (panel) {
        panel.classList.remove('translate-y-full');
        panel.classList.add('translate-y-0');
    }
}

function closeMobileCartDrawer() {
    const panel = document.getElementById('pos-order-panel');
    if (panel) {
        panel.classList.add('translate-y-full');
        panel.classList.remove('translate-y-0');
    }
}

// ============================================================================
// CATEGORÍAS Y PRODUCTOS DEL MENÚ (PRECIOS DE SISTEMA_MOZOS)
// ============================================================================
function renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = menuData.map(cat => {
        const isActive = cat.id === currentCategoryId;
        return `
            <button onclick="selectCategory('${cat.id}')"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all shrink-0 ${
                    isActive
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                        : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/70'
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
    renderMenuItems();
}

function renderMenuItems() {
    const container = document.getElementById('menu-container');
    const modesBar = document.getElementById('pizza-modes-bar');
    if (!container) return;

    const category = menuData.find(c => c.id === currentCategoryId) || menuData[0];
    if (!category) {
        container.innerHTML = `<p class="text-slate-400 text-sm col-span-full text-center py-8">Cargando carta de precios...</p>`;
        return;
    }

    const searchInput = document.getElementById('menu-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // Mostrar barra de modo de pizza cuando estamos en la categoría Pizzas
    if (modesBar) {
        if (category.id === 'pizzas') {
            modesBar.classList.remove('hidden');
            modesBar.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-bold text-orange-300 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-sliders"></i> Modo rápido de Pizza:
                    </span>
                    <div class="flex flex-wrap gap-1.5">
                        <button onclick="setPizzaConfigMode('1_flavor')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                currentPizzaConfigType === '1_flavor'
                                    ? 'bg-orange-500 text-white shadow'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }">1 Gusto (Entera)</button>
                        <button onclick="setPizzaConfigMode('media')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                currentPizzaConfigType === 'media'
                                    ? 'bg-orange-500 text-white shadow'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }">Media Pizza</button>
                        <button onclick="setPizzaConfigMode('2_flavors')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                currentPizzaConfigType === '2_flavors'
                                    ? 'bg-orange-500 text-white shadow'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }">2 Gustos (Mitad/Mitad)</button>
                        <button onclick="setPizzaConfigMode('3_flavors')"
                            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                currentPizzaConfigType === '3_flavors'
                                    ? 'bg-orange-500 text-white shadow'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }">3 Gustos</button>
                    </div>
                </div>
            `;
        } else {
            modesBar.classList.add('hidden');
        }
    }

    const items = (category.items || []).filter(it =>
        !query || it.name.toLowerCase().includes(query)
    );

    if (items.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-sm col-span-full text-center py-8">No se encontraron productos.</p>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const isLibre = !!item.isPizzaLibre;
        const isPizza = !!item.isPizza && !isLibre;
        const displayPrice = (isPizza && currentPizzaConfigType === 'media' && item.precioMedia)
            ? Number(item.precioMedia)
            : Number(item.price) || 0;

        const safeId = String(item.id).replace(/'/g, "\\'");

        return `
            <div onclick="onMenuItemClicked('${safeId}')"
                class="rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between min-h-[110px] select-none active:scale-[0.98] ${
                    isLibre
                        ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/10 border-orange-500/50 hover:border-orange-400'
                        : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700/80 hover:border-orange-500/50'
                }">
                <div>
                    <div class="flex items-start justify-between gap-2">
                        <h4 class="font-bold text-white text-sm leading-snug">${item.name}</h4>
                        ${isLibre ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-orange-500 text-white shrink-0">LIBRE</span>` : ''}
                    </div>
                    ${isPizza && item.precioMedia ? `
                        <p class="text-[11px] text-slate-400 mt-1">
                            Entera: $${Number(item.price).toLocaleString('es-AR')} • Media: $${Number(item.precioMedia).toLocaleString('es-AR')}
                        </p>
                    ` : ''}
                </div>
                <div class="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                    <span class="text-sm font-black text-orange-400">$${displayPrice.toLocaleString('es-AR')}</span>
                    <div class="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                        <i class="fa-solid fa-plus"></i>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function filterMenu() {
    renderMenuItems();
}

function onMenuItemClicked(itemId) {
    if (!currentTable) {
        showToast('Seleccione una mesa primero', 'error');
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
        addDirectItemToOrder({
            id: foundItem.id,
            name: foundItem.name,
            price: Number(foundItem.price) || 0,
            isPizza: true,
            isPizzaLibre: true,
            libreType: foundItem.libreType || 'G'
        });
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
    if (currentPizzaConfigType === '1_flavor') {
        const price = calculateMozosPizzaPrice('entera', [pizzaItem.name]) || Number(pizzaItem.price) || 0;
        addDirectItemToOrder({
            id: `pizza_entera_${pizzaItem.name}`,
            name: `Pizza Entera (${pizzaItem.name})`,
            price,
            isPizza: true,
            isPizzaLibre: false,
            pizzaSize: 'entera',
            pizzaConfigType: '1_flavor',
            toppings: [pizzaItem.name]
        });
    } else if (currentPizzaConfigType === 'media') {
        const price = calculateMozosPizzaPrice('media', [pizzaItem.name]) || Number(pizzaItem.precioMedia) || Math.round((Number(pizzaItem.price) || 0) / 2);
        addDirectItemToOrder({
            id: `pizza_media_${pizzaItem.name}`,
            name: `Media Pizza (${pizzaItem.name})`,
            price,
            isPizza: true,
            isPizzaLibre: false,
            pizzaSize: 'media',
            pizzaConfigType: 'media',
            toppings: [pizzaItem.name]
        });
    } else if (currentPizzaConfigType === '2_flavors') {
        openPizzaBuilderModal('entera', 2, pizzaItem.name);
    } else if (currentPizzaConfigType === '3_flavors') {
        openPizzaBuilderModal('entera', 3, pizzaItem.name);
    } else {
        openPizzaBuilderModal('entera', 1, pizzaItem.name);
    }
}

// ============================================================================
// MODAL CONFIGURADOR DE PIZZAS (ENTERA / MEDIA, 1 / 2 / 3 GUSTOS)
// ============================================================================
function openPizzaBuilderModal(initialSize = 'entera', initialCount = 2, preselectedFlavor = null) {
    pizzaModalSize = initialSize === 'media' ? 'media' : 'entera';
    pizzaModalFlavorsCount = initialCount || 2;
    if (pizzaModalSize === 'media' && pizzaModalFlavorsCount > 2) {
        pizzaModalFlavorsCount = 2;
    }
    selectedPizzaFlavors = preselectedFlavor ? [preselectedFlavor] : [];
    pizzaModalQty = 1;

    const obsInput = document.getElementById('pizza-builder-obs');
    if (obsInput) obsInput.value = '';

    const modal = document.getElementById('pizza-builder-modal');
    if (modal) modal.classList.remove('hidden');

    syncPizzaModalButtonsUI();
    renderPizzaBuilderFlavorButtons();
    updatePizzaBuilderPreview();
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
    if (selectedPizzaFlavors.length > pizzaModalFlavorsCount) {
        selectedPizzaFlavors = selectedPizzaFlavors.slice(0, pizzaModalFlavorsCount);
    }
    syncPizzaModalButtonsUI();
    renderPizzaBuilderFlavorButtons();
    updatePizzaBuilderPreview();
}

function setPizzaFlavorsCount(count) {
    if (pizzaModalSize === 'media' && count > 2) {
        showToast('En Media Pizza puedes elegir hasta 2 gustos', 'info');
        count = 2;
    }
    pizzaModalFlavorsCount = count;
    if (selectedPizzaFlavors.length > count) {
        selectedPizzaFlavors = selectedPizzaFlavors.slice(0, count);
    }
    syncPizzaModalButtonsUI();
    renderPizzaBuilderFlavorButtons();
    updatePizzaBuilderPreview();
}

function syncPizzaModalButtonsUI() {
    const sizeEnteraBtn = document.getElementById('pizza-size-entera-btn');
    const sizeMediaBtn = document.getElementById('pizza-size-media-btn');

    if (sizeEnteraBtn && sizeMediaBtn) {
        sizeEnteraBtn.className = pizzaModalSize === 'entera'
            ? 'py-2 rounded-xl font-bold text-xs border border-orange-500 bg-orange-500/20 text-orange-300 transition-all'
            : 'py-2 rounded-xl font-bold text-xs border border-slate-700 bg-slate-800 text-slate-400 transition-all';
        sizeMediaBtn.className = pizzaModalSize === 'media'
            ? 'py-2 rounded-xl font-bold text-xs border border-orange-500 bg-orange-500/20 text-orange-300 transition-all'
            : 'py-2 rounded-xl font-bold text-xs border border-slate-700 bg-slate-800 text-slate-400 transition-all';
    }

    [1, 2, 3].forEach(n => {
        const btn = document.getElementById(`pizza-flavor-btn-${n}`);
        if (!btn) return;
        if (n === pizzaModalFlavorsCount) {
            btn.className = 'py-2.5 rounded-xl font-bold text-xs border border-orange-500 bg-orange-500/20 text-orange-300 transition-all';
        } else {
            btn.className = 'py-2.5 rounded-xl font-bold text-xs border border-slate-700 bg-slate-800 text-slate-400 transition-all';
        }
    });

    const subtitle = document.getElementById('pizza-modal-subtitle');
    if (subtitle) {
        subtitle.textContent = `${pizzaModalSize === 'media' ? 'Media Pizza' : 'Pizza Entera'} • Seleccione ${pizzaModalFlavorsCount} gusto(s)`;
    }
}

function renderPizzaBuilderFlavorButtons() {
    const grid = document.getElementById('pizza-flavors-grid');
    if (!grid) return;

    const pizzaCat = menuData.find(c => c.id === 'pizzas');
    const flavors = (pizzaCat ? pizzaCat.items : []).filter(i => i.isPizza && !i.isPizzaLibre);

    grid.innerHTML = flavors.map(f => {
        const isSelected = selectedPizzaFlavors.includes(f.name);
        const safeName = f.name.replace(/'/g, "\\'");
        return `
            <button onclick="togglePizzaFlavorSelection('${safeName}')"
                class="p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    isSelected
                        ? 'bg-orange-500/25 border-orange-500 text-white font-bold shadow'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                }">
                <span class="text-xs truncate pr-1">${f.name}</span>
                ${isSelected ? '<i class="fa-solid fa-circle-check text-orange-400 text-xs shrink-0"></i>' : ''}
            </button>
        `;
    }).join('');
}

function togglePizzaFlavorSelection(flavorName) {
    const idx = selectedPizzaFlavors.indexOf(flavorName);
    if (idx !== -1) {
        selectedPizzaFlavors.splice(idx, 1);
    } else {
        if (selectedPizzaFlavors.length >= pizzaModalFlavorsCount) {
            if (pizzaModalFlavorsCount === 1) {
                selectedPizzaFlavors = [flavorName];
            } else {
                showToast(`Ya seleccionaste los ${pizzaModalFlavorsCount} gustos`, 'info');
                return;
            }
        } else {
            selectedPizzaFlavors.push(flavorName);
        }
    }
    renderPizzaBuilderFlavorButtons();
    updatePizzaBuilderPreview();
}

function changePizzaBuilderQty(delta) {
    pizzaModalQty = Math.max(1, pizzaModalQty + delta);
    const qtyEl = document.getElementById('pizza-builder-qty');
    if (qtyEl) qtyEl.textContent = String(pizzaModalQty);
    updatePizzaBuilderPreview();
}

function updatePizzaBuilderPreview() {
    const summaryEl = document.getElementById('pizza-selected-flavors-summary');
    const priceEl = document.getElementById('pizza-builder-price-preview');

    if (summaryEl) {
        summaryEl.textContent = selectedPizzaFlavors.length > 0
            ? `${pizzaModalSize === 'media' ? 'Media' : 'Entera'}: ${selectedPizzaFlavors.join(' + ')}`
            : 'Ningún gusto seleccionado';
    }

    const unitPrice = calculateMozosPizzaPrice(pizzaModalSize, selectedPizzaFlavors);
    const totalPrice = unitPrice * pizzaModalQty;
    if (priceEl) {
        priceEl.textContent = `$${totalPrice.toLocaleString('es-AR')}`;
    }
}

function confirmAddPizzaToOrder() {
    if (selectedPizzaFlavors.length !== pizzaModalFlavorsCount) {
        showToast(`Debes seleccionar ${pizzaModalFlavorsCount} gusto(s)`, 'error');
        return;
    }

    const unitPrice = calculateMozosPizzaPrice(pizzaModalSize, selectedPizzaFlavors);
    const obsInput = document.getElementById('pizza-builder-obs');
    const note = obsInput ? obsInput.value.trim() : '';

    const sizeLabel = pizzaModalSize === 'media' ? 'Media Pizza' : 'Pizza Entera';
    const flavorsLabel = selectedPizzaFlavors.join(' / ');
    const itemName = `${sizeLabel} (${flavorsLabel})`;

    addDirectItemToOrder({
        id: `pizza_${pizzaModalSize}_${selectedPizzaFlavors.join('_')}_${ note || 'std' }`,
        name: itemName,
        price: unitPrice,
        qty: pizzaModalQty,
        note,
        isPizza: true,
        isPizzaLibre: false,
        pizzaSize: pizzaModalSize,
        pizzaConfigType: pizzaModalSize === 'media' ? 'media' : `${pizzaModalFlavorsCount}_flavors`,
        toppings: [...selectedPizzaFlavors]
    });

    closePizzaBuilderModal();
}

// ============================================================================
// GESTIÓN DE LA COMANDA DE LA MESA Y ENVÍO A COCINA + SISTEMA_MOZOS
// ============================================================================
async function addDirectItemToOrder(newItem) {
    if (!currentTable) return;
    const tableOrder = ordersByTable[currentTable];
    if (!tableOrder) return;

    if (tableOrder.isPaid) {
        showToast('Esta mesa figura PAGADA. Libérala o desmarca el pago antes de cargar nuevos productos.', 'error');
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
    await saveCurrentTableToServer();
}

function updateCurrentOrderNote(val) {
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
    const listEl = document.getElementById('order-list');
    const subtotalEl = document.getElementById('subtotal-price');
    const totalEl = document.getElementById('total-price');
    const noteInput = document.getElementById('order-note-input');
    const libreBanner = document.getElementById('pizza-libre-rounds-banner');
    const roundBadge = document.getElementById('libre-round-counter');
    const mobileCount = document.getElementById('mobile-cart-count-badge');
    const mobileTotal = document.getElementById('mobile-cart-total-badge');

    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    const items = Array.isArray(tableOrder.items) ? tableOrder.items : [];

    if (noteInput && !skipNoteUpdate) {
        noteInput.value = tableOrder.note || '';
    }

    const hasPizzaLibre = items.some(it => it.isPizzaLibre);
    if (libreBanner) {
        if (hasPizzaLibre && !tableOrder.isPaid) {
            libreBanner.classList.remove('hidden');
            if (roundBadge) roundBadge.textContent = `Ronda #${tableOrder.libreRounds || 1}`;
        } else {
            libreBanner.classList.add('hidden');
        }
    }

    let total = 0;
    let totalItemsCount = 0;

    items.forEach(it => {
        total += (Number(it.price) || 0) * (Number(it.qty) || 0);
        totalItemsCount += Number(it.qty) || 0;
    });

    if (subtotalEl) subtotalEl.textContent = `$${total.toLocaleString('es-AR')}`;
    if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')}`;
    if (mobileCount) mobileCount.textContent = String(totalItemsCount);
    if (mobileTotal) mobileTotal.textContent = `$${total.toLocaleString('es-AR')}`;

    if (!listEl) return;

    let html = '';

    if (tableOrder.isPaid) {
        const safeTable = currentTable.replace(/'/g, "\\'");
        html += `
            <div class="p-3.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/60 text-emerald-200 mb-3">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-black text-xs uppercase tracking-wider text-emerald-300">
                        <i class="fa-solid fa-circle-check mr-1"></i> MESA PAGADA
                    </span>
                    <span class="font-black text-sm text-white">$${(tableOrder.paidAmount || total).toLocaleString('es-AR')}</span>
                </div>
                <p class="text-[11px] text-emerald-300/90 mb-2.5">
                    Ya puedes imprimir el ticket desde la PC de Sistema Mozos o liberar la mesa para nuevos clientes.
                </p>
                <div class="flex gap-2">
                    <button onclick="freePaidTable('${safeTable}', event)"
                        class="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow">
                        <i class="fa-solid fa-broom mr-1"></i> Liberar Mesa (Nueva Cuenta)
                    </button>
                    <button onclick="unpayTable('${safeTable}', event)"
                        class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700">
                        Desmarcar
                    </button>
                </div>
            </div>
        `;
    }

    if (items.length === 0) {
        html += `
            <div class="text-center py-10 text-slate-500">
                <i class="fa-solid fa-utensils text-2xl mb-2 opacity-40"></i>
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
                <div class="p-3 rounded-xl bg-slate-800/90 border ${pending > 0 ? 'border-amber-500/40' : 'border-slate-700/70'} flex items-center justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-white text-xs sm:text-sm">${it.name}</span>
                            ${pending > 0
                                ? `<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">${pending} sin enviar</span>`
                                : `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Enviado</span>`
                            }
                        </div>
                        ${it.note ? `<p class="text-[11px] text-amber-300/90 italic mt-0.5">"${it.note}"</p>` : ''}
                        <p class="text-xs font-bold text-orange-400 mt-0.5">$${lineTotal.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <button onclick="changeOrderItemQty(${idx}, -1)"
                            class="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <span class="w-6 text-center font-extrabold text-white text-sm">${qty}</span>
                        <button onclick="changeOrderItemQty(${idx}, 1)"
                            class="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs flex items-center justify-center">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    listEl.innerHTML = html;
}

async function sendOrderToKitchen() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    if (tableOrder.isPaid) {
        showToast('La mesa ya está pagada.', 'error');
        return;
    }

    const items = Array.isArray(tableOrder.items) ? tableOrder.items : [];
    if (items.length === 0) {
        showToast('Agrega productos a la mesa antes de enviar', 'error');
        return;
    }

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
        showToast('Todos los productos actuales ya fueron enviados. Modifica cantidades o agrega productos nuevos.', 'info');
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
            showToast('¡Comanda enviada! Pizzas/Empanadas en cola de Pedidos y mesa actualizada en Sistema Mozos.', 'success');
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

async function sendNextPizzaLibreRound() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    tableOrder.libreRounds = (Number(tableOrder.libreRounds) || 1) + 1;

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
                newItemsToSend: [{
                    id: 'pizza_libre_round',
                    name: `Ronda #${tableOrder.libreRounds} Pizza Libre`,
                    isPizza: true,
                    isPizzaLibre: true,
                    isLibreRound: true,
                    sendQty: 1,
                    price: 0
                }],
                libreRound: tableOrder.libreRounds
            })
        });
        if (res.ok) {
            renderOrder();
            showToast(`Ronda #${tableOrder.libreRounds} de Pizza Libre enviada a la cola de Sistema Pedidos`, 'success');
        }
    } catch (e) {
        showToast('Error al pedir ronda de Pizza Libre', 'error');
    } finally {
        isSavingOrder = false;
        await fetchServerState(true);
    }
}

// ============================================================================
// COBRO DE MESA (SINCRONIZADO CON SISTEMA_MOZOS)
// ============================================================================
function openPaymentModal() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];
    const items = Array.isArray(tableOrder.items) ? tableOrder.items : [];

    if (items.length === 0) {
        showToast('La mesa no tiene productos cargados para cobrar', 'error');
        return;
    }

    currentCheckoutSubtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
    selectedPaymentMethod = 'Efectivo';
    selectedTipPercent = 0;

    const subName = document.getElementById('payment-modal-table-name');
    const subAmount = document.getElementById('payment-modal-subtotal');
    const tipCustom = document.getElementById('payment-custom-tip');
    const freeCheck = document.getElementById('free-table-after-pay-checkbox');

    if (subName) subName.textContent = `${currentTable} • Mozo: ${tableOrder.waiter || currentUser}`;
    if (subAmount) subAmount.textContent = `$${currentCheckoutSubtotal.toLocaleString('es-AR')}`;
    if (tipCustom) tipCustom.value = '';
    if (freeCheck) freeCheck.checked = false;

    selectPaymentMethod('Efectivo');
    setTipPercentage(0);

    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('hidden');
}

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    const map = {
        'Efectivo': 'pay-method-efectivo',
        'Transferencia': 'pay-method-transferencia',
        'Mixto': 'pay-method-mixto'
    };

    Object.entries(map).forEach(([m, elId]) => {
        const btn = document.getElementById(elId);
        if (!btn) return;
        if (m === method) {
            btn.className = 'py-3 px-2 rounded-xl border border-emerald-500 bg-emerald-500/15 text-emerald-300 font-bold text-xs flex flex-col items-center gap-1.5 transition-all';
        } else {
            btn.className = 'py-3 px-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 font-bold text-xs flex flex-col items-center gap-1.5 transition-all';
        }
    });

    const mixtoBox = document.getElementById('mixto-inputs-container');
    if (mixtoBox) {
        if (method === 'Mixto') {
            mixtoBox.classList.remove('hidden');
            const totalNow = getCurrentCheckoutTotalWithTip();
            const half = Math.round(totalNow / 2);
            const cashIn = document.getElementById('mixto-cash-input');
            const transIn = document.getElementById('mixto-transfer-input');
            if (cashIn) cashIn.value = String(half);
            if (transIn) transIn.value = String(totalNow - half);
        } else {
            mixtoBox.classList.add('hidden');
        }
    }
}

function setTipPercentage(pct) {
    selectedTipPercent = pct;
    const customInput = document.getElementById('payment-custom-tip');
    if (customInput) {
        if (pct === 0) {
            customInput.value = '';
        } else {
            customInput.value = String(Math.round(currentCheckoutSubtotal * (pct / 100)));
        }
    }
    updatePaymentTotalDisplay();
}

function onCustomTipInput() {
    selectedTipPercent = -1;
    updatePaymentTotalDisplay();
}

function getCurrentTipAmount() {
    const customInput = document.getElementById('payment-custom-tip');
    return customInput ? Math.max(0, Number(customInput.value) || 0) : 0;
}

function getCurrentCheckoutTotalWithTip() {
    return currentCheckoutSubtotal + getCurrentTipAmount();
}

function updatePaymentTotalDisplay() {
    const total = getCurrentCheckoutTotalWithTip();
    const totalEl = document.getElementById('payment-modal-final-total');
    if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')}`;

    if (selectedPaymentMethod === 'Mixto') {
        const cashIn = document.getElementById('mixto-cash-input');
        const transIn = document.getElementById('mixto-transfer-input');
        if (cashIn && transIn) {
            const cashVal = Number(cashIn.value) || 0;
            transIn.value = String(Math.max(0, total - cashVal));
        }
    }
}

function balanceMixtoAmounts(changedType) {
    const total = getCurrentCheckoutTotalWithTip();
    const cashIn = document.getElementById('mixto-cash-input');
    const transIn = document.getElementById('mixto-transfer-input');
    if (!cashIn || !transIn) return;

    if (changedType === 'cash') {
        const c = Math.max(0, Number(cashIn.value) || 0);
        transIn.value = String(Math.max(0, total - c));
    } else {
        const t = Math.max(0, Number(transIn.value) || 0);
        cashIn.value = String(Math.max(0, total - t));
    }
}

async function confirmPaymentAndFinish() {
    if (!currentTable || !ordersByTable[currentTable]) return;
    const tableOrder = ordersByTable[currentTable];

    const tipAmount = getCurrentTipAmount();
    const totalPaid = currentCheckoutSubtotal + tipAmount;
    const freeCheckbox = document.getElementById('free-table-after-pay-checkbox');
    const freeTableAfterPay = freeCheckbox ? !!freeCheckbox.checked : false;

    let cashAmount = 0;
    let transferAmount = 0;

    if (selectedPaymentMethod === 'Efectivo') {
        cashAmount = totalPaid;
    } else if (selectedPaymentMethod === 'Transferencia') {
        transferAmount = totalPaid;
    } else {
        const cashIn = document.getElementById('mixto-cash-input');
        const transIn = document.getElementById('mixto-transfer-input');
        cashAmount = Number(cashIn ? cashIn.value : 0) || 0;
        transferAmount = Number(transIn ? transIn.value : 0) || 0;
    }

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table: currentTable,
                waiter: tableOrder.waiter || currentUser || 'Mozo',
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
            closeMobileCartDrawer();
            await fetchServerState(true);
            if (freeTableAfterPay) {
                showToast(`${currentTable} cobrada y liberada para nuevos clientes`, 'success');
                backToTablesGrid();
            } else {
                showToast(`${currentTable} marcada como PAGADA en Sistema Mozos y Humboldt`, 'success');
                backToTablesGrid();
            }
        } else {
            showToast(data.error || 'Error al registrar el cobro', 'error');
        }
    } catch (e) {
        showToast('Error de red al procesar el cobro', 'error');
    }
}

// ============================================================================
// PANEL DE ADMINISTRACIÓN (CARTA DE PRECIOS MOZOS, REPORTES, PERSONAL)
// ============================================================================
function switchAdminSubTab(tab) {
    currentAdminSubTab = tab;
    const tabs = ['menu', 'report', 'staff'];
    tabs.forEach(t => {
        const btn = document.getElementById(`admin-tab-${t}`);
        const view = document.getElementById(`admin-subview-${t}`);
        if (btn) {
            btn.className = t === tab
                ? 'flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                : 'flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all bg-slate-800 text-slate-400 hover:text-white';
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
    const catSelect = document.getElementById('admin-new-item-category');
    if (catSelect) {
        catSelect.innerHTML = menuData.map(c =>
            `<option value="${c.id}" ${c.id === currentAdminMenuCatId ? 'selected' : ''}>${c.name}</option>`
        ).join('');
    }

    const tabsEl = document.getElementById('admin-menu-categories-tabs');
    if (tabsEl) {
        tabsEl.innerHTML = menuData.map(c => `
            <button onclick="selectAdminMenuCat('${c.id}')"
                class="px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                    c.id === currentAdminMenuCatId
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                }">
                ${c.name}
            </button>
        `).join('');
    }

    const listEl = document.getElementById('admin-menu-items-list');
    if (!listEl) return;

    const cat = menuData.find(c => c.id === currentAdminMenuCatId) || menuData[0];
    if (!cat || !Array.isArray(cat.items)) {
        listEl.innerHTML = '';
        return;
    }

    listEl.innerHTML = cat.items.map(item => {
        const safeId = String(item.id).replace(/'/g, "\\'");
        const safeName = String(item.name).replace(/'/g, "\\'");
        const canDelete = String(item.id).startsWith('pizza_flavor_') || String(item.id).startsWith('bev_');

        return `
            <div class="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-2">
                <div>
                    <p class="font-bold text-white text-sm">${item.name}</p>
                    <p class="text-xs font-extrabold text-orange-400">
                        $${Number(item.price).toLocaleString('es-AR')}
                        ${item.precioMedia ? `<span class="text-slate-400 font-normal ml-1">(Media: $${Number(item.precioMedia).toLocaleString('es-AR')})</span>` : ''}
                    </p>
                </div>
                <div class="flex items-center gap-1.5">
                    <button onclick="openEditMenuItemModal('${safeId}', '${safeName}', ${Number(item.price) || 0})"
                        class="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    ${canDelete ? `
                        <button onclick="deleteAdminMenuItem('${safeId}')"
                            class="p-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs border border-red-500/30">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function selectAdminMenuCat(catId) {
    currentAdminMenuCatId = catId;
    renderAdminMenuManager();
}

async function addNewMenuItemFromAdmin() {
    const catEl = document.getElementById('admin-new-item-category');
    const nameEl = document.getElementById('admin-new-item-name');
    const priceEl = document.getElementById('admin-new-item-price');

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
            await fetchServerState(true);
            showToast('Producto guardado en la lista de precios de Sistema Mozos', 'success');
        }
    } catch (e) {
        showToast('Error al agregar producto', 'error');
    }
}

function openEditMenuItemModal(id, name, price) {
    editingMenuItemId = id;
    const nameEl = document.getElementById('edit-item-name-input');
    const priceEl = document.getElementById('edit-item-price-input');
    if (nameEl) nameEl.value = name;
    if (priceEl) priceEl.value = String(price);

    const modal = document.getElementById('edit-menu-item-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditMenuItemModal() {
    editingMenuItemId = null;
    const modal = document.getElementById('edit-menu-item-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveEditedMenuItem() {
    if (!editingMenuItemId) return;
    const nameEl = document.getElementById('edit-item-name-input');
    const priceEl = document.getElementById('edit-item-price-input');
    const name = nameEl ? nameEl.value.trim() : '';
    const price = priceEl ? Number(priceEl.value) : 0;

    try {
        const res = await fetch(`/api/menu/items/${encodeURIComponent(editingMenuItemId)}`, {
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

async function deleteAdminMenuItem(id) {
    if (!confirm('¿Eliminar este producto de la carta?')) return;
    try {
        const res = await fetch(`/api/menu/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) {
            await fetchServerState(true);
            showToast('Producto eliminado', 'info');
        }
    } catch (e) {
        showToast('Error al eliminar producto', 'error');
    }
}

// ============================================================================
// REPORTES Y CIERRE DE NOCHE
// ============================================================================
function renderAdminNightReport() {
    let totalOrders = paymentHistory.length;
    let totalRevenue = 0;
    let totalCash = 0;
    let totalTransfer = 0;

    paymentHistory.forEach(p => {
        totalRevenue += Number(p.subtotal) || 0;
        totalCash += Number(p.cashAmount) || 0;
        totalTransfer += Number(p.transferAmount) || 0;
    });

    const elOrders = document.getElementById('report-total-orders');
    const elRev = document.getElementById('report-total-revenue');
    const elCash = document.getElementById('report-total-cash');
    const elTrans = document.getElementById('report-total-transfer');
    const elTips = document.getElementById('report-total-tips');

    if (elOrders) elOrders.textContent = String(totalOrders);
    if (elRev) elRev.textContent = `$${totalRevenue.toLocaleString('es-AR')}`;
    if (elCash) elCash.textContent = `$${totalCash.toLocaleString('es-AR')}`;
    if (elTrans) elTrans.textContent = `$${totalTransfer.toLocaleString('es-AR')}`;
    if (elTips) elTips.textContent = `$${generalTipsPool.toLocaleString('es-AR')}`;

    const waitersCount = Math.max(1, staffList.filter(s => s.role !== 'admin').length);
    const tipPerWaiter = Math.round(generalTipsPool / waitersCount);

    const tipDist = document.getElementById('report-tips-per-waiter');
    if (tipDist) {
        tipDist.textContent = `${waitersCount} mozos activos → $${tipPerWaiter.toLocaleString('es-AR')} c/u`;
    }

    const paymentsEl = document.getElementById('report-payments-list');
    if (paymentsEl) {
        if (paymentHistory.length === 0) {
            paymentsEl.innerHTML = `<p class="text-slate-500 text-xs py-4 text-center">Sin cobros registrados en este turno.</p>`;
        } else {
            paymentsEl.innerHTML = paymentHistory.map(p => `
                <div class="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-between text-xs">
                    <div>
                        <span class="font-bold text-white">${p.table}</span>
                        <span class="text-slate-400 ml-1">(${p.waiter}) • ${p.method}</span>
                        <span class="text-slate-500 block text-[10px]">${p.timestamp || ''}</span>
                    </div>
                    <div class="text-right">
                        <span class="font-extrabold text-emerald-400 block">$${Number(p.totalPaid).toLocaleString('es-AR')}</span>
                        ${p.tip > 0 ? `<span class="text-[10px] text-amber-300">Propina: $${Number(p.tip).toLocaleString('es-AR')}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
    }

    const historyEl = document.getElementById('night-reports-history-list');
    if (historyEl) {
        if (nightReports.length === 0) {
            historyEl.innerHTML = `<p class="text-slate-500 text-xs py-4 text-center">No hay cierres anteriores.</p>`;
        } else {
            historyEl.innerHTML = nightReports.map(r => `
                <div class="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
                    <div>
                        <span class="font-bold text-white block">${r.closedAt}</span>
                        <span class="text-slate-400">${r.totalOrders} mesas cobradas</span>
                    </div>
                    <div class="text-right">
                        <span class="font-black text-orange-400 block">$${Number(r.totalRevenue).toLocaleString('es-AR')}</span>
                        <span class="text-[10px] text-amber-300">Propinas: $${Number(r.totalTips).toLocaleString('es-AR')}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

async function closeNightAndReset() {
    if (!confirm('¿Confirmar Cierre de Noche? Se guardará el reporte y se limpiarán todas las mesas para la próxima jornada.')) return;
    try {
        const res = await fetch('/api/close-night', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary: { closedBy: currentUser } })
        });
        if (res.ok) {
            await fetchServerState(true);
            showToast('Cierre de noche completado y mesas reiniciadas', 'success');
        }
    } catch (e) {
        showToast('Error al cerrar la noche', 'error');
    }
}

function downloadNightReportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('Librería PDF no disponible', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Reporte de Turno - Humboldt / Rivera', 14, 18);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleString('es-AR')}`, 14, 26);

    const rows = paymentHistory.map(p => [
        p.table,
        p.waiter,
        p.method,
        `$${Number(p.subtotal).toLocaleString('es-AR')}`,
        `$${Number(p.tip).toLocaleString('es-AR')}`,
        `$${Number(p.totalPaid).toLocaleString('es-AR')}`
    ]);

    if (doc.autoTable) {
        doc.autoTable({
            startY: 32,
            head: [['Mesa', 'Mozo', 'Método', 'Subtotal', 'Propina', 'Total']],
            body: rows
        });
    }
    doc.save(`Reporte_Humboldt_${Date.now()}.pdf`);
}

// ============================================================================
// GESTIÓN DE PERSONAL (MOZOS Y CONTRASEÑA ADMIN)
// ============================================================================
function renderAdminStaffManager() {
    const listEl = document.getElementById('admin-staff-list');
    if (!listEl) return;

    const waiters = staffList.filter(s => s.role !== 'admin');
    listEl.innerHTML = waiters.map(w => {
        const safeName = w.name.replace(/'/g, "\\'");
        return `
            <div class="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <span class="font-bold text-white text-sm">${w.name}</span>
                </div>
                <button onclick="deleteStaffMember('${safeName}')"
                    class="p-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs border border-red-500/30">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

async function addNewStaffMember() {
    const input = document.getElementById('admin-new-staff-name');
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
    if (!confirm(`¿Eliminar a ${name} de la lista de mozos?`)) return;
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

function openChangePasswordModal() {
    const curr = document.getElementById('current-admin-pass-input');
    const next = document.getElementById('new-admin-pass-input');
    const conf = document.getElementById('confirm-admin-pass-input');
    if (curr) curr.value = '';
    if (next) next.value = '';
    if (conf) conf.value = '';

    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveNewAdminPassword() {
    const curr = document.getElementById('current-admin-pass-input');
    const next = document.getElementById('new-admin-pass-input');
    const conf = document.getElementById('confirm-admin-pass-input');

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
            closeChangePasswordModal();
            showToast('Contraseña actualizada correctamente', 'success');
        } else {
            showToast(data.error || 'No se pudo cambiar la contraseña', 'error');
        }
    } catch (e) {
        showToast('Error al cambiar contraseña', 'error');
    }
}

// ============================================================================
// NOTIFICACIONES TOAST UI
// ============================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
        success: 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200',
        error: 'bg-red-950/95 border-red-500/60 text-red-200',
        info: 'bg-slate-900/95 border-orange-500/50 text-slate-100'
    };

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl border shadow-xl text-xs font-bold flex items-center gap-2.5 transition-all ${colors[type] || colors.info}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'error' ? 'fa-triangle-exclamation text-red-400' : 'fa-circle-info text-orange-400'}"></i>
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
