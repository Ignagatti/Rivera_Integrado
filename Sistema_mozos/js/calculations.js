function getPizzaPrice(toppingName, size, prices) {
    const pizzaData = prices.preciosPizzas.find(p => p.name === toppingName);
    if (!pizzaData) return 0;
    return size === 'entera' ? pizzaData.precioEntera : pizzaData.precioMedia;
}

function calculatePizzaPrice(pizza, prices) {
    const toppings = pizza.toppings;

    if (pizza.size === 'media') {
        if (toppings.length === 1) return getPizzaPrice(toppings[0], 'media', prices);
        if (toppings.length === 2) return (getPizzaPrice(toppings[0], 'media', prices) / 2) + (getPizzaPrice(toppings[1], 'media', prices) / 2);
        return 0;
    }

    // entera
    if (toppings.length === 1) return getPizzaPrice(toppings[0], 'entera', prices);
    if (toppings.length === 2) return getPizzaPrice(toppings[0], 'media', prices) + getPizzaPrice(toppings[1], 'media', prices);
    if (toppings.length === 3) return (getPizzaPrice(toppings[0], 'media', prices) / 2) + (getPizzaPrice(toppings[1], 'media', prices) / 2) + (getPizzaPrice(toppings[2], 'media', prices) / 2);
    return 0;
}

function calculateTotal(order, prices, currentMode) {
    if (!order || !prices) return 0;
    let total = 0;

    const pLibreH = Number(prices.pizzaLibreH) || 0;
    const pLibreM = Number(prices.pizzaLibreM) || 0;
    const pLibreG = Number(prices.pizzaLibreG) || 0;

    if (currentMode === 'jueves' || currentMode === 'sabado') {
        total += (Number(order.pizzaLibreH) || 0) * pLibreH;
        total += (Number(order.pizzaLibreM) || 0) * pLibreM;
        total += (Number(order.pizzaLibreG) || 0) * pLibreG;
    }

    if (currentMode === 'martes')         total += (Number(order.menu) || 0) * (Number(prices.precioMenuMartes) || 0);
    else if (currentMode === 'miercoles') total += (Number(order.menu) || 0) * (Number(prices.precioMenuMiercoles) || 0);
    else if (currentMode === 'viernes')   total += (Number(order.menu) || 0) * (Number(prices.precioMenuViernes) || 0);
    else if (currentMode === 'domingo')   total += (Number(order.menu) || 0) * (Number(prices.precioMenuDomingo) || 0);

    total += (Number(order.empanadas) || 0) * (Number(prices.empanada) || 0);
    total += (Number(order.menores)   || 0) * (Number(order.menorPrice) || 0);
    total += (Number(order.postres)   || 0) * (Number(prices.precioPostre) || 0);

    if (Array.isArray(order.pizzasPersonalizadas)) {
        order.pizzasPersonalizadas.forEach(pizza => {
            total += calculatePizzaPrice(pizza, prices);
        });
    }

    if (Array.isArray(order.beverages) && Array.isArray(prices.beverages)) {
        order.beverages.forEach(bev => {
            if (!bev || !bev.name) return;
            const priceInfo = prices.beverages.find(p => p && p.name === bev.name);
            if (priceInfo) total += (Number(bev.quantity) || 0) * (Number(priceInfo.price) || 0);
        });
    }

    return Math.round(total * 100) / 100;
}

function calculateGrandTotal(tables = [], barOrders = [], prices = {}, currentMode = 'miercoles') {
    let grand = 0;
    (tables || []).forEach(t  => { if (t) grand += calculateTotal(t.order, prices, currentMode); });
    (barOrders || []).forEach(o => { if (o) grand += calculateTotal(o.order, prices, currentMode); });
    return Math.round(grand * 100) / 100;
}

