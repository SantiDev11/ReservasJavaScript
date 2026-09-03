(function (window) {
  'use strict';

  var PLACEHOLDER_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

  window.CONFIG = window.CONFIG || {};
  if (!window.CONFIG.CLIENT_ID) window.CONFIG.CLIENT_ID = PLACEHOLDER_CLIENT_ID;
  if (!window.CONFIG.GIS_SRC) window.CONFIG.GIS_SRC = 'https://accounts.google.com/gsi/client';
  if (!window.CONFIG.TOKENINFO_URL) window.CONFIG.TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
  window.CONFIG.PLACEHOLDER_CLIENT_ID = PLACEHOLDER_CLIENT_ID;

  var CONFIG = window.CONFIG;
  var Storage = window.RestoStorage;

  var SESSION_KEY = 'restaurante_session';
  var LEGACY_SESSION_KEY = 'restoCurrentUser';
  var SESSION_TTL = 8 * 60 * 60 * 1000;
  var CLOCK_SKEW_SECONDS = 300;
  var VALID_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
  var PROVIDER_GOOGLE = 'google';
  var PROVIDER_LOCAL = 'local';

  var DEMO_ACCESS = {
    'admin@restoapp.com': 'admin123',
    'mesero@restoapp.com': 'mesero123',
    'cocina@restoapp.com': 'cocina123',
    'despacho@restoapp.com': 'despacho123'
  };

  var denialHandler = null;
  var signInHandler = null;

  function setDenialHandler(handler) {
    denialHandler = typeof handler === 'function' ? handler : null;
  }

  function setSignInHandler(handler) {
    signInHandler = typeof handler === 'function' ? handler : null;
  }

  function deny(message) {
    if (denialHandler) denialHandler(message);
    return false;
  }

  function isClientIdConfigured() {
    if (!CONFIG.CLIENT_ID || typeof CONFIG.CLIENT_ID !== 'string') return false;
    var trimmed = CONFIG.CLIENT_ID.trim();
    if (trimmed === PLACEHOLDER_CLIENT_ID || trimmed === CONFIG.PLACEHOLDER_CLIENT_ID) return false;
    if (trimmed.indexOf('...') !== -1 || trimmed.indexOf('YOUR_GOOGLE_CLIENT_ID') !== -1) return false;
    return /^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/i.test(trimmed);
  }

  function isLocalAccessEnabled() {
    return !isClientIdConfigured();
  }

  function getDirectory() {
    return Storage.getCollection('usuarios');
  }

  function findDirectoryUser(email) {
    var target = Storage.normalizeEmail(email);
    if (!target) return null;
    var matches = getDirectory().filter(function (usuario) {
      return usuario.email === target && usuario.activo;
    });
    return matches.length ? matches[0] : null;
  }

  function resolveEmailFromIdentifier(identifier) {
    var value = Storage.normalizeEmail(identifier);
    if (!value) return '';
    if (value.indexOf('@') !== -1) return value;

    var matches = getDirectory().filter(function (usuario) {
      return usuario.email.split('@')[0] === value;
    });
    return matches.length ? matches[0].email : '';
  }

  function sanitizePictureUrl(url) {
    var value = String(url === undefined || url === null ? '' : url).trim();
    if (!value) return '';
    try {
      var parsed = new URL(value);
      return parsed.protocol === 'https:' ? parsed.href : '';
    } catch (e) {
      return '';
    }
  }

  function toProfile(usuario, picture) {
    return {
      username: usuario.email.split('@')[0],
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      picture: sanitizePictureUrl(picture)
    };
  }

  function clearSession() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (e) {
      return false;
    }
    return true;
  }

  function saveSession(sessionData) {
    var sealed = Storage.sealEnvelope(sessionData);
    if (sealed === null) return false;
    try {
      window.sessionStorage.setItem(SESSION_KEY, sealed);
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(LEGACY_SESSION_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSession() {
    var raw;
    try {
      raw = window.sessionStorage.getItem(SESSION_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;

    var opened = Storage.openEnvelope(raw);
    if (!opened.ok) {
      clearSession();
      return null;
    }
    return opened.data;
  }

  function parseJwt(token) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length !== 3) return null;
      var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var padded = base64 + '==='.slice((base64.length + 3) % 4);
      var jsonPayload = decodeURIComponent(window.atob(padded).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      var claims = JSON.parse(jsonPayload);
      return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null;
    } catch (e) {
      return null;
    }
  }

  function validateJwtClaims(claims) {
    if (!isClientIdConfigured()) {
      return { valid: false, reason: 'El identificador de cliente de Google no está configurado.' };
    }
    if (!claims || typeof claims !== 'object') {
      return { valid: false, reason: 'El token de Google no se pudo decodificar.' };
    }
    if (VALID_ISSUERS.indexOf(String(claims.iss)) === -1) {
      return { valid: false, reason: 'El emisor del token es inválido.' };
    }
    if (String(claims.aud) !== String(CONFIG.CLIENT_ID).trim()) {
      return { valid: false, reason: 'La audiencia del token no coincide con esta aplicación.' };
    }
    var now = Math.floor(Date.now() / 1000);
    var exp = Number(claims.exp);
    if (!isFinite(exp) || exp <= 0) {
      return { valid: false, reason: 'El token no incluye fecha de expiración.' };
    }
    if (exp < now) {
      return { valid: false, reason: 'El token de Google ha expirado.' };
    }
    var iat = Number(claims.iat);
    if (isFinite(iat) && iat > now + CLOCK_SKEW_SECONDS) {
      return { valid: false, reason: 'Fecha de emisión del token en el futuro.' };
    }
    if (!claims.sub) {
      return { valid: false, reason: 'El token no contiene identificador de usuario.' };
    }
    if (!Storage.isValidEmail(claims.email)) {
      return { valid: false, reason: 'El token no incluye una dirección de correo válida.' };
    }
    if (String(claims.email_verified) !== 'true') {
      return { valid: false, reason: 'El correo de Google no está verificado.' };
    }
    return { valid: true, reason: null };
  }

  function verifyTokenInfo(idToken) {
    if (typeof window.fetch !== 'function') {
      return Promise.reject(new Error('Este navegador no puede verificar el token con Google.'));
    }
    return window.fetch(CONFIG.TOKENINFO_URL + '?id_token=' + encodeURIComponent(idToken))
      .then(function (response) {
        if (!response.ok) throw new Error('Google rechazó la verificación del token.');
        return response.json();
      });
  }

  function buildGoogleSession(idToken, claims, profile) {
    var tokenExpiresAt = Number(claims.exp) * 1000;
    var ttlExpiresAt = Date.now() + SESSION_TTL;
    return {
      provider: PROVIDER_GOOGLE,
      idToken: idToken,
      email: profile.email,
      loginAt: new Date().toISOString(),
      expiresAt: Math.min(tokenExpiresAt, ttlExpiresAt)
    };
  }

  function handleGoogleCredential(credential) {
    if (!credential) {
      return Promise.reject(new Error('No se recibió credencial de Google.'));
    }

    var localCheck = validateJwtClaims(parseJwt(credential));
    if (!localCheck.valid) {
      return Promise.reject(new Error(localCheck.reason));
    }

    return verifyTokenInfo(credential).then(function (info) {
      var remoteCheck = validateJwtClaims(info);
      if (!remoteCheck.valid) {
        throw new Error('Verificación fallida: ' + remoteCheck.reason);
      }

      var usuario = findDirectoryUser(info.email);
      if (!usuario) {
        throw new Error('La cuenta ' + info.email + ' no tiene un rol activo asignado en este sistema.');
      }

      var session = buildGoogleSession(credential, info, toProfile(usuario, info.picture));
      if (!saveSession(session)) {
        throw new Error('No se pudo guardar la sesión en este navegador.');
      }

      return getCurrentUser();
    });
  }

  var gisPromise = null;
  var gisInitialized = false;

  function loadGisScript() {
    if (gisPromise) return gisPromise;

    gisPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        resolve();
        return;
      }

      var existing = document.querySelector('script[data-resto-gis="1"]');
      var script = existing || document.createElement('script');

      script.addEventListener('load', function () {
        if (window.google && window.google.accounts && window.google.accounts.id) resolve();
        else reject(new Error('La librería de Google se cargó sin interfaz de identidad.'));
      });
      script.addEventListener('error', function () {
        gisPromise = null;
        reject(new Error('No se pudo cargar Google Identity Services.'));
      });

      if (!existing) {
        script.src = CONFIG.GIS_SRC;
        script.async = true;
        script.defer = true;
        script.setAttribute('data-resto-gis', '1');
        document.head.appendChild(script);
      }
    });

    return gisPromise;
  }

  function onCredentialResponse(response) {
    handleGoogleCredential(response && response.credential)
      .then(function (user) {
        if (signInHandler) signInHandler(null, user);
      })
      .catch(function (error) {
        if (signInHandler) signInHandler(error, null);
      });
  }

  var GoogleAuth = {
    isConfigured: isClientIdConfigured,

    init: function (containerId) {
      var container = document.getElementById(containerId || 'googleSignInBtn');
      if (!container) {
        return Promise.resolve({ ready: false, reason: 'No existe el contenedor del botón de Google.' });
      }

      container.innerHTML = '';

      if (!isClientIdConfigured()) {
        return Promise.resolve({
          ready: false,
          reason: 'Acceso con Google no configurado. Defina CONFIG.CLIENT_ID en js/auth.js con el ID de cliente real para habilitarlo.'
        });
      }

      if (window.location.protocol === 'file:') {
        return Promise.resolve({
          ready: false,
          reason: 'El acceso con Google exige servir la aplicación por http o https, no desde el sistema de archivos.'
        });
      }

      return loadGisScript().then(function () {
        if (!gisInitialized) {
          window.google.accounts.id.initialize({
            client_id: CONFIG.CLIENT_ID.trim(),
            callback: onCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          gisInitialized = true;
        }

        window.google.accounts.id.renderButton(container, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 320,
          logo_alignment: 'left'
        });
        return { ready: true, reason: null };
      }).catch(function (error) {
        return { ready: false, reason: error.message };
      });
    },

    handleCredential: handleGoogleCredential
  };

  function resolveAuthoritativeProfile(session) {
    if (!session || typeof session !== 'object') return null;

    if (session.provider === PROVIDER_GOOGLE) {
      var claims = parseJwt(session.idToken);
      var check = validateJwtClaims(claims);
      if (!check.valid) return null;
      var googleUser = findDirectoryUser(claims.email);
      return googleUser ? toProfile(googleUser, claims.picture) : null;
    }

    if (session.provider === PROVIDER_LOCAL) {
      if (!isLocalAccessEnabled()) return null;
      var localUser = findDirectoryUser(session.email);
      return localUser ? toProfile(localUser, '') : null;
    }

    return null;
  }

  function getCurrentUser() {
    var session = loadSession();
    if (!session) return null;

    if (!session.provider || !session.email || !session.expiresAt) {
      clearSession();
      return null;
    }

    if (Date.now() > Number(session.expiresAt)) {
      clearSession();
      return null;
    }

    var profile = resolveAuthoritativeProfile(session);
    if (!profile || Storage.VALID_ROLES.indexOf(profile.rol) === -1) {
      clearSession();
      return null;
    }

    return {
      provider: session.provider,
      username: profile.username,
      email: profile.email,
      nombre: profile.nombre,
      rol: profile.rol,
      picture: profile.picture,
      loginAt: session.loginAt,
      expiresAt: session.expiresAt
    };
  }

  function revalidateSession() {
    var session = loadSession();
    if (!session) return Promise.resolve(null);
    if (session.provider !== PROVIDER_GOOGLE) return Promise.resolve(getCurrentUser());

    return verifyTokenInfo(session.idToken)
      .then(function (info) {
        var check = validateJwtClaims(info);
        if (!check.valid) throw new Error(check.reason);
        if (!findDirectoryUser(info.email)) {
          throw new Error('La cuenta ya no tiene un rol activo asignado.');
        }
        return getCurrentUser();
      })
      .catch(function (error) {
        clearSession();
        throw error;
      });
  }

  function login(identificador, clave) {
    if (!isLocalAccessEnabled()) {
      return { success: false, error: 'El acceso local está deshabilitado. Utilice el acceso con Google.' };
    }

    var entrada = String(identificador === undefined || identificador === null ? '' : identificador).trim();
    var password = String(clave === undefined || clave === null ? '' : clave);

    if (!entrada || !password) {
      return { success: false, error: 'Por favor complete todos los campos.' };
    }

    var email = resolveEmailFromIdentifier(entrada);
    var usuario = email ? findDirectoryUser(email) : null;

    if (!usuario || DEMO_ACCESS[usuario.email] !== password) {
      return { success: false, error: 'Usuario o contraseña incorrectos.' };
    }

    var sessionData = {
      provider: PROVIDER_LOCAL,
      email: usuario.email,
      loginAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_TTL
    };

    if (!saveSession(sessionData)) {
      return { success: false, error: 'No se pudo guardar la sesión en este navegador.' };
    }

    var user = getCurrentUser();
    if (!user) {
      return { success: false, error: 'La sesión no superó la validación posterior al acceso.' };
    }

    return { success: true, user: user };
  }

  function logout() {
    try {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) {
      clearSession();
      return;
    }
    clearSession();
  }

  function requireAuth(allowedRoles) {
    var user = getCurrentUser();
    if (!user) return null;

    if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && allowedRoles.indexOf(user.rol) === -1) {
      deny('Acceso no autorizado para este rol.');
      return null;
    }

    return user;
  }

  function checkRole(allowedRoles) {
    var user = getCurrentUser();
    if (!user) {
      return deny('La sesión ha caducado. Vuelva a iniciar sesión.');
    }
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
    if (allowedRoles.indexOf(user.rol) === -1) {
      return deny('No tiene permisos para realizar esta acción.');
    }
    return true;
  }

  window.GoogleAuth = GoogleAuth;

  window.RestoAuth = {
    CONFIG: CONFIG,
    GoogleAuth: GoogleAuth,
    PROVIDER_GOOGLE: PROVIDER_GOOGLE,
    PROVIDER_LOCAL: PROVIDER_LOCAL,
    isGoogleConfigured: isClientIdConfigured,
    isLocalAccessEnabled: isLocalAccessEnabled,
    parseJwt: parseJwt,
    validateJwtClaims: validateJwtClaims,
    getCurrentUser: getCurrentUser,
    revalidateSession: revalidateSession,
    login: login,
    logout: logout,
    requireAuth: requireAuth,
    checkRole: checkRole,
    setDenialHandler: setDenialHandler,
    setSignInHandler: setSignInHandler
  };

})(window);
