(function (window) {
  'use strict';

  var STORAGE_KEY = 'restaurante_db';
  var LEGACY_STORAGE_KEY = 'restoData';
  var PROBE_KEY = '__restoStorageProbe__';
  var ENVELOPE_VERSION = 1;

  var lastStorageError = null;
  var lastLoadReport = { available: true, hadStoredData: false, tampered: false, repaired: false, removed: 0 };
  var cachedData = null;

  function isStorageAvailable() {
    try {
      window.localStorage.setItem(PROBE_KEY, '1');
      window.localStorage.removeItem(PROBE_KEY);
      return true;
    } catch (e) {
      lastStorageError = e;
      return false;
    }
  }

  function toBase64(str) {
    return window.btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  }

  function fromBase64(str) {
    return decodeURIComponent(Array.prototype.map.call(window.atob(str), function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  function fingerprint(str) {
    var hash = 0x811c9dc5;
    var mix = 0x9e3779b9;
    for (var i = 0; i < str.length; i++) {
      hash = (hash ^ str.charCodeAt(i)) >>> 0;
      hash = (hash * 0x01000193) >>> 0;
      mix = ((mix + str.charCodeAt(i) * (i + 1)) ^ (mix >>> 7)) >>> 0;
    }
    return hash.toString(16) + '-' + mix.toString(16) + '-' + str.length.toString(16);
  }

  function sealEnvelope(value) {
    try {
      var json = JSON.stringify(value);
      var envelope = { v: ENVELOPE_VERSION, sig: fingerprint(json), payload: json };
      return toBase64(JSON.stringify(envelope));
    } catch (e) {
      lastStorageError = e;
      return null;
    }
  }

  function parseEnvelope(raw) {
    var result = { readable: false, tampered: false, data: null };
    if (typeof raw !== 'string' || raw === '') return result;

    var decoded;
    try {
      decoded = fromBase64(raw);
    } catch (e) {
      return result;
    }

    var envelope;
    try {
      envelope = JSON.parse(decoded);
    } catch (e) {
      return result;
    }

    if (!envelope || typeof envelope !== 'object' || typeof envelope.payload !== 'string') return result;

    result.readable = true;
    if (envelope.sig !== fingerprint(envelope.payload)) {
      result.tampered = true;
      return result;
    }

    try {
      result.data = JSON.parse(envelope.payload);
    } catch (e) {
      result.tampered = true;
    }
    return result;
  }

  function decodeLegacyObject(raw) {
    var candidates = [raw];
    try {
      candidates.unshift(fromBase64(raw));
    } catch (e) {
      lastStorageError = e;
    }

    for (var i = 0; i < candidates.length; i++) {
      try {
        var parsed = JSON.parse(candidates[i]);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      } catch (e) {
        lastStorageError = e;
      }
    }
    return null;
  }

  function openEnvelope(raw) {
    var parsed = parseEnvelope(raw);
    var valid = parsed.readable && !parsed.tampered && parsed.data !== null;
    return { ok: valid, data: valid ? parsed.data : null };
  }

  function secureSet(key, value) {
    var sealed = sealEnvelope(value);
    if (sealed === null) return false;
    try {
      window.localStorage.setItem(key, sealed);
      if (window.localStorage.getItem(LEGACY_STORAGE_KEY)) {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      lastStorageError = null;
      return true;
    } catch (e) {
      lastStorageError = e;
      return false;
    }
  }

  function secureGet(key) {
    var result = { data: null, present: false, tampered: false, legacy: false, unreadable: false };
    var raw;

    try {
      raw = window.localStorage.getItem(key);
      if ((raw === null || raw === undefined || raw === '') && key === STORAGE_KEY) {
        raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch (e) {
      lastStorageError = e;
      result.unreadable = true;
      return result;
    }

    if (raw === null || raw === undefined || raw === '') return result;
    result.present = true;

    var parsed = parseEnvelope(raw);
    if (parsed.readable) {
      result.tampered = parsed.tampered;
      result.data = parsed.data;
      return result;
    }

    var legacy = decodeLegacyObject(raw);
    if (legacy) {
      result.data = legacy;
      result.legacy = true;
      return result;
    }

    result.unreadable = true;
    return result;
  }

  var DEFAULT_MESAS = [
    { id: 1, numero: 1, capacidad: 2, estado: 'disponible' },
    { id: 2, numero: 2, capacidad: 4, estado: 'ocupada' },
    { id: 3, numero: 3, capacidad: 4, estado: 'reservada' },
    { id: 4, numero: 4, capacidad: 6, estado: 'disponible' },
    { id: 5, numero: 5, capacidad: 2, estado: 'disponible' },
    { id: 6, numero: 6, capacidad: 4, estado: 'ocupada' },
    { id: 7, numero: 7, capacidad: 8, estado: 'disponible' },
    { id: 8, numero: 8, capacidad: 2, estado: 'disponible' }
  ];

  var DEFAULT_PLATOS = [
    { id: 1, nombre: 'Ceviche Clásico', precio: 14.50, categoria: 'Entradas' },
    { id: 2, nombre: 'Lomo Saltado Criollo', precio: 18.00, categoria: 'Fondos' },
    { id: 3, nombre: 'Arroz con Mariscos', precio: 16.50, categoria: 'Fondos' },
    { id: 4, nombre: 'Pasta al Pesto con Lomo', precio: 15.00, categoria: 'Pastas' },
    { id: 5, nombre: 'Ensalada Mediterránea', precio: 9.50, categoria: 'Ensaladas' },
    { id: 6, nombre: 'Sopa Parihuela', precio: 16.00, categoria: 'Sopas' },
    { id: 7, nombre: 'Parrillada Mixta Especial', precio: 26.00, categoria: 'Carnes' },
    { id: 8, nombre: 'Flan Artesanal de Coco', precio: 7.00, categoria: 'Postres' }
  ];

  var DEFAULT_RESERVAS = [
    {
      id: 1700000001,
      mesaId: 3,
      cliente: 'Carlos Mendoza',
      fecha: new Date().toISOString().slice(0, 10),
      hora: '20:30',
      personas: 4
    }
  ];

  var DEFAULT_PEDIDOS = [
    {
      id: 101,
      mesaId: 2,
      cliente: 'Mesa 2 - Salón',
      estado: 'activo',
      hora: '19:20',
      platos: [
        { nombre: 'Ceviche Clásico', estado: 'listo', precio: 14.50 },
        { nombre: 'Lomo Saltado Criollo', estado: 'preparacion', precio: 18.00 }
      ]
    },
    {
      id: 102,
      mesaId: 6,
      cliente: 'Mesa 6 - Terraza',
      estado: 'activo',
      hora: '19:40',
      platos: [
        { nombre: 'Parrillada Mixta Especial', estado: 'pendiente', precio: 26.00 },
        { nombre: 'Ensalada Mediterránea', estado: 'listo', precio: 9.50 }
      ]
    }
  ];

  var DEFAULT_DESPACHOS = [
    {
      id: 501,
      pedidoId: 101,
      mesaId: 2,
      platos: ['Ceviche Clásico'],
      estado: 'ruta',
      repartidor: 'Juan Pérez'
    }
  ];

  var DEFAULT_USUARIOS = [
    { id: 1, email: 'admin@restoapp.com', nombre: 'Administrador General', rol: 'administrador', activo: true },
    { id: 2, email: 'mesero@restoapp.com', nombre: 'Mateo González', rol: 'mesero', activo: true },
    { id: 3, email: 'cocina@restoapp.com', nombre: 'Chef Valentina', rol: 'cocina', activo: true },
    { id: 4, email: 'despacho@restoapp.com', nombre: 'Diego Reparto', rol: 'despacho', activo: true }
  ];

  function getDefaultData() {
    return {
      mesas: JSON.parse(JSON.stringify(DEFAULT_MESAS)),
      platos: JSON.parse(JSON.stringify(DEFAULT_PLATOS)),
      reservas: JSON.parse(JSON.stringify(DEFAULT_RESERVAS)),
      pedidos: JSON.parse(JSON.stringify(DEFAULT_PEDIDOS)),
      despachos: JSON.parse(JSON.stringify(DEFAULT_DESPACHOS)),
      usuarios: JSON.parse(JSON.stringify(DEFAULT_USUARIOS))
    };
  }

  var COLLECTIONS = ['mesas', 'platos', 'reservas', 'pedidos', 'despachos', 'usuarios'];
  var VALID_MESA_ESTADOS = ['disponible', 'reservada', 'ocupada'];
  var VALID_PLATO_ESTADOS = ['pendiente', 'preparacion', 'listo'];
  var VALID_DESPACHO_ESTADOS = ['pendiente', 'ruta', 'entregado'];
  var VALID_PEDIDO_ESTADOS = ['activo', 'cerrado'];
  var VALID_ROLES = ['administrador', 'mesero', 'cocina', 'despacho'];

  function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160);
  }

  function isValidText(str) {
    if (typeof str !== 'string') return false;
    var trimmed = str.trim();
    if (trimmed.length === 0 || str.length > 160) return false;
    var cleaned = str.replace(/[^a-zA-Z0-9áéíóúüÁÉÍÓÚÜñÑ\s\-_,.:;#'+@()\/º°&!?]/g, '');
    return cleaned === str;
  }

  function isValidNumber(n, min, max) {
    var num = Number(n);
    if (isNaN(num) || !Number.isInteger(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  }

  function isValidDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) return false;
    var d = new Date(dateStr);
    return !isNaN(d.getTime());
  }

  function isValidTime(timeStr) {
    return typeof timeStr === 'string' && /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(timeStr);
  }

  function normalizeEmail(value) {
    return String(value === undefined || value === null ? '' : value).trim().toLowerCase();
  }

  function isValidEmail(value) {
    var email = normalizeEmail(value);
    if (email.length < 6 || email.length > 120) return false;
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email);
  }

  function isValidRol(value) {
    return VALID_ROLES.indexOf(value) !== -1;
  }

  function isValidMesa(m) {
    return !!m && typeof m === 'object' &&
           isValidNumber(m.id, 1) && isValidNumber(m.numero, 1) &&
           isValidNumber(m.capacidad, 1, 50) &&
           VALID_MESA_ESTADOS.indexOf(m.estado) !== -1;
  }

  function isValidPlato(p) {
    return !!p && typeof p === 'object' &&
           isValidNumber(p.id, 1) && isValidText(p.nombre) &&
           typeof p.precio === 'number' && isFinite(p.precio) && p.precio > 0;
  }

  function isValidReserva(r) {
    return !!r && typeof r === 'object' &&
           isValidNumber(r.id, 1) && isValidNumber(r.mesaId, 1) &&
           isValidText(r.cliente) &&
           isValidDate(r.fecha) && isValidTime(r.hora) &&
           isValidNumber(r.personas, 1, 20);
  }

  function isValidPedidoPlato(pl) {
    return !!pl && typeof pl === 'object' &&
           isValidText(pl.nombre) &&
           VALID_PLATO_ESTADOS.indexOf(pl.estado) !== -1 &&
           (pl.precio === undefined || (typeof pl.precio === 'number' && isFinite(pl.precio) && pl.precio >= 0));
  }

  function isValidPedido(p) {
    return !!p && typeof p === 'object' &&
           isValidNumber(p.id, 1) && isValidNumber(p.mesaId, 1) &&
           VALID_PEDIDO_ESTADOS.indexOf(p.estado || 'activo') !== -1 &&
           Array.isArray(p.platos) && p.platos.length > 0 && p.platos.every(isValidPedidoPlato);
  }

  function isValidDespacho(d) {
    return !!d && typeof d === 'object' &&
           isValidNumber(d.id, 1) && isValidNumber(d.pedidoId, 1) &&
           isValidNumber(d.mesaId, 1) &&
           Array.isArray(d.platos) && d.platos.length > 0 && d.platos.every(isValidText) &&
           VALID_DESPACHO_ESTADOS.indexOf(d.estado) !== -1;
  }

  function isValidUsuario(u) {
    return !!u && typeof u === 'object' &&
           isValidNumber(u.id, 1) &&
           isValidEmail(u.email) &&
           isValidText(u.nombre) &&
           isValidRol(u.rol) &&
           typeof u.activo === 'boolean';
  }

  function cleanMesa(m) {
    if (!m || typeof m !== 'object') return m;
    return { id: m.id, numero: m.numero, capacidad: m.capacidad, estado: m.estado };
  }

  function cleanPlato(p) {
    if (!p || typeof p !== 'object') return p;
    return { id: p.id, nombre: sanitizeInput(p.nombre), precio: p.precio, categoria: sanitizeInput(p.categoria) };
  }

  function cleanReserva(r) {
    if (!r || typeof r !== 'object') return r;
    return {
      id: r.id, mesaId: r.mesaId, cliente: sanitizeInput(r.cliente),
      fecha: r.fecha, hora: r.hora, personas: r.personas
    };
  }

  function cleanPedido(p) {
    if (!p || typeof p !== 'object') return p;
    return {
      id: p.id,
      mesaId: p.mesaId,
      cliente: sanitizeInput(p.cliente),
      estado: p.estado || 'activo',
      hora: sanitizeInput(p.hora),
      platos: Array.isArray(p.platos) ? p.platos.map(function (pl) {
        if (!pl || typeof pl !== 'object') return pl;
        return { nombre: sanitizeInput(pl.nombre), estado: pl.estado, precio: pl.precio };
      }) : p.platos
    };
  }

  function cleanDespacho(d) {
    if (!d || typeof d !== 'object') return d;
    var cleanedPlatos = [];
    if (Array.isArray(d.platos)) {
      d.platos.forEach(function (pl) {
        if (typeof pl === 'string') {
          var cleaned = sanitizeInput(pl);
          if (cleaned) cleanedPlatos.push(cleaned);
        } else if (pl && typeof pl === 'object' && typeof pl.nombre === 'string') {
          var cleanedFromObj = sanitizeInput(pl.nombre);
          if (cleanedFromObj) cleanedPlatos.push(cleanedFromObj);
        }
      });
    }
    return {
      id: d.id,
      pedidoId: d.pedidoId,
      mesaId: d.mesaId,
      repartidor: sanitizeInput(d.repartidor),
      platos: cleanedPlatos,
      estado: d.estado
    };
  }

  function cleanUsuario(u) {
    if (!u || typeof u !== 'object') return u;
    return {
      id: u.id,
      email: normalizeEmail(u.email),
      nombre: sanitizeInput(u.nombre),
      rol: u.rol,
      activo: u.activo !== false
    };
  }

  function collectValid(source, cleaner, validator, counter, extraKey) {
    var seenId = {};
    var seenExtra = {};
    var output = [];
    if (!Array.isArray(source)) {
      if (source !== undefined && source !== null) counter.removed++;
      return output;
    }
    source.forEach(function (item) {
      var cleaned = cleaner(item);
      if (!validator(cleaned)) {
        counter.removed++;
        return;
      }
      if (seenId[cleaned.id]) {
        counter.removed++;
        return;
      }
      if (extraKey) {
        var key = extraKey(cleaned);
        if (seenExtra[key]) {
          counter.removed++;
          return;
        }
        seenExtra[key] = true;
      }
      seenId[cleaned.id] = true;
      output.push(cleaned);
    });
    return output;
  }

  function mergeCatalog(source, defaults, cleaner, validator, counter) {
    var byId = {};
    defaults.forEach(function (item) { byId[item.id] = item; });
    if (Array.isArray(source)) {
      source.forEach(function (item) {
        var cleaned = cleaner(item);
        if (validator(cleaned)) {
          byId[cleaned.id] = cleaned;
        } else if (item !== undefined && item !== null) {
          counter.removed++;
        }
      });
    } else if (source !== undefined && source !== null) {
      counter.removed++;
    }
    return Object.keys(byId)
      .map(function (key) { return byId[key]; })
      .sort(function (a, b) { return a.id - b.id; });
  }

  function countRecords(obj) {
    return COLLECTIONS.reduce(function (total, key) {
      return total + (Array.isArray(obj[key]) ? obj[key].length : 0);
    }, 0);
  }

  function usuarioEmailKey(u) {
    return u.email;
  }

  function ensureAdministrador(usuarios, defaults, counter) {
    var hasActiveAdmin = usuarios.some(function (u) {
      return u.rol === 'administrador' && u.activo;
    });
    if (hasActiveAdmin) return usuarios;

    var fallback = defaults.filter(function (u) { return u.rol === 'administrador'; })[0];
    if (!fallback) return usuarios;

    var restored = usuarios.filter(function (u) {
      return u.id !== fallback.id && u.email !== fallback.email;
    });
    restored.push(JSON.parse(JSON.stringify(fallback)));
    counter.restoredAdmin = true;
    return restored.sort(function (a, b) { return a.id - b.id; });
  }

  function normalizeAndValidate(input) {
    var defaults = getDefaultData();
    var counter = { removed: 0, restoredAdmin: false };

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { data: defaults, removed: 0, repaired: input !== null && input !== undefined };
    }

    var normalized = {
      mesas: mergeCatalog(input.mesas, defaults.mesas, cleanMesa, isValidMesa, counter),
      platos: mergeCatalog(input.platos, defaults.platos, cleanPlato, isValidPlato, counter),
      reservas: collectValid(input.reservas, cleanReserva, isValidReserva, counter),
      pedidos: collectValid(input.pedidos, cleanPedido, isValidPedido, counter),
      despachos: collectValid(input.despachos, cleanDespacho, isValidDespacho, counter),
      usuarios: collectValid(input.usuarios, cleanUsuario, isValidUsuario, counter, usuarioEmailKey)
    };

    normalized.usuarios = ensureAdministrador(normalized.usuarios, defaults.usuarios, counter);

    var repaired = counter.removed > 0 || counter.restoredAdmin || countRecords(input) !== countRecords(normalized);

    return { data: normalized, removed: counter.removed, repaired: repaired };
  }

  function nextId(list, floorValue) {
    var candidate = floorValue || 1;
    (Array.isArray(list) ? list : []).forEach(function (item) {
      if (item && typeof item.id === 'number' && item.id >= candidate) candidate = item.id + 1;
    });
    return candidate;
  }

  window.RestoStorage = {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY,
    COLLECTIONS: COLLECTIONS,
    VALID_ROLES: VALID_ROLES,
    VALID_MESA_ESTADOS: VALID_MESA_ESTADOS,
    VALID_PLATO_ESTADOS: VALID_PLATO_ESTADOS,
    VALID_DESPACHO_ESTADOS: VALID_DESPACHO_ESTADOS,
    getDefaultData: getDefaultData,
    sanitizeInput: sanitizeInput,
    normalizeEmail: normalizeEmail,
    isValidText: isValidText,
    isValidNumber: isValidNumber,
    isValidDate: isValidDate,
    isValidTime: isValidTime,
    isValidEmail: isValidEmail,
    isValidRol: isValidRol,
    isValidMesa: isValidMesa,
    isValidPlato: isValidPlato,
    isValidReserva: isValidReserva,
    isValidPedido: isValidPedido,
    isValidDespacho: isValidDespacho,
    isValidUsuario: isValidUsuario,
    isAvailable: isStorageAvailable,
    nextId: nextId,
    sealEnvelope: sealEnvelope,
    openEnvelope: openEnvelope,

    getLastReport: function () {
      return lastLoadReport;
    },

    getCollection: function (name) {
      if (!cachedData) window.RestoStorage.load();
      return Array.isArray(cachedData[name]) ? cachedData[name] : [];
    },

    getLastError: function () {
      if (!lastStorageError) return null;
      return lastStorageError.name || 'StorageError';
    },

    load: function () {
      var available = isStorageAvailable();
      var stored = secureGet(STORAGE_KEY);
      var normalized = normalizeAndValidate(stored.data);
      var needsRewrite = available && (!stored.present || stored.unreadable || stored.tampered || stored.legacy || normalized.repaired);
      var written = false;

      if (needsRewrite) {
        written = secureSet(STORAGE_KEY, normalized.data);
      }

      lastLoadReport = {
        available: available,
        hadStoredData: stored.present,
        tampered: stored.tampered,
        unreadable: stored.unreadable,
        repaired: normalized.repaired || stored.tampered || stored.unreadable,
        removed: normalized.removed,
        rewritten: written
      };

      cachedData = normalized.data;
      return normalized.data;
    },

    save: function (payload) {
      var normalized = normalizeAndValidate(payload);
      var ok = secureSet(STORAGE_KEY, normalized.data);
      cachedData = normalized.data;
      return {
        ok: ok,
        data: normalized.data,
        removed: normalized.removed,
        error: ok ? null : (lastStorageError && lastStorageError.name) || 'StorageError'
      };
    },

    reset: function () {
      var initial = getDefaultData();
      var ok = secureSet(STORAGE_KEY, initial);
      cachedData = initial;
      return { ok: ok, data: initial, removed: 0, error: ok ? null : (lastStorageError && lastStorageError.name) || 'StorageError' };
    }
  };

})(window);