function calculateTablePersons(order, currentMode) {
    if (!order) return 0;
    if (currentMode === 'jueves' || currentMode === 'sabado') {
        return 0;
    }
    // martes, miercoles, viernes, domingo y otros dias
    return (order.menu || 0) + (order.menores || 0);
}

function calculateGrandTotalPersons(tables, currentMode) {
    if (!tables || currentMode === 'jueves' || currentMode === 'sabado') {
        return 0;
    }
    let totalPersons = 0;
    tables.forEach(t => {
        if (t && t.order) {
            totalPersons += calculateTablePersons(t.order, currentMode);
        }
    });
    return totalPersons;
}

function getModeMenuPrice(currentMode, prices) {
    if (currentMode === 'martes')    return prices.precioMenuMartes    || 0;
    if (currentMode === 'miercoles') return prices.precioMenuMiercoles || 0;
    if (currentMode === 'viernes')   return prices.precioMenuViernes   || 0;
    if (currentMode === 'domingo')   return prices.precioMenuDomingo   || 0;
    return 0;
}

function generateSalesReport(tables = [], barOrders = [], prices = {}, currentMode = 'miercoles', genericData = {}) {
    const isPizzaLibreMode = currentMode === 'jueves' || currentMode === 'sabado';
    const menuPrice = getModeMenuPrice(currentMode, prices);

    // 1. Unificar todas las entidades activas
    const allEntities = [];
    tables.forEach(t => {
        allEntities.push({
            id: t.id,
            title: `Mesa ${t.number || '?' }`,
            type: 'table',
            number: t.number,
            order: t.order || {},
            isPaid: t.isPaid || false,
            paidAmount: t.paidAmount || 0,
            tipAmount: t.tipAmount || 0
        });
    });
    barOrders.forEach(b => {
        allEntities.push({
            id: b.id,
            title: `Barra - ${b.clientName || 'Cliente'}`,
            type: 'bar',
            clientName: b.clientName,
            order: b.order || {},
            isPaid: b.isPaid || false,
            paidAmount: b.paidAmount || 0,
            tipAmount: b.tipAmount || 0
        });
    });

    let totalRecaudado = 0;
    let totalPropina = 0;
    let totalUnidades = 0;
    let totalPersonas = 0;
    let totalMesasConConsumo = 0;
    let totalBarraConConsumo = 0;

    // Totales por rubro principal
    let comidaUnits = 0,    comidaSubtotal = 0;
    let customPizzaUnits = 0, customPizzaSubtotal = 0;
    let empanadaUnits = 0,  empanadaSubtotal = 0;
    let postreUnits = 0,    postreSubtotal = 0;
    let bebidaUnits = 0,    bebidaSubtotal = 0;

    // Desglose de comida individual
    let pizzaLibreHUnits = 0, pizzaLibreHSubtotal = 0;
    let pizzaLibreMUnits = 0, pizzaLibreMSubtotal = 0;
    let pizzaLibreGUnits = 0, pizzaLibreGSubtotal = 0;
    let menuUnits = 0,        menuSubtotal = 0;
    let menoresUnits = 0,     menoresSubtotal = 0;

    // Mapas de conteo
    const customPizzasMap = {}; // "Entera (Muzzarella, Jamon)" -> { name, size, toppings, units, subtotal }
    const customPizzaToppingsCount = {}; // "Muzzarella" -> count
    (prices.preciosPizzas || []).forEach(p => {
        customPizzaToppingsCount[p.name] = 0;
    });

    const beveragesMap = {}; // name -> { name, category, price, units, subtotal }
    (prices.beverages || []).forEach(bev => {
        beveragesMap[bev.name] = {
            name: bev.name,
            category: bev.category || 'otro',
            price: Number(bev.price) || 0,
            units: 0,
            subtotal: 0
        };
    });

    const entityReports = [];

    // Recorrer pedidos de cada entidad
    allEntities.forEach(ent => {
        const ord = ent.order;
        const entTotal = calculateTotal(ord, prices, currentMode);
        totalRecaudado += entTotal;
        if (ent.isPaid) {
            totalPropina += (ent.tipAmount || 0);
        }

        const entItems = [];
        let entUnits = 0;
        let entPersons = 0;

        // Comensales de la entidad
        if (isPizzaLibreMode) {
            entPersons = (ord.pizzaLibreH || 0) + (ord.pizzaLibreM || 0) + (ord.pizzaLibreG || 0) + (ord.menores || 0);
        } else {
            entPersons = (ord.menu || 0) + (ord.menores || 0);
        }
        totalPersonas += entPersons;

        if (entTotal > 0 || entUnits > 0 || entPersons > 0) {
            if (ent.type === 'table') totalMesasConConsumo++;
            else totalBarraConConsumo++;
        }

        // Pizza Libre
        if (isPizzaLibreMode) {
            if (ord.pizzaLibreH > 0) {
                const sub = ord.pizzaLibreH * (prices.pizzaLibreH || 0);
                pizzaLibreHUnits += ord.pizzaLibreH;
                pizzaLibreHSubtotal += sub;
                comidaUnits += ord.pizzaLibreH;
                comidaSubtotal += sub;
                entUnits += ord.pizzaLibreH;
                entItems.push({ name: 'Pizza Libre (Hombres)', quantity: ord.pizzaLibreH, price: prices.pizzaLibreH || 0, subtotal: sub });
            }
            if (ord.pizzaLibreM > 0) {
                const sub = ord.pizzaLibreM * (prices.pizzaLibreM || 0);
                pizzaLibreMUnits += ord.pizzaLibreM;
                pizzaLibreMSubtotal += sub;
                comidaUnits += ord.pizzaLibreM;
                comidaSubtotal += sub;
                entUnits += ord.pizzaLibreM;
                entItems.push({ name: 'Pizza Libre (Mujeres)', quantity: ord.pizzaLibreM, price: prices.pizzaLibreM || 0, subtotal: sub });
            }
            if (ord.pizzaLibreG > 0) {
                const sub = ord.pizzaLibreG * (prices.pizzaLibreG || 0);
                pizzaLibreGUnits += ord.pizzaLibreG;
                pizzaLibreGSubtotal += sub;
                comidaUnits += ord.pizzaLibreG;
                comidaSubtotal += sub;
                entUnits += ord.pizzaLibreG;
                entItems.push({ name: 'Pizza Libre (General)', quantity: ord.pizzaLibreG, price: prices.pizzaLibreG || 0, subtotal: sub });
            }
        } else {
            // Menú
            if (ord.menu > 0) {
                const sub = ord.menu * menuPrice;
                menuUnits += ord.menu;
                menuSubtotal += sub;
                comidaUnits += ord.menu;
                comidaSubtotal += sub;
                entUnits += ord.menu;
                entItems.push({ name: 'Menú del Día', quantity: ord.menu, price: menuPrice, subtotal: sub });
            }
        }

        // Menores
        if (ord.menores > 0) {
            const mPrice = Number(ord.menorPrice) || 0;
            const sub = ord.menores * mPrice;
            menoresUnits += ord.menores;
            menoresSubtotal += sub;
            comidaUnits += ord.menores;
            comidaSubtotal += sub;
            entUnits += ord.menores;
            entItems.push({ name: 'Menores', quantity: ord.menores, price: mPrice, subtotal: sub });
        }

        // Empanadas
        if (ord.empanadas > 0) {
            const sub = ord.empanadas * (prices.empanada || 0);
            empanadaUnits += ord.empanadas;
            empanadaSubtotal += sub;
            entUnits += ord.empanadas;
            entItems.push({ name: 'Empanadas', quantity: ord.empanadas, price: prices.empanada || 0, subtotal: sub });
        }

        // Postres
        if (ord.postres > 0) {
            const sub = ord.postres * (prices.precioPostre || 0);
            postreUnits += ord.postres;
            postreSubtotal += sub;
            entUnits += ord.postres;
            entItems.push({ name: 'Postres', quantity: ord.postres, price: prices.precioPostre || 0, subtotal: sub });
        }

        // Pizzas Personalizadas
        if (ord.pizzasPersonalizadas && ord.pizzasPersonalizadas.length > 0) {
            ord.pizzasPersonalizadas.forEach(pizza => {
                const pPrice = calculatePizzaPrice(pizza, prices);
                const validToppings = (pizza.toppings || []).filter(t => t && t !== 'ninguno');
                const desc = `Pizza ${pizza.size === 'media' ? 'Media' : 'Entera'} (${validToppings.join(', ') || 'Sin gusto'})`;
                
                if (!customPizzasMap[desc]) {
                    customPizzasMap[desc] = {
                        name: desc,
                        size: pizza.size,
                        toppings: validToppings,
                        price: pPrice,
                        units: 0,
                        subtotal: 0
                    };
                }
                customPizzasMap[desc].units += 1;
                customPizzasMap[desc].subtotal += pPrice;
                customPizzaUnits += 1;
                customPizzaSubtotal += pPrice;
                entUnits += 1;

                validToppings.forEach(top => {
                    customPizzaToppingsCount[top] = (customPizzaToppingsCount[top] || 0) + 1;
                });

                entItems.push({ name: desc, quantity: 1, price: pPrice, subtotal: pPrice });
            });
        }

        // Bebidas
        if (ord.beverages && ord.beverages.length > 0) {
            ord.beverages.forEach(bev => {
                const qty = Number(bev.quantity) || 0;
                if (qty <= 0) return;

                if (!beveragesMap[bev.name]) {
                    const foundBev = (prices.beverages || []).find(b => b.name === bev.name) || {};
                    beveragesMap[bev.name] = {
                        name: bev.name,
                        category: foundBev.category || 'otro',
                        price: Number(foundBev.price) || 0,
                        units: 0,
                        subtotal: 0
                    };
                }
                const bPrice = beveragesMap[bev.name].price;
                const sub = qty * bPrice;
                beveragesMap[bev.name].units += qty;
                beveragesMap[bev.name].subtotal += sub;
                bebidaUnits += qty;
                bebidaSubtotal += sub;
                entUnits += qty;

                entItems.push({ name: bev.name, quantity: qty, price: bPrice, subtotal: sub });
            });
        }

        totalUnidades += entUnits;

        entityReports.push({
            id: ent.id,
            title: ent.title,
            type: ent.type,
            persons: entPersons,
            units: entUnits,
            total: entTotal,
            items: entItems
        });
    });

    const activeEntitiesCount = totalMesasConConsumo + totalBarraConConsumo;
    const ticketPromedio = activeEntitiesCount > 0 ? (totalRecaudado / activeEntitiesCount) : 0;

    // Lista de todas las bebidas procesadas
    const allBeveragesList = Object.values(beveragesMap).map(b => ({
        ...b,
        percentOfBeveragesUnits: bebidaUnits > 0 ? ((b.units / bebidaUnits) * 100) : 0,
        percentOfBeveragesRevenue: bebidaSubtotal > 0 ? ((b.subtotal / bebidaSubtotal) * 100) : 0
    }));

    // Categorías de bebidas agrupadas
    const BEV_CAT_CONFIG = [
        { id: 'vino',       label: 'Vinos',             icon: '', color: '#475569' },
        { id: 'cerveza',    label: 'Cervezas',          icon: '', color: '#334155' },
        { id: 'gaseosa',    label: 'Gaseosas',          icon: '', color: '#1E293B' },
        { id: 'agua',       label: 'Aguas',             icon: '', color: '#2563EB' },
        { id: 'saborizada', label: 'Aguas Saborizadas', icon: '', color: '#0F766E' },
        { id: 'jarro',      label: 'Jarros / Tragos',   icon: '', color: '#4F46E5' },
        { id: 'otro',       label: 'Otras Bebidas',     icon: '', color: '#64748B' }
    ];

    const beverageCategoryBreakdown = BEV_CAT_CONFIG.map(cat => {
        const items = allBeveragesList.filter(b => b.category === cat.id);
        const units = items.reduce((acc, i) => acc + i.units, 0);
        const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
        return {
            id: cat.id,
            label: cat.label,
            icon: cat.icon,
            color: cat.color,
            itemsCount: items.length,
            units: units,
            subtotal: subtotal,
            percentOfBeverageUnits: bebidaUnits > 0 ? ((units / bebidaUnits) * 100) : 0,
            percentOfBeverageRevenue: bebidaSubtotal > 0 ? ((subtotal / bebidaSubtotal) * 100) : 0
        };
    }).filter(cat => cat.units > 0 || cat.itemsCount > 0);

    // Resumen por rubro general
    const categoryBreakdown = [
        { id: 'comida', label: isPizzaLibreMode ? 'Pizza Libre / Menús' : 'Menú Principal', icon: '', color: '#1E293B', units: comidaUnits, subtotal: comidaSubtotal },
        { id: 'pizzas', label: 'Pizzas por Gusto', icon: '', color: '#0F766E', units: customPizzaUnits, subtotal: customPizzaSubtotal },
        { id: 'empanadas', label: 'Empanadas', icon: '', color: '#334155', units: empanadaUnits, subtotal: empanadaSubtotal },
        { id: 'postres', label: 'Postres', icon: '', color: '#475569', units: postreUnits, subtotal: postreSubtotal },
        { id: 'bebidas', label: 'Bebidas', icon: '', color: '#2563EB', units: bebidaUnits, subtotal: bebidaSubtotal }
    ].map(cat => ({
        ...cat,
        percentOfTotalRevenue: totalRecaudado > 0 ? ((cat.subtotal / totalRecaudado) * 100) : 0,
        percentOfTotalUnits: totalUnidades > 0 ? ((cat.units / totalUnidades) * 100) : 0
    }));

    // Listado unificado de todos los productos vendidos con unidades > 0
    const soldItemsList = [];

    if (isPizzaLibreMode) {
        if (pizzaLibreHUnits > 0) soldItemsList.push({ name: 'Pizza Libre (Hombres)', category: 'Comida', units: pizzaLibreHUnits, unitPrice: prices.pizzaLibreH || 0, subtotal: pizzaLibreHSubtotal, icon: '' });
        if (pizzaLibreMUnits > 0) soldItemsList.push({ name: 'Pizza Libre (Mujeres)', category: 'Comida', units: pizzaLibreMUnits, unitPrice: prices.pizzaLibreM || 0, subtotal: pizzaLibreMSubtotal, icon: '' });
        if (pizzaLibreGUnits > 0) soldItemsList.push({ name: 'Pizza Libre (General)', category: 'Comida', units: pizzaLibreGUnits, unitPrice: prices.pizzaLibreG || 0, subtotal: pizzaLibreGSubtotal, icon: '' });
    } else {
        if (menuUnits > 0) soldItemsList.push({ name: 'Menú del Día', category: 'Comida', units: menuUnits, unitPrice: menuPrice, subtotal: menuSubtotal, icon: '' });
    }

    if (menoresUnits > 0) soldItemsList.push({ name: 'Menores', category: 'Comida', units: menoresUnits, unitPrice: menoresUnits > 0 ? (menoresSubtotal / menoresUnits) : 0, subtotal: menoresSubtotal, icon: '' });
    if (empanadaUnits > 0) soldItemsList.push({ name: 'Empanadas', category: 'Empanadas', units: empanadaUnits, unitPrice: prices.empanada || 0, subtotal: empanadaSubtotal, icon: '' });
    if (postreUnits > 0) soldItemsList.push({ name: 'Postres', category: 'Postres', units: postreUnits, unitPrice: prices.precioPostre || 0, subtotal: postreSubtotal, icon: '' });

    Object.values(customPizzasMap).forEach(p => {
        if (p.units > 0) {
            soldItemsList.push({ name: p.name, category: 'Pizzas por Gusto', units: p.units, unitPrice: p.price, subtotal: p.subtotal, icon: '' });
        }
    });

    allBeveragesList.forEach(b => {
        if (b.units > 0) {
            soldItemsList.push({ name: b.name, category: 'Bebidas', units: b.units, unitPrice: b.price, subtotal: b.subtotal, icon: '' });
        }
    });

    // Rankings
    // Más vendidos (orden descendente por unidades, luego subtotal)
    const topVendidos = [...soldItemsList].sort((a, b) => (b.units - a.units) || (b.subtotal - a.subtotal));

    // Menos vendidos (de los que tuvieron ventas > 0, orden ascendente por unidades)
    const menosVendidos = [...soldItemsList].sort((a, b) => (a.units - b.units) || (a.subtotal - b.subtotal));

    // Sin Ventas (0 Unidades Vendidas)
    const sinVentasList = [];

    // Bebidas sin ventas
    allBeveragesList.filter(b => b.units === 0).forEach(b => {
        sinVentasList.push({ name: b.name, category: 'Bebidas', price: b.price, icon: '', reason: 'Sin demanda' });
    });

    // Gustos de pizzas sin ventas (si sábado o hay gustos configurados)
    Object.keys(customPizzaToppingsCount).forEach(topName => {
        if (customPizzaToppingsCount[topName] === 0) {
            const pizzaInfo = (prices.preciosPizzas || []).find(p => p.name === topName) || {};
            sinVentasList.push({
                name: `Gusto Pizza: ${topName}`,
                category: 'Pizzas por Gusto',
                price: pizzaInfo.precioEntera || 0,
                icon: '',
                reason: 'Sin pedidos'
            });
        }
    });

    // Comidas principales sin ventas
    if (isPizzaLibreMode) {
        if (pizzaLibreHUnits === 0) sinVentasList.push({ name: 'Pizza Libre (Hombres)', category: 'Comida', price: prices.pizzaLibreH || 0, icon: '', reason: '0 unidades' });
        if (pizzaLibreMUnits === 0) sinVentasList.push({ name: 'Pizza Libre (Mujeres)', category: 'Comida', price: prices.pizzaLibreM || 0, icon: '', reason: '0 unidades' });
        if (pizzaLibreGUnits === 0) sinVentasList.push({ name: 'Pizza Libre (General)', category: 'Comida', price: prices.pizzaLibreG || 0, icon: '', reason: '0 unidades' });
    } else {
        if (menuUnits === 0) sinVentasList.push({ name: 'Menú del Día', category: 'Comida', price: menuPrice, icon: '', reason: '0 unidades' });
    }

    if (empanadaUnits === 0) sinVentasList.push({ name: 'Empanadas', category: 'Empanadas', price: prices.empanada || 0, icon: '🥟', reason: '0 unidades' });
    if (postreUnits === 0) sinVentasList.push({ name: 'Postres', category: 'Postres', price: prices.precioPostre || 0, icon: '🍰', reason: '0 unidades' });

    const topProductoEstrella = topVendidos.length > 0 ? topVendidos[0] : null;

    // 🧠 Análisis Estratégico de Inversión y Compras (En qué MÁS y en qué MENOS invertir)
    let acumuladoRecaudacion = 0;
    const itemsConAnalisis = topVendidos.map(item => {
        acumuladoRecaudacion += item.subtotal;
        const pctAcumulado = totalRecaudado > 0 ? (acumuladoRecaudacion / totalRecaudado) * 100 : 0;
        const pctVenta = totalRecaudado > 0 ? (item.subtotal / totalRecaudado) * 100 : 0;

        let clasificacion = 'media';
        let recomendacion = 'Reposición normal según demanda';
        let nivelInversion = 'Inversión Moderada';

        if (pctAcumulado <= 75 || pctVenta >= 15 || item.units >= 8) {
            clasificacion = 'alta';
            recomendacion = '⭐ Prioridad Máxima: Asegurar stock / Comprar por mayor para mejor margen';
            nivelInversion = 'Alta Prioridad (Más Invertir)';
        } else if (item.units <= 2) {
            clasificacion = 'baja';
            recomendacion = '⚠️ Reducir compras: Mantener stock mínimo indispensable';
            nivelInversion = 'Baja Prioridad (Menos Invertir)';
        }

        return {
            ...item,
            pctVenta,
            pctAcumulado,
            clasificacion,
            recomendacion,
            nivelInversion
        };
    });

    const masInvertir = itemsConAnalisis.filter(i => i.clasificacion === 'alta');
    const inversionModerada = itemsConAnalisis.filter(i => i.clasificacion === 'media');
    const menosInvertir = itemsConAnalisis.filter(i => i.clasificacion === 'baja');

    const analisisInversion = {
        masInvertir,
        inversionModerada,
        menosInvertir,
        sinVentas: sinVentasList,
        rubrosPrioritarios: [...categoryBreakdown].sort((a, b) => b.subtotal - a.subtotal)
    };

    // 🍕 Ranking de Gustos de Pizza (Los que más salen y los que no salieron)
    const pizzaToppingsRanking = Object.entries(customPizzaToppingsCount)
        .map(([name, count]) => {
            const pizzaPrice = (prices.preciosPizzas || []).find(p => p.name === name) || {};
            return {
                name,
                count,
                precioEntera: pizzaPrice.precioEntera || 0,
                precioMedia: pizzaPrice.precioMedia || 0
            };
        })
        .sort((a, b) => b.count - a.count);

    const gustosPizzaMasVendidos = pizzaToppingsRanking.filter(p => p.count > 0);
    const gustosPizzaSinVentas = pizzaToppingsRanking.filter(p => p.count === 0);

    return {
        // Métricas Globales
        totalRecaudado,
        totalPropina,
        totalUnidades,
        totalPersonas,
        totalMesasConConsumo,
        totalBarraConConsumo,
        activeEntitiesCount,
        ticketPromedio,
        topProductoEstrella,

        // Modos y Contexto
        currentMode,
        isPizzaLibreMode,
        menuPrice,
        generatedAt: new Date().toISOString(),
        genericData: genericData || {},

        // Desgloses por categoría y grupos
        categoryBreakdown,
        beverageCategoryBreakdown,
        allBeveragesList,
        customPizzasMap,
        customPizzaToppingsCount,
        pizzaToppingsRanking,
        gustosPizzaMasVendidos,
        gustosPizzaSinVentas,

        // Listados de ventas y Rankings
        soldItemsList,
        topVendidos,
        menosVendidos,
        sinVentasList,
        analisisInversion,

        // Desglose individual de entidades
        entityReports
    };
}

function calculateGrandTotalTip(tables = [], barOrders = []) {
    let grandTip = 0;
    (tables || []).forEach(t => {
        if (t && t.isPaid) {
            const val = parseFloat(t.tipAmount);
            if (!isNaN(val)) grandTip += val;
        }
    });
    (barOrders || []).forEach(b => {
        if (b && b.isPaid) {
            const val = parseFloat(b.tipAmount);
            if (!isNaN(val)) grandTip += val;
        }
    });
    return Math.round(grandTip * 100) / 100;
}

// Exportar para Node.js (tests), sin romper el uso en browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getPizzaPrice,
        calculatePizzaPrice,
        calculateTotal,
        calculateGrandTotal,
        calculateGrandTotalTip,
        calculateTablePersons,
        calculateGrandTotalPersons,
        getModeMenuPrice,
        generateSalesReport
    };
}


