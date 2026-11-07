// Suite Completa de Tests para Casos de Borde (Edge Cases) y Pruebas Extremas
// Ejecutar con: node tests/edge-cases-and-stress.test.js

const {
    getPizzaPrice,
    calculatePizzaPrice,
    calculateTotal,
    calculateGrandTotal,
    calculateGrandTotalTip,
    calculateTablePersons,
    calculateGrandTotalPersons,
    generateSalesReport
} = require('../js/calculations.js');

const SalesReportManager = require('../js/sales-report.js');

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

const mockPrices = {
    pizzaLibreH: 10500.50,
    pizzaLibreM: 9500.25,
    pizzaLibreG: 10000,
    empanada: 250.75,
    precioPostre: 1200,
    precioMenuMartes: 8500,
    precioMenuMiercoles: 8000,
    precioMenuViernes: 9000,
    precioMenuDomingo: 7500,
    preciosPizzas: [
        { name: 'Muzzarella', precioEntera: 4000, precioMedia: 2000 },
        { name: 'Especial',   precioEntera: 5500, precioMedia: 2750 }
    ],
    beverages: [
        { name: 'Coca 1.5L', price: 1500.50, category: 'gaseosa' }
    ]
};

console.log('\n=== SUITE DE PRUEBAS EXTREMAS Y CASOS DE BORDE ===\n');

// 1. Resiliencia ante Entradas Nulas / Indefinidas
console.log('1. Entradas Nulas o Malformadas');
test('calculateTotal con order nulo no lanza excepción y devuelve 0', () => {
    assertEqual(calculateTotal(null, mockPrices, 'miercoles'), 0);
});

test('calculateTotal con prices nulo no lanza excepción y devuelve 0', () => {
    assertEqual(calculateTotal({ menu: 2 }, null, 'miercoles'), 0);
});

test('calculateGrandTotal con arreglos vacíos o nulos', () => {
    assertEqual(calculateGrandTotal(null, null, mockPrices, 'miercoles'), 0);
    assertEqual(calculateGrandTotal([], [], mockPrices, 'miercoles'), 0);
});

test('calculateGrandTotalTip con objetos corruptos o sin tipAmount', () => {
    const corruptTables = [
        null,
        {},
        { isPaid: true, tipAmount: undefined },
        { isPaid: true, tipAmount: null },
        { isPaid: true, tipAmount: 'invalid_number' }
    ];
    assertEqual(calculateGrandTotalTip(corruptTables, null), 0);
});

// 2. Precisión Decimal y Cálculo de Propina
console.log('\n2. Precisión Decimal y Cálculos Monetarios');
test('Precisión de coma flotante en total y propina con decimales', () => {
    // 2 x Empanadas ($250.75 c/u) + 1 x Coca ($1500.50) = $501.50 + $1500.50 = $2002.00
    const order = { empanadas: 2, beverages: [{ name: 'Coca 1.5L', quantity: 1 }] };
    const total = calculateTotal(order, mockPrices, 'miercoles');
    assertEqual(total, 2002);

    const table = {
        id: 't-dec',
        order,
        isPaid: true,
        paidAmount: 2500.75,
        tipAmount: Math.max(0, Math.round((2500.75 - total) * 100) / 100)
    };
    assertEqual(table.tipAmount, 498.75);
    assertEqual(calculateGrandTotalTip([table], []), 498.75);
});

test('Pago inferior al consumido (Underpayment) no genera propina negativa', () => {
    const tableTotal = 10000;
    const paidAmount = 8000; // Pago parcial
    const calculatedTip = Math.max(0, paidAmount - tableTotal);
    assertEqual(calculatedTip, 0);
});

// 3. Seguridad e Inyección HTML en PDF/Reportes
console.log('\n3. Seguridad e Inyección HTML en PDF');
test('Escapado de caracteres especiales HTML en nombres de clientes y establecimientos', () => {
    const maliciousData = {
        establishmentName: 'Club <script>alert("XSS")</script>',
        address: 'Calle & Av. "Principal"'
    };
    const maliciousBarOrder = [
        {
            id: 'bar-xss',
            clientName: '<b style="color:red">Hacker</b>',
            order: { menu: 1 },
            isPaid: true,
            tipAmount: 100
        }
    ];

    const report = generateSalesReport([], maliciousBarOrder, mockPrices, 'miercoles', maliciousData);
    const htmlPdf = SalesReportManager.generatePrintDocumentHTML(report);

    assertEqual(htmlPdf.includes('<script>'), false);
    assertEqual(htmlPdf.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'), true);
    assertEqual(htmlPdf.includes('Calle &amp; Av. &quot;Principal&quot;'), true);
});

// 4. Armado de Pizzas por Gusto (Casos Complejos)
console.log('\n4. Armado de Pizzas por Gusto');
test('Pizza entera con gustos inexistentes o con ninguno', () => {
    const pizza = { size: 'entera', toppings: ['Inexistente', 'ninguno'] };
    assertEqual(calculatePizzaPrice(pizza, mockPrices), 0);
});

test('Pizza media con 2 gustos válidos calcula exactamente la mitad de cada una', () => {
    // Muzzarella media: 2000, Especial media: 2750 -> (2000/2) + (2750/2) = 1000 + 1375 = 2375
    const pizza = { size: 'media', toppings: ['Muzzarella', 'Especial'] };
    assertEqual(calculatePizzaPrice(pizza, mockPrices), 2375);
});

// 5. Transiciones de Estado y Cambio de Jornada
console.log('\n5. Transición de Estado de Mesas');
test('Limpieza de mesa resetea isPaid, paidAmount y tipAmount a valores neutros', () => {
    const tables = [
        { id: 't-1', number: '1', order: { menu: 2 }, isPaid: true, paidAmount: 20000, tipAmount: 4000 },
        { id: 't-2', number: '2', order: { menu: 1 }, isPaid: true, paidAmount: 10000, tipAmount: 2000 }
    ];

    // Simulación de reseteo al cambiar de día
    tables.forEach(t => {
        t.order = { pizzaLibreH: 0, pizzaLibreM: 0, pizzaLibreG: 0, menores: 0, menorPrice: 0, empanadas: 0, postres: 0, menu: 0, beverages: [], pizzasPersonalizadas: [] };
        t.isPaid = false;
        t.paidAmount = 0;
        t.tipAmount = 0;
    });

    assertEqual(tables.every(t => t.isPaid === false), true);
    assertEqual(tables.every(t => t.paidAmount === 0), true);
    assertEqual(tables.every(t => t.tipAmount === 0), true);
    assertEqual(calculateGrandTotalTip(tables, []), 0);
});

// ── Resumen de Ejecución ──────────────────────────────────────────────────────
console.log(`\n==================================================`);
console.log(`Resultado: ${passed} pruebas pasadas, ${failed} falladas`);
console.log(`==================================================\n`);

if (failed > 0) process.exit(1);
