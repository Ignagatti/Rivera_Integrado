// Tests unitarios para js/calculations.js
// Ejecutar con: node tests/calculations.test.js

const {
    getPizzaPrice,
    calculatePizzaPrice,
    calculateTotal,
    calculateGrandTotal,
    calculateTablePersons,
    calculateGrandTotalPersons,
    generateSalesReport
} = require('../js/calculations.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ✗ ${name}`);
        console.log(`    → ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg = '') {
    if (actual !== expected) {
        throw new Error(`${msg ? msg + ' — ' : ''}esperado: ${expected}, recibido: ${actual}`);
    }
}

function assertClose(actual, expected, tolerance = 0.01) {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`esperado: ~${expected}, recibido: ${actual}`);
    }
}

// ── Datos de prueba ──────────────────────────────────────────────────────────
const prices = {
    pizzaLibreH: 10000, pizzaLibreM: 9000, pizzaLibreG: 9500,
    empanada: 500, precioPostre: 1000,
    precioMenuMartes: 8500, precioMenuMiercoles: 8000, precioMenuViernes: 9000, precioMenuDomingo: 7500,
    preciosPizzas: [
        { name: 'Muzzarella', precioEntera: 4000, precioMedia: 2000 },
        { name: 'Jamon',      precioEntera: 5000, precioMedia: 2500 },
        { name: 'Roquefort',  precioEntera: 6000, precioMedia: 3000 }
    ],
    beverages: [
        { name: 'Coca',   price: 1000, category: 'gaseosa' },
        { name: 'Heineken', price: 2000, category: 'cerveza' }
    ]
};

function emptyOrder(overrides = {}) {
    return Object.assign({
        pizzaLibreH: 0, pizzaLibreM: 0, pizzaLibreG: 0,
        menores: 0, menorPrice: 0, empanadas: 0, postres: 0, menu: 0,
        beverages: [], pizzasPersonalizadas: []
    }, overrides);
}

// ── getPizzaPrice ────────────────────────────────────────────────────────────
console.log('\ngetPizzaPrice');
test('precio entera correcto', () => assertEqual(getPizzaPrice('Muzzarella', 'entera', prices), 4000));
test('precio media correcto',  () => assertEqual(getPizzaPrice('Muzzarella', 'media',  prices), 2000));
test('gusto inexistente da 0', () => assertEqual(getPizzaPrice('Anchoas',    'entera', prices), 0));

// ── calculatePizzaPrice ──────────────────────────────────────────────────────
console.log('\ncalculatePizzaPrice');
test('entera 1 gusto', () => {
    assertEqual(calculatePizzaPrice({ size: 'entera', toppings: ['Muzzarella'] }, prices), 4000);
});
test('entera 2 gustos (media y media)', () => {
    // precioMedia[Muzz] + precioMedia[Jamon] = 2000 + 2500 = 4500
    assertEqual(calculatePizzaPrice({ size: 'entera', toppings: ['Muzzarella', 'Jamon'] }, prices), 4500);
});
test('entera 3 gustos (mitad de cada media)', () => {
    // precioMedia[Muzz]/2 + precioMedia[Jamon]/2 + precioMedia[Roquefort]/2 = 1000 + 1250 + 1500 = 3750
    assertEqual(calculatePizzaPrice({ size: 'entera', toppings: ['Muzzarella', 'Jamon', 'Roquefort'] }, prices), 3750);
});
test('media 1 gusto', () => {
    assertEqual(calculatePizzaPrice({ size: 'media', toppings: ['Muzzarella'] }, prices), 2000);
});
test('media 2 gustos', () => {
    // (2000/2) + (2500/2) = 1000 + 1250 = 2250
    assertEqual(calculatePizzaPrice({ size: 'media', toppings: ['Muzzarella', 'Jamon'] }, prices), 2250);
});
test('sin toppings da 0', () => {
    assertEqual(calculatePizzaPrice({ size: 'entera', toppings: [] }, prices), 0);
});

// ── calculateTotal ───────────────────────────────────────────────────────────
console.log('\ncalculateTotal');
test('pizza libre jueves — suma hombres y mujeres', () => {
    const order = emptyOrder({ pizzaLibreH: 2, pizzaLibreM: 1 });
    // 2*10000 + 1*9000 = 29000
    assertEqual(calculateTotal(order, prices, 'jueves'), 29000);
});
test('pizza libre NO se suma en miercoles', () => {
    const order = emptyOrder({ pizzaLibreH: 5, pizzaLibreM: 5, pizzaLibreG: 5 });
    assertEqual(calculateTotal(order, prices, 'miercoles'), 0);
});
test('menú miercoles', () => {
    const order = emptyOrder({ menu: 3 });
    // 3 * 8000 = 24000
    assertEqual(calculateTotal(order, prices, 'miercoles'), 24000);
});
test('menú martes usa precio de martes', () => {
    const order = emptyOrder({ menu: 2 });
    assertEqual(calculateTotal(order, prices, 'martes'), 17000); // 2 * 8500
});
test('menú viernes usa precio de viernes', () => {
    const order = emptyOrder({ menu: 2 });
    assertEqual(calculateTotal(order, prices, 'viernes'), 18000); // 2 * 9000
});
test('menú domingo usa precio de domingo', () => {
    const order = emptyOrder({ menu: 1 });
    assertEqual(calculateTotal(order, prices, 'domingo'), 7500);
});
test('empanadas', () => {
    const order = emptyOrder({ empanadas: 4 });
    assertEqual(calculateTotal(order, prices, 'miercoles'), 2000); // 4 * 500
});
test('menores con precio variable', () => {
    const order = emptyOrder({ menores: 2, menorPrice: 3000 });
    assertEqual(calculateTotal(order, prices, 'miercoles'), 6000);
});
test('postres', () => {
    const order = emptyOrder({ postres: 3 });
    assertEqual(calculateTotal(order, prices, 'miercoles'), 3000); // 3 * 1000
});
test('bebidas', () => {
    const order = emptyOrder({ beverages: [{ name: 'Coca', quantity: 3 }] });
    assertEqual(calculateTotal(order, prices, 'miercoles'), 3000); // 3 * 1000
});
test('bebida desconocida no tira error', () => {
    const order = emptyOrder({ beverages: [{ name: 'Inexistente', quantity: 5 }] });
    assertEqual(calculateTotal(order, prices, 'miercoles'), 0);
});
test('pizza personalizada incluida en total', () => {
    const order = emptyOrder({
        pizzasPersonalizadas: [{ size: 'entera', toppings: ['Muzzarella'] }]
    });
    assertEqual(calculateTotal(order, prices, 'sabado'), 4000);
});
test('total combinado: pizza libre + empanadas + bebida (sabado)', () => {
    const order = emptyOrder({
        pizzaLibreH: 1,
        empanadas:   2,
        beverages:   [{ name: 'Heineken', quantity: 1 }]
    });
    // 10000 + 2*500 + 2000 = 13000
    assertEqual(calculateTotal(order, prices, 'sabado'), 13000);
});

// ── calculateGrandTotal ──────────────────────────────────────────────────────
console.log('\ncalculateGrandTotal');
test('suma mesas y barra', () => {
    const tables    = [{ order: emptyOrder({ menu: 2 }) }];
    const barOrders = [{ order: emptyOrder({ menu: 1 }) }];
    // (2 + 1) * 8000 = 24000
    assertEqual(calculateGrandTotal(tables, barOrders, prices, 'miercoles'), 24000);
});
test('sin pedidos da 0', () => {
    assertEqual(calculateGrandTotal([], [], prices, 'miercoles'), 0);
});

// ── calculateTablePersons & calculateGrandTotalPersons ───────────────────────
console.log('\ncalculateTablePersons & calculateGrandTotalPersons');
test('jueves da 0 personas (deshabilitado)', () => {
    const order = emptyOrder({ pizzaLibreH: 3, pizzaLibreM: 2, menores: 1 });
    assertEqual(calculateTablePersons(order, 'jueves'), 0);
});

test('sabado da 0 personas (deshabilitado)', () => {
    const order = emptyOrder({ pizzaLibreH: 2, pizzaLibreM: 3, pizzaLibreG: 1, menores: 2 });
    assertEqual(calculateTablePersons(order, 'sabado'), 0);
});

test('viernes suma menu y menores', () => {
    const order = emptyOrder({ menu: 5, menores: 2 });
    assertEqual(calculateTablePersons(order, 'viernes'), 7);
});

test('miercoles suma menu y menores', () => {
    const order = emptyOrder({ menu: 4, menores: 2 });
    assertEqual(calculateTablePersons(order, 'miercoles'), 6);
});

test('martes suma menu y menores', () => {
    const order = emptyOrder({ menu: 3, menores: 0 });
    assertEqual(calculateTablePersons(order, 'martes'), 3);
});

test('domingo suma menu y menores', () => {
    const order = emptyOrder({ menu: 2, menores: 3 });
    assertEqual(calculateTablePersons(order, 'domingo'), 5);
});

test('calculateGrandTotalPersons suma todas las mesas en miercoles', () => {
    const tables = [
        { order: emptyOrder({ menu: 4, menores: 1 }) }, // 5
        { order: emptyOrder({ menu: 2, menores: 0 }) }, // 2
        { order: emptyOrder({ menu: 0, menores: 0 }) }  // 0
    ];
    assertEqual(calculateGrandTotalPersons(tables, 'miercoles'), 7);
});

test('calculateGrandTotalPersons suma todas las mesas en viernes', () => {
    const tables = [
        { order: emptyOrder({ menu: 3, menores: 2 }) }, // 5
        { order: emptyOrder({ menu: 4, menores: 0 }) }  // 4
    ];
    assertEqual(calculateGrandTotalPersons(tables, 'viernes'), 9);
});

test('calculateGrandTotalPersons da 0 en jueves y sabado', () => {
    const tables = [
        { order: emptyOrder({ pizzaLibreH: 5, pizzaLibreM: 5, pizzaLibreG: 2 }) }
    ];
    assertEqual(calculateGrandTotalPersons(tables, 'jueves'), 0);
    assertEqual(calculateGrandTotalPersons(tables, 'sabado'), 0);
});

// ── generateSalesReport ──────────────────────────────────────────────────
console.log('\ngenerateSalesReport');

test('reporte vacío genera métricas en cero sin romper', () => {
    const report = generateSalesReport([], [], prices, 'miercoles');
    assertEqual(report.totalRecaudado, 0);
    assertEqual(report.totalUnidades, 0);
    assertEqual(report.totalPersonas, 0);
    assertEqual(report.activeEntitiesCount, 0);
    assertEqual(report.ticketPromedio, 0);
    assertEqual(report.topVendidos.length, 0);
    assertEqual(report.sinVentasList.length > 0, true);
});

test('reporte con mesas y barra calcula totales, unidades y ticket promedio', () => {
    const tables = [
        {
            id: 't-1',
            number: '1',
            order: emptyOrder({
                menu: 4,
                menores: 2,
                menorPrice: 2000,
                empanadas: 6,
                postres: 2,
                beverages: [
                    { name: 'Coca', quantity: 4 },
                    { name: 'Heineken', quantity: 2 }
                ]
            })
        },
        {
            id: 't-2',
            number: '2',
            order: emptyOrder({
                menu: 2,
                beverages: [
                    { name: 'Coca', quantity: 2 }
                ]
            })
        }
    ];

    const barOrders = [
        {
            id: 'b-1',
            clientName: 'Juan',
            order: emptyOrder({
                empanadas: 2,
                beverages: [{ name: 'Heineken', quantity: 1 }]
            })
        }
    ];

    // Total cálculos:
    // Mesa 1: 4*8000 (32000) + 2*2000 (4000) + 6*500 (3000) + 2*1000 (2000) + 4*1000 (4000) + 2*2000 (4000) = 49000
    // Mesa 2: 2*8000 (16000) + 2*1000 (2000) = 18000
    // Barra 1: 2*500 (1000) + 1*2000 (2000) = 3000
    // Total = 49000 + 18000 + 3000 = 70000
    // Personas: (4+2) + (2+0) = 8
    // Unidades: Mesa 1 (4+2+6+2+4+2=20) + Mesa 2 (2+2=4) + Barra (2+1=3) = 27
    const report = generateSalesReport(tables, barOrders, prices, 'miercoles');

    assertEqual(report.totalRecaudado, 70000);
    assertEqual(report.totalPersonas, 8);
    assertEqual(report.totalUnidades, 27);
    assertEqual(report.activeEntitiesCount, 3);
    assertClose(report.ticketPromedio, 70000 / 3);

    // Validar top vendidos
    // Coca: 6 unidades (4 Mesa 1 + 2 Mesa 2)
    // Empanadas: 8 unidades (6 Mesa 1 + 2 Barra)
    // Menú: 6 unidades (4 Mesa 1 + 2 Mesa 2)
    // Heineken: 3 unidades (2 Mesa 1 + 1 Barra)
    // Menores: 2 unidades
    // Postres: 2 unidades
    assertEqual(report.topVendidos[0].name, 'Empanadas'); // 8 units
    assertEqual(report.topVendidos[0].units, 8);

    // Validar menos vendidos
    assertEqual(report.menosVendidos[0].units, 2);

    // Validar productos sin ventas
    // En este caso, no se vendió pizza libre ni pizzas por gusto
    const sinVentasNombres = report.sinVentasList.map(s => s.name);
    assertEqual(sinVentasNombres.includes('Gusto Pizza: Muzzarella'), true);
});

test('reporte sábado con pizza libre y pizzas personalizadas', () => {
    const tables = [
        {
            id: 't-1',
            number: '5',
            order: emptyOrder({
                pizzaLibreH: 2,
                pizzaLibreM: 3,
                pizzasPersonalizadas: [
                    { size: 'entera', toppings: ['Muzzarella', 'Jamon'] }
                ],
                beverages: [{ name: 'Heineken', quantity: 4 }]
            })
        }
    ];

    // Sabado:
    // Pizza Libre: 2*10000 (20000) + 3*9000 (27000) = 47000
    // Pizza Personalizada entera 2 gustos: Jamon (2500) + Muzzarella (2000) = 4500
    // Bebidas: 4*2000 (8000)
    // Total = 47000 + 4500 + 8000 = 59500
    // Personas: 2 + 3 = 5
    // Unidades: 2 + 3 + 1 + 4 = 10
    const report = generateSalesReport(tables, [], prices, 'sabado');

    assertEqual(report.totalRecaudado, 59500);
    assertEqual(report.totalPersonas, 5);
    assertEqual(report.totalUnidades, 10);
    assertEqual(report.isPizzaLibreMode, true);

    // Pizza Libre Hombres y Mujeres están en soldItemsList
    const soldNames = report.soldItemsList.map(s => s.name);
    assertEqual(soldNames.includes('Pizza Libre (Hombres)'), true);
    assertEqual(soldNames.includes('Pizza Libre (Mujeres)'), true);
    assertEqual(soldNames.includes('Pizza Entera (Muzzarella, Jamon)'), true);
});

test('cálculo de propina acumulada (totalPropina y calculateGrandTotalTip)', () => {
    const { calculateGrandTotalTip } = require('../js/calculations.js');
    const tables = [
        {
            id: 't-1',
            number: '1',
            order: emptyOrder({ menu: 2 }), // Total: 2*8000 = 16000
            isPaid: true,
            paidAmount: 18000,
            tipAmount: 2000
        },
        {
            id: 't-2',
            number: '2',
            order: emptyOrder({ menu: 1 }), // Total: 8000
            isPaid: false,
            paidAmount: 0,
            tipAmount: 0
        }
    ];
    const barOrders = [
        {
            id: 'b-1',
            clientName: 'Juan',
            order: emptyOrder({ empanadas: 2 }), // Total: 1000
            isPaid: true,
            paidAmount: 1500,
            tipAmount: 500
        }
    ];

    const grandTip = calculateGrandTotalTip(tables, barOrders);
    assertEqual(grandTip, 2500);

    const report = generateSalesReport(tables, barOrders, prices, 'miercoles');
    assertEqual(report.totalPropina, 2500);
});

test('reseteo de mesa al cambiar de día / limpiar pedidos', () => {
    const { calculateGrandTotalTip } = require('../js/calculations.js');
    const table = {
        id: 't-1',
        number: '1',
        order: emptyOrder({ menu: 2 }),
        isPaid: true,
        paidAmount: 20000,
        tipAmount: 4000
    };

    // Simulación de limpieza de mesa al cambiar de día
    table.order = emptyOrder();
    table.isPaid = false;
    table.paidAmount = 0;
    table.tipAmount = 0;

    assertEqual(table.isPaid, false);
    assertEqual(table.paidAmount, 0);
    assertEqual(table.tipAmount, 0);
    assertEqual(calculateGrandTotalTip([table], []), 0);
});

// ── Resultado final ──────────────────────────────────────────────────────────
console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
if (failed > 0) process.exit(1);


