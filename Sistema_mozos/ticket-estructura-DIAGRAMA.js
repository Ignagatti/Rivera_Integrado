/**
 * ESTRUCTURA VISUAL DEL TICKET
 * Diagrama y componentes del ticket impreso (58mm x 200mm aprox.)
 */

/*
╔════════════════════════════════════════╗
║                                        ║
║    CLUB BOCHAS                         ║ <- Header (Establishment Info)
║    Calle Principal 123                 ║
║    Tel: +54 9 11 1234567               ║
║    Email: info@club.com                ║
║                                        ║
╠════════════════════════════════════════╣
║                                        ║
║    MESA 5                              ║ <- Identificador (Table/Order)
║                                        ║
╠════════════════════════════════════════╣
║                                        ║
║ 2 x Pizza Libre Hombres    $ 900.00   ║
║ 1 x Pizza Libre Mujeres    $ 350.00   ║
║ 3 x Empanada               $  75.00   ║
║ 1 x Postre                 $  80.00   ║
║ 1 x Pizza Entera            $ 400.00   ║
║   (Muzzarella, Jamón, Piña)            ║
║ 2 x Coca Cola              $ 100.00   ║
║ 1 x Agua                   $  20.00   ║
║                                        ║ <- Items (Products)
║ 1 x Menú                   $ 250.00   ║
║                                        ║
╠════════════════════════════════════════╣
║                                        ║
║    TOTAL    $ 2,175.00                 ║ <- Total
║                                        ║
╠════════════════════════════════════════╣
║                                        ║
║  Gracias por su visita                 ║ <- Footer (Message)
║                                        ║
╚════════════════════════════════════════╝

*/

// ============================================
// COMPONENTES DEL TICKET
// ============================================

const TICKET_COMPONENTS = {
  
  // 1. HEADER - Información del establecimiento
  HEADER: {
    name: "establishmentName",
    fields: [
      "establishmentName",      // Nombre del establecimiento
      "address",                // Dirección
      "phone",                  // Teléfono
      "email"                   // Email
    ],
    styles: {
      maxWidth: "58mm",
      textAlign: "center",
      borderBottom: "1px dashed",
      padding: "6px"
    }
  },

  // 2. TITLE - Mesa o Pedido
  TITLE: {
    name: "identificador",
    types: [
      {
        condition: "tableNumber",
        format: "MESA {number}",
        example: "MESA 5"
      },
      {
        condition: "clientName",
        format: "PEDIDO: {name}",
        example: "PEDIDO: Juan Pérez"
      }
    ],
    styles: {
      textAlign: "center",
      fontWeight: "700",
      fontSize: "14px",
      margin: "6px 0"
    }
  },

  // 3. ITEMS - Productos del pedido
  ITEMS: {
    name: "itemsSection",
    categories: [
      {
        name: "pizzaLibre",
        items: [
          {
            field: "pizzaLibreH",
            label: "{qty} x Pizza Libre Hombres",
            priceField: "pizzaLibreH"
          },
          {
            field: "pizzaLibreM",
            label: "{qty} x Pizza Libre Mujeres",
            priceField: "pizzaLibreM"
          }
        ]
      },
      {
        name: "menores",
        items: [
          {
            field: "menores",
            label: "{qty} x Menor",
            priceField: "menorPrice"  // Variable por orden
          }
        ]
      },
      {
        name: "menu",
        items: [
          {
            field: "menu",
            label: "{qty} x Menú",
            priceField: "precioMenu{MODE}"  // Varía por día
          }
        ]
      },
      {
        name: "empanadas",
        items: [
          {
            field: "empanadas",
            label: "{qty} x Empanada",
            priceField: "empanada"
          }
        ]
      },
      {
        name: "postres",
        items: [
          {
            field: "postres",
            label: "{qty} x Postre",
            priceField: "precioPostre"
          }
        ]
      },
      {
        name: "pizzasPersonalizadas",
        items: [
          {
            field: "pizzasPersonalizadas",
            label: "1 x Pizza {size} ({toppings})",
            dynamic: true  // Se calcula según toppings
          }
        ]
      },
      {
        name: "beverages",
        items: [
          {
            field: "beverages",
            label: "{qty} x {name}",
            dynamic: true  // Se busca en prices.beverages
          }
        ]
      }
    ],
    itemFormat: {
      layout: "flex",
      justifyContent: "space-between",
      fontSize: "12px",
      margin: "4px 0",
      lineHeight: "1.1",
      amount: {
        width: "74px",
        textAlign: "right",
        format: "$ {amount}"
      }
    }
  },

  // 4. TOTAL - Suma total
  TOTAL: {
    name: "totalSection",
    calculation: "suma de todos los items",
    format: {
      layout: "flex",
      justifyContent: "space-between",
      fontWeight: "800",
      fontSize: "18px",
      borderTop: "1px dashed",
      padding: "8px 0"
    },
    display: {
      label: "TOTAL",
      amount: "$ {total}"
    }
  },

  // 5. FOOTER - Mensaje de cierre
  FOOTER: {
    name: "footerSection",
    fields: ["footer"],
    optional: true,
    styles: {
      textAlign: "center",
      fontSize: "10px",
      marginTop: "8px",
      padding: "8px 0",
      borderTop: "1px dashed"
    }
  }
};

