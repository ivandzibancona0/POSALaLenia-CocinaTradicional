# 🔥 POS - A La Leña
### Sistema Integral de Punto de Venta y Gestión para Restaurante de Cocina Tradicional

---

## 📋 Descripción del Proyecto

**POS - A La Leña** es una solución web completa, rápida e intuitiva para la administración y operación diaria de restaurantes de cocina tradicional. Diseñado específicamente para optimizar la toma de comandas, el control de mesas en salón, la venta en mostrador/para llevar, el control de inventario con porciones duales (órdenes completas y medias órdenes), la fidelización de clientes y la emisión de tickets térmicos.

---

## ✨ Características Principales

### 🛒 1. Punto de Venta (POS) Ágil
- **Venta de mostrador y servicio para llevar** con búsqueda instantánea de platillos y filtrado por categorías.
- **Soporte de Porciones Duales**: Venta de platillos en porción completa o media orden/ración con precios y descuento de stock diferenciados.
- **Múltiples Métodos de Pago**: Efectivo (con calculadora de cambio automático), Tarjeta, Transferencia y Pagos Mixtos.
- **Emisión e Impresión de Tickets**: Diseño optimizado para impresoras térmicas (80mm y 58mm) sin páginas en blanco, con logotipo del negocio, tamaño de fuente configurable (*Pequeña*, *Mediana*, *Grande*), desglose detallado y pie personalizable.
- **Tickets Digitales en PDF (`jsPDF`)**: Exportación con logotipo opcional, ajuste automático de líneas dentro de los márgenes, tamaño de papel/fuente sincronizado con la configuración de impresora y altura dinámica de página.

### 🍽️ 2. Módulo de Mesas / Comedor
- **Plano visual del salón**: Vista en tiempo real del estado de cada mesa (*Libre*, *Ocupada*, *Por cobrar / Facturada*).
- **Comandas en Mesa**: Apertura de mesa, asignación de comensal/cliente, adición continua de platillos y notas de preparación.
- **Cierre y Cobro**: Conversión instantánea de la cuenta de la mesa a venta final con impresión de ticket y liberación de mesa.
- **Liberación / Cancelación de Mesa (Solo Administrador)**: Reinicio transaccional de mesas con consumos no cobrados protegido por rol `admin`.

### 📦 3. Menú, Categorías e Inventario
- **Gestión de Menú**: Creación y edición de productos con código, descripción, costo, precio de venta, precio de media porción y categoría.
- **Control de Existencias en Tiempo Real**: Alertas de stock bajo e insignias dinámicas según disponibilidad.
- **Kardex / Movimientos de Stock**: Registro auditable de entradas, salidas por venta, ajustes manuales, mermas y cancelaciones.
- **Gestión de Activos, Inactivos y Eliminación Definitiva (Solo Administrador)**:
  - Filtros por estado (*Solo Activos*, *Inactivos (Dados de baja)* y *Todos*) tanto en la tabla de **Inventario** como en el modal de **Categorías**, manteniendo **Caja** y **Comedor** estrictamente limitados a registros activos.
  - **Baja lógica (`active = 0`)**: oculta platillos o categorías del catálogo operativo sin perder el historial de ventas ni de Kardex.
  - **Reactivación (`PATCH .../restore`)**: devuelve registros inactivos al catálogo activo (alertando si la categoría asignada a un platillo también está inactiva).
  - **Eliminación definitiva (`DELETE ...?permanent=true`)**: borra físicamente el registro en MySQL y libera su código SKU o nombre único, con validaciones de integridad (impide eliminar platillos con consumo activo en mesas abiertas o categorías con platillos activos).

### 👥 4. Directorio de Clientes
- Registro de clientes con teléfono, dirección y notas.
- Historial de compras asociadas al cliente y selección rápida desde el POS o mesas.

### 📊 5. Reportes y Analíticas
- Resumen de ingresos del día, ticket promedio y cantidad de órdenes.
- Gráficos y desglose de ventas por método de pago y productos más vendidos.
- **Cancelación de Órdenes / Tickets (Solo Administrador)**: Anulación transaccional desde *Reporte de Ventas por Ticket* con motivo opcional, traza de auditoría del administrador responsable y casilla **"Devolver Platillos"** para elegir entre reintegrar raciones completas (`1.0`) / medias (`0.5`) al inventario (registrado en Kardex como `cancellation`) o cancelar como merma sin devolver existencias.

### 🔒 6. Seguridad y Control de Usuarios
- **Control de Acceso basado en Roles (RBAC)**:
  - **Administrador (`admin`)**: Acceso total al sistema, reportes, cancelación de órdenes, liberación de mesas, inventario, usuarios, configuración y respaldos.
  - **Cajero (`cashier`)**: Acceso operativo enfocado al POS, comedor, registro de clientes e impresión de tickets.
