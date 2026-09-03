/**
 * Configuración local de RestoApp — PLANTILLA
 * ------------------------------------------------------------------
 * 1. Copia este archivo como  js/config.js
 * 2. Escribe tu(s) correo(s) de administrador en ADMIN_EMAILS.
 * 3. (Opcional) sobreescribe CLIENT_ID si usas otro proyecto de Google.
 *
 * QUÉ HACE:
 *   Cuando alguien inicia sesión con Google y su correo verificado
 *   figura en ADMIN_EMAILS, el sistema le asigna el rol "administrador".
 *   Cualquier otro correo nuevo entra como "mesero". El rol se decide
 *   SIEMPRE aquí y en el backend de validación (js/auth.js), nunca desde
 *   el formulario: el frontend no puede enviar role=ADMIN.
 *
 * SEGURIDAD:
 *   - Esto NO es una variable de entorno real: en un sitio estático el
 *     archivo se sirve al navegador y es legible. Una lista de correos
 *     autorizados no es una credencial, así que es aceptable.
 *   - NO pongas aquí client secrets, claves ni contraseñas. El flujo
 *     ID-token de Google Identity Services no usa client secret.
 *
 * DESPLIEGUE EN GITHUB PAGES:
 *   js/config.js está en .gitignore, así que no se publica. Para que
 *   ADMIN_EMAILS tenga efecto en Pages, quita js/config.js del .gitignore
 *   y haz commit, o pega el array directamente en js/auth.js.
 */
(function (window) {
  'use strict';

  window.CONFIG = window.CONFIG || {};

  // Correos de Google que deben recibir rol "administrador" al iniciar sesión.
  // Ej.: ['maria.admin@gmail.com', 'dueno.resto@gmail.com']
  window.CONFIG.ADMIN_EMAILS = [
    // 'tu-correo@gmail.com'
  ];

  // Opcional: descomenta para usar tu propio Client ID de OAuth 2.0.
  // window.CONFIG.CLIENT_ID = '000000000000-xxxxxxxxxxxxxxxx.apps.googleusercontent.com';

})(window);