// ============================================
// FLUJO DE GENERACIÓN DE TICKET
// ============================================

const TICKET_GENERATION_FLOW = `
1. Datos Entrada
   ├─ Pedido (items, cantidad, cliente)
   ├─ Precios (configurados en el sistema)
   └─ Modo (día de la semana)

2. Validación
   ├─ Verificar datos requeridos
   ├─ Calcular totales parciales
   └─ Validar que todo esté presente

3. Generación HTML
   ├─ Crear Header (establecimiento)
   ├─ Crear Title (mesa/pedido)
   ├─ Iterar Items
   │  ├─ Para cada categoría de producto
   │  ├─ Si cantidad > 0
   │  └─ Generar línea HTML
   ├─ Calcular Total
   ├─ Crear línea de Total
   └─ Agregar Footer

4. Estilos CSS
   ├─ Aplicar estilos de impresión
   ├─ Configurar página (58mm x 200mm)
   ├─ Ajustar márgenes
   └─ Asegurar escalado correcto

5. Envío a Impresora
   ├─ Abrir ventana emergente
   ├─ Escribir HTML en ventana
   ├─ Llamar a print()
   └─ Cerrar ventana
`;

// ============================================
// MAPEADO DE PRECIOS
// ============================================

const PRICE_MAPPING = {
  "Pizza Libre Hombres": {
    qty: "pizzaLibreH",
    price: "prices.pizzaLibreH",
    calculation: "qty * price"
  },
  "Pizza Libre Mujeres": {
    qty: "pizzaLibreM",
    price: "prices.pizzaLibreM",
    calculation: "qty * price"
  },
  "Menores": {
    qty: "menores",
    price: "order.menorPrice",  // Variable por orden
    calculation: "qty * price"
  },
  "Menú": {
    qty: "menu",
    price: "prices['precioMenu' + MODE]",  // Depende del día
    calculation: "qty * price"
  },
  "Empanada": {
    qty: "empanadas",
    price: "prices.empanada",
    calculation: "qty * price"
  },
  "Postre": {
    qty: "postres",
    price: "prices.precioPostre",
    calculation: "qty * price"
  },
  "Pizza Personalizada": {
    size: "size",  // 'Entera' o 'Media'
    toppings: "toppings[]",
    price: "prices.pizzasPersonalizadas[size][topping]",
    calculation: "sum de cada topping"
  },
  "Bebida": {
    qty: "quantity",
    name: "name",
    price: "find en prices.beverages",
    calculation: "qty * price"
  }
};

// ============================================
// VARIANTES POR DÍA
// ============================================

