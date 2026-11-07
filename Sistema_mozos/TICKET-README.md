# 📋 Configuración de Tickets - Sistema Modular y Reutilizable

## Descripción

Estos archivos contienen la configuración completa del sistema de tickets separada del código principal. Permite:

✅ **Reutilizar el mismo modelo de ticket en otros sistemas**  
✅ **Mantener consistencia en la presentación de tickets**  
✅ **Cambiar fácilmente precios, nombres y estilos**  
✅ **Integrar en múltiples plataformas (web, Node.js, React, Vue, etc.)**

---

## Archivos Incluidos

### 1. `ticket-config.js` 
Módulo principal con toda la lógica de configuración y generación de tickets.

**Contiene:**
- Estructura de datos del ticket
- Estilos CSS para impresión
- Funciones de utilidad
- Generador de HTML
- Cálculo de totales

### 2. `ticket-config-EJEMPLO.js`
Ejemplos de uso en diferentes contextos (Navegador, Node.js, React, etc.)

### 3. `README.md` (este archivo)
Documentación completa

---

## Uso Rápido

### En Navegador

```html
<!DOCTYPE html>
<html>
<head>
  <script src="ticket-config.js"></script>
</head>
<body>
  <button onclick="imprimirTicket()">Imprimir</button>
  
  <script>
    function imprimirTicket() {
      const pedido = {
        establishmentName: 'Club Bochas',
        address: 'Calle Principal 123',
        phone: '+54 9 11 1234567',
        email: 'info@club.com',
        footer: 'Gracias por su visita',
        tableNumber: '5',
        pizzaLibreH: 2,
        pizzaLibreM: 1,
        empanadas: 3,
        postres: 1,
        beverages: [
          { name: 'Coca Cola', quantity: 2 }
        ]
      };
      
      const precios = {
        pizzaLibreH: 450,
        pizzaLibreM: 350,
        empanada: 25,
        precioPostre: 80,
        beverages: [
          { name: 'Coca Cola', price: 50, category: 'gaseosa' }
        ]
      };
      
      const html = TICKET_CONFIG.generateTicketHTML(
        pedido, 
        precios, 
        'sabado'  // modo: miercoles, viernes, sabado, domingo
      );
      
      const ventana = window.open('', '_blank');
      ventana.document.write(html);
      ventana.document.close();
      ventana.print();
    }
  </script>
</body>
</html>
```

### En Node.js / Express

```javascript
const TICKET_CONFIG = require('./ticket-config');

app.post('/api/ticket', (req, res) => {
  const { pedido, precios, modo } = req.body;
  
  const ticketHTML = TICKET_CONFIG.generateTicketHTML(pedido, precios, modo);
  
  res.setHeader('Content-Type', 'text/html');
  res.send(ticketHTML);
});
```

---

## Estructura de Datos

### Objeto Pedido

```javascript
{
  // Identificación
  tableNumber: '5',              // Mesa (alternativa: clientName)
  clientName: 'Juan Pérez',      // Cliente en barra

  // Datos del establecimiento
  establishmentName: 'Club Bochas',
  address: 'Calle Principal 123',
  phone: '+54 9 11 1234567',
  email: 'info@club.com',
  footer: 'Gracias por su visita',

  // Items
  pizzaLibreH: 0,                // Cantidad pizza libre hombres
  pizzaLibreM: 0,                // Cantidad pizza libre mujeres
  menores: 0,                    // Cantidad menores
  menorPrice: 0,                 // Precio especial del menor
  menu: 0,                       // Cantidad menú
  empanadas: 0,                  // Cantidad empanadas
  postres: 0,                    // Cantidad postres

  // Pizzas personalizadas
  pizzasPersonalizadas: [
    {
      size: 'Entera',            // o 'Media'
      toppings: ['Muzzarella', 'Jamón']
    }
  ],

  // Bebidas
  beverages: [
    { name: 'Coca Cola', quantity: 2 },
    { name: 'Agua', quantity: 1 }
  ]
}
```

### Objeto Precios

```javascript
{
  // Pizza libre
  pizzaLibreH: 450,              // Precio hombres
  pizzaLibreM: 350,              // Precio mujeres

  // Menú por día
  precioMenuMiercoles: 200,
  precioMenuViernes: 220,
  precioMenuSabado: 250,
  precioMenuDomingo: 280,

  // Productos individuales
  empanada: 25,
  precioPostre: 80,

  // Pizzas personalizadas
  pizzasPersonalizadas: {
    preciosEntera: {
      'Muzzarella': 200,
      'Jamón': 150,
      'Piña': 50
    },
    preciosMedia: {
      'Muzzarella': 120,
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
}
```

---

## API del TICKET_CONFIG

### Métodos Principales

#### `generateTicketHTML(data, prices, mode)`
Genera el HTML completo del ticket para impresión.

**Parámetros:**
- `data` (Object): Datos del pedido
- `prices` (Object): Precios configurados
- `mode` (String): Día de la semana ('miercoles', 'viernes', 'sabado', 'domingo')

**Retorna:** HTML string

**Ejemplo:**
```javascript
const html = TICKET_CONFIG.generateTicketHTML(pedido, precios, 'sabado');
```

---

#### `calculateTotal(data, prices, mode)`
Calcula el total del ticket.

**Parámetros:**
- `data` (Object): Datos del pedido
- `prices` (Object): Precios configurados
- `mode` (String): Día de la semana

**Retorna:** Number (total en dinero)

**Ejemplo:**
```javascript
const total = TICKET_CONFIG.calculateTotal(pedido, precios, 'sabado');
console.log(`Total: $${total.toFixed(2)}`);
```

