# Rivera POS - Sistema Gastronómico Mobile-First

**Rivera POS** es una aplicación web integral diseñada específicamente para toma de comandas por mozos desde teléfonos celulares (iOS / Android sin necesidad de instalar apps nativas), monitoreo de cocina en tiempo real con alertas acústicas, checkout de cobros con propina voluntaria por sustracción, administración de carta y personal, y reportes nocturnos exportables a PDF (A4).

---

## 1. Estética y Reglas Mobile-First
- **Colores del Club (Azul y Blanco):**
  - Fondo principal: Slate 50 (`#f8fafc`) con tarjetas en blanco puro (`#ffffff`).
  - Color de acento primario: Azul vibrante (`#2563eb`) con detalles suaves `bg-blue-50` y bordes `border-blue-200`.
  - Estados semánticos: Esmeralda (`#059669`) para cobros y entregas, Ámbar (`#f59e0b`) para alertas de cocina, e Índigo para transferencias bancarias.
- **Sin emojis:** Iconografía limpia y profesional mediante **FontAwesome 6 (fa-solid)**.
- **Regla Anti-Zoom para Teléfonos Móviles:**
  - `font-size: 16px !important;` en todos los `input`, `select` y `textarea` para evitar que Safari (iOS) o Chrome (Android) apliquen auto-zoom molesto al escribir.
  - Atributo `inputmode="numeric"` en todos los campos de precios, montos y cantidades.

---

## 2. Arquitectura de Sincronización en Tiempo Real (100% Neon PostgreSQL)
- **Base de Datos Neon PostgreSQL:** Conexión persistente directa y centralizada. Todo cambio (mozos, platos, mesas, comandas, cobros y cierres) se guarda inmediatamente en PostgreSQL.
- **Sincronización Dual Inteligente:**
  - **WebSockets (`/ws`):** Para despliegues en servidores locales o VPS con notificación instantánea push.
  - **Smart Polling Serverless:** Para despliegues en **Vercel**, sincroniza de forma transparente cada 2.5 segundos para que todos los mozos y la cocina tengan el estado en vivo sin requerir WebSockets persistentes.
- **Cero Dependencia de LocalStorage:** Toda la verdad del sistema reside exclusivamente en la base de datos Neon, garantizando consistencia total entre todas las terminales y celulares.

---

## 🛡️ 3. Seguridad y Credenciales Protegidas
- La URL de conexión a la base de datos de Neon **NO** se encuentra expuesta en el código del cliente.
- Se gestiona exclusivamente a través de variables de entorno en el archivo `.env` del servidor.
- El archivo `.gitignore` excluye `.env` y `node_modules` para evitar filtraciones de credenciales en repositorios públicos de GitHub.
- Se incluye `.env.example` como plantilla de configuración.

---

## ⚙️ 4. Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js v18 o superior.
- Conexión a Neon PostgreSQL (o cualquier PostgreSQL compatible).

### Pasos
1. Clonar el repositorio o ingresar a la carpeta del proyecto:
   ```bash
   cd Rivera-Humboldt
   ```
2. Instalar las dependencias:
   ```bash
   npm install
   ```
3. Configurar el archivo `.env` (si aún no existe, copiar desde `.env.example`):
   ```env
   DATABASE_URL=postgresql://usuario:contraseña@host-neon/neondb?sslmode=require
   PORT=3000
   ```
4. Iniciar el servidor:
   ```bash
   npm start
   ```
5. Abrir en el navegador:
   - **En la computadora de caja / cocina:** `http://localhost:3000`
   - **En los celulares de los mozos (misma red Wi-Fi):** `http://<IP-DE-TU-PC>:3000`

---

## 📱 5. Flujos Principales

### A. Pantalla de Ingreso Rápido
- Selección con un toque de mozo de turno (Lucas Gómez, Sofía Martínez, Martín Rossi) o botón directo a **Cocina / Admin**.

### B. Salón y Mesas (Mozo)
- Grilla de mesas con estados dinámicos (Libre, Preparando, ¡Listo en Cocina!, Entregado).
- Botón directo de cobro rápido desde la tarjeta de la mesa si tiene consumo activo.

### C. Toma de Comanda en Celular
- Buscador instantáneo (`oninput`) de platos y bebidas por nombre o ingredientes.
- Pestañas horizontales deslizables por categorías (Pizzas, Sándwiches de Milanesa, Minutas, Bebidas).
- **Bottom Drawer Desplegable:** Barra inferior colapsable para optimizar espacio en pantallas de teléfonos; permite sumar/restar cantidades, añadir observaciones y enviar a cocina.

### D. Notificaciones y Campana de Cocina
- Web Audio API genera una campanada acústica nítida sin depender de archivos de audio externos.
- Modal con botón *"Ya lo llevé a la mesa (Marcar Entregado)"*.

### E. Checkout y Propina por Sustracción
- Modal de cobro con elección de método (Efectivo / Transferencia).
- El mozo o cajero ingresa con cuánto pagó el cliente. La propina a voluntad se calcula de forma automática:
  $$\text{Propina} = \max(0, \text{Monto Abonado} - \text{Total})$$
- La propina se acumula en la Caja General de Propinas y la mesa queda libre para nuevos clientes.

### F. Administración y Cierre Nocturno
- **Cocina en vivo:** Tablero kanban con selector de 3 estados (Pendiente, ¡Listo!, Entregado) e impresión de ticket térmico de 80mm con reglas `@media print`.
- **Carta / Menú:** Creación y baja de categorías y platos con precios y descripciones.
- **Reporte Nocturno:** 5 tarjetas KPI, ranking de lo más vendido con barras de progreso, rendimiento individual por mozo, división equitativa de propinas, exportación a PDF A4 (html2pdf.js), copiado de texto para WhatsApp y CSV para Excel.
- **Personal:** Alta, baja y alternancia de roles Mozo <-> Cocina.

---

## 🚀 6. Despliegue en Vercel y GitHub

### Paso 1: Subir el proyecto a GitHub
1. Abre tu terminal en la carpeta del proyecto y ejecuta:
   ```bash
   git add .
   git commit -m "Rivera POS: 100% Neon DB persistente y optimizado para Vercel"
   git push origin main
   ```

### Paso 2: Conectar con Vercel
1. Ingresa a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New Project** e importa el repositorio `Rivera-Humboldt`.
3. En la sección **Environment Variables**, añade:
   - **Key:** `DATABASE_URL`
   - **Value:** La URL de tu base de datos Neon PostgreSQL (la misma de tu archivo `.env`).
4. Haz clic en **Deploy**.
5. ¡Listo! Vercel te dará un enlace público seguro (HTTPS) para compartir con los mozos y el personal de cocina, accesible desde cualquier celular y computadora sin necesidad de configurar redes locales.
