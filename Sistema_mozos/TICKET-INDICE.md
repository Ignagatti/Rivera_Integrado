# 🎫 ARCHIVOS DE CONFIGURACIÓN DE TICKET - ÍNDICE

Este documento guía rápida sobre los archivos creados para extraer y reutilizar la configuración de tickets.

---

## 📦 Archivos Creados

### 1️⃣ **ticket-config.js** ⭐ (Principal)
**Archivo:** `ticket-config.js`  
**Tamaño:** ~6KB  
**Tipo:** Módulo JavaScript reutilizable

**¿Qué contiene?**
- Toda la lógica de generación de tickets
- Estructura de datos completa
- Estilos CSS para impresión
- Funciones de cálculo y utilidad
- Generador HTML automatizado

**¿Cómo usarlo?**
```javascript
// En navegador
<script src="ticket-config.js"></script>

// En Node.js
const TICKET_CONFIG = require('./ticket-config');
```

**Métodos principales:**
- `generateTicketHTML(data, prices, mode)` - Genera HTML del ticket
- `calculateTotal(data, prices, mode)` - Calcula el total
- `calculatePizzaPrice(pizza, prices)` - Calcula precio pizza
- `utils.escapeHtml(text)` - Escapa caracteres HTML
- `utils.formatCurrency(amount)` - Formatea dinero

---

### 2️⃣ **ticket-config-EJEMPLO.js**
**Archivo:** `ticket-config-EJEMPLO.js`  
**Tamaño:** ~10KB  
**Tipo:** Ejemplos y documentación

**¿Qué contiene?**
- ✅ Ejemplo en HTML + JavaScript
- ✅ Ejemplo en Node.js / Express
- ✅ Ejemplo en React
- ✅ Estructura de datos del pedido
- ✅ Estructura de precios
- ✅ Integración con IndexedDB
- ✅ Casos de uso reales

**Copia cualquier ejemplo y adapta a tu necesidad.**

---

### 3️⃣ **TICKET-README.md** 📖 (Documentación)
**Archivo:** `TICKET-README.md`  
**Tamaño:** ~15KB  
**Tipo:** Documentación completa

**¿Qué contiene?**
- 📋 Descripción general
- 🚀 Uso rápido (copy-paste)
- 📊 Estructura de datos completa
- 🔧 API completa documentada
- 🔄 Integración paso a paso
- 🎯 Cómo usar en otro sistema
- 🎨 Cómo cambiar estilos
- 📏 Dimensiones de impresión
- 🆕 Cómo agregar productos
- ❌ Troubleshooting (solución de problemas)

**Léelo si:**
- Quieres entender cómo funciona todo
- Necesitas integrar en otro proyecto
- Quieres personalizar los estilos
- Tienes dudas sobre la API

---

### 4️⃣ **ticket-estructura-DIAGRAMA.js**
**Archivo:** `ticket-estructura-DIAGRAMA.js`  
**Tamaño:** ~8KB  
**Tipo:** Diagramas y estructura visual

**¿Qué contiene?**
- 🎨 Diagrama ASCII del ticket
- 🧩 Desglose de cada componente
- 🔄 Flujo de generación
- 💰 Mapeado de precios
- 📅 Variantes por día de semana
- 📋 Ejemplos de tickets generados
- ✅ Checklist de validación

**Usa este archivo si:**
- Quieres visualizar cómo se ve el ticket
- Necesitas entender la estructura
- Quieres validar un ticket generado
- Quieres agregar nuevos componentes

---

## 🎯 Flujo de Uso Rápido

### Opción A: "Solo quiero ver cómo funciona"
1. Lee el diagrama ASCII en `ticket-estructura-DIAGRAMA.js` (primeras líneas)
2. Mira los ejemplos en `ticket-config-EJEMPLO.js`
3. ✅ Listo, entiendes cómo funciona

### Opción B: "Quiero usar esto en mi sistema actual"
1. Lee "Integración en tu Sistema Actual" en `TICKET-README.md`
2. Copia `ticket-config.js` a tu proyecto
3. Reemplaza tu código actual con 2-3 líneas usando `TICKET_CONFIG.generateTicketHTML()`
4. ✅ Listo, optimizaste tu código

### Opción C: "Quiero usar esto en otro proyecto"
1. Copia `ticket-config.js` a tu nuevo proyecto
2. Sigue los ejemplos en `ticket-config-EJEMPLO.js` para tu framework
3. Adapta `ticket-config.js` si necesitas diferentes productos
4. ✅ Listo, tienes tickets reutilizables

### Opción D: "Necesito agregar nuevos productos"
1. Lee "Agregar Nuevos Productos" en `TICKET-README.md`
2. Modifica `ticket-config.js` > `structure.products`
3. Agrega lógica en `generateTicketHTML()`
4. ✅ Listo, tienes tus productos personalizados

---

## 📊 Estructura de Datos de Referencia Rápida

### Pedido (Mínimo)
```javascript
{
  tableNumber: '5',
  pizzaLibreH: 2,
  pizzaLibreM: 1,
  empanadas: 3,
  beverages: [{ name: 'Coca Cola', quantity: 2 }]
}
```

### Precios (Mínimo)
```javascript
{
  pizzaLibreH: 450,
  pizzaLibreM: 350,
  empanada: 25,
  beverages: [{ name: 'Coca Cola', price: 50, category: 'gaseosa' }]
}
```

### Generación (1 línea)
```javascript
const html = TICKET_CONFIG.generateTicketHTML(pedido, precios, 'sabado');
```

---

## 🔍 Buscador Rápido

