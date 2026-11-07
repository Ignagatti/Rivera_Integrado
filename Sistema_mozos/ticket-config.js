/**
 * CONFIGURACIÓN DE TICKET - Módulo Reutilizable
 * 
 * Este archivo contiene la configuración completa del ticket.
 * Puedes importarlo en cualquier otro sistema para mantener consistencia.
 * 
 * Uso:
 * - En Node.js: const ticketConfig = require('./ticket-config');
 * - En navegador: <script src="ticket-config.js"></script>
 */

const TICKET_CONFIG = {
  // Dimensiones del ticket (en milímetros)
  dimensions: {
    width: '58mm',
    height: '200mm',
    margin: '3mm'
  },

  // Estructura de datos del ticket
  structure: {
    establishment: {
      name: '',        // Nombre del establecimiento
      address: '',     // Dirección
      phone: '',       // Teléfono
      email: '',       // Email
      footer: ''       // Mensaje de pie de página
    },

    // Tipos de productos disponibles
    products: {
      pizzaLibre: {
        tipos: ['Hombres', 'Mujeres', 'General'],
        preciosIndividuales: true
      },
      menores: {
        precioVariable: true  // Precio se define por orden
      },
      menu: {
        preciosPorDia: {
          martes: 0,
          miercoles: 0,
          viernes: 0,
          domingo: 0
        }
      },
      empanadas: {
        precioPorUnidad: 0
      },
      postres: {
        precioPorUnidad: 0
      },
      pizzasPersonalizadas: {
        tamaños: ['Entera', 'Media'],
        preciosEntera: {},   // { 'gusto1': 0, 'gusto2': 0 }
        preciosMedia: {}     // { 'gusto1': 0, 'gusto2': 0 }
      },
      bebidas: [
        // Formato: { name: 'Coca Cola', price: 5.00, category: 'gaseosa' }
      ]
    }
  },

  // Estilos CSS para impresión
  styles: {
    print: `
      @page {
        size: 58mm 200mm;
        margin: 3mm;
      }
      
      body {
        margin: 0;
        padding: 0;
        background-color: white;
        color: black;
        font-family: 'Inter', Arial, sans-serif;
      }
      
      .ticket {
        width: 58mm;
        max-width: 58mm;
        margin: 0 auto;
        padding: 0;
      }
      
      .line {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        font-size: 12px;
        line-height: 1.1;
        margin: 4px 0;
      }
      
      .label {
        flex: 1;
        text-align: left;
        word-break: break-word;
        margin-right: 8px;
      }
      
      .amount {
        width: 74px;
        text-align: right;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      
      .header {
        text-align: center;
        margin-bottom: 8px;
        border-bottom: 1px dashed #333;
        padding-bottom: 6px;
      }
      
      .title {
        font-weight: 700;
        font-size: 14px;
        margin-top: 6px;
        margin-bottom: 6px;
      }
      
      .total-section {
        font-weight: 800;
        font-size: 18px;
        margin-top: 8px;
        border-top: 1px dashed #333;
        padding-top: 8px;
      }
      
      hr.small {
        border: none;
        border-top: 1px dashed #222;
        margin: 8px 0;
      }
      
      img.logo {
        max-height: 80px;
        display: block;
        margin: 0 auto 8px;
      }
    `,
    
    preview: `
      #print-preview {
        width: 58mm;
        max-width: 58mm;
        margin: 0 auto;
        font-size: 13px;
        background: white;
        padding: 8px;
        border: 1px solid #ccc;
      }
      
      #print-preview .header {
        text-align: center;
        margin-bottom: 8px;
        border-bottom: 2px solid #000;
        padding-bottom: 6px;
      }
      
      #print-preview img {
        max-height: 110px;
        max-width: 100%;
        display: block;
        margin: 0 auto 8px;
      }
    `
  },

  // Funciones de utilidad
  utils: {
    /**
     * Escapa caracteres especiales para HTML
     */
    escapeHtml: function(text) {
      if (!text) return '';
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    },

    formatCurrency: function(amount) {
      let num = Number(amount) || 0;
      let str = num.toFixed(2);
      str = str.endsWith('.00') ? str.slice(0, -3) : str;
      return `$ ${str}`;
    },

    /**
     * Genera una línea del ticket
     */
    generateLine: function(label, amount) {
      return `
        <div class="line">
          <span class="label">${this.escapeHtml(label)}</span>
          <span class="amount">${this.formatCurrency(amount)}</span>
        </div>
      `;
    }
  },

  /**
   * Genera el HTML del ticket para impresión
   * @param {Object} data - Datos del pedido
   * @param {Object} prices - Precios configurados
   * @param {string} mode - Día de la semana (miercoles, jueves, viernes, sabado, domingo)
   * @returns {string} HTML del ticket
   */
  generateTicketHTML: function(data, prices, mode = 'sabado') {
    const { escapeHtml, formatCurrency, generateLine } = this.utils;
    let bodyHtml = '';

    // Header
    bodyHtml += '<div class="header">';
    bodyHtml += `<div style="font-weight:700;font-size:14px;">${escapeHtml(data.establishmentName || '')}</div>`;
    if (data.address) bodyHtml += `<div style="font-size:10px;">${escapeHtml(data.address)}</div>`;
    if (data.phone) bodyHtml += `<div style="font-size:10px;">Tel: ${escapeHtml(data.phone)}</div>`;
    if (data.email) bodyHtml += `<div style="font-size:10px;">${escapeHtml(data.email)}</div>`;
    bodyHtml += '</div>';

    // Título (Mesa o Pedido)
    if (data.tableNumber) {
      bodyHtml += `<div style="text-align:center;font-weight:700;margin:6px 0;">MESA ${escapeHtml(data.tableNumber)}</div>`;
    } else if (data.clientName) {
      bodyHtml += `<div style="text-align:center;font-weight:700;margin:6px 0;">PEDIDO: ${escapeHtml(data.clientName)}</div>`;
    }

    // Items
    bodyHtml += '<div style="margin-top:6px;">';

    // Pizza Libre
    if (data.pizzaLibreH > 0) {
      bodyHtml += generateLine.call(this, 
        `${data.pizzaLibreH} x Pizza Libre Hombres`, 
        data.pizzaLibreH * prices.pizzaLibreH
      );
    }
    if (data.pizzaLibreM > 0) {
      bodyHtml += generateLine.call(this,
        `${data.pizzaLibreM} x Pizza Libre Mujeres`,
        data.pizzaLibreM * prices.pizzaLibreM
      );
    }
    if (data.pizzaLibreG > 0) {
      bodyHtml += generateLine.call(this,
        `${data.pizzaLibreG} x Pizza Libre General`,
        data.pizzaLibreG * prices.pizzaLibreG
      );
    }

    // Menores
    if (data.menores > 0) {
      bodyHtml += generateLine.call(this,
        `${data.menores} x Menor`,
        data.menores * (data.menorPrice || 0)
      );
    }

    // Menú
    if (data.menu > 0) {
      const menuPrices = {
        martes: prices.precioMenuMartes || 0,
        miercoles: prices.precioMenuMiercoles || 0,
        viernes: prices.precioMenuViernes || 0,
        domingo: prices.precioMenuDomingo || 0
      };
      const menuPrice = menuPrices[mode] || 0;
      bodyHtml += generateLine.call(this,
        `${data.menu} x Menú`,
        data.menu * menuPrice
      );
    }

    // Empanadas
    if (data.empanadas > 0) {
      bodyHtml += generateLine.call(this,
        `${data.empanadas} x Empanada`,
        data.empanadas * prices.empanada
      );
    }

    // Postres
    if (data.postres > 0) {
      bodyHtml += generateLine.call(this,
        `${data.postres} x Postre`,
        data.postres * prices.precioPostre
      );
    }

    // Pizzas Personalizadas
    if (data.pizzasPersonalizadas && data.pizzasPersonalizadas.length > 0) {
      data.pizzasPersonalizadas.forEach(pizza => {
        const pizzaPrice = this.calculatePizzaPrice(pizza, prices);
        const desc = `Pizza ${pizza.size} (${pizza.toppings.join(', ')})`;
        bodyHtml += generateLine.call(this, `1 x ${desc}`, pizzaPrice);
      });
    }

    // Bebidas
    if (data.beverages && data.beverages.length > 0) {
      data.beverages.forEach(bev => {
        const bevInfo = prices.beverages.find(b => b.name === bev.name) || { price: 0 };
        bodyHtml += generateLine.call(this,
          `${bev.quantity} x ${bev.name}`,
          bev.quantity * bevInfo.price
        );
      });
    }

    bodyHtml += '</div>';

    // Total
    const totalAmount = this.calculateTotal(data, prices, mode);
    bodyHtml += '<hr class="small"/>';
    bodyHtml += `
      <div class="line" style="margin-top:6px;">
        <span class="label" style="font-weight:800;">TOTAL</span>
        <span class="amount" style="font-size:16px;font-weight:800;">${formatCurrency(totalAmount)}</span>
      </div>
    `;

    // Footer
    if (data.footer) {
      bodyHtml += `<div style="text-align:center;font-size:10px;margin-top:8px;">${escapeHtml(data.footer)}</div>`;
    }

    // Documento completo
    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ticket</title>
          <style>${this.styles.print}</style>
        </head>
        <body>
          <div class="ticket">${bodyHtml}</div>
        </body>
      </html>
    `;
  },

  /**
   * Calcula el total del ticket
   */
  calculateTotal: function(data, prices, mode) {
    let total = 0;

    if (data.pizzaLibreH) total += data.pizzaLibreH * prices.pizzaLibreH;
    if (data.pizzaLibreM) total += data.pizzaLibreM * prices.pizzaLibreM;
    if (data.pizzaLibreG) total += data.pizzaLibreG * prices.pizzaLibreG;
    if (data.menores) total += data.menores * (data.menorPrice || 0);

    if (data.menu) {
      const menuPrices = {
        martes: prices.precioMenuMartes || 0,
        miercoles: prices.precioMenuMiercoles || 0,
        viernes: prices.precioMenuViernes || 0,
        domingo: prices.precioMenuDomingo || 0
      };
      total += data.menu * (menuPrices[mode] || 0);
    }

    if (data.empanadas) total += data.empanadas * prices.empanada;
    if (data.postres) total += data.postres * prices.precioPostre;

    if (data.pizzasPersonalizadas) {
      data.pizzasPersonalizadas.forEach(pizza => {
        total += this.calculatePizzaPrice(pizza, prices);
      });
    }

    if (data.beverages) {
      data.beverages.forEach(bev => {
        const bevInfo = prices.beverages.find(b => b.name === bev.name) || { price: 0 };
        total += bev.quantity * bevInfo.price;
      });
    }

    return total;
  },

  /**
   * Calcula el precio de una pizza personalizada
   */
  calculatePizzaPrice: function(pizza, prices) {
    if (!prices.pizzasPersonalizadas) return 0;
    
    const toppingPrices = pizza.size === 'Entera' 
      ? prices.pizzasPersonalizadas.preciosEntera 
      : prices.pizzasPersonalizadas.preciosMedia;
    
    let totalPrice = 0;
    pizza.toppings.forEach(topping => {
      if (topping !== 'Ninguno') {
        totalPrice += toppingPrices[topping] || 0;
      }
    });
    
    return totalPrice;
  }
};

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TICKET_CONFIG;
}
