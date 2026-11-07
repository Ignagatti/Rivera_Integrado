/**
 * GUÍA VISUAL RÁPIDA - TICKET CONFIG
 * 
 * Imprime este documento o guárdalo como referencia
 */

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                    🎫 CONFIGURACIÓN DE TICKET - GUÍA RÁPIDA                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📦 ARCHIVOS CREADOS (4 NUEVOS)                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ⭐ ticket-config.js                                                         │
│    └─ El módulo principal (reutilizable)                                    │
│       • Generar tickets HTML                                                │
│       • Calcular totales                                                    │
│       • Formatear datos                                                     │
│       • Aplicar estilos                                                     │
│                                                                              │
│ 📖 TICKET-README.md                                                         │
│    └─ Documentación completa                                                │
│       • Guía de uso rápido                                                  │
│       • API completa                                                        │
│       • Integración paso a paso                                             │
│       • Troubleshooting                                                     │
│                                                                              │
│ 🎨 ticket-estructura-DIAGRAMA.js                                            │
│    └─ Diagramas visuales                                                    │
│       • Estructura del ticket                                               │
│       • Componentes                                                         │
│       • Flujos                                                              │
│       • Checklist                                                           │
│                                                                              │
│ 📋 ticket-config-EJEMPLO.js                                                 │
│    └─ Ejemplos listos para copiar                                           │
│       • HTML puro                                                           │
│       • React                                                               │
│       • Node.js / Express                                                   │
│       • Vue                                                                 │
│                                                                              │
│ 🗂️ TICKET-INDICE.md                                                         │
│    └─ Este índice y referencia rápida                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚀 EMPEZAR EN 3 PASOS                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Paso 1: Incluir ticket-config.js                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                             │
│   <script src="ticket-config.js"></script>                                  │
│                                                                              │
│                                                                              │
│ Paso 2: Preparar datos                                                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━                                                    │
│   const pedido = {                                                          │
│     tableNumber: '5',                                                       │
│     pizzaLibreH: 2,                                                         │
│     beverages: [{ name: 'Coca', quantity: 1 }]                              │
│   };                                                                         │
│   const precios = {                                                         │
│     pizzaLibreH: 450,                                                       │
│     beverages: [{ name: 'Coca', price: 50 }]                                │
│   };                                                                         │
│                                                                              │
│                                                                              │
│ Paso 3: Generar y imprimir                                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                                 │
│   const html = TICKET_CONFIG.generateTicketHTML(                            │
│     pedido, precios, 'sabado'                                               │
│   );                                                                         │
│   const w = window.open('', '_blank');                                      │
│   w.document.write(html);                                                   │
│   w.document.close();                                                       │
│   w.print();                                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📊 ESTRUCTURA DE DATOS                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ PEDIDO                          PRECIOS                                      │
│ ─────────────────────────────   ──────────────────────────────────          │
│ tableNumber: '5'                pizzaLibreH: 450                            │
│ pizzaLibreH: 2                  pizzaLibreM: 350                            │
│ pizzaLibreM: 1                  empanada: 25                                │
│ menores: 0                      precioPostre: 80                            │
│ menu: 1                         precioMenuMiercoles: 200                    │
│ empanadas: 3                    precioMenuSabado: 250                       │
│ postres: 1                      beverages: [{                               │
│ beverages: [{                     name: 'Coca Cola',                        │
│   name: 'Coca Cola',              price: 50,                                │
│   quantity: 2                      category: 'gaseosa'                      │
│ }]                              }]                                          │
│ pizzasPersonalizadas: [{        pizzasPersonalizadas: {                     │
│   size: 'Entera',                 preciosEntera: {                          │
│   toppings: ['Jamón', 'Piña']      'Jamón': 150,                            │
│ }]                                'Piña': 50                                │
│ establishmentName: 'Club'        }                                          │
│ address: 'Calle 123'            }                                          │
│ phone: '+54...'                                                             │
│ email: 'info@club.com'                                                      │
│ footer: 'Gracias...'                                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚙️ API RÁPIDA                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ generateTicketHTML(data, prices, mode)                                      │
│ ├─ Retorna: HTML string del ticket                                          │
│ ├─ data: Datos del pedido                                                   │
│ ├─ prices: Precios configurados                                             │
│ └─ mode: 'miercoles'|'viernes'|'sabado'|'domingo'                           │
│                                                                              │
│ calculateTotal(data, prices, mode)                                          │
│ ├─ Retorna: Number (total)                                                  │
│ └─ Mismo parámetros que generateTicketHTML                                  │
│                                                                              │
│ calculatePizzaPrice(pizza, prices)                                          │
│ ├─ Retorna: Number (precio pizza personalizada)                             │
│ ├─ pizza: { size, toppings }                                                │
│ └─ prices: Precios configurados                                             │
│                                                                              │
│ utils.escapeHtml(text)           → Escapa caracteres HTML                   │
│ utils.formatCurrency(amount)     → Formatea como dinero                     │
│ utils.generateLine(label, amt)   → Crea línea del ticket                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔄 CASOS DE USO                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ✅ Imprimir ticket en navegador                                             │
│    → Ver TICKET-README.md > "Uso Rápido"                                    │
│                                                                              │
│ ✅ Usar en otro proyecto web                                                │
│    → Ver TICKET-README.md > "Usar en Otro Sistema"                          │
│                                                                              │
│ ✅ Crear servicio para React                                                │
│    → Ver ticket-config-EJEMPLO.js > "EN UN COMPONENTE REACT"                │
│                                                                              │
│ ✅ API backend en Node.js                                                   │
│    → Ver ticket-config-EJEMPLO.js > "EN NODE.JS / EXPRESS"                  │
│                                                                              │
│ ✅ Cambiar estilos de impresión                                             │
│    → Ver TICKET-README.md > "Cambiar Estilos de Impresión"                  │
│                                                                              │
│ ✅ Agregar nuevo producto                                                   │
│    → Ver TICKET-README.md > "Agregar Nuevos Productos"                      │
│                                                                              │
│ ✅ Sincronizar entre múltiples sistemas                                     │
│    → Ver TICKET-README.md > "Sincronizar Entre Sistemas"                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📍 MODOS (Días de la Semana)                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 'miercoles'  → Solo menú, empanadas, postres, bebidas                       │
│ 'viernes'    → Solo menú, empanadas, postres, bebidas                       │
│ 'sabado'     → Todo: pizza libre, menú, empanadas, pizzas pers., bebidas    │
│ 'domingo'    → Pizza libre, menú, empanadas, postres, bebidas               │
│                                                                              │
│ Los precios del menú varían según el día                                    │
│ Las pizzas personalizadas solo están disponibles en sábado                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🎨 DIMENSIONES & ESTILOS                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ Tamaño del ticket:    58mm × 200mm (aprox)                                  │
│ Margen de página:     3mm en todos lados                                    │
│ Fuente:               Inter, Arial, sans-serif                              │
│ Tipo de impresora:    Térmica (estándar)                                    │
│ Soporte:              Todos los navegadores modernos                        │
│                                                                              │
│ Para cambiar:                                                               │
│ • Abre ticket-config.js                                                    │
│ • Modifica TICKET_CONFIG.dimensions                                         │
│ • Modifica TICKET_CONFIG.styles.print                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ ✅ CHECKLIST DE VALIDACIÓN                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ □ El archivo ticket-config.js está incluido                                 │
│ □ Los datos del pedido tienen el formato correcto                           │
│ □ Los datos de precios tienen el formato correcto                           │
│ □ Se pasan los 3 parámetros: (data, prices, mode)                          │
│ □ El ticket se genera sin errores en consola                                │
│ □ Se imprime el tamaño correcto (58mm ancho)                                │
│ □ Todos los items aparecen con cantidad y precio                            │
│ □ El total es correcto (suma de subtotales)                                 │
│ □ La información del establecimiento es correcta                            │
│ □ El número de mesa o nombre del cliente aparece                            │
│ □ La función de impresión abre ventana emergente                            │
│ □ El navegador permite ventanas emergentes                                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🆘 TROUBLESHOOTING RÁPIDO                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ❌ "TICKET_CONFIG no está definido"                                         │
│    → Verifica que incluiste <script src="ticket-config.js"></script>        │
│                                                                              │
│ ❌ No aparece el ticket o se ve mal                                         │
│    → Abre consola (F12) y busca errores                                     │
│    → Verifica que data y prices sean objetos válidos                        │
│                                                                              │
│ ❌ Los precios no coinciden                                                 │
│    → Verifica que prices.beverages tenga todos los productos                │
│    → Verifica que mode sea uno de: miercoles, viernes, sabado, domingo      │
│                                                                              │
│ ❌ No se abre la ventana de impresión                                       │
│    → Verifica que no haya popup blocker activo                              │
│    → Usa el siguiente en la consola: window.open('', '_blank')              │
│                                                                              │
│ ❌ Se imprime en tamaño incorrecto                                          │
│    → En impresora → Propiedades → Márgenes → 0mm todos lados                │
│    → En impresora → Escala → Sin escala (100%)                              │
│                                                                              │
│ ❌ Faltan items en el ticket                                                │
│    → Verifica que el objeto data tenga todos los campos necesarios          │
│    → Compara con el ejemplo en TICKET-README.md                             │
│                                                                              │
│ Para más: Ver TICKET-README.md > "Troubleshooting"                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 📚 DÓNDE ENCONTRAR TODO                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ PREGUNTA                          → VE A:                                    │
│ ─────────────────────────────────────────────────────────────────────────   │
│ ¿Cómo lo uso?                     → TICKET-README.md (inicio)               │
│ ¿Qué métodos hay?                 → TICKET-README.md (API)                  │
│ Necesito un ejemplo               → ticket-config-EJEMPLO.js                 │
│ ¿Cómo integro en React?           → ticket-config-EJEMPLO.js + TICKET-README │
│ ¿Cómo integro en Node.js?         → ticket-config-EJEMPLO.js + TICKET-README │
│ ¿Cómo se ve el ticket?            → ticket-estructura-DIAGRAMA.js           │
│ ¿Cuál es la estructura?           → ticket-estructura-DIAGRAMA.js           │
│ Tengo un error                    → TICKET-README.md (Troubleshooting)      │
│ Quiero cambiar estilos            → TICKET-README.md (Cambiar Estilos)      │
│ Quiero agregar producto           → TICKET-README.md (Agregar Productos)    │
│ Quiero usar en otro proyecto      → TICKET-README.md (Usar en Otro Sistema) │
│ Necesito referencia rápida        → Este archivo (TICKET-GUIA-VISUAL.js)    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 💡 TIPS PRO                                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ • Versioná ticket-config.js en Git → reutiliza en múltiples proyectos      │
│ • Crea ticket-config-custom.js → para tus extensiones personalizadas       │
│ • Usa localStorage → para guardar últimos precios usados                    │
│ • Integra con WhatsApp → para enviar ticket por chat                       │
│ • Crea PDF → usar puppeteer o similar en backend                           │
│ • Testea en navegador → "Guardar como PDF" antes de imprimir               │
│ • Mantén sincronizado → si cambias en un proyecto, actualiza en todos      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║                          ✅ LISTO PARA USAR 🚀                              ║
║                                                                              ║
║ Todos los archivos están en tu carpeta del proyecto                         ║
║ Comienza con TICKET-README.md para entender todo                            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

`);