- Autenticación robusta con **JSON Web Tokens (JWT)** y contraseñas encriptadas con **bcrypt**.
- **Protección de Sesiones**:
  - Sesión vinculada a la ventana activa (`sessionStorage`): al cerrar la aplicación la sesión se cierra automáticamente (conservando intactas las mesas abiertas en MySQL y las órdenes pausadas).
  - **Cierre automático por inactividad**: finaliza la sesión y cierra modales abiertos tras **30 minutos** sin actividad.

### ⚙️ 7. Configuración, Respaldos y Mantenimiento
- Configuración de datos fiscales, razón social, dirección, teléfono, IVA y logotipo del negocio.
- **Copias de Seguridad (Backups SQL)**: Generación y descarga directa de volcados `.SQL` compatibles con MySQL/MariaDB, y restauración transaccional desde la interfaz web.
- **Reinicio de Fábrica / Restaurar desde Cero**: Procedimiento protegido para vaciar la base de datos o restaurar los datos semilla de demostración.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend** | [Node.js](https://nodejs.org/), [Express.js](https://expressjs.com/) |
| **Base de Datos** | [MySQL](https://www.mysql.com/) / [MariaDB](https://mariadb.org/) mediante [`mysql2`](https://www.npmjs.com/package/mysql2) con Connection Pooling |
| **Seguridad** | [Helmet](https://helmetjs.github.io/), [CORS](https://www.npmjs.com/package/cors), [bcryptjs](https://www.npmjs.com/package/bcryptjs), [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) |
| **Frontend** | Vanilla JavaScript (Modular SPA), HTML5 Semántico, CSS3 Personalizado, [jsPDF](https://github.com/parallax/jsPDF) |
| **Gestión de Archivos** | [Multer](https://www.npmjs.com/package/multer) para almacenamiento temporal de volcados |

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- [npm](https://www.npmjs.com/) (incluido con Node.js)
- Servidor [MySQL](https://www.mysql.com/) o [MariaDB](https://mariadb.org/) en ejecución

### Pasos de Instalación

1. **Clonar o descargar el proyecto** y ubicarse en el directorio principal:
   ```bash
   cd "POS - A La Leña"
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configuración de Variables de Entorno**:
   Copia el archivo `.env.example` como `.env` y configura las credenciales de tu base de datos MySQL:
   ```env
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=tu_clave_secreta_super_segura

   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=pos_alalena
   DB_USER=root
   DB_PASSWORD=tu_contraseña_aqui
   ```
   > [!NOTE]
   > Si la base de datos `pos_alalena` no existe en MySQL, el sistema la creará automáticamente al iniciar el servidor junto con todas sus tablas e índices.

4. **Iniciar el servidor**:
   - **Inicio Recomendado en Windows (En Segundo Plano, Modo App en Edge):**
     Ejecuta el archivo `POS - A La Leña.vbs` (sin ventana negra: verifica/inicia automáticamente el servicio oficial de MySQL si está detenido, evita instancias duplicadas, guarda logs en `data/server.log` y abre el sistema maximizado en **Microsoft Edge en modo aplicación** con el ícono oficial).
     - Para detener el servidor en segundo plano al finalizar el turno, ejecuta `Detener POS - A La Leña.bat`.
   - **Inicio en Consola Visible en Windows:**
     Ejecuta el archivo `POS - A La Leña.bat` (mismas verificaciones de MySQL y apertura en Edge en modo aplicación, manteniendo los logs visibles en consola).
   - **Desde la terminal (Modo Producción):**
     ```bash
     npm start
     ```
   - **Desde la terminal (Modo Desarrollo con recarga automática):**
     ```bash
     npm run dev
     ```

5. **Abrir en el Navegador** *(si iniciaste desde terminal)*:
   Ingresa a: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Credenciales por Defecto

Al arrancar la aplicación por primera vez, el sistema inicializa automáticamente la base de datos y crea los siguientes usuarios:

| Rol | Usuario | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` |
| **Cajero** | `cajero` | `cajero123` |

> [!IMPORTANT]
> Se recomienda cambiar las contraseñas por defecto desde el módulo de **Usuarios** una vez desplegado en un entorno productivo.

---

## 🧪 Pruebas Automatizadas

El proyecto incluye una suite completa de pruebas E2E automatizadas para validar autenticación, productos, comandas de mesas, ventas, kardex, generación de respaldos SQL y restricciones de roles (RBAC):

```bash
# Con el servidor en ejecución en el puerto 3000:
node src/utils/testSuite.js
```

---

## 📁 Estructura del Proyecto

```plaintext
POS - A La Leña/
├── data/
│   ├── temp_uploads/          # Archivos temporales de carga multipart (Multer)
│   ├── server.log             # Registro de salida del servidor en segundo plano
│   └── server-error.log       # Registro de errores del servidor en segundo plano
├── public/                    # Archivos estáticos del Frontend (SPA)
│   ├── assets/                # Logotipo (.jpg) y favicon oficial (.ico) del restaurante
│   ├── css/                   # Hojas de estilo modulares
│   │   ├── components.css     # Botones, modales, badges, alertas y tablas
│   │   ├── dining.css         # Estilos específicos del plano y comandas de mesas
│   │   ├── main.css           # Layout principal, temas y variables CSS
│   │   ├── pos.css            # Catálogo de platillos, carrito y calculadora de cobro
│   │   └── print.css          # Estilos optimizados para impresión térmica
│   ├── js/                    # Módulos JavaScript Vanilla (Cliente)
│   │   ├── api.js             # Cliente HTTP con interceptores JWT
│   │   ├── app.js             # Inicialización y enrutador SPA
│   │   ├── auth.js            # Sesiones en sessionStorage y cierre tras 30 min de inactividad
│   │   ├── customers.js       # Directorio e historial de clientes
│   │   ├── dining.js          # Control de mesas, comandas y cuentas
│   │   ├── inventory.js       # Gestión de platillos, categorías, stock, filtros activo/inactivo, reactivación y borrado definitivo
│   │   ├── pos.js             # Carrito, cálculo de cambio y proceso de venta
│   │   ├── reports.js         # Reportes analíticos, CSV y cancelación de órdenes
│   │   ├── settings.js        # Configuración del negocio, impresora y backups
│   │   ├── ticketPrinter.js   # Tickets térmicos, PDF (jsPDF) y modal de cancelación
│   │   ├── ui.js              # Notificaciones toast, modales y utilidades visuales
│   │   └── users.js           # Gestión de cuentas y roles de usuario
│   └── index.html             # Punto de entrada de la interfaz de usuario
├── src/                       # Código fuente del Backend (Node.js / Express)
│   ├── config/
│   │   └── database.js        # Pool de MySQL, verificación y esquema relacional
│   ├── middleware/
│   │   └── auth.js            # Middleware de verificación JWT y control RBAC
│   ├── routes/                # Endpoints de la API REST
│   │   ├── auth.routes.js     # Autenticación y perfil de usuario
│   │   ├── backup.routes.js   # Configuraciones del negocio, exportación/importación SQL
│   │   ├── customers.routes.js# Gestión de clientes
│   │   ├── dining.routes.js   # Salón, mesas, comandas y liberación (admin)
│   │   ├── products.routes.js # Catálogo de platillos/categorías, baja lógica, reactivación y eliminación permanente
│   │   ├── sales.routes.js    # Ventas, cancelaciones con devolución, kardex y reportes
│   │   └── users.routes.js    # Administración de usuarios y contraseñas
│   └── utils/
│       ├── backupManager.js   # Generador de volcados SQL y restauración transaccional
│       ├── seedData.js        # Platillos iniciales tradicionales yucatecos
│       └── testSuite.js       # Suite de pruebas E2E automatizadas
├── .env.example               # Plantilla de variables de entorno
├── .gitignore                 # Exclusiones de control de versiones
├── Detener POS - A La Leña.bat # Cierre seguro del servidor Node.js en segundo plano
├── logo-a-la-leña.ico         # Ícono oficial para accesos directos de Windows
├── package.json               # Dependencias y scripts de ejecución
├── POS - A La Leña.bat        # Lanzador en consola (auto-inicio MySQL + Edge modo app)
├── POS - A La Leña.vbs        # Lanzador silencioso en segundo plano (sin ventana negra)
├── server.js                  # Punto de entrada del servidor Express
└── README.md                  # Documentación del sistema
```

---

## 🖨️ Configuración de Impresión de Tickets

1. Inicia sesión como **Administrador** y dirígete a **Configuración** en la barra lateral.
2. Configura los datos del negocio (RFC, Teléfono, Dirección, Mensaje de agradecimiento).
3. Selecciona el ancho de tu impresora térmica (**80mm** o **58mm**), el tamaño de fuente (**Pequeña**, **Mediana** o **Grande**), si deseas imprimir el **logotipo** y el corte automático.
4. Al concretar una venta o solicitar la cuenta de una mesa, podrás imprimir el **ticket térmico físico** (en una sola hoja sin márgenes extra ni hojas en blanco) o descargar el **ticket digital en `.PDF`** respetando toda la configuración anterior.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

