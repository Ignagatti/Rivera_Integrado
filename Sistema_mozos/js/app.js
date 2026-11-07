document.addEventListener('DOMContentLoaded', async () => {

    // ── DOM ──────────────────────────────────────────────────────────────────
    const kitchenNumberInput  = document.getElementById('kitchen-number-input');
    const modeSwitcher        = document.getElementById('mode-switcher');
    const mapaClub            = document.getElementById('mapa-club');
    const addTableBtn         = document.getElementById('add-table-btn');
    const managePricesBtn     = document.getElementById('manage-prices-btn');
    const clearAllOrdersBtn   = document.getElementById('clear-all-orders-btn');
    const showTotalBtn        = document.getElementById('show-total-btn');
    const exportPdfBtn        = document.getElementById('export-pdf-btn');

    // Secciones del modal de pedido
    const pizzaLibreSection         = document.getElementById('pizza-libre-section');
    const menuSection               = document.getElementById('menu-section');
    const customPizzaBuilderSection = document.getElementById('custom-pizza-builder-section');
    const pizzaTopping3Container    = document.getElementById('pizza-topping-3-container');

    // Secciones del modal de precios
    const pricePizzaSection       = document.getElementById('price-pizza-section');
    const priceMenuSection        = document.getElementById('price-menu-section');
    const priceCustomPizzaSection = document.getElementById('price-custom-pizza-section');
    const priceMenuMiercolesWrapper = document.getElementById('price-menu-miercoles-wrapper');
    const priceMenuMartesWrapper     = document.getElementById('price-menu-martes-wrapper');
    const priceMenuViernesWrapper    = document.getElementById('price-menu-viernes-wrapper');
    const priceMenuDomingoWrapper    = document.getElementById('price-menu-domingo-wrapper');

    // Modales
    const orderModal               = document.getElementById('order-modal');
    const pricesModal              = document.getElementById('prices-modal');
    const passwordModal            = document.getElementById('password-modal');
    const totalModal               = document.getElementById('total-modal');
    const printSingleAccountModal  = document.getElementById('print-single-account-modal');
    const genericDataModal         = document.getElementById('generic-data-modal');
    const salesReportModal         = document.getElementById('sales-report-modal');
    const salesReportContent       = document.getElementById('sales-report-content');

    // Botones de modales
    const closeOrderModalBtn               = document.getElementById('close-order-modal-btn');
    const closePricesModalBtn              = document.getElementById('close-prices-modal-btn');
    const closeTotalModalBtn               = document.getElementById('close-total-modal-btn');
    const closePrintSingleAccountModalBtn  = document.getElementById('close-print-single-account-modal-btn');
    const closePrintSingleAccountFinalBtn  = document.getElementById('close-print-single-account-final-btn');
    const printSingleAccountFinalBtn       = document.getElementById('print-single-account-final-btn');
    const printSinglePreview               = document.getElementById('print-single-preview');
    const printSingleAccountBtn            = document.getElementById('print-single-account-btn');
    const closeGenericDataModalBtn         = document.getElementById('close-generic-data-modal-btn');
    const genericDataBtn                   = document.getElementById('generic-data-btn');
    const downloadPdfBtn                   = document.getElementById('download-pdf-btn');
    const closeSalesReportModalBtn         = document.getElementById('close-sales-report-modal-btn');
    const closeSalesReportFinalBtn         = document.getElementById('close-sales-report-final-btn');

    // Modal Cambio de Día
    const changeDayModal      = document.getElementById('change-day-modal');
    const changeDayTargetName = document.getElementById('change-day-target-name');
    const changeDayClearBtn   = document.getElementById('change-day-clear-btn');
    const changeDayKeepBtn    = document.getElementById('change-day-keep-btn');
    const changeDayCancelBtn  = document.getElementById('change-day-cancel-btn');

    // Datos genéricos
    const genericEstablishmentNameInput = document.getElementById('generic-establishment-name');
    const genericAddressInput           = document.getElementById('generic-address');
    const genericPhoneInput             = document.getElementById('generic-phone');
    const genericEmailInput             = document.getElementById('generic-email');
    const genericFooterInput            = document.getElementById('generic-footer');
    const genericAliasInput             = document.getElementById('generic-alias');
    const saveGenericDataBtn            = document.getElementById('save-generic-data-btn');

    // Contadores del modal de pedido
    const modalTitleContainer = document.getElementById('modal-title-container');
    const pizzaLibreHCount    = document.getElementById('pizzaLibreH-count');
    const pizzaLibreMCount    = document.getElementById('pizzaLibreM-count');
    const pizzaLibreGCount    = document.getElementById('pizzaLibreG-count');
    const menoresCount        = document.getElementById('menores-count');
    const menorPriceInput     = document.getElementById('menor-price-input');
    const empanadasCount      = document.getElementById('empanadas-count');
    const menuCount           = document.getElementById('menu-count');
    const postresCount        = document.getElementById('postres-count');
    const beverageSelect      = document.getElementById('beverage-select');
    const beverageQuantityInput = document.getElementById('beverage-quantity');
    const addBeverageBtn      = document.getElementById('add-beverage-btn');
    const modalOrderList      = document.getElementById('modal-order-list');
    const modalTotalPrice     = document.getElementById('modal-total-price');
    const deleteEntityBtn     = document.getElementById('delete-entity-btn');
    const cleanOrderBtn       = document.getElementById('clean-order-btn');
    const freePaidTableBtn    = document.getElementById('free-paid-table-btn');
    const closeAndSaveBtn     = document.getElementById('close-and-save-btn');

    // Inputs de precios
    const pricePizzaLibreHInput    = document.getElementById('price-pizza-libre-h');
    const pricePizzaLibreMInput    = document.getElementById('price-pizza-libre-m');
    const pricePizzaLibreGInput    = document.getElementById('price-pizza-libre-g');
    const priceEmpanadaInput       = document.getElementById('price-empanada');
    const pricePostreInput         = document.getElementById('price-postre');
    const priceMenuMiercolesInput  = document.getElementById('price-menu-miercoles');
    const priceMenuMartesInput     = document.getElementById('price-menu-martes');
    const priceMenuViernesInput    = document.getElementById('price-menu-viernes');
    const priceMenuDomingoInput    = document.getElementById('price-menu-domingo');
    const beveragesPricesList      = document.getElementById('beverages-prices-list');
    const newBeverageNameInput     = document.getElementById('new-beverage-name');
    const newBeveragePriceInput    = document.getElementById('new-beverage-price');
    const newBeverageCategoryInput = document.getElementById('new-beverage-category');
    const addNewBeveragePriceBtn   = document.getElementById('add-new-beverage-price-btn');
    const savePricesBtn            = document.getElementById('save-prices-btn');
    const customPizzaPricesList    = document.getElementById('custom-pizza-prices-list');
    const newPizzaNameInput        = document.getElementById('new-pizza-name');
    const addNewPizzaBtn           = document.getElementById('add-new-pizza-btn');

    // Constructor de pizzas
    const pizzaSizeSelect     = document.getElementById('pizza-size');
    const pizzaTopping1Select = document.getElementById('pizza-topping-1');
    const pizzaTopping2Select = document.getElementById('pizza-topping-2');
    const pizzaTopping3Select = document.getElementById('pizza-topping-3');
    const addCustomPizzaBtn   = document.getElementById('add-custom-pizza-btn');

    // Barra
    const barClientNameInput = document.getElementById('bar-client-name');
    const addBarOrderBtn     = document.getElementById('add-bar-order-btn');
    const barOrdersList      = document.getElementById('bar-orders-list');

    // Password
    const passwordTitle       = document.getElementById('password-title');
    const passwordDescription = document.getElementById('password-description');
    const passwordInput       = document.getElementById('password-input');
    const passwordError       = document.getElementById('password-error');
    const passwordConfirmBtn  = document.getElementById('password-confirm-btn');
    const passwordCancelBtn   = document.getElementById('password-cancel-btn');
    const totalModalAmount    = document.getElementById('total-modal-amount');

    // Propina & Pago DOM
    const payBtnIcon                = document.getElementById('pay-btn-icon');
    const payBtnText                = document.getElementById('pay-btn-text');
    const modalTipDetail            = document.getElementById('modal-tip-detail');
    const modalTipAmount            = document.getElementById('modal-tip-amount');
    
    // Modal Pago
    const paymentModal              = document.getElementById('payment-modal');
    const closePaymentModalBtn       = document.getElementById('close-payment-modal-btn');
    const paymentModalTableTotal    = document.getElementById('payment-modal-table-total');
    const paymentAmountInput        = document.getElementById('payment-amount-input');
    const paymentModalCalculatedTip = document.getElementById('payment-modal-calculated-tip');
    const paymentUnpayBtn           = document.getElementById('payment-unpay-btn');
    const paymentConfirmBtn         = document.getElementById('payment-confirm-btn');
    const totalModalPropinaCount    = document.getElementById('total-modal-propina-count');

    // Conteo de Personas DOM
    const totalPersonasCard        = document.getElementById('total-personas-card');
    const totalPersonasCount       = document.getElementById('total-personas-count');
    const totalPersonasBreakdown   = document.getElementById('total-personas-breakdown');
    const totalModalPersonasBox    = document.getElementById('total-modal-personas-box');
    const totalModalPersonasCount  = document.getElementById('total-modal-personas-count');
    const totalModalPersonasDetail = document.getElementById('total-modal-personas-detail');

    // Categorías de bebidas organizadas
    const BEVERAGE_CATEGORIES = [
        { id: 'vino',       label: 'Vinos',            icon: '🍷' },
        { id: 'cerveza',    label: 'Cervezas',         icon: '🍺' },
        { id: 'gaseosa',    label: 'Gaseosas',         icon: '🥤' },
        { id: 'agua',       label: 'Aguas',            icon: '💧' },
        { id: 'saborizada', label: 'Aguas Saborizadas',icon: '🍊' },
        { id: 'jarro',      label: 'Jarros / Tragos',  icon: '🍹' },
        { id: 'otro',       label: 'Otras Bebidas',    icon: '📦' }
    ];

    // ── UI STATE (no se persiste) ─────────────────────────────────────────────
    let activeEntity       = null;
    let orderBeforeChanges = null;
    let actionToConfirm    = null;
    let currentSalesReport = null;
    let pendingNewMode     = null;
    let modeBeforeChange   = null;

    // ── HELPERS ───────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatPrice(amount) {
        let num = Number(amount) || 0;
        let str = num.toFixed(2);
        return str.endsWith('.00') ? str.slice(0, -3) : str;
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

    function getBeverageColor(name, category = 'otro') {
        switch (resolveBeverageCategory(name, category)) {
            case 'agua':       return 'bg-blue-200 border-blue-500';
            case 'saborizada': return 'bg-orange-200 border-orange-500';
            case 'gaseosa':    return 'bg-red-200 border-red-500';
            case 'cerveza':    return 'bg-yellow-200 border-yellow-500';
            case 'vino':       return 'bg-purple-200 border-purple-500';
            case 'jarro':      return 'bg-indigo-200 border-indigo-500 text-indigo-900';
            default:           return 'bg-gray-100 border-gray-400';
        }
    }

    function getBeverageOptionStyle(name, category = 'otro') {
        switch (resolveBeverageCategory(name, category)) {
            case 'agua':       return { bg: '#90CDF4', text: '#2A4365' };
            case 'saborizada': return { bg: '#FBD38D', text: '#9C4221' };
            case 'gaseosa':    return { bg: '#FC8181', text: '#9B2C2C' };
            case 'cerveza':    return { bg: '#F0E68C', text: '#975A16' };
            case 'vino':       return { bg: '#B794F4', text: '#44337A' };
            case 'jarro':      return { bg: '#C3DAFE', text: '#2C5282' };
            default:           return { bg: '#FFFFFF', text: '#1A202C' };
        }
    }

    // ── MODO UI ───────────────────────────────────────────────────────────────
    function updateUIMode(mode) {
        const isPizzaLibre = mode === 'jueves' || mode === 'sabado';

        pizzaLibreSection.style.display         = isPizzaLibre ? 'block' : 'none';
        menuSection.style.display               = isPizzaLibre ? 'none'  : 'block';
        customPizzaBuilderSection.style.display = isPizzaLibre ? 'block' : 'none';

        pricePizzaSection.style.display       = isPizzaLibre ? 'block' : 'none';
        priceMenuSection.style.display        = isPizzaLibre ? 'none'  : 'block';
        priceCustomPizzaSection.style.display = isPizzaLibre ? 'block' : 'none';

        [priceMenuMartesWrapper, priceMenuMiercolesWrapper,
         priceMenuViernesWrapper, priceMenuDomingoWrapper].forEach(w => { if (w) w.style.display = 'none'; });

        if (mode === 'martes'    && priceMenuMartesWrapper)    priceMenuMartesWrapper.style.display    = 'block';
        if (mode === 'miercoles' && priceMenuMiercolesWrapper) priceMenuMiercolesWrapper.style.display = 'block';
        if (mode === 'viernes'   && priceMenuViernesWrapper)   priceMenuViernesWrapper.style.display   = 'block';
        if (mode === 'domingo'   && priceMenuDomingoWrapper)   priceMenuDomingoWrapper.style.display   = 'block';

        updateTotalPersonsUI();
    }

    // ── CONTEO DE PERSONAS Y PROPINAS ─────────────────────────────────────────
    function getAllTablesWithArchived() {
        return [...(appState.tables || []), ...(appState.archivedSales || [])];
    }

    function updateTotalPersonsUI() {
        const mode = appState.currentMode;
        const isExcluded = mode === 'jueves' || mode === 'sabado';

        if (totalPersonasCard) {
            if (isExcluded) {
                totalPersonasCard.style.display = 'none';
            } else {
                totalPersonasCard.style.display = 'block';
                const allTables = getAllTablesWithArchived();
                const count = calculateGrandTotalPersons(allTables, mode);
                if (totalPersonasCount) totalPersonasCount.textContent = count;

                if (totalPersonasBreakdown) {
                    let menus = 0, menores = 0;
                    allTables.forEach(t => {
                        if (t && t.order) {
                            menus += (t.order.menu || 0);
                            menores += (t.order.menores || 0);
                        }
                    });
                    if (menores > 0) {
                        totalPersonasBreakdown.textContent = `(${menus} menús + ${menores} menores)`;
                        totalPersonasBreakdown.classList.remove('hidden');
                    } else {
                        totalPersonasBreakdown.classList.add('hidden');
                    }
                }
            }
        }
    }

    // ── RENDER ────────────────────────────────────────────────────────────────
    function renderAll() {
        renderTables();
        renderBarOrders();
        updateTotalPersonsUI();
    }

    function renderTables() {
        mapaClub.innerHTML = '';
        appState.tables.forEach(table => {
            const el = document.createElement('div');
            el.id = table.id;
            const isPaid = table.isPaid || false;
            const total = calculateTotal(table.order, appState.prices, appState.currentMode);
            const tip = table.tipAmount || 0;

            const bgClass = isPaid ? 'bg-emerald-600 border-emerald-800' : 'bg-blue-500 border-blue-700';

            el.className = `mesa absolute ${bgClass} border-2 rounded-lg flex flex-col items-center justify-center text-white font-bold cursor-grab select-none p-1 shadow-md transition-colors duration-200 overflow-hidden`;
            el.style.left   = `${table.x}px`;
            el.style.top    = `${table.y}px`;
            el.style.width  = `${table.width}px`;
            el.style.height = `${table.height}px`;

            const w = table.width || 100;
            const h = table.height || 100;

            let fontClass = 'text-2xl';
            if (w < 70 || h < 70) {
                fontClass = 'text-sm';
            } else if (w < 95 || h < 90) {
                fontClass = 'text-lg';
            }

            const persons = calculateTablePersons(table.order, appState.currentMode);
            const numEl = document.createElement('div');
            numEl.className = 'text-center flex flex-col items-center justify-center pointer-events-none w-full px-0.5';

            let infoSubHtml = '';
            if (isPaid) {
                if (w < 70 || h < 65) {
                    // Mesa muy pequeña: número compacto + total resumido en 1 sola línea
                    infoSubHtml = `<div class="text-[9px] bg-emerald-950 bg-opacity-70 px-1 py-0.5 rounded mt-0.5 font-medium leading-none text-center truncate max-w-full" title="Total: $${formatPrice(total)}${tip > 0 ? ' | Propina: $' + formatPrice(tip) : ''}">
                        ✓ $${formatPrice(total)}
                    </div>`;
                } else if (w < 95 || h < 85) {
                    // Mesa mediana: compacto
                    infoSubHtml = `<div class="text-[9px] bg-emerald-950 bg-opacity-70 px-1 py-0.5 rounded mt-0.5 font-medium leading-tight text-center w-full truncate" title="Total: $${formatPrice(total)}${tip > 0 ? ' | Propina: $' + formatPrice(tip) : ''}">
                        <div>$${formatPrice(total)}</div>
                        ${tip > 0 ? `<div class="font-bold text-emerald-200">P: $${formatPrice(tip)}</div>` : ''}
                    </div>`;
                } else {
                    // Mesa normal / grande: detalle completo
                    infoSubHtml = `<div class="text-[10px] bg-emerald-950 bg-opacity-70 px-1.5 py-0.5 rounded-md mt-0.5 font-medium leading-tight text-center w-full">
                        <div>Total: $${formatPrice(total)}</div>
                        <div class="font-bold text-emerald-200">Propina: $${formatPrice(tip)}</div>
                    </div>`;
                }
            } else if (persons > 0 && appState.currentMode !== 'jueves' && appState.currentMode !== 'sabado') {
                const badgeTextSize = (w < 70 || h < 70) ? 'text-[9px] px-1 py-0.2' : (w < 95 || h < 90) ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-1.5 py-0.5';
                infoSubHtml = `<span class="${badgeTextSize} bg-blue-900 bg-opacity-70 rounded-full mt-0.5 flex items-center justify-center gap-0.5 font-semibold leading-none">👥 ${persons}</span>`;
            }

            numEl.innerHTML = `<span class="leading-none ${fontClass} font-bold truncate max-w-full">${escapeHtml(table.number)}</span>${infoSubHtml}`;

            const resizerEl = document.createElement('div');
            resizerEl.className = 'resizer';

            el.appendChild(numEl);
            el.appendChild(resizerEl);
            mapaClub.appendChild(el);

            el.addEventListener('click', e => {
                if (e.target.classList.contains('resizer')) return;
                openOrderModal(table.id, 'table');
            });
            makeDraggable(el, appState.tables, mapaClub, saveState);
            makeResizable(el, resizerEl, appState.tables, saveState, () => renderTables());
        });
    }

    function renderBarOrders() {
        barOrdersList.innerHTML = '';
        appState.barOrders.forEach(order => {
            const el    = document.createElement('div');
            el.className = 'bg-gray-100 p-3 rounded-lg cursor-pointer hover:bg-gray-200';
            const total = calculateTotal(order.order, appState.prices, appState.currentMode);
            el.innerHTML = `<div class="flex justify-between items-center"><span class="font-semibold">${order.clientName}</span><span class="font-bold text-gray-700">$${formatPrice(total)}</span></div>`;
            el.addEventListener('click', () => openOrderModal(order.id, 'bar'));
            barOrdersList.appendChild(el);
        });
    }

    function renderOrderList() {
        modalOrderList.innerHTML = '';
        const order = activeEntity.order;
        const mode  = appState.currentMode;

        if (mode === 'jueves' || mode === 'sabado') {
            if (order.pizzaLibreH > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.pizzaLibreH} x Pizza Libre Hombres</div>`;
            if (order.pizzaLibreM > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.pizzaLibreM} x Pizza Libre Mujeres</div>`;
            if (order.pizzaLibreG > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.pizzaLibreG} x Pizza Libre General</div>`;
        }
        if (mode !== 'jueves' && mode !== 'sabado') {
            if (order.menu > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.menu} x Menú</div>`;
        }
        if (order.empanadas > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.empanadas} x Empanada</div>`;
        if (order.menores   > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.menores} x Menor — $${formatPrice((order.menores||0)*(order.menorPrice||0))}</div>`;
        if (order.postres   > 0) modalOrderList.innerHTML += `<div class="order-item-food">${order.postres} x Postre</div>`;

        if (order.pizzasPersonalizadas && order.pizzasPersonalizadas.length > 0) {
            order.pizzasPersonalizadas.forEach((pizza, index) => {
                const item = document.createElement('div');
                item.className = 'order-item-bev flex justify-between items-center bg-green-100 border-green-500';
                const desc = `1x Pizza ${pizza.size} (${pizza.toppings.filter(t => t !== 'ninguno').join(', ')})`;
                item.innerHTML = `
                    <span class="font-medium text-gray-800">${desc}</span>
                    <button data-pizza-index="${index}" class="remove-pizza-btn" title="Quitar Pizza">X</button>
                `;
                modalOrderList.appendChild(item);
            });
        }

        order.beverages.forEach((bev, index) => {
            const bevEl      = document.createElement('div');
            const bevInfo    = appState.prices.beverages.find(b => b.name === bev.name) || {};
            const colorCls   = getBeverageColor(bev.name, bevInfo.category);
            bevEl.className  = `order-item-bev flex justify-between items-center ${colorCls}`;
            bevEl.innerHTML  = `
                <span class="font-medium ${colorCls.includes('text-white') ? 'text-white' : 'text-gray-800'}">${bev.quantity} x ${bev.name}</span>
                <div class="flex items-center space-x-1">
                    <button data-index="${index}" class="decrease-bev-btn w-7 h-7 flex items-center justify-center bg-red-500 text-white rounded-full font-bold shadow-sm hover:bg-red-600 transition" title="Quitar 1">-</button>
                    <button data-index="${index}" class="increase-bev-btn w-7 h-7 flex items-center justify-center bg-green-500 text-white rounded-full font-bold shadow-sm hover:bg-green-600 transition" title="Agregar 1">+</button>
                </div>
            `;
            modalOrderList.appendChild(bevEl);
        });
    }

    function updateOrderModalUI() {
        if (!activeEntity) return;
        const order = activeEntity.order;
        pizzaLibreHCount.textContent = order.pizzaLibreH || 0;
        pizzaLibreMCount.textContent = order.pizzaLibreM || 0;
        pizzaLibreGCount.textContent = order.pizzaLibreG || 0;
        if (menoresCount)    menoresCount.textContent = order.menores || 0;
        if (menorPriceInput) menorPriceInput.value    = (order.menorPrice !== undefined && order.menorPrice !== null) ? order.menorPrice : '';
        empanadasCount.textContent = order.empanadas || 0;
        menuCount.textContent      = order.menu      || 0;
        postresCount.textContent   = order.postres   || 0;

        beverageSelect.innerHTML = '<option value="" disabled selected>-- Seleccionar bebida --</option>';
        BEVERAGE_CATEGORIES.forEach(cat => {
            const catBevs = appState.prices.beverages
                .filter(bev => resolveBeverageCategory(bev.name, bev.category) === cat.id);

            if (catBevs.length > 0) {
                const groupEl = document.createElement('optgroup');
                groupEl.label = `${cat.icon} ${cat.label}`;
                catBevs.forEach(bev => {
                    const opt = document.createElement('option');
                    opt.value = bev.name;
                    opt.textContent = `${bev.name} - $${formatPrice(bev.price)}`;
                    const style = getBeverageOptionStyle(bev.name, bev.category);
                    opt.style.backgroundColor = style.bg;
                    opt.style.color           = style.text;
                    groupEl.appendChild(opt);
                });
                beverageSelect.appendChild(groupEl);
            }
        });

        [pizzaTopping1Select, pizzaTopping2Select, pizzaTopping3Select].forEach((sel, i) => {
            sel.innerHTML = '';
            if (i > 0) {
                const none = document.createElement('option');
                none.value = 'ninguno'; none.textContent = 'Ninguno';
                sel.appendChild(none);
            }
            appState.prices.preciosPizzas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.name; opt.textContent = p.name;
                sel.appendChild(opt);
            });
        });

        renderOrderList();
        updateTotal();

        if (activeEntity) {
            const isPaid = activeEntity.isPaid || false;
            const tip = activeEntity.tipAmount || 0;

            if (payBtnIcon) payBtnIcon.textContent = isPaid ? '✅' : '💳';
            if (payBtnText) payBtnText.textContent = isPaid ? 'Pagado' : 'Marcar Pagado';

            if (cleanOrderBtn) {
                if (isPaid) {
                    cleanOrderBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'bg-yellow-500', 'hover:bg-yellow-600');
                    cleanOrderBtn.classList.add('bg-emerald-700', 'hover:bg-emerald-800');
                } else {
                    cleanOrderBtn.classList.remove('bg-emerald-700', 'hover:bg-emerald-800', 'bg-yellow-500', 'hover:bg-yellow-600');
                    cleanOrderBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
                }
            }

            if (freePaidTableBtn) {
                if (isPaid && activeEntity.id && activeEntity.id.startsWith('table-')) {
                    freePaidTableBtn.classList.remove('hidden');
                } else {
                    freePaidTableBtn.classList.add('hidden');
                }
            }

            if (modalTipDetail) {
                if (isPaid && tip >= 0) {
                    if (modalTipAmount) modalTipAmount.textContent = `$${formatPrice(tip)}`;
                    modalTipDetail.classList.remove('hidden');
                } else {
                    modalTipDetail.classList.add('hidden');
                }
            }
        }
    }

    function updateTotal() {
        if (!activeEntity) return;
        const total = calculateTotal(activeEntity.order, appState.prices, appState.currentMode);
        modalTotalPrice.textContent = `$${formatPrice(total)}`;
        renderAll();
    }

    // ── MODALES ───────────────────────────────────────────────────────────────
    function openOrderModal(id, type) {
        if (type === 'table') {
            activeEntity = appState.tables.find(t => t.id === id);
            modalTitleContainer.innerHTML = `<div class="flex items-center gap-2"><span class="text-2xl font-bold text-gray-800">Mesa</span><input id="modal-table-number-input" type="text" value="${activeEntity.number}" class="text-2xl font-bold p-1 w-20 border rounded-lg text-center"></div>`;
            deleteEntityBtn.textContent = 'Eliminar Mesa';
        } else {
            activeEntity = appState.barOrders.find(o => o.id === id);
            modalTitleContainer.innerHTML = `<h2 class="text-2xl font-bold">Pedido de ${activeEntity.clientName}</h2>`;
            deleteEntityBtn.textContent = 'Eliminar Pedido';
        }
        if (!activeEntity) return;

        activeEntity.order = Object.assign(getNewOrderObject(), activeEntity.order);
        orderBeforeChanges = JSON.parse(JSON.stringify(activeEntity.order));
        resetDeleteButtonState();
        updateOrderModalUI();
        orderModal.style.display = 'flex';
    }

    function closeOrderModal() {
        if (activeEntity && activeEntity.id.startsWith('table-')) {
            const numInput = document.getElementById('modal-table-number-input');
            if (numInput) {
                const newNum = numInput.value.trim();
                if (newNum) activeEntity.number = newNum;
            }
        }
        if (activeEntity && orderBeforeChanges) {
            const name    = activeEntity.id.startsWith('table-') ? `Mesa ${activeEntity.number}` : activeEntity.clientName;
            const message = generateOrderMessage(orderBeforeChanges, activeEntity.order, name);
            if (message) sendWhatsAppMessage(message);

            if (activeEntity.id.startsWith('table-') && window.electronAPI && window.electronAPI.sendTableToPedidos) {
                window.electronAPI.sendTableToPedidos({
                    tableNumber: activeEntity.number,
                    oldOrder: orderBeforeChanges,
                    newOrder: activeEntity.order,
                    prices: appState.prices
                }).catch(() => {});
            }
        }
        saveState();
        activeEntity = null; orderBeforeChanges = null;
        orderModal.style.display = 'none';
        resetDeleteButtonState();
        beverageQuantityInput.value = 1;
        renderAll();
    }

    function openPasswordModal(action) {
        actionToConfirm = action;
        passwordInput.value = '';
        passwordError.classList.add('hidden');
        const titles = {
            deleteTable:     { t: 'Eliminar Mesa',          d: 'Para eliminar la mesa, ingresa la clave.' },
            clearSingleOrder:{ t: 'Limpiar Pedido',         d: 'Para limpiar este pedido, ingresa la clave.' },
            clearAllOrders:  { t: 'Limpiar Todos los Pedidos', d: 'Para limpiar todos los pedidos, ingresa la clave.' }
        };
        const info = titles[action] || { t: 'Verificación', d: 'Ingresá la clave.' };
        passwordTitle.textContent       = info.t;
        passwordDescription.textContent = info.d;
        passwordModal.style.display = 'flex';
    }

    function closePasswordModal() {
        passwordModal.style.display = 'none';
        actionToConfirm = null;
    }

    function resetDeleteButtonState() {
        if (!deleteEntityBtn) return;
        deleteEntityBtn.classList.remove('bg-red-800', 'hover:bg-red-900');
        deleteEntityBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        deleteEntityBtn.dataset.confirming = 'false';
        if (activeEntity) deleteEntityBtn.textContent = activeEntity.id.startsWith('table-') ? 'Eliminar Mesa' : 'Eliminar Pedido';
    }

    function openPricesModal() {
        pricePizzaLibreHInput.value   = appState.prices.pizzaLibreH;
        pricePizzaLibreMInput.value   = appState.prices.pizzaLibreM;
        pricePizzaLibreGInput.value   = appState.prices.pizzaLibreG || 0;
        priceEmpanadaInput.value      = appState.prices.empanada;
        pricePostreInput.value        = appState.prices.precioPostre;
        priceMenuMartesInput.value    = appState.prices.precioMenuMartes;
        priceMenuMiercolesInput.value = appState.prices.precioMenuMiercoles;
        priceMenuViernesInput.value   = appState.prices.precioMenuViernes;
        priceMenuDomingoInput.value   = appState.prices.precioMenuDomingo;
        renderBeveragePrices();
        renderCustomPizzaPrices();
        pricesModal.style.display = 'flex';
    }

    function closePricesModal() { pricesModal.style.display = 'none'; }

    function renderBeveragePrices() {
        beveragesPricesList.innerHTML = '';

        BEVERAGE_CATEGORIES.forEach(cat => {
            const matchingItems = [];
            appState.prices.beverages.forEach((bev, index) => {
                if (resolveBeverageCategory(bev.name, bev.category) === cat.id) {
                    matchingItems.push({ bev, index });
                }
            });

            if (matchingItems.length > 0) {
                const section = document.createElement('div');
                section.className = 'mb-4 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm';

                const header = document.createElement('div');
                header.className = 'bg-gray-100 px-3 py-2 border-b flex items-center justify-between';
                header.innerHTML = `
                    <div class="flex items-center space-x-1.5 font-bold text-sm text-gray-800">
                        <span>${cat.icon}</span>
                        <span>${cat.label}</span>
                    </div>
                    <span class="text-xs bg-gray-300 text-gray-700 px-2 py-0.5 rounded-full font-bold">${matchingItems.length}</span>
                `;
                section.appendChild(header);

                const listContainer = document.createElement('div');
                listContainer.className = 'p-2 space-y-2';

                matchingItems.forEach(({ bev, index }) => {
                    const item = document.createElement('div');
                    const colorCls = getBeverageColor(bev.name, bev.category);
                    item.className = `flex items-center justify-between p-2 rounded-lg border-l-4 ${colorCls} bg-white shadow-xs`;
                    item.innerHTML = `
                        <span class="flex-grow font-medium ${colorCls.includes('text-white') ? 'text-white' : 'text-gray-800'} text-sm mr-2">${escapeHtml(bev.name)}</span>
                        <div class="flex items-center space-x-1">
                            <span class="text-xs text-gray-500 font-bold">$</span>
                            <input type="number" step="0.01" min="0" value="${formatPrice(bev.price)}" data-index="${index}" class="bev-price-input w-24 p-1 border rounded-lg text-right font-bold text-sm">
                            <button data-index="${index}" class="delete-bev-price-btn text-red-500 font-bold p-1 ml-1 hover:text-red-700 text-lg transition" title="Eliminar bebida">&times;</button>
                        </div>
                    `;
                    listContainer.appendChild(item);
                });

                section.appendChild(listContainer);
                beveragesPricesList.appendChild(section);
            }
        });
    }

    function renderCustomPizzaPrices() {
        customPizzaPricesList.innerHTML = '';
        appState.prices.preciosPizzas.forEach((pizza, index) => {
            const item     = document.createElement('div');
            item.className = 'flex items-center justify-between bg-white shadow-xs p-2 border border-gray-200 rounded-lg gap-2';
            item.innerHTML = `
                <span class="flex-grow font-medium text-gray-800 text-sm truncate mr-2">${escapeHtml(pizza.name)}</span>
                <div class="flex items-center space-x-1">
                    <span class="text-xs text-gray-500 font-bold">$</span>
                    <input type="number" value="${formatPrice(pizza.precioEntera||0)}" data-pizza-index="${index}" data-price-type="entera" class="pizza-price-input w-20 p-1 border rounded-lg text-right font-bold text-sm" placeholder="Entera">
                </div>
                <div class="flex items-center space-x-1">
                    <span class="text-xs text-gray-500 font-bold">$</span>
                    <input type="number" value="${formatPrice(pizza.precioMedia ||0)}" data-pizza-index="${index}" data-price-type="media"  class="pizza-price-input w-20 p-1 border rounded-lg text-right font-bold text-sm" placeholder="Media">
                </div>
                <button data-index="${index}" class="delete-pizza-price-btn text-red-500 font-bold p-1 ml-1 hover:text-red-700 text-lg transition" title="Eliminar gusto">&times;</button>
            `;
            customPizzaPricesList.appendChild(item);
        });
    }

    // ── WHATSAPP ──────────────────────────────────────────────────────────────
    function generateOrderMessage(oldOrder, newOrder, entityName) {
        const parts = [];
        const mode  = appState.currentMode;

        if (mode === 'jueves' || mode === 'sabado') {
            const dH = (newOrder.pizzaLibreH||0) - (oldOrder.pizzaLibreH||0);
            const dM = (newOrder.pizzaLibreM||0) - (oldOrder.pizzaLibreM||0);
            const dG = (newOrder.pizzaLibreG||0) - (oldOrder.pizzaLibreG||0);
            if (dH > 0) parts.push(`+${dH} Libre Hombres`);
            if (dM > 0) parts.push(`+${dM} Libre Mujeres`);
            if (dG > 0) parts.push(`+${dG} Libre General`);

            const dP = (newOrder.pizzasPersonalizadas?.length||0) - (oldOrder.pizzasPersonalizadas?.length||0);
            if (dP > 0) parts.push(`+${dP} Pizzas Nuevas`);
        } else {
            const dMenu = (newOrder.menu||0) - (oldOrder.menu||0);
            if (dMenu > 0) parts.push(`+${dMenu} Menú`);
        }

        const dEmp = (newOrder.empanadas||0) - (oldOrder.empanadas||0);
        if (dEmp > 0) parts.push(`+${dEmp} Empanadas`);

        const dPostre = (newOrder.postres||0) - (oldOrder.postres||0);
        if (dPostre > 0) parts.push(`+${dPostre} Postres`);

        return parts.length > 0 ? `*${entityName}:* ${parts.join(', ')}` : null;
    }

    function sendWhatsAppMessage(message) {
        if (!appState.numeroCocina) { console.error('Número de cocina no configurado.'); return; }
        window.electronAPI.openExternal(`whatsapp://send?phone=${appState.numeroCocina}&text=${encodeURIComponent(message)}`);
    }

    function showModeToast(mode, customSubtitle) {
        let toast = document.getElementById('mode-toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mode-toast-notification';
            toast.className = 'fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-xl border border-slate-700 flex items-center space-x-3 transition-all duration-300';
            document.body.appendChild(toast);
        }

        const names = {
            martes: 'Martes (Menú)',
            miercoles: 'Miércoles (Menú)',
            jueves: 'Jueves (Pizza Libre)',
            viernes: 'Viernes (Menú)',
            sabado: 'Sábado (Pizza Libre)',
            domingo: 'Domingo (Menú)'
        };

        const subtitle = customSubtitle || `Día activo: ${names[mode] || mode}`;

        toast.innerHTML = `
            <div>
                <h4 class="font-bold text-xs text-slate-300 uppercase tracking-wider">Modo de Operación</h4>
                <p class="text-xs text-white font-semibold">${escapeHtml(subtitle)}</p>
            </div>
        `;

        toast.style.display = 'flex';
        setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 4000);
    }

    // ── IMPRESIÓN ─────────────────────────────────────────────────────────────
    function getMenuPrice() {
        const m = appState.currentMode;
        if (m === 'martes')    return appState.prices.precioMenuMartes;
        if (m === 'miercoles') return appState.prices.precioMenuMiercoles;
        if (m === 'viernes')   return appState.prices.precioMenuViernes;
        if (m === 'domingo')   return appState.prices.precioMenuDomingo;
        return 0;
    }

    function generateSingleAccountPreview() {
        if (!activeEntity) return;
        printSinglePreview.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'text-center mb-4 pb-4 border-b-2';

        const titleEl = document.createElement('h1');
        titleEl.className   = 'text-2xl font-bold';
        titleEl.textContent = appState.genericData.establishmentName;
        header.appendChild(titleEl);

        if (appState.genericData.address) {
            const p = document.createElement('p');
            p.className = 'text-sm text-gray-700'; p.textContent = appState.genericData.address;
            header.appendChild(p);
        }
        if (appState.genericData.phone) {
            const p = document.createElement('p');
            p.className = 'text-sm text-gray-700'; p.textContent = `Teléfono: ${appState.genericData.phone}`;
            header.appendChild(p);
        }
        if (appState.genericData.email) {
            const p = document.createElement('p');
            p.className = 'text-sm text-gray-700'; p.textContent = `Email: ${appState.genericData.email}`;
            header.appendChild(p);
        }
        if (appState.genericData.alias) {
            const aliasEl = document.createElement('div');
            aliasEl.className = 'mt-3 text-left';
            aliasEl.innerHTML = `<span class="text-xs block mb-1 font-bold">ALIAS:</span><span class="font-bold text-lg text-black tracking-wider break-all">${appState.genericData.alias}</span>`;
            header.appendChild(aliasEl);
        }
        printSinglePreview.appendChild(header);

        const clientTitle = document.createElement('h2');
        clientTitle.className   = 'text-xl font-bold text-center mt-4 mb-4';
        clientTitle.textContent = activeEntity.id.startsWith('table-')
            ? `MESA ${activeEntity.number}`
            : `PEDIDO: ${activeEntity.clientName}`;
        printSinglePreview.appendChild(clientTitle);

        const detailDiv = document.createElement('div');
        detailDiv.className = 'space-y-2 mb-4';

        const order = activeEntity.order;

        function addItem(label, amount) {
            const p = document.createElement('p');
            p.className = 'flex justify-between';
            p.innerHTML = `<span>${label}</span><span>$ ${formatPrice(amount)}</span>`;
            detailDiv.appendChild(p);
        }

        if (order.pizzaLibreH > 0) addItem(`${order.pizzaLibreH} x Pizza Libre Hombres`, order.pizzaLibreH * appState.prices.pizzaLibreH);
        if (order.pizzaLibreM > 0) addItem(`${order.pizzaLibreM} x Pizza Libre Mujeres`, order.pizzaLibreM * appState.prices.pizzaLibreM);
        if (order.pizzaLibreG > 0) addItem(`${order.pizzaLibreG} x Pizza Libre General`, order.pizzaLibreG * appState.prices.pizzaLibreG);
        if (order.menores     > 0) addItem(`${order.menores} x Menor`, order.menores * (order.menorPrice || 0));
        if (order.menu        > 0) addItem(`${order.menu} x Menú`,     order.menu    * getMenuPrice());
        if (order.empanadas   > 0) addItem(`${order.empanadas} x Empanada`, order.empanadas * appState.prices.empanada);
        if (order.postres     > 0) addItem(`${order.postres} x Postre`, order.postres * appState.prices.precioPostre);

        if (order.pizzasPersonalizadas && order.pizzasPersonalizadas.length > 0) {
            order.pizzasPersonalizadas.forEach(pizza => {
                const p    = document.createElement('p');
                p.className = 'flex justify-between';
                p.innerHTML = `<span>1 x Pizza ${pizza.size} (${pizza.toppings.join(', ')})</span><span>$ ${formatPrice(calculatePizzaPrice(pizza, appState.prices))}</span>`;
                detailDiv.appendChild(p);
            });
        }

        if (order.beverages && order.beverages.length > 0) {
            order.beverages.forEach(bev => {
                const info = appState.prices.beverages.find(b => b.name === bev.name) || { price: 0 };
                addItem(`${bev.quantity} x ${bev.name}`, bev.quantity * info.price);
            });
        }

        printSinglePreview.appendChild(detailDiv);

        const totalDiv = document.createElement('div');
        totalDiv.className = 'mt-4 pt-4 border-t-2 border-black text-center';
        const totalAmt  = calculateTotal(order, appState.prices, appState.currentMode);
        const lblEl     = document.createElement('p');
        lblEl.className = 'text-lg font-bold'; lblEl.textContent = 'TOTAL';
        const valEl     = document.createElement('p');
        valEl.className = 'text-3xl font-bold text-green-600'; valEl.textContent = `$ ${formatPrice(totalAmt)}`;
        totalDiv.appendChild(lblEl); totalDiv.appendChild(valEl);
        printSinglePreview.appendChild(totalDiv);

        if (appState.genericData.footer) {
            const footerDiv = document.createElement('div');
            footerDiv.className   = 'text-center mt-6 pt-4 border-t text-sm text-gray-600';
            footerDiv.textContent = appState.genericData.footer;
            printSinglePreview.appendChild(footerDiv);
        }

        const style = document.createElement('style');
        style.textContent = `
            #print-single-preview { width:58mm; max-width:58mm; margin:0 auto; font-size:9px; font-family: 'Inter', Arial, sans-serif; }
            #print-single-preview img { max-height:110px; max-width:100%; display:block; margin:0 auto 8px; }
            @page { size:58mm auto; margin:0; }
            @media print { html,body { background:white; margin:0; padding:0; } #print-single-preview { width:48mm; max-width:48mm; margin:0 auto; } }
        `;
        printSinglePreview.appendChild(style);
    }

    const DAY_NAMES = {
        martes: 'Martes (Menú)',
        miercoles: 'Miércoles (Menú)',
        jueves: 'Jueves (Pizza Libre)',
        viernes: 'Viernes (Menú)',
        sabado: 'Sábado (Pizza Libre)',
        domingo: 'Domingo (Menú)'
    };

    function isOrderNotEmpty(ord) {
        if (!ord) return false;
        if ((ord.pizzaLibreH || 0) > 0) return true;
        if ((ord.pizzaLibreM || 0) > 0) return true;
        if ((ord.pizzaLibreG || 0) > 0) return true;
        if ((ord.menu || 0) > 0) return true;
        if ((ord.menores || 0) > 0) return true;
        if ((ord.empanadas || 0) > 0) return true;
        if ((ord.postres || 0) > 0) return true;
        if (ord.beverages && ord.beverages.some(b => (b.quantity || 0) > 0)) return true;
        if (ord.pizzasPersonalizadas && ord.pizzasPersonalizadas.length > 0) return true;
        return false;
    }

    function hasActiveOrders() {
        const hasTableOrders = appState.tables.some(table => isOrderNotEmpty(table.order));
        const hasBarOrders   = appState.barOrders && appState.barOrders.some(bar => isOrderNotEmpty(bar.order));
        return hasTableOrders || hasBarOrders;
    }

    modeSwitcher.addEventListener('change', e => {
        const newMode = e.target.value;
        if (newMode === appState.currentMode) return;

        // Solo solicitar confirmación de limpieza si hay pedidos cargados en las mesas o barra
        if (hasActiveOrders()) {
            pendingNewMode = newMode;
            modeBeforeChange = appState.currentMode;

            if (changeDayTargetName) {
                changeDayTargetName.textContent = DAY_NAMES[newMode] || capitalizeFirstLetter(newMode);
            }
            if (changeDayModal) {
                changeDayModal.style.display = 'flex';
            }
        } else {
            // Si no hay pedidos cargados, cambiar el día directamente
            appState.currentMode = newMode;
            updateUIMode(appState.currentMode);
            saveState();
            renderAll();
            showModeToast(appState.currentMode);
        }
    });

    if (changeDayClearBtn) {
        changeDayClearBtn.addEventListener('click', () => {
            if (!pendingNewMode) return;
            appState.currentMode = pendingNewMode;
            // Limpiar los pedidos del día anterior y resetear estado de pago en mesas y barra
            appState.tables.forEach(t => {
                t.order = getNewOrderObject();
                t.isPaid = false;
                t.paidAmount = 0;
                t.tipAmount = 0;
                t.waiterName = 'Sin asignar';
                t.note = '';
            });
            appState.barOrders = [];
            appState.archivedSales = [];

            updateUIMode(appState.currentMode);
            saveState();
            renderAll();
            closeChangeDayModal();
            showModeToast(appState.currentMode, '¡Pedidos del día anterior limpiados para la nueva jornada!');
        });
    }

    if (changeDayKeepBtn) {
        changeDayKeepBtn.addEventListener('click', () => {
            if (!pendingNewMode) return;
            appState.currentMode = pendingNewMode;
            updateUIMode(appState.currentMode);
            saveState();
            renderAll();
            closeChangeDayModal();
            showModeToast(appState.currentMode, 'Pedidos conservados.');
        });
    }

    if (changeDayCancelBtn) {
        changeDayCancelBtn.addEventListener('click', () => {
            if (modeBeforeChange) {
                appState.currentMode = modeBeforeChange;
                modeSwitcher.value   = modeBeforeChange;
            }
            closeChangeDayModal();
        });
    }

    function closeChangeDayModal() {
        if (changeDayModal) changeDayModal.style.display = 'none';
        if (modeSwitcher) modeSwitcher.value = appState.currentMode;
        pendingNewMode = null;
    }

    kitchenNumberInput.addEventListener('change', () => {
        appState.numeroCocina = kitchenNumberInput.value.trim();
        saveState();
    });

    pizzaSizeSelect.addEventListener('change', () => {
        const isMedia = pizzaSizeSelect.value === 'media';
        pizzaTopping3Container.style.display = isMedia ? 'none' : 'block';
        pizzaTopping2Select.disabled = false;
    });

    closeOrderModalBtn.addEventListener('click', closeOrderModal);
    closeAndSaveBtn.addEventListener('click', closeOrderModal);

    passwordCancelBtn.addEventListener('click', closePasswordModal);

    managePricesBtn.addEventListener('click', openPricesModal);
    closePricesModalBtn.addEventListener('click', closePricesModal);

    closeTotalModalBtn.addEventListener('click', () => { totalModal.style.display = 'none'; });

    closeGenericDataModalBtn.addEventListener('click', () => { genericDataModal.style.display = 'none'; });

    closePrintSingleAccountModalBtn.addEventListener('click', () => { printSingleAccountModal.style.display = 'none'; });
    closePrintSingleAccountFinalBtn.addEventListener('click', () => { printSingleAccountModal.style.display = 'none'; });

    addTableBtn.addEventListener('click', () => {
        appState.nextTableNumber = appState.tables.length > 0
            ? Math.max(...appState.tables.map(t => parseInt(t.number) || 0)) + 1
            : 1;
        const newTable = {
            id: `table-${Date.now()}`,
            number: appState.nextTableNumber.toString(),
            x: 50, y: 50, width: 100, height: 100,
            order: getNewOrderObject()
        };
        appState.tables.push(newTable);
        saveState();
        renderTables();
    });

    addBarOrderBtn.addEventListener('click', () => {
        const clientName = barClientNameInput.value.trim();
        if (!clientName) return;
        const newOrder = { id: `bar-${Date.now()}`, clientName, order: getNewOrderObject() };
        appState.barOrders.push(newOrder);
        barClientNameInput.value = '';
        saveState();
        renderBarOrders();
        openOrderModal(newOrder.id, 'bar');
    });

    orderModal.addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) return;

        if (deleteEntityBtn.dataset.confirming === 'true' && !target.closest('#delete-entity-btn')) {
            resetDeleteButtonState();
        }

        if (target.classList.contains('op-btn')) {
            const type   = target.dataset.type;
            const action = target.dataset.action;
            if (action === 'increase') {
                if (!activeEntity.order[type]) activeEntity.order[type] = 0;
                activeEntity.order[type]++;
            } else if (action === 'decrease' && activeEntity.order[type] > 0) {
                activeEntity.order[type]--;
            }
            updateOrderModalUI();
            saveState();
        }

        if (target.classList.contains('decrease-bev-btn')) {
            const idx = parseInt(target.dataset.index);
            const bev = activeEntity.order.beverages[idx];
            if (bev) {
                bev.quantity--;
                if (bev.quantity === 0) activeEntity.order.beverages.splice(idx, 1);
                updateOrderModalUI();
            }
        }

        if (target.classList.contains('increase-bev-btn')) {
            const idx = parseInt(target.dataset.index);
            const bev = activeEntity.order.beverages[idx];
            if (bev) { bev.quantity++; updateOrderModalUI(); }
        }

        if (target.classList.contains('remove-pizza-btn')) {
            const idx = parseInt(target.dataset.pizzaIndex);
            if (activeEntity.order.pizzasPersonalizadas[idx]) {
                activeEntity.order.pizzasPersonalizadas.splice(idx, 1);
                updateOrderModalUI();
            }
        }
    });

    addCustomPizzaBtn.addEventListener('click', () => {
        const size     = pizzaSizeSelect.value;
        const topping1 = pizzaTopping1Select.value;
        const topping2 = pizzaTopping2Select.value;
        const topping3 = pizzaTopping3Select.value;

        const toppings = size === 'media'
            ? [topping1, topping2].filter(t => t !== 'ninguno')
            : [topping1, topping2, topping3].filter(t => t !== 'ninguno');

        activeEntity.order.pizzasPersonalizadas.push({ id: Date.now(), size, toppings });
        updateOrderModalUI();
    });

    addBeverageBtn.addEventListener('click', () => {
        const name     = beverageSelect.value;
        const quantity = parseInt(beverageQuantityInput.value);
        if (!name || quantity <= 0) return;
        const existing = activeEntity.order.beverages.find(b => b.name === name);
        if (existing) { existing.quantity += quantity; }
        else          { activeEntity.order.beverages.push({ name, quantity }); }
        beverageQuantityInput.value = 1;
        updateOrderModalUI();
    });

    if (menorPriceInput) {
        menorPriceInput.addEventListener('change', () => {
            if (!activeEntity) return;
            const v = parseFloat(menorPriceInput.value);
            activeEntity.order.menorPrice = isNaN(v) ? 0 : v;
            saveState();
            updateOrderModalUI();
        });
    }

    deleteEntityBtn.addEventListener('click', () => {
        if (!activeEntity) return;
        if (activeEntity.id.startsWith('table-')) {
            openPasswordModal('deleteTable');
        } else {
            if (deleteEntityBtn.dataset.confirming === 'true') {
                appState.barOrders = appState.barOrders.filter(o => o.id !== activeEntity.id);
                closeOrderModal();
            } else {
                deleteEntityBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
                deleteEntityBtn.classList.add('bg-red-800', 'hover:bg-red-900');
                deleteEntityBtn.textContent = '¿Confirmar?';
                deleteEntityBtn.dataset.confirming = 'true';
            }
        }
    });

    function openPaymentModal() {
        if (!activeEntity) return;
        const currentTotal = calculateTotal(activeEntity.order, appState.prices, appState.currentMode);
        
        if (paymentModalTableTotal) paymentModalTableTotal.textContent = `$${formatPrice(currentTotal)}`;
        
        const existingPaid = activeEntity.paidAmount;
        if (paymentAmountInput) {
            paymentAmountInput.value = (existingPaid !== undefined && existingPaid !== null && existingPaid > 0)
                ? existingPaid
                : (currentTotal > 0 ? currentTotal : '');
        }
        
        const initialPaid = parseFloat(paymentAmountInput ? paymentAmountInput.value : 0) || 0;
        const initialTip  = Math.max(0, initialPaid - currentTotal);
        if (paymentModalCalculatedTip) paymentModalCalculatedTip.textContent = `$${formatPrice(initialTip)}`;

        if (paymentUnpayBtn) {
            if (activeEntity.isPaid) {
                paymentUnpayBtn.classList.remove('hidden');
            } else {
                paymentUnpayBtn.classList.add('hidden');
            }
        }

        if (paymentModal) paymentModal.style.display = 'flex';
    }

    function closePaymentModal() {
        if (paymentModal) paymentModal.style.display = 'none';
    }

    if (cleanOrderBtn) {
        cleanOrderBtn.addEventListener('click', () => {
            if (!activeEntity) return;
            openPaymentModal();
        });
    }

    if (freePaidTableBtn) {
        freePaidTableBtn.addEventListener('click', () => {
            if (!activeEntity || !activeEntity.isPaid) return;
            appState.archivedSales = appState.archivedSales || [];
            appState.archivedSales.push({
                id: `arch-${Date.now()}`,
                number: `${activeEntity.number} (Cobrada)`,
                isPaid: true,
                paidAmount: activeEntity.paidAmount || 0,
                tipAmount: activeEntity.tipAmount || 0,
                order: JSON.parse(JSON.stringify(activeEntity.order)),
                paidAt: new Date().toISOString()
            });

            activeEntity.order = getNewOrderObject();
            activeEntity.isPaid = false;
            activeEntity.paidAmount = 0;
            activeEntity.tipAmount = 0;
            activeEntity.waiterName = 'Sin asignar';
            activeEntity.note = '';
            orderBeforeChanges = getNewOrderObject();

            saveState();
            updateOrderModalUI();
            renderAll();
            orderModal.style.display = 'none';
            activeEntity = null;
        });
    }

    if (paymentAmountInput) {
        paymentAmountInput.addEventListener('input', () => {
            if (!activeEntity) return;
            const currentTotal = calculateTotal(activeEntity.order, appState.prices, appState.currentMode);
            const paid = parseFloat(paymentAmountInput.value) || 0;
            const tip  = Math.max(0, paid - currentTotal);
            if (paymentModalCalculatedTip) paymentModalCalculatedTip.textContent = `$${formatPrice(tip)}`;
        });
    }

    if (paymentConfirmBtn) {
        paymentConfirmBtn.addEventListener('click', () => {
            if (!activeEntity) return;
            const currentTotal = calculateTotal(activeEntity.order, appState.prices, appState.currentMode);
            let paid = parseFloat(paymentAmountInput.value);
            if (isNaN(paid)) paid = currentTotal;

            activeEntity.isPaid = true;
            activeEntity.paidAmount = paid;
            activeEntity.tipAmount = Math.max(0, paid - currentTotal);

            saveState();
            updateOrderModalUI();
            renderAll();
            closePaymentModal();
        });
    }

    if (paymentUnpayBtn) {
        paymentUnpayBtn.addEventListener('click', () => {
            if (!activeEntity) return;
            activeEntity.isPaid = false;
            activeEntity.paidAmount = 0;
            activeEntity.tipAmount = 0;

            saveState();
            updateOrderModalUI();
            renderAll();
            closePaymentModal();
        });
    }

    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', closePaymentModal);
    }

    clearAllOrdersBtn.addEventListener('click', () => {
        openPasswordModal('clearAllOrders');
    });

    passwordConfirmBtn.addEventListener('click', () => {
        const clave = 'bochas';
        if (passwordInput.value.toLowerCase() !== clave) {
            passwordError.classList.remove('hidden');
            passwordInput.value = '';
            return;
        }
        if (actionToConfirm === 'deleteTable') {
            appState.tables = appState.tables.filter(t => t.id !== activeEntity.id);
            closePasswordModal(); closeOrderModal();
        } else if (actionToConfirm === 'clearSingleOrder') {
            activeEntity.order = getNewOrderObject();
            activeEntity.isPaid = false;
            activeEntity.paidAmount = 0;
            activeEntity.tipAmount = 0;
            updateOrderModalUI();
            closePasswordModal();
        } else if (actionToConfirm === 'clearAllOrders') {
            appState.tables.forEach(t => {
                t.order = getNewOrderObject();
                t.isPaid = false;
                t.paidAmount = 0;
                t.tipAmount = 0;
                t.waiterName = 'Sin asignar';
                t.note = '';
            });
            appState.barOrders = [];
            appState.archivedSales = [];
            saveState(); renderAll(); closePasswordModal();
        }
    });

    addNewBeveragePriceBtn.addEventListener('click', () => {
        const name     = newBeverageNameInput.value.trim();
        const price    = parseFloat(newBeveragePriceInput.value);
        const category = newBeverageCategoryInput.value || 'otro';
        if (name && !isNaN(price)) {
            const newBev = { name, price, category };

            // Encontrar el último índice de la misma categoría para insertarlo junto a sus pares
            let insertIdx = -1;
            for (let i = appState.prices.beverages.length - 1; i >= 0; i--) {
                const b = appState.prices.beverages[i];
                if (resolveBeverageCategory(b.name, b.category) === category) {
                    insertIdx = i + 1;
                    break;
                }
            }

            if (insertIdx !== -1) {
                appState.prices.beverages.splice(insertIdx, 0, newBev);
            } else {
                appState.prices.beverages.push(newBev);
            }

            newBeverageNameInput.value  = '';
            newBeveragePriceInput.value = '';
            renderBeveragePrices();
        }
    });

    beveragesPricesList.addEventListener('click', e => {
        const btn = e.target.closest('.delete-bev-price-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && appState.prices.beverages[idx]) {
                appState.prices.beverages.splice(idx, 1);
                renderBeveragePrices();
            }
        }
    });

    addNewPizzaBtn.addEventListener('click', () => {
        const name = newPizzaNameInput.value.trim();
        if (name) {
            appState.prices.preciosPizzas.push({ name: name, precioEntera: 0, precioMedia: 0 });
            newPizzaNameInput.value = '';
            renderCustomPizzaPrices();
        }
    });

    customPizzaPricesList.addEventListener('click', e => {
        const btn = e.target.closest('.delete-pizza-price-btn');
        if (btn) {
            const idx = parseInt(btn.dataset.index);
            if (!isNaN(idx) && appState.prices.preciosPizzas[idx]) {
                appState.prices.preciosPizzas.splice(idx, 1);
                renderCustomPizzaPrices();
            }
        }
    });

    savePricesBtn.addEventListener('click', () => {
        appState.prices.pizzaLibreH          = parseFloat(pricePizzaLibreHInput.value)   || 0;
        appState.prices.pizzaLibreM          = parseFloat(pricePizzaLibreMInput.value)   || 0;
        appState.prices.pizzaLibreG          = parseFloat(pricePizzaLibreGInput.value)   || 0;
        appState.prices.empanada             = parseFloat(priceEmpanadaInput.value)      || 0;
        appState.prices.precioPostre         = parseFloat(pricePostreInput.value)        || 0;
        appState.prices.precioMenuMartes     = parseFloat(priceMenuMartesInput.value)    || 0;
        appState.prices.precioMenuMiercoles  = parseFloat(priceMenuMiercolesInput.value) || 0;
        appState.prices.precioMenuViernes    = parseFloat(priceMenuViernesInput.value)   || 0;
        appState.prices.precioMenuDomingo    = parseFloat(priceMenuDomingoInput.value)   || 0;

        document.querySelectorAll('#beverages-prices-list .bev-price-input').forEach(input => {
            const idx      = parseInt(input.dataset.index);
            const newPrice = parseFloat(input.value);
            if (!isNaN(newPrice) && appState.prices.beverages[idx]) appState.prices.beverages[idx].price = newPrice;
        });

        document.querySelectorAll('#custom-pizza-prices-list .pizza-price-input').forEach(input => {
            const idx      = parseInt(input.dataset.pizzaIndex);
            const type     = input.dataset.priceType;
            const newPrice = parseFloat(input.value);
            if (!isNaN(newPrice) && appState.prices.preciosPizzas[idx]) {
                if (type === 'entera') appState.prices.preciosPizzas[idx].precioEntera = newPrice;
                if (type === 'media')  appState.prices.preciosPizzas[idx].precioMedia  = newPrice;
            }
        });

        saveState();
        closePricesModal();
    });

    showTotalBtn.addEventListener('click', () => {
        const allTables = getAllTablesWithArchived();
        const grand = calculateGrandTotal(allTables, appState.barOrders, appState.prices, appState.currentMode);
        totalModalAmount.textContent = `$${formatPrice(grand)}`;

        const grandTip = calculateGrandTotalTip(allTables, appState.barOrders);
        if (totalModalPropinaCount) totalModalPropinaCount.textContent = `$${formatPrice(grandTip)}`;

        const isExcluded = appState.currentMode === 'jueves' || appState.currentMode === 'sabado';
        if (totalModalPersonasBox) {
            if (isExcluded) {
                totalModalPersonasBox.style.display = 'none';
            } else {
                totalModalPersonasBox.style.display = 'block';
                const totalPersons = calculateGrandTotalPersons(allTables, appState.currentMode);
                if (totalModalPersonasCount) totalModalPersonasCount.textContent = totalPersons;

                if (totalModalPersonasDetail) {
                    let menus = 0, menores = 0;
                    allTables.forEach(t => {
                        if (t && t.order) {
                            menus += (t.order.menu || 0);
                            menores += (t.order.menores || 0);
                        }
                    });
                    totalModalPersonasDetail.textContent = menores > 0 ? `${menus} menús + ${menores} menores` : '';
                }
            }
        }

        totalModal.style.display = 'flex';
    });

    genericDataBtn.addEventListener('click', () => {
        genericEstablishmentNameInput.value = appState.genericData.establishmentName;
        genericAddressInput.value           = appState.genericData.address;
        genericPhoneInput.value             = appState.genericData.phone;
        genericEmailInput.value             = appState.genericData.email;
        genericFooterInput.value            = appState.genericData.footer;
        genericAliasInput.value             = appState.genericData.alias || '';
        genericDataModal.style.display = 'flex';
    });

    saveGenericDataBtn.addEventListener('click', () => {
        appState.genericData.establishmentName = genericEstablishmentNameInput.value;
        appState.genericData.address           = genericAddressInput.value;
        appState.genericData.phone             = genericPhoneInput.value;
        appState.genericData.email             = genericEmailInput.value;
        appState.genericData.footer            = genericFooterInput.value;
        appState.genericData.alias             = genericAliasInput.value;
        saveState();
        genericDataModal.style.display = 'none';
    });

    exportPdfBtn.addEventListener('click', () => {
        currentSalesReport = generateSalesReport(
            getAllTablesWithArchived(),
            appState.barOrders,
            appState.prices,
            appState.currentMode,
            appState.genericData
        );
        salesReportContent.innerHTML = SalesReportManager.renderModalDashboard(currentSalesReport);
        salesReportModal.style.display = 'flex';
    });

    downloadPdfBtn.addEventListener('click', async () => {
        currentSalesReport = generateSalesReport(
            getAllTablesWithArchived(),
            appState.barOrders,
            appState.prices,
            appState.currentMode,
            appState.genericData
        );
        await SalesReportManager.downloadSalesReportPDF(currentSalesReport);
    });

    closeSalesReportModalBtn.addEventListener('click', () => {
        salesReportModal.style.display = 'none';
    });

    closeSalesReportFinalBtn.addEventListener('click', () => {
        salesReportModal.style.display = 'none';
    });

    printSingleAccountBtn.addEventListener('click', () => {
        if (!activeEntity) return;
        generateSingleAccountPreview();
        printSingleAccountModal.style.display = 'flex';
    });

    printSingleAccountFinalBtn.addEventListener('click', () => {
        if (!activeEntity) return;
        const order = activeEntity.order;
        let bodyHtml = '';

        bodyHtml += `<div style="text-align:center;"><div style="font-weight:700;font-size:15px;">${escapeHtml(appState.genericData.establishmentName||'')}</div></div>`;
        bodyHtml += `<div>`;
        if (appState.genericData.address) bodyHtml += `<div style="font-size:11px;">${escapeHtml(appState.genericData.address)}</div>`;
        if (appState.genericData.phone)   bodyHtml += `<div style="font-size:11px;">Tel: ${escapeHtml(appState.genericData.phone)}</div>`;
        if (appState.genericData.email)   bodyHtml += `<div style="font-size:11px;">${escapeHtml(appState.genericData.email)}</div>`;
        
        if (appState.genericData.alias) {
             bodyHtml += `<div style="margin: 4px 0; font-size: 12px;">`;
             bodyHtml += `<strong>ALIAS:</strong> ${escapeHtml(appState.genericData.alias)}`;
             bodyHtml += `</div>`;
        }
        
        bodyHtml += '<hr style="border:none;border-top:1.5px dashed #000;margin:8px 0;"/></div>';

        bodyHtml += activeEntity.id.startsWith('table-')
            ? `<div style="text-align:center;font-weight:700;margin:6px 0;font-size:10px;">MESA ${escapeHtml(activeEntity.number)}</div>`
            : `<div style="text-align:center;font-weight:700;margin:6px 0;font-size:10px;">PEDIDO: ${escapeHtml(activeEntity.clientName)}</div>`;

        bodyHtml += '<div style="margin-top:6px;">';
        function line(label, amount) {
            return `<div class="line"><span class="label">${escapeHtml(label)}</span><span class="amount">$ ${formatPrice(Number(amount))}</span></div>`;
        }

        if (order.pizzaLibreH > 0) bodyHtml += line(`${order.pizzaLibreH} x Pizza Libre Hombres`, order.pizzaLibreH * appState.prices.pizzaLibreH);
        if (order.pizzaLibreM > 0) bodyHtml += line(`${order.pizzaLibreM} x Pizza Libre Mujeres`, order.pizzaLibreM * appState.prices.pizzaLibreM);
        if (order.pizzaLibreG > 0) bodyHtml += line(`${order.pizzaLibreG} x Pizza Libre General`, order.pizzaLibreG * appState.prices.pizzaLibreG);
        if (order.menores     > 0) bodyHtml += line(`${order.menores} x Menor`,    order.menores    * (order.menorPrice||0));
        if (order.menu        > 0) bodyHtml += line(`${order.menu} x Menú`,        order.menu       * getMenuPrice());
        if (order.empanadas   > 0) bodyHtml += line(`${order.empanadas} x Empanada`, order.empanadas * appState.prices.empanada);
        if (order.postres     > 0) bodyHtml += line(`${order.postres} x Postre`,   order.postres    * appState.prices.precioPostre);

        if (order.pizzasPersonalizadas && order.pizzasPersonalizadas.length > 0) {
            order.pizzasPersonalizadas.forEach(pizza => {
                bodyHtml += line(`1 x Pizza ${pizza.size} (${pizza.toppings.join(', ')})`, calculatePizzaPrice(pizza, appState.prices));
            });
        }
        if (order.beverages && order.beverages.length > 0) {
            order.beverages.forEach(bev => {
                const info = appState.prices.beverages.find(b => b.name === bev.name) || { price: 0 };
                bodyHtml += line(`${bev.quantity} x ${bev.name}`, bev.quantity * info.price);
            });
        }

        bodyHtml += '</div>';
        const totalAmt = calculateTotal(order, appState.prices, appState.currentMode);
        bodyHtml += '<hr class="small"/>';
        bodyHtml += `<div class="line" style="margin-top:6px;"><span class="label" style="font-weight:800;font-size:10px;">TOTAL</span><span class="amount" style="font-size:11px;font-weight:800;">$ ${formatPrice(totalAmt)}</span></div>`;
        if (appState.genericData.footer) {
            bodyHtml += `<div style="text-align:center;font-size:8px;margin-top:8px;word-break:break-word;">${escapeHtml(appState.genericData.footer)}</div>`;
        }

        const ticketHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
            @page{margin:0;}
            html,body{margin:0;padding:0;background:#fff;width:100%;}
            body{font-family:'Inter',Arial,sans-serif;color:#111;}
            .ticket{width:100%;box-sizing:border-box;padding-left:0;padding-right:8mm;margin:0;}
            .line{display:flex;justify-content:space-between;align-items:flex-start;font-size:10px;line-height:1.1;margin:2px 0;}
            .label{flex:1;text-align:left;word-break:break-word;margin-right:4px;}
            .amount{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;flex-shrink:0;}
            hr.small{border:none;border-top:1px dashed #222;margin:4px 0;}
        </style></head><body><div class="ticket">${bodyHtml}</div></body></html>`;

        const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0');
        if (!w) { alert('Permite ventanas emergentes para imprimir.'); return; }
        w.document.open(); w.document.write(ticketHtml); w.document.close();
        w.focus();
        setTimeout(() => { w.print(); w.close(); }, 900);
    });

    // ── INICIALIZACIÓN Y SINCRONIZACIÓN EN TIEMPO REAL ────────────────────────
    await loadState();
    modeSwitcher.value        = appState.currentMode;
    kitchenNumberInput.value  = appState.numeroCocina;
    updateUIMode(appState.currentMode);
    pizzaSizeSelect.dispatchEvent(new Event('change'));
    renderAll();

    if (window.electronAPI && window.electronAPI.onRemoteUpdate) {
        window.electronAPI.onRemoteUpdate(remote => {
            if (!remote) return;
            // Si hay un modal de mesa abierto, no pisar la mesa activa mientras se edita
            const editingTableNum = (activeEntity && activeEntity.id && activeEntity.id.startsWith('table-'))
                ? String(activeEntity.number)
                : null;

            if (Array.isArray(remote.tables)) {
                const localMap = new Map(appState.tables.map(t => [String(t.number), t]));
                appState.tables = remote.tables.map(dbt => {
                    const numStr = String(dbt.number);
                    if (editingTableNum && numStr === editingTableNum) {
                        return activeEntity;
                    }
                    const loc = localMap.get(numStr);
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
            if (remote.prices && (!pricesModal || pricesModal.style.display !== 'flex')) {
                applyPricesObject(remote.prices);
            }
            if (remote.currentMode && remote.currentMode !== appState.currentMode) {
                appState.currentMode = remote.currentMode;
                if (modeSwitcher) modeSwitcher.value = appState.currentMode;
                updateUIMode(appState.currentMode);
            }
            if (remote.genericData && Object.keys(remote.genericData).length > 0) {
                appState.genericData = Object.assign({}, DEFAULT_GENERIC_DATA, remote.genericData);
            }
            if (Array.isArray(remote.barOrders) && (!activeEntity || !activeEntity.id.startsWith('bar-'))) {
                appState.barOrders = remote.barOrders;
            }
            if (Array.isArray(remote.archivedSales)) {
                appState.archivedSales = remote.archivedSales;
            }
            localStorage.setItem('restaurantState', JSON.stringify({
                tables: appState.tables,
                barOrders: appState.barOrders,
                archivedSales: appState.archivedSales || [],
                prices: appState.prices,
                nextTableNumber: appState.nextTableNumber,
                currentMode: appState.currentMode,
                numeroCocina: appState.numeroCocina,
                genericData: appState.genericData
            }));
            renderAll();
        });
    }
});
