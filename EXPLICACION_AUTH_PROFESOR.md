# 🛡️ Documento de Sustentación Técnica: Módulo de Autenticación (`js/auth.js`)
**Proyecto:** RestoApp · Sistema de Reservas y Operaciones  
**Tema:** Arquitectura de Autenticación, Google OAuth 2.0 y Control de Acceso (RBAC)

---

## 1. Resumen Ejecutivo (Pitch de 1 minuto)

> *"Profesor, el archivo `js/auth.js` gestiona toda la seguridad del sistema, encargándose de dos tareas fundamentales: la **autenticación** (comprobar la identidad del usuario) y la **autorización** (controlar qué acciones puede realizar según su rol mediante RBAC).*
>
> *Para ello implementamos una arquitectura híbrida: soportamos acceso local por credenciales para pruebas rápidas y entornos cerrados, e integración oficial con **Google Identity Services (OAuth 2.0)** para producción. El flujo con Google no es una simulación visual: captura un token criptográfico **JWT (JSON Web Token)**, valida rigurosamente sus claims tanto en local como contra los servidores de Google mediante su endpoint `tokeninfo`, y realiza el **auto-registro** del usuario en la base de datos local manteniendo la integridad de las sesiones."*

---

## 2. Diagrama del Flujo de Autenticación con Google

```text
[ Usuario ]
    │
    ▼
1. Clic en "Iniciar sesión con Google"
    │
    ▼
2. Google Identity Services abre el diálogo oficial
    │
    ▼
3. Usuario concede autorización con su cuenta Gmail
    │
    ▼
4. Google genera y retorna una credencial JWT (Token firmado)
    │
    ▼
5. Función `handleGoogleCredential(credential)` en `auth.js`
    ├── A. `parseJwt()`: Decodifica el Payload en Base64.
    ├── B. `validateJwtClaims()`: Valida iss, aud, exp, iat y email_verified.
    └── C. `verifyTokenInfo()`: Consulta con fetch() a https://oauth2.googleapis.com/tokeninfo
           para asegurar que la firma de Google sea 100% auténtica y no alterada.
    │
    ▼
6. Búsqueda y Registro en el Sistema
    ├── ¿El correo ya existe en Restaurante? -> Se conserva su rol (admin, cocina, etc.).
    └── ¿Es su primera vez? -> `autoRegisterGoogleUser()` lo da de alta con rol `mesero`,
        guardando su nombre, email y foto en localStorage.
    │
    ▼
7. Construcción de Sesión
    ├── Se guarda en `sessionStorage` (expira al cerrar la pestaña).
    └── Redirección automática al Dashboard.
```

---

## 3. Desglose del Código por Componentes Clave

### A. Encapsulación mediante IIFE (Líneas 1-3)
```javascript
(function (window) {
  'use strict';
  // ...
  window.RestoAuth = RestoAuth;
})(window);
```
- **Justificación:** Se utiliza una **IIFE (Immediately Invoked Function Expression)** para evitar contaminar el scope global (`window`). Todas las funciones internas, secretos y estados intermedios quedan protegidos; únicamente se expone al exterior la interfaz pública `window.RestoAuth`.

---

### B. Configuración y TTL de Sesión (Líneas 4-22)
- `CONFIG.CLIENT_ID`: El identificador de cliente registrado en Google Cloud Console para el dominio de la aplicación.
- `SESSION_TTL = 8 * 60 * 60 * 1000`: Tiempo de vida de la sesión (8 horas continuas).
- `CLOCK_SKEW_SECONDS = 300`: Margen de tolerancia de 5 minutos para absorber diferencias de sincronización horaria (skew) entre el dispositivo del cliente y los servidores de Google.

---

### C. Validación Criptográfica del Token JWT (Líneas 152-207)

El código realiza una **doble verificación** antes de confiar en la identidad:

#### 1. Verificación Local (`validateJwtClaims`)
- **Emisor (`iss`):** Asegura que provenga exclusivamente de `accounts.google.com`.
- **Audiencia (`aud`):** Asegura que el token haya sido generado para **nuestra aplicación** y no para otra web.
- **Expiración (`exp`):** Comprueba que `exp > now`, rechazando tokens vencidos.
- **Correo Verificado (`email_verified`):** Comprueba que el correo haya sido validado por Google.

#### 2. Verificación Remota (`verifyTokenInfo`)
```javascript
function verifyTokenInfo(idToken) {
  return window.fetch(CONFIG.TOKENINFO_URL + '?id_token=' + encodeURIComponent(idToken))
    .then(function (response) {
      if (!response.ok) throw new Error('Google rechazó la verificación del token.');
      return response.json();
    });
}
```
- **Por qué es necesario:** En un entorno frontend sin backend dedicado, decodificar el JWT en base64 permite ver la información, pero no garantiza que no haya sido forjada. La consulta a `tokeninfo` delega a los servidores de Google la comprobación de la firma criptográfica.

---

### D. Auto-Registro de Usuarios de Google (Líneas 209-221)
```javascript
function autoRegisterGoogleUser(email, nombre) {
  var currentData = Storage.load();
  var newUser = {
    id: Storage.nextId(currentData.usuarios, 1),
    email: Storage.normalizeEmail(email),
    nombre: Storage.sanitizeInput(nombre) || email.split('@')[0],
    rol: 'mesero',
    activo: true
  };
  currentData.usuarios.push(newUser);
  var result = Storage.save(currentData);
  return result.ok ? newUser : null;
}
```
- Si un empleado o usuario inicia sesión por primera vez con su cuenta de Google, el sistema lo incorpora automáticamente a la base de datos con el rol operativo base (`mesero`), permitiéndole ingresar al sistema de inmediato sin requerir configuración previa. Luego, un usuario con rol `administrador` puede ajustar sus permisos desde el panel.

---

### E. Autorización por Roles (RBAC) (Líneas 470-490)
```javascript
function checkRole(allowedRoles) {
  var user = getCurrentUser();
  if (!user) return deny('Debe iniciar sesión para continuar.');
  // Verifica si el rol del usuario está dentro del arreglo permitido
  if (!allowedRoles.includes(user.rol)) {
    return deny('No tiene permisos para realizar esta acción.');
  }
  return true;
}
```
- **Principio de Mínimo Privilegio:** Cada operación crítica (crear pedidos, cambiar estados de cocina, despachos, gestión de usuarios) consulta a `checkRole()` antes de ejecutarse.

---

## 4. Banco de Preguntas y Respuestas para la Evaluación

### P1: ¿Por qué usaron `sessionStorage` en lugar de `localStorage` para la sesión?
> **R:** Para mitigar riesgos de seguridad en estaciones de trabajo compartidas. Al usar `sessionStorage`, si el usuario cierra el navegador o la pestaña, la sesión se destruye automáticamente. Los datos del restaurante (mesas, pedidos, menú) sí residen en `localStorage`, pero la credencial activa no.

### P2: ¿Cómo evitan que un usuario modifique su rol en la consola para ganar privilegios de administrador?
> **R:** La función `getCurrentUser()` no confía ciegamente en los datos guardados en la sesión: vuelve a cruzar el correo contra la base de datos de usuarios persistente en `Storage`. Además, `Storage` implementa una verificación de integridad mediante un sobre sellado (firma/envelope) que detecta alteraciones manuales en el almacenamiento.

### P3: ¿Qué ventaja tiene Google Identity Services frente al login clásico por usuario y contraseña?
> **R:** 
> 1. Delegamos el almacenamiento y cifrado de contraseñas a la infraestructura de Google (cero contraseñas almacenadas localmente).
> 2. Provee autenticación en dos factores (2FA) nativa.
> 3. Simplifica la experiencia del empleado mediante inicio de sesión con un solo clic.