const DAY_VARIANTS = {
  "MIÉRCOLES": {
    mode: "miercoles",
    products: ["menu", "empanadas", "postres", "beverages"],
    excludeProducts: ["pizzaLibre", "pizzasPersonalizadas"],
    menuPrice: "prices.precioMenuMiercoles"
  },
  "VIERNES": {
    mode: "viernes",
    products: ["menu", "empanadas", "postres", "beverages"],
    excludeProducts: ["pizzaLibre", "pizzasPersonalizadas"],
    menuPrice: "prices.precioMenuViernes"
  },
  "SÁBADO": {
    mode: "sabado",
    products: ["pizzaLibre", "menu", "empanadas", "postres", "pizzasPersonalizadas", "beverages"],
    menuPrice: "prices.precioMenuSabado"
  },
  "DOMINGO": {
    mode: "domingo",
    products: ["pizzaLibre", "menu", "empanadas", "postres", "beverages"],
    excludeProducts: ["pizzasPersonalizadas"],
    menuPrice: "prices.precioMenuDomingo"
  }
};

// ============================================
// EJEMPLOS DE TICKETS GENERADOS
// ============================================

const TICKET_EXAMPLES = {
  "Pizza Libre": {
    establishments: "Club Bochas",
    tableNumber: "5",
    items: {
      pizzaLibreH: 2,
      pizzaLibreM: 1
    },
    beverages: [
      { name: "Coca Cola", quantity: 2 }
    ],
    mode: "sabado",
    expectedTotal: "Pizzas + Bebidas"
  },

  "Menú": {
    establishments: "Club Bochas",
    tableNumber: "3",
    items: {
      menu: 4,
      postres: 2
    },
    beverages: [
      { name: "Agua", quantity: 4 }
    ],
    mode: "miercoles",
    expectedTotal: "(4 * precioMenuMiercoles) + (2 * precioPostre) + (4 * 20)"
  },

  "Pizza Personalizada": {
    establishments: "Club Bochas",
    tableNumber: "7",
    items: {
      pizzasPersonalizadas: [
        {
          size: "Entera",
          toppings: ["Muzzarella", "Jamón", "Piña"]
        }
      ]
    },
    mode: "sabado",
    expectedTotal: "suma de toppings"
  },

  "Pedido en Barra": {
    establishments: "Club Bochas",
    clientName: "Juan Pérez",
    items: {
      empanadas: 6
    },
    beverages: [
      { name: "Cerveza Quilmes", quantity: 3 },
      { name: "Vino Tinto", quantity: 1 }
    ],
    mode: "sabado",
    expectedTotal: "(6 * 25) + (3 * 120) + (1 * 150)"
  }
};

// ============================================
// CHECKLIST PARA VALIDAR TICKET
// ============================================

const TICKET_VALIDATION_CHECKLIST = `
✅ Header (Establecimiento)
   □ Nombre del establecimiento visible
   □ Dirección correcta
   □ Teléfono correcto
   □ Email visible

✅ Título
   □ Número de mesa OR nombre del cliente
   □ Formateado correctamente

✅ Items
   □ Todas las categorías de productos presentes
   □ Las cantidades coinciden con el pedido
   □ Los precios unitarios son correctos
   □ La descripción es clara

✅ Cálculos
   □ Cada subtotal es correcto (qty * price)
   □ El total es la suma de subtotales
   □ No hay items duplicados

✅ Formato
   □ Ancho 58mm (estándar térmica)
   □ Márgenes correctos
   □ Fuente legible
   □ Espacios adecuados

✅ Impresión
   □ Se alinea bien en el papel
   □ No se corta ningún texto
   □ Códigos especiales se ven correctamente
   □ Símbolos de dinero ($) claros

✅ Datos Genéricos
   □ Footer mensaje visible (si lo hay)
   □ Información de contacto completa
   □ Nombre del club/negocio correcto
`;

// ============================================
// EXPORTAR INFORMACIÓN
// ============================================

console.log('📋 ESTRUCTURA DE TICKET');
console.log(TICKET_COMPONENTS);
console.log('\\n🔄 FLUJO DE GENERACIÓN');
console.log(TICKET_GENERATION_FLOW);
console.log('\\n💰 MAPEADO DE PRECIOS');
console.log(PRICE_MAPPING);
console.log('\\n📅 VARIANTES POR DÍA');
console.log(DAY_VARIANTS);
console.log('\\n✅ CHECKLIST DE VALIDACIÓN');
console.log(TICKET_VALIDATION_CHECKLIST);