| Necesito... | Busca aquí... |
|---|---|
| Ver cómo se ve un ticket | `ticket-estructura-DIAGRAMA.js` (primeras líneas) |
| Entender la estructura | `ticket-estructura-DIAGRAMA.js` |
| Copiar un ejemplo | `ticket-config-EJEMPLO.js` |
| Documentación completa | `TICKET-README.md` |
| API de funciones | `ticket-config.js` + `TICKET-README.md` |
| Integrar en mi proyecto | `TICKET-README.md` > "Integración" |
| Usar en otro proyecto | `TICKET-README.md` > "Usar en Otro Sistema" |
| Cambiar estilos de impresión | `TICKET-README.md` > "Cambiar Estilos" |
| Agregar producto nuevo | `TICKET-README.md` > "Agregar Nuevos Productos" |
| Validar un ticket | `ticket-estructura-DIAGRAMA.js` > Checklist |
| Solucionar problema | `TICKET-README.md` > Troubleshooting |

---

## 🚀 Caso de Uso: Usar en React

```javascript
// 1. Importa
import TICKET_CONFIG from './ticket-config';

// 2. En tu componente
function TicketPrinter({ pedido, precios, modo }) {
  const handlePrint = () => {
    const html = TICKET_CONFIG.generateTicketHTML(pedido, precios, modo);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return <button onClick={handlePrint}>Imprimir Ticket</button>;
}
```

---

## 🚀 Caso de Uso: Usar en Express

```javascript
// 1. Requiere
const TICKET_CONFIG = require('./ticket-config');

// 2. Crea ruta
app.post('/api/ticket', (req, res) => {
  const html = TICKET_CONFIG.generateTicketHTML(
    req.body.pedido,
    req.body.precios,
    req.body.modo
  );
  res.send(html);
});
```

---

## 🚀 Caso de Uso: Usar en Vue

```vue
<template>
  <button @click="imprimirTicket">Imprimir</button>
</template>

<script>
import TICKET_CONFIG from './ticket-config';

export default {
  methods: {
    imprimirTicket() {
      const html = TICKET_CONFIG.generateTicketHTML(
        this.pedido,
        this.precios,
        this.modo
      );
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }
}
</script>
```

---

## 📏 Especificaciones Técnicas

| Propiedad | Valor |
|---|---|
| Ancho del ticket | 58mm |
| Alto aproximado | 200mm |
| Margen | 3mm |
| Font-family | Inter, Arial, sans-serif |
| Formato de impresión | Térmico (estándar) |
| Formato de salida | HTML5 |
| Compatibilidad | Todos los navegadores modernos |

---

## ✅ Checklist de Integración

- [ ] Copié `ticket-config.js` a mi proyecto
- [ ] Incluí o requerí el módulo
- [ ] Adapté mis datos de pedido al formato esperado
- [ ] Adapté mis datos de precios al formato esperado
- [ ] Generé un ticket de prueba
- [ ] El ticket se imprime correctamente
- [ ] Los cálculos son correctos
- [ ] El formato se ve bien en mi impresora

---

## 💡 Consejos Útiles

1. **Guardar en Repositorio:** Versioná `ticket-config.js` en Git para usar en múltiples proyectos

2. **Sincronizar Cambios:** Si actualizas el ticket, actualiza todos los proyectos

3. **Crear Config Local:** Mantén `ticket-config.js` sin cambios, crea `ticket-config-custom.js` para extensiones

4. **Testear Impresión:** Siempre prueba con "Guardar como PDF" antes de imprimir en térmica

5. **Mantener Licencia:** Este módulo es reutilizable, comparte libremente

---

## 📞 Soporte Rápido

**P: ¿Cómo cambio el nombre del establecimiento en el ticket?**  
R: Pasa `establishmentName` en el objeto `data` a `generateTicketHTML()`

**P: ¿Cómo agrego un nuevo producto?**  
R: Ve a "Agregar Nuevos Productos" en `TICKET-README.md`

**P: ¿El ticket no imprime en tamaño correcto?**  
R: Verifica las configuraciones de margen de página en el navegador (deben ser 0)

**P: ¿Cómo calculo precios dinámicos?**  
R: Mira `calculatePizzaPrice()` en `ticket-config.js`

**P: ¿Puedo usar esto en múltiples proyectos?**  
R: ✅ Sí, es completamente modular y reutilizable

---

## 🎓 Aprendizaje Recomendado

1. **Principiante:** Lee diagrama > TICKET-README.md > copia ejemplo
2. **Intermedio:** Modifica ejemplo para tu caso > integra en proyecto
3. **Avanzado:** Customiza `ticket-config.js` > agrega nuevos productos > extiende funcionalidad

---

## 📁 Estructura de Carpetas Recomendada

```
tu-proyecto/
├── ticket-config.js              ⭐ (Módulo principal)
├── ticket-config-EJEMPLO.js      (Consulta cuando necesites ejemplos)
├── TICKET-README.md              (Consulta cuando tengas dudas)
├── ticket-estructura-DIAGRAMA.js (Consulta para validar estructura)
└── src/
    └── components/
        └── TicketPrinter.jsx     (Tu componente que usa ticket-config)
```

---

## 🎉 Conclusión

Estos archivos te permiten:

✅ **Extraer** la configuración de tickets de tu sistema actual  
✅ **Reutilizar** el mismo modelo en otros proyectos  
✅ **Mantener** consistencia entre múltiples sistemas  
✅ **Escalar** fácilmente sin duplicar código  
✅ **Actualizar** una sola vez y reflejar cambios en todas partes  

¡Listo para usar! 🚀

---

*Última actualización: 2026-04-24*