---

#### `calculatePizzaPrice(pizza, prices)`
Calcula el precio de una pizza personalizada.

**Parámetros:**
- `pizza` (Object): { size: 'Entera'|'Media', toppings: [...] }
- `prices` (Object): Precios configurados

**Retorna:** Number

**Ejemplo:**
```javascript
const pizza = { size: 'Entera', toppings: ['Muzzarella', 'Jamón'] };
const precio = TICKET_CONFIG.calculatePizzaPrice(pizza, precios);
```

---

### Utilidades

#### `utils.escapeHtml(text)`
Escapa caracteres especiales para HTML.

#### `utils.formatCurrency(amount)`
Formatea un número como moneda.

**Ejemplo:**
```javascript
TICKET_CONFIG.utils.formatCurrency(450);  // "$ 450.00"
```

#### `utils.generateLine(label, amount)`
Genera una línea del ticket.

---

## Integración en tu Sistema Actual

### Paso 1: Incluir el módulo

En tu `index.html`, añade:

```html
<script src="ticket-config.js"></script>
```

### Paso 2: Usar en tu función de impresión

Busca tu función actual de generación de tickets (alrededor de la línea 1470) y reemplázala:

```javascript
// ANTES: Código duplicado
// let bodyHtml = '...'; // Todo el HTML está aquí

// DESPUÉS: Usa el módulo
const ticketHTML = TICKET_CONFIG.generateTicketHTML(
  {
    establishmentName: genericData.establishmentName,
    address: genericData.address,
    phone: genericData.phone,
    email: genericData.email,
    footer: genericData.footer,
    tableNumber: activeEntity.id.startsWith('table-') ? activeEntity.number : undefined,
    clientName: !activeEntity.id.startsWith('table-') ? activeEntity.clientName : undefined,
    ...activeEntity.order
  },
  prices,
  currentMode
);

// Imprimir
const w = window.open('', '_blank');
w.document.write(ticketHTML);
w.document.close();
w.print();
```

---

## Cambiar Estilos de Impresión

Los estilos CSS están en `TICKET_CONFIG.styles.print`:

```javascript
TICKET_CONFIG.styles.print = `
  /* Tus estilos aquí */
  .line {
    font-size: 14px;  // Cambiar tamaño
    /* ... */
  }
`;
```

---

## Usar en Otro Sistema

### Opción 1: Copiar `ticket-config.js`

1. Copia `ticket-config.js` a tu nuevo proyecto
2. Incluye o requiere el módulo
3. Usa las funciones según tus necesidades

### Opción 2: Crear un Servicio

```javascript
// ticketService.js
import TICKET_CONFIG from './ticket-config';

export const generateTicketPreview = (pedido, precios, modo) => {
  return TICKET_CONFIG.generateTicketHTML(pedido, precios, modo);
};

export const printTicket = (pedido, precios, modo) => {
  const html = TICKET_CONFIG.generateTicketHTML(pedido, precios, modo);
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.print();
};

export const calculateTicketTotal = (pedido, precios, modo) => {
  return TICKET_CONFIG.calculateTotal(pedido, precios, modo);
};
```

### Opción 3: API Backend

```javascript
// Guardar ticket-config.js en el servidor
const TICKET_CONFIG = require('./ticket-config');

app.post('/api/generate-ticket', (req, res) => {
  const html = TICKET_CONFIG.generateTicketHTML(
    req.body.pedido,
    req.body.precios,
    req.body.modo
  );
  res.json({ html });
});
```

---

## Dimensiones de Impresión

El ticket está configurado para:
- **Ancho:** 58mm (estándar de impresoras térmicas)
- **Alto:** 200mm (ajustable según necesidad)
- **Margen:** 3mm

Para cambiar, edita en `ticket-config.js`:

```javascript
dimensions: {
  width: '58mm',     // Ancho
  height: '200mm',   // Alto
  margin: '3mm'      // Margen
}
```

---

## Agregar Nuevos Productos

En `TICKET_CONFIG.structure.products`, agrega tu nuevo producto:

```javascript
bebidaCopa: {
  precioPorUnidad: 0,
  mostrarEnTicket: true
}
```

Luego, en `generateTicketHTML()`, agrega la lógica para incluirlo.

---

## Sincronizar Entre Sistemas

### Opción 1: JSON Compartido

Guarda los precios en `precios.json`:

```json
{
  "pizzaLibreH": 450,
  "pizzaLibreM": 350,
  "empanada": 25,
  "beverages": [...]
}
```

Cárgalo en ambos sistemas:

```javascript
fetch('precios.json')
  .then(r => r.json())
  .then(precios => {
    console.log(precios);
  });
```

### Opción 2: API Central

Todos los sistemas obtienen precios de un API central:

```javascript
const obtenerPrecios = async () => {
  const res = await fetch('https://tu-api.com/precios');
  return res.json();
};
```

---

## Troubleshooting

**❌ Problema:** El ticket no imprime en formato correcto
**✅ Solución:** Verifica que el navegador tenga margen de página en 0

**❌ Problema:** Los precios no coinciden
**✅ Solución:** Verifica que `prices.beverages` esté correctamente configurado

**❌ Problema:** Falta información en el ticket
**✅ Solución:** Revisa que todos los campos del `data` estén presentes

---

## Licencia y Notas

Este módulo es parte del **Sistema de Gestión para Mozos**. Puedes usarlo, modificarlo y compartirlo libremente.

---

## Contacto y Soporte

Para dudas sobre implementación, consulta `ticket-config-EJEMPLO.js` para ver más casos de uso.

