// Tests para js/sales-report.js
// Ejecutar con: node tests/sales-report.test.js

const { generateSalesReport } = require('../js/calculations.js');
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

function assertIncludes(str, snippet, msg = '') {
    if (!str || !str.includes(snippet)) {
        throw new Error(`${msg ? msg + ' — ' : ''}esperado que contenga: "${snippet}"`);
    }
}

const mockPrices = {
    pizzaLibreH: 10000, pizzaLibreM: 9000, pizzaLibreG: 9500,
    empanada: 500, precioPostre: 1000,
    precioMenuMartes: 8500, precioMenuMiercoles: 8000, precioMenuViernes: 9000, precioMenuDomingo: 7500,
    preciosPizzas: [
        { name: 'Muzzarella', precioEntera: 4000, precioMedia: 2000 },
        { name: 'Calabresa',  precioEntera: 5000, precioMedia: 2500 }
    ],
    beverages: [
        { name: 'Coca', price: 1000, category: 'gaseosa' },
        { name: 'Vino Malbec', price: 3500, category: 'vino' }
    ]
};

const mockTables = [
    {
        id: 't-1',
        number: '4',
        order: {
            menu: 3,
            menores: 1,
            menorPrice: 2000,
            empanadas: 4,
            postres: 2,
            beverages: [
                { name: 'Coca', quantity: 3 },
                { name: 'Vino Malbec', quantity: 1 }
            ]
        }
    }
];

const mockGenericData = {
    establishmentName: 'Club Social y Deportivo',
    address: 'Av. Libertador 450',
    phone: '+54 9 3496 123456',
    alias: 'club.social.mp'
};

console.log('\nSalesReportManager Tests');

test('renderModalDashboard genera HTML válido con KPIs, lo más vendido, gustos de pizza y lo que no se vendió', () => {
    const report = generateSalesReport(mockTables, [], mockPrices, 'miercoles', mockGenericData);
    const html = SalesReportManager.renderModalDashboard(report);

    assertIncludes(html, 'Club Social y Deportivo');
    assertIncludes(html, 'Reporte de Ventas');
    assertIncludes(html, 'Día: Miercoles');
    assertIncludes(html, 'Productos Más Vendidos');
    assertIncludes(html, 'Gustos de Pizza Más Vendidos');
    assertIncludes(html, 'Productos Menos Vendidos');
    assertIncludes(html, 'Productos Sin Ventas');
    assertIncludes(html, 'Detalle Consolidado de Todo lo Vendido');
    assertIncludes(html, 'Menú del Día');
    assertIncludes(html, 'Coca');
    assertIncludes(html, 'Vino Malbec');
});

test('generatePrintDocumentHTML genera documento A4 con resumen y detalle', () => {
    const report = generateSalesReport(mockTables, [], mockPrices, 'miercoles', mockGenericData);
    const printHtml = SalesReportManager.generatePrintDocumentHTML(report);

    assertIncludes(printHtml, '<!DOCTYPE html>');
    assertIncludes(printHtml, '@page {');
    assertIncludes(printHtml, 'size: A4 portrait;');
    assertIncludes(printHtml, 'Club Social y Deportivo');
    assertIncludes(printHtml, 'Informe Consolidado de Cierre y Ventas');
    assertIncludes(printHtml, 'Productos Más Vendidos');
    assertIncludes(printHtml, 'Gustos de Pizza Más Vendidos');
    assertIncludes(printHtml, 'Productos Sin Ventas');
    assertIncludes(printHtml, 'Detalle Consolidado de Todo lo Vendido');
});

test('getReportFileName genera nombre con día de operación y fecha', () => {
    const report = generateSalesReport(mockTables, [], mockPrices, 'miercoles', mockGenericData);
    report.generatedAt = '2026-08-18T14:00:00.000Z';
    const filename = SalesReportManager.getReportFileName(report);
    assertIncludes(filename, 'Reporte-Ventas-Miercoles-');
    assertIncludes(filename, '.pdf');
});

test('formateadores numéricos y de moneda', () => {
    assertEqual(SalesReportManager.formatCurrency(15000), '$ 15.000');
    assertEqual(SalesReportManager.formatPercent(33.333), '33.3%');
    assertEqual(SalesReportManager.formatNumber(1250), '1.250');
});

test('downloadSalesReportPDF genera documento y retorna resultado válido', async () => {
    const report = generateSalesReport(mockTables, [], mockPrices, 'miercoles', mockGenericData);
    const result = await SalesReportManager.downloadSalesReportPDF(report);
    assertEqual(result.success, true);
});

console.log(`\n${passed} pasaron, ${failed} fallaron\n`);
if (failed > 0) process.exit(1);
