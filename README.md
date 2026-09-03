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
├── index.html            # Estructura principal (login + lámpara + dashboard + modal)
├── css/
│   └── styles.css        # Diseño responsive, variables CSS, componentes y animación de la lámpara
├── js/
│   ├── config.example.js # Plantilla de configuración local (ADMIN_EMAILS)
│   ├── config.js         # Configuración local real — NO versionado (.gitignore)
│   ├── storage.js        # Persistencia en localStorage con validación e integridad
│   ├── auth.js           # Autenticación (Google Identity Services + acceso local demo)
│   ├── modules.js        # Lógica de negocio, vistas y formularios por módulo
│   └── app.js            # Controlador principal, enrutamiento, eventos y lámpara de acceso
└── .gitignore
```

> `js/config.js` se carga **antes** que el resto de scripts. Si no existe (por ejemplo
> en un clon recién hecho) la aplicación sigue funcionando: `ADMIN_EMAILS` queda vacío.

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

## 💡 Lámpara de acceso (la lámpara es el interruptor del login)

Al abrir la página el login está **bloqueado**: pantalla oscura, tarjeta atenuada,
campos y botones deshabilitados, y el aviso *«Enciende la lámpara para continuar»*.

El usuario **tira del cordón** (clic o, con el teclado, `Tab` hasta el interruptor y
`Enter`/`Espacio`). La lámpara se enciende de forma progresiva, el ambiente se ilumina
con luz cálida, la tarjeta cobra vida y se habilitan todos los controles.

- El estado *encendida* se recuerda durante la sesión (`sessionStorage`): recargar tras
  desbloquear no vuelve a bloquear. Una pestaña nueva empieza de nuevo bloqueada.
- Sonido de interruptor opcional vía Web Audio API; si el navegador lo bloquea, el flujo
  continúa sin interrupción.
- Respeta `prefers-reduced-motion`: sin desplazamientos ni parpadeos, pero totalmente funcional.

---

## 🔐 Autenticación

> **Nota de arquitectura.** Es una SPA **estática** (GitHub Pages), sin backend propio.
> No hay cookies `HttpOnly`, tokens CSRF ni endpoints de servidor: no son posibles aquí.
> La frontera de confianza es la capa de validación de `js/storage.js` + `js/auth.js`,
> que sella los datos con una huella de integridad y **re-deriva el rol del directorio
> sellado en cada comprobación**. La sesión solo guarda proveedor + correo + token; el
> frontend nunca envía el rol. Es lo máximo que puede garantizar un sitio sin servidor.

### Acceso Local (Demo)

Siempre habilitado. Permite evaluar toda la funcionalidad con las credenciales demo
(ver más abajo) mediante el formulario o el panel de *Acceso Rápido de Prueba*.

### Google Identity Services (Producción)

El **Client ID** ya está configurado en `js/auth.js` (`CONFIG.CLIENT_ID`). El flujo
ID-token de GIS **no usa client secret**, así que no hay ninguna credencial que ocultar.
Para usarlo con tu propio proyecto de Google:

1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Crear un **ID de cliente OAuth 2.0** de tipo *Aplicación web*.
3. En **Orígenes de JavaScript autorizados** añadir el origen donde sirves la app
   (ej. `http://localhost:5501` en desarrollo y `https://<usuario>.github.io` en Pages).
4. Poner ese Client ID en `js/config.js` (`window.CONFIG.CLIENT_ID = '...'`) o en `js/auth.js`.

### Administradores autorizados (`ADMIN_EMAILS`)

1. Copia `js/config.example.js` a **`js/config.js`**.
2. Escribe tu correo de Google en el array:

   ```js
   window.CONFIG.ADMIN_EMAILS = ['tu-correo@gmail.com'];
   ```

3. Al iniciar sesión con Google, ese correo recibe el rol **`administrador`**.
   Cualquier otro correo nuevo entra como **`mesero`**; un correo que ya exista en la
   tabla de Usuarios conserva el rol que tenga asignado.

**Importante:** `js/config.js` está en `.gitignore` para no publicar tu correo. En
GitHub Pages solo se despliega lo versionado, así que para que `ADMIN_EMAILS` tenga
efecto en Pages debes **quitar `js/config.js` del `.gitignore` y hacer commit** (una
lista de correos no es un secreto) o pegar el array directamente en `js/auth.js`.
El rol `administrador` se asigna **solo en `js/auth.js`**; el formulario de login no
puede enviar `role=ADMIN` y un usuario no puede cambiar su propio rol.

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
