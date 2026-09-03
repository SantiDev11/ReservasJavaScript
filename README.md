# 🍽️ RestoApp · Sistema Integral de Reservas & Operaciones

Sistema web de gestión para restaurantes con control de reservas, comandas, cocina, despachos y administración de usuarios con autenticación por roles.

---

## 📋 Descripción

RestoApp es una aplicación web de página única (SPA) desarrollada con **HTML, CSS y JavaScript vanilla** que permite gestionar las operaciones diarias de un restaurante mediante cuatro roles diferenciados:

- **Administrador:** Acceso total al sistema (mesas, reservas, pedidos, cocina, despachos y usuarios).
- **Mesero:** Gestión de mesas, reservas, pedidos y despachos.
- **Cocina:** Cola de producción con transición de platos (pendiente → preparación → listo).
- **Despacho:** Gestión de entregas (pendiente → en ruta → entregado).

---

## 🏗️ Estructura del Proyecto

```
sistema-reservas-restaurante/
├── index.html          # Estructura principal (login + dashboard + modal)
├── css/
│   └── styles.css      # Diseño responsive, variables CSS y componentes visuales
└── js/
    ├── storage.js      # Persistencia en localStorage con validación e integridad
    ├── auth.js         # Autenticación (Google Identity Services + acceso local demo)
    ├── modules.js      # Lógica de negocio, vistas y formularios por módulo
    └── app.js          # Controlador principal, enrutamiento y eventos globales
```

---

## 🚀 Instalación y Ejecución

### Requisitos

- Navegador web moderno (Chrome, Firefox, Edge).
- Servidor web local (recomendado).

### Opción 1: Live Server (VS Code)

1. Abrir la carpeta del proyecto en **Visual Studio Code**.
2. Instalar la extensión **Live Server**.
3. Clic derecho en `index.html` → **Open with Live Server**.

### Opción 2: Servidor HTTP con Node.js

```bash
npx serve .
```

### Opción 3: Servidor HTTP con Python

```bash
python -m http.server 8080
```

> ⚠️ **Importante:** No abrir `index.html` directamente con doble clic (`file:///`). La aplicación requiere protocolo `http://` para el correcto funcionamiento de almacenamiento y autenticación.

---

## 🔑 Credenciales de Acceso Demo

La aplicación incluye acceso rápido de prueba con los siguientes usuarios predefinidos:

| Rol            | Usuario    | Contraseña   |
|----------------|------------|--------------|
| Administrador  | `admin`    | `admin123`   |
| Mesero         | `mesero`   | `mesero123`  |
| Cocina         | `cocina`   | `cocina123`  |
| Despacho       | `despacho` | `despacho123`|

También se puede usar el selector de **Acceso Rápido de Prueba (1-Clic)** en la pantalla de login.

---

## 🔄 Flujo Operativo

```
RESERVA → PEDIDO → COCINA → PLATO EN PREPARACIÓN → PLATO LISTO → DESPACHO → EN RUTA → ENTREGADO
```

1. El **mesero** crea una reserva asignando mesa, fecha, hora y comensales.
2. El **mesero** toma un pedido seleccionando platos del menú.
3. La **cocina** recibe los platos pendientes y los mueve a preparación y luego a listos.
4. El **despacho** genera la entrega de los platos listos.
5. Al completar la entrega, el pedido se cierra y la mesa se libera automáticamente.

---

## 🔐 Autenticación

### Acceso Local (Demo)

Habilitado automáticamente cuando no se configura un Client ID de Google. Permite evaluar toda la funcionalidad del sistema con las credenciales demo.

### Google Identity Services (Producción)

Para habilitar el inicio de sesión con cuentas reales de Google:

1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Obtener un **Client ID** de tipo OAuth 2.0.
3. Configurar los orígenes autorizados de JavaScript (ej. `http://localhost:5500`).
4. Reemplazar el valor de `PLACEHOLDER_CLIENT_ID` en `js/auth.js` con el Client ID real.
5. Registrar los correos de los usuarios en la tabla de Usuarios del sistema desde la vista de Administración.

---

## 💾 Persistencia

Todos los datos se almacenan en `localStorage` del navegador bajo la clave `restaurante_db`:

- Mesas (8 demo)
- Platos (8 demo)
- Reservas
- Pedidos / Comandas
- Despachos
- Usuarios (4 demo)

Los datos persisten al recargar la página y se protegen mediante un sistema de firma de integridad contra manipulación externa.

Desde la vista de **Administración** (rol Administrador) se puede restablecer todos los datos a sus valores de fábrica.

---

## 📱 Diseño Responsive

La interfaz se adapta a diferentes tamaños de pantalla:

- **Desktop (>960px):** Menú lateral fijo.
- **Tablet (≤960px):** Menú lateral colapsable con botón hamburguesa.
- **Móvil (≤480px):** Diseño optimizado para pantallas pequeñas.

---

## 🛠️ Tecnologías Utilizadas

- **HTML5** — Estructura semántica y accesible.
- **CSS3** — Variables CSS, Flexbox, Grid, animaciones y glassmorphism.
- **JavaScript ES5+** — Vanilla JS sin dependencias externas.
- **Font Awesome 6** — Iconografía.
- **Google Fonts** — Tipografías Plus Jakarta Sans y Outfit.
- **Google Identity Services** — Autenticación OAuth 2.0 (opcional).
