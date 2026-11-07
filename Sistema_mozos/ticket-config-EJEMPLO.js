/**
 * EJEMPLO DE USO - Implementar ticket en otro sistema
 * 
 * Este archivo muestra cómo usar ticket-config.js en otro proyecto
 */

// ============================================
// 1. EN UN NAVEGADOR (HTML + JavaScript)
// ============================================

/*
<!DOCTYPE html>
<html>
<head>
  <script src="ticket-config.js"></script>
</head>
<body>
  <button onclick="generarTicket()">Generar Ticket</button>
  <div id="preview"></div>
  
  <script>
    function generarTicket() {
      // Datos del pedido
      const pedido = {
        establishmentName: 'Club Bochas',
        address: 'Calle Principal 123',
        phone: '+54 9 11 1234567',
        email: 'info@club.com',
        footer: 'Gracias por su visita',
        tableNumber: '5',
        pizzaLibreH: 2,
        pizzaLibreM: 1,
        menu: 0,
        empanadas: 3,
        postres: 1,
        beverages: [
          { name: 'Coca Cola', quantity: 2 }
        ]
      };
      
      // Precios
      const precios = {
        pizzaLibreH: 450,
        pizzaLibreM: 350,
        empanada: 25,
        precioPostre: 80,
        precioMenuMiercoles: 200,
        beverages: [
          { name: 'Coca Cola', price: 50, category: 'gaseosa' }
        ]
      };
      
      // Generar HTML
      const html = TICKET_CONFIG.generateTicketHTML(pedido, precios, 'sabado');
      
      // Mostrar preview
      document.getElementById('preview').innerHTML = html;
      
      // Imprimir
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      w.print();
    }
  </script>
</body>
</html>
*/

// ============================================
// 2. EN NODE.JS / EXPRESS
// ============================================

/*
const TICKET_CONFIG = require('./ticket-config');

app.post('/api/imprimir-ticket', (req, res) => {
  const { pedido, precios, modo } = req.body;
  
  const ticketHTML = TICKET_CONFIG.generateTicketHTML(pedido, precios, modo);
  
  res.send(ticketHTML);
  
  // O guardarlo como PDF si usas librerías como puppeteer
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.setContent(ticketHTML);
  // await page.pdf({ path: 'ticket.pdf', format: 'A4' });
});
*/

// ============================================
// 3. EN UN COMPONENTE REACT
// ============================================

/*
import TICKET_CONFIG from './ticket-config';

function TicketPrinter() {
  const [ticketData, setTicketData] = useState({
    establishmentName: 'Club Bochas',
    tableNumber: '1',
    pizzaLibreH: 0,
    pizzaLibreM: 0,
    menu: 0,
    empanadas: 0,
    postres: 0,
    beverages: []
  });

  const handlePrint = () => {
    const prices = {
      pizzaLibreH: 450,
      pizzaLibreM: 350,
      empanada: 25,
      precioPostre: 80,
      precioMenuSabado: 250,
      beverages: []
    };

    const html = TICKET_CONFIG.generateTicketHTML(
      ticketData, 
      prices, 
      'sabado'
    );

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div>
      <button onClick={handlePrint}>Imprimir Ticket</button>
    </div>
  );
}

export default TicketPrinter;
*/

// ============================================
// 4. ESTRUCTURA DE DATOS DEL PEDIDO
// ============================================

const PEDIDO_EJEMPLO = {
  // Datos del cliente/mesa
  tableNumber: '5',              // O clientName para pedidos en barra
  clientName: 'Juan Pérez',      // Alternativa a tableNumber

  // Datos del establecimiento (se pueden pasar aquí o en genericData)
  establishmentName: 'Club Bochas',
  address: 'Calle Principal 123',
  phone: '+54 9 11 1234567',
  email: 'info@club.com',
  footer: 'Gracias por su visita!',

  // Items del pedido
  pizzaLibreH: 2,                // Pizza libre para hombres
  pizzaLibreM: 1,                // Pizza libre para mujeres
  menores: 0,                    // Menores (se debe incluir menorPrice)
  menorPrice: 150,               // Precio especial del menor
  menu: 1,                       // Menú del día
  empanadas: 3,                  // Cantidad de empanadas
  postres: 1,                    // Cantidad de postres

  // Pizzas personalizadas
  pizzasPersonalizadas: [
    {
      size: 'Entera',            // 'Entera' o 'Media'
      toppings: ['Muzzarella', 'Jamón', 'Piña']
    },
    {
      size: 'Media',
      toppings: ['Especial', 'Jamón']
    }
  ],

  // Bebidas
  beverages: [
    { name: 'Coca Cola', quantity: 2 },
    { name: 'Agua', quantity: 1 },
    { name: 'Cerveza Quilmes', quantity: 1 }
  ]
};

// ============================================
// 5. ESTRUCTURA DE PRECIOS
// ============================================

const PRECIOS_EJEMPLO = {
  // Pizza libre por tipo
  pizzaLibreH: 450,              // Precio hombres
  pizzaLibreM: 350,              // Precio mujeres

  // Menú por día de la semana
  precioMenuMiercoles: 200,
  precioMenuViernes: 220,
  precioMenuSabado: 250,
  precioMenuDomingo: 280,

  // Productos individuales
  empanada: 25,                  // Precio por unidad
  precioPostre: 80,              // Precio por unidad

  // Pizzas personalizadas
  pizzasPersonalizadas: {
    preciosEntera: {
      'Muzzarella': 200,
      'Especial': 250,
      'Jamón': 150,
      'Piña': 50
    },
    preciosMedia: {
      'Muzzarella': 120,
      'Especial': 150,
      'Jamón': 90,
      'Piña': 30
    }
  },

  // Bebidas
  beverages: [
    { name: 'Coca Cola', price: 50, category: 'gaseosa' },
    { name: 'Agua', price: 20, category: 'agua' },
    { name: 'Cerveza Quilmes', price: 120, category: 'cerveza' },
    { name: 'Vino Tinto', price: 150, category: 'vino' }
  ]
};

// ============================================
// 6. INTEGRACIÓN CON ÍNDEXEDDB (GUARDAR LOCALMENTE)
// ============================================

/*
const saveTicketToIndexedDB = (pedido, precios) => {
  const request = indexedDB.open('TicketDatabase', 1);

  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['tickets'], 'readwrite');
    const store = transaction.objectStore('tickets');
    
    store.add({
      id: Date.now(),
      pedido: pedido,
      precios: precios,
      timestamp: new Date().toISOString()
    });
  };
};

const loadTicketsFromIndexedDB = () => {
  const request = indexedDB.open('TicketDatabase', 1);
  
  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(['tickets'], 'readonly');
    const store = transaction.objectStore('tickets');
    const allTickets = store.getAll();
    
    allTickets.onsuccess = () => {
      console.log('Tickets guardados:', allTickets.result);
    };
  };
};
*/

// ============================================
// EXPORTAR EJEMPLO DE USO
// ============================================

console.log('📋 EJEMPLO DE CONFIGURACIÓN DE TICKET');
console.log('Pedido:', PEDIDO_EJEMPLO);
console.log('Precios:', PRECIOS_EJEMPLO);
