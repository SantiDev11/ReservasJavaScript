(function (window) {
  'use strict';

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str || '')));
    return div.innerHTML;
  }

  function getOrCreateToastContainer() {
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  var TOAST_ICONS = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration !== undefined ? duration : 3500;
    var container = getOrCreateToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    var iconClass = TOAST_ICONS[type] || TOAST_ICONS.info;
    var safeMessage = escapeHtml(message);

    toast.innerHTML =
      '<i class="fas ' + iconClass + ' toast-icon"></i>' +
      '<div class="toast-msg">' + safeMessage + '</div>' +
      '<button class="toast-close" aria-label="Cerrar">&times;</button>';

    var closeBtn = toast.querySelector('.toast-close');
    var dismiss = function () {
      toast.classList.add('hiding');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    };

    closeBtn.addEventListener('click', dismiss);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  window.RestoToast = {
    show: showToast,
    success: function (msg, dur) { showToast(msg, 'success', dur); },
    error: function (msg, dur) { showToast(msg, 'error', dur); },
    warning: function (msg, dur) { showToast(msg, 'warning', dur); },
    info: function (msg, dur) { showToast(msg, 'info', dur); }
  };

  var data = null;
  var currentUser = null;
  var tempDishesForOrder = [];

  var ROLES_SALA = ['administrador', 'mesero'];
  var ROLES_COCINA = ['administrador', 'cocina'];
  var ROLES_DESPACHO = ['administrador', 'mesero', 'despacho'];
  var ROLES_ADMIN = ['administrador'];

  function init(appData, appUser) {
    data = appData;
    currentUser = appUser;
  }

  function hasRole(allowedRoles) {
    return !!currentUser && allowedRoles.indexOf(currentUser.rol) !== -1;
  }

  function findMesa(mesaId) {
    return data.mesas.find(function (m) { return m.id === mesaId; });
  }

  function getMesaNumero(mesaId) {
    var mesa = findMesa(mesaId);
    return mesa ? mesa.numero : '?';
  }

  function getDespachosActivos(pedidoId) {
    return data.despachos.filter(function (d) {
      return d.pedidoId === pedidoId && d.estado !== 'entregado';
    });
  }

  function tienePlatosListos(pedido) {
    return (pedido.platos || []).some(function (pl) { return pl.estado === 'listo'; });
  }

  function mesaTieneReservas(mesaId) {
    return data.reservas.some(function (r) { return r.mesaId === mesaId; });
  }

  function mesaTienePedidoActivo(mesaId) {
    return data.pedidos.some(function (p) { return p.mesaId === mesaId && p.estado === 'activo'; });
  }

  function updateData(newData) {
    data = newData;
  }

  function syncFromStorage(validated) {
    if (!data || !validated) return;
    window.RestoStorage.COLLECTIONS.forEach(function (key) {
      if (Array.isArray(validated[key])) data[key] = validated[key];
    });
  }

  function persist(successMessage) {
    var result = window.RestoStorage.save(data);
    syncFromStorage(result.data);

    if (!result.ok) {
      if (window.RestoToast) {
        window.RestoToast.error('No se pudo guardar en este navegador (' + result.error + ').', 9000);
      }
      return false;
    }

    if (result.removed > 0 && window.RestoToast) {
      window.RestoToast.warning('Se descartaron ' + result.removed + ' registro(s) inválido(s) al guardar.', 6000);
    }

    if (successMessage && window.RestoToast) window.RestoToast.success(successMessage);
    return true;
  }

  function viewDashboard() {
    var today = new Date().toISOString().slice(0, 10);
    var reservasHoy = data.reservas.filter(function (r) { return r.fecha === today; });
    var platosPendientes = data.pedidos.flatMap(function (p) { return p.platos || []; }).filter(function (pl) { return pl.estado === 'pendiente'; });
    var despachosActivos = data.despachos.filter(function (d) { return d.estado === 'ruta' || d.estado === 'pendiente'; });
    var mesasOcupadas = data.mesas.filter(function (m) { return m.estado === 'ocupada'; }).length;

    return '' +
      '<div class="stats-grid">' +
        '<div class="stat-card">' +
          '<div class="stat-icon-wrap stat-icon-amber"><i class="fas fa-calendar-day"></i></div>' +
          '<div class="stat-info">' +
            '<h4>Reservas Hoy</h4>' +
            '<span>' + reservasHoy.length + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon-wrap stat-icon-rose"><i class="fas fa-fire"></i></div>' +
          '<div class="stat-info">' +
            '<h4>Platos Pendientes</h4>' +
            '<span>' + platosPendientes.length + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon-wrap stat-icon-blue"><i class="fas fa-truck-fast"></i></div>' +
          '<div class="stat-info">' +
            '<h4>Despachos</h4>' +
            '<span>' + despachosActivos.length + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-icon-wrap stat-icon-emerald"><i class="fas fa-chair"></i></div>' +
          '<div class="stat-info">' +
            '<h4>Mesas Ocupadas</h4>' +
            '<span>' + mesasOcupadas + '/' + data.mesas.length + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-info-circle"></i> Estado Operativo</h3>' +
          '<span class="badge badge-admin">' + currentUser.rol.toUpperCase() + '</span>' +
        '</div>' +
        '<p style="color:var(--text-secondary); margin-bottom: 16px;">' +
          'Sesión iniciada como <strong>' + escapeHtml(currentUser.nombre) + '</strong> (@' + escapeHtml(currentUser.username) + '). El sistema se encuentra sincronizado con almacenamiento local verificado.' +
        '</p>' +
        '<div style="display:flex; gap:12px; flex-wrap:wrap;">' +
          (hasRole(ROLES_SALA) ?
            '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.openModal(\'reserva\')">' +
              '<i class="fas fa-plus"></i> Nueva Reserva' +
            '</button>' +
            '<button class="btn btn-outline btn-sm" onclick="window.RestoApp.openModal(\'pedido\')">' +
              '<i class="fas fa-utensils"></i> Tomar Pedido' +
            '</button>'
          : '') +
          (hasRole(ROLES_DESPACHO) ?
            '<button class="btn btn-outline btn-sm" onclick="window.RestoApp.openModal(\'despacho\')">' +
              '<i class="fas fa-truck"></i> Crear Despacho' +
            '</button>'
          : '') +
        '</div>' +
      '</div>';
  }

  function viewMesas() {
    var mesasHtml = data.mesas.map(function (m) {
      return '' +
        '<div class="mesa-item ' + m.estado + '" onclick="window.RestoApp.toggleMesaEstado(' + m.id + ')" title="Alternar estado">' +
          '<div class="mesa-icon"><i class="fas fa-chair"></i></div>' +
          '<div class="mesa-num">Mesa #' + m.numero + '</div>' +
          '<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">Capacidad: ' + (m.capacidad || 4) + ' p.</div>' +
          '<span class="badge badge-' + m.estado + '">' + m.estado + '</span>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-th-large"></i> Mapa de Distribución de Mesas</h3>' +
          '<div style="display:flex; gap:8px;">' +
            '<span class="badge badge-disponible">Disponible</span>' +
            '<span class="badge badge-reservada">Reservada</span>' +
            '<span class="badge badge-ocupada">Ocupada</span>' +
          '</div>' +
        '</div>' +
        '<div class="mesas-grid">' + mesasHtml + '</div>' +
      '</div>';
  }

  function viewReservas() {
    var rows;
    if (data.reservas.length === 0) {
      rows = '<tr><td colspan="8"><div class="empty-state"><i class="far fa-calendar-times"></i><p>No hay reservas registradas.</p></div></td></tr>';
    } else {
      rows = data.reservas.map(function (r) {
        return '' +
          '<tr>' +
            '<td>#' + r.id.toString().slice(-4) + '</td>' +
            '<td><strong>' + escapeHtml(r.cliente || 'Reserva Directa') + '</strong></td>' +
            '<td><span class="badge badge-admin">Mesa ' + getMesaNumero(r.mesaId) + '</span></td>' +
            '<td>' + escapeHtml(r.fecha) + '</td>' +
            '<td><i class="far fa-clock"></i> ' + escapeHtml(r.hora) + '</td>' +
            '<td>' + r.personas + ' personas</td>' +
            '<td><span class="badge badge-reservada">Confirmada</span></td>' +
            '<td>' +
              '<button class="btn btn-danger btn-sm" onclick="window.RestoApp.cancelReserva(' + r.id + ')">' +
                '<i class="fas fa-trash-alt"></i> Cancelar' +
              '</button>' +
            '</td>' +
          '</tr>';
      }).join('');
    }

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-calendar-alt"></i> Listado de Reservas Activas</h3>' +
          '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.openModal(\'reserva\')">' +
            '<i class="fas fa-plus"></i> Nueva Reserva' +
          '</button>' +
        '</div>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th>ID</th><th>Cliente</th><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Estado</th><th>Acción</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function viewPedidos() {
    var rows;
    if (data.pedidos.length === 0) {
      rows = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-receipt"></i><p>No hay comandas registradas.</p></div></td></tr>';
    } else {
      rows = data.pedidos.map(function (p) {
        var dishes = (p.platos || []).map(function (pl) {
          var bClass = pl.estado === 'listo' ? 'badge-listo' : (pl.estado === 'preparacion' ? 'badge-preparacion' : 'badge-pendiente');
          return '<span class="badge ' + bClass + '" style="margin:2px;">' + escapeHtml(pl.nombre) + '</span>';
        }).join('');

        return '' +
          '<tr>' +
            '<td><strong>#' + p.id + '</strong></td>' +
            '<td><span class="badge badge-admin">Mesa ' + getMesaNumero(p.mesaId) + '</span></td>' +
            '<td>' + (dishes || '<em>Sin platos</em>') + '</td>' +
            '<td><span class="badge badge-' + (p.estado === 'cerrado' ? 'entregado' : 'disponible') + '">' + escapeHtml(p.estado || 'activo') + '</span></td>' +
            '<td>' +
              (p.estado === 'cerrado'
                ? '<span style="color:var(--text-muted); font-size:0.8rem;">Cerrado</span>'
                : '<button class="btn btn-outline btn-sm" onclick="window.RestoApp.openModal(\'pedido\', ' + p.id + ')">' +
                    '<i class="fas fa-edit"></i> Modificar' +
                  '</button>') +
            '</td>' +
          '</tr>';
      }).join('');
    }

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-receipt"></i> Comandas y Pedidos en Sala</h3>' +
          '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.openModal(\'pedido\')">' +
            '<i class="fas fa-plus"></i> Nuevo Pedido' +
          '</button>' +
        '</div>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th>Comanda</th><th>Mesa</th><th>Platos Solicitados</th><th>Estado</th><th>Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function viewCocina() {
    var allDishes = data.pedidos.flatMap(function (p) {
      return (p.platos || []).map(function (pl, index) {
        return { nombre: pl.nombre, estado: pl.estado, pedidoId: p.id, mesaId: p.mesaId, index: index };
      });
    });

    var pendientes = allDishes.filter(function (pl) { return pl.estado === 'pendiente'; });
    var preparacion = allDishes.filter(function (pl) { return pl.estado === 'preparacion'; });
    var listos = allDishes.filter(function (pl) { return pl.estado === 'listo'; });

    var pendientesHtml = pendientes.length === 0
      ? '<div class="empty-state"><i class="fas fa-utensils"></i><p>No hay platos pendientes.</p></div>'
      : pendientes.map(function (pl) {
          return '' +
            '<div class="ticket-item" style="border-left-color: var(--color-warning);">' +
              '<div class="ticket-info">' +
                '<h5>' + escapeHtml(pl.nombre) + '</h5>' +
                '<p><i class="fas fa-clipboard"></i> Pedido #' + pl.pedidoId + ' &bull; Mesa ' + getMesaNumero(pl.mesaId) + '</p>' +
              '</div>' +
              '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.cocinaAction(' + pl.pedidoId + ', ' + pl.index + ', \'preparacion\')">' +
                '<i class="fas fa-fire"></i> Preparar' +
              '</button>' +
            '</div>';
        }).join('');

    var preparacionHtml = preparacion.length === 0
      ? '<div class="empty-state"><i class="fas fa-fire-burner"></i><p>Nada en preparación actualmente.</p></div>'
      : preparacion.map(function (pl) {
          return '' +
            '<div class="ticket-item" style="border-left-color: var(--color-danger);">' +
              '<div class="ticket-info">' +
                '<h5>' + escapeHtml(pl.nombre) + '</h5>' +
                '<p><i class="fas fa-clipboard"></i> Pedido #' + pl.pedidoId + ' &bull; Mesa ' + getMesaNumero(pl.mesaId) + '</p>' +
              '</div>' +
              '<button class="btn btn-success btn-sm" onclick="window.RestoApp.cocinaAction(' + pl.pedidoId + ', ' + pl.index + ', \'listo\')">' +
                '<i class="fas fa-check"></i> Listo' +
              '</button>' +
            '</div>';
        }).join('');

    var listosRows = listos.length === 0
      ? '<tr><td colspan="4"><div class="empty-state"><p>Sin platos terminados en espera.</p></div></td></tr>'
      : listos.map(function (pl) {
          return '' +
            '<tr>' +
              '<td><strong>' + escapeHtml(pl.nombre) + '</strong></td>' +
              '<td>#' + pl.pedidoId + '</td>' +
              '<td>Mesa ' + getMesaNumero(pl.mesaId) + '</td>' +
              '<td><span class="badge badge-listo">Listo</span></td>' +
            '</tr>';
        }).join('');

    return '' +
      '<div class="kitchen-board">' +
        '<div class="kitchen-col">' +
          '<div class="kitchen-col-header">' +
            '<h4><i class="fas fa-clock" style="color:var(--color-warning);"></i> Pendientes por Iniciar</h4>' +
            '<span class="badge badge-pendiente">' + pendientes.length + '</span>' +
          '</div>' +
          pendientesHtml +
        '</div>' +
        '<div class="kitchen-col">' +
          '<div class="kitchen-col-header">' +
            '<h4><i class="fas fa-fire" style="color:var(--color-danger);"></i> En Preparación</h4>' +
            '<span class="badge badge-preparacion">' + preparacion.length + '</span>' +
          '</div>' +
          preparacionHtml +
        '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:24px;">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-check-double" style="color:var(--color-success);"></i> Platos Listos para Entrega / Despacho</h3>' +
          '<span class="badge badge-listo">' + listos.length + '</span>' +
        '</div>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead><tr><th>Plato</th><th>Pedido</th><th>Mesa</th><th>Estado</th></tr></thead>' +
            '<tbody>' + listosRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function viewDespachos() {
    var rows;
    if (data.despachos.length === 0) {
      rows = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-truck"></i><p>No hay despachos registrados.</p></div></td></tr>';
    } else {
      rows = data.despachos.map(function (d) {
        var platosStr = (d.platos || []).map(escapeHtml).join(', ');
        var estado = d.estado || 'pendiente';
        var badgeClass = estado === 'entregado' ? 'badge-entregado' : (estado === 'ruta' ? 'badge-ruta' : 'badge-pendiente');
        var actionHtml;

        if (estado === 'pendiente') {
          actionHtml = '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.despachoAction(' + d.id + ', \'ruta\')">' +
            '<i class="fas fa-motorcycle"></i> En ruta</button>';
        } else if (estado === 'ruta') {
          actionHtml = '<button class="btn btn-success btn-sm" onclick="window.RestoApp.despachoAction(' + d.id + ', \'entregado\')">' +
            '<i class="fas fa-check-circle"></i> Entregado</button>';
        } else {
          actionHtml = '<span style="color:var(--text-muted); font-size:0.8rem;">Completado</span>';
        }

        return '' +
          '<tr>' +
            '<td><strong>#' + d.id + '</strong></td>' +
            '<td>Pedido #' + d.pedidoId + '</td>' +
            '<td><span class="badge badge-admin">Mesa ' + getMesaNumero(d.mesaId) + '</span></td>' +
            '<td>' + (platosStr || '—') + '</td>' +
            '<td>' + escapeHtml(d.repartidor || 'Sin asignar') + '</td>' +
            '<td><span class="badge ' + badgeClass + '">' + estado + '</span></td>' +
            '<td>' + actionHtml + '</td>' +
          '</tr>';
      }).join('');
    }

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-truck-fast"></i> Despachos y Entregas a Mesas</h3>' +
          '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.openModal(\'despacho\')">' +
            '<i class="fas fa-plus"></i> Nuevo Despacho' +
          '</button>' +
        '</div>' +
        '<div class="table-wrap">' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th>ID</th><th>Pedido</th><th>Destino</th><th>Platos</th><th>Responsable</th><th>Estado</th><th>Acción</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  function viewUsuarios() {
    var esUnicoAdmin = function (usuario) {
      if (usuario.rol !== 'administrador' || !usuario.activo) return false;
      return data.usuarios.filter(function (u) {
        return u.rol === 'administrador' && u.activo;
      }).length <= 1;
    };

    var usersRows = data.usuarios.length === 0
      ? '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-user-slash"></i><p>No hay usuarios registrados.</p></div></td></tr>'
      : data.usuarios.map(function (u) {
          var bloqueado = esUnicoAdmin(u);
          var accionesHtml = bloqueado
            ? '<span style="color:var(--text-muted); font-size:0.8rem;">Último administrador</span>'
            : '<button class="btn btn-outline btn-sm" onclick="window.RestoApp.openModal(\'usuario\', ' + u.id + ')">' +
                '<i class="fas fa-edit"></i> Editar' +
              '</button> ' +
              '<button class="btn btn-danger btn-sm" onclick="window.RestoApp.deleteUsuario(' + u.id + ')">' +
                '<i class="fas fa-trash-alt"></i> Eliminar' +
              '</button>';

          return '' +
            '<tr>' +
              '<td><code>' + escapeHtml(u.email) + '</code></td>' +
              '<td><strong>' + escapeHtml(u.nombre) + '</strong></td>' +
              '<td><span class="badge badge-' + u.rol + '">' + u.rol + '</span></td>' +
              '<td><span class="badge badge-' + (u.activo ? 'disponible' : 'ocupada') + '">' + (u.activo ? 'activo' : 'inactivo') + '</span></td>' +
              '<td>' + accionesHtml + '</td>' +
            '</tr>';
        }).join('');

    return '' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h3><i class="fas fa-user-shield"></i> Usuarios del Sistema y Roles</h3>' +
          '<button class="btn btn-primary btn-sm" onclick="window.RestoApp.openModal(\'usuario\')">' +
            '<i class="fas fa-user-plus"></i> Nuevo Usuario' +
          '</button>' +
        '</div>' +
        '<p style="color:var(--text-secondary); margin-bottom:16px;">' +
          'El correo electrónico es la identidad del usuario: al iniciar sesión con Google, el rol se asigna a partir de esta tabla. Una cuenta que no figure aquí, o que esté inactiva, no obtiene acceso.' +
        '</p>' +
        '<div class="table-wrap" style="margin-bottom:24px;">' +
          '<table>' +
            '<thead>' +
              '<tr>' +
                '<th>Correo</th><th>Nombre Completo</th><th>Rol Asignado</th><th>Estado</th><th>Acciones</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + usersRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="card" style="border-left: 4px solid var(--color-danger);">' +
        '<div class="card-header">' +
          '<h3 style="color:var(--color-danger);"><i class="fas fa-database"></i> Mantenimiento y Restablecimiento</h3>' +
        '</div>' +
        '<p style="color:var(--text-secondary); margin-bottom:16px;">' +
          'Si deseas reiniciar todas las reservas, comandas y pedidos a los datos iniciales por defecto, utiliza el siguiente botón:' +
        '</p>' +
        '<button class="btn btn-danger" onclick="window.RestoApp.resetDemoData()">' +
          '<i class="fas fa-rotate-left"></i> Restablecer Datos por Defecto' +
        '</button>' +
      '</div>';
  }

  function toggleMesaEstado(mesaId) {
    if (!window.RestoAuth.checkRole(ROLES_SALA)) return;
    var mesa = findMesa(mesaId);
    if (!mesa) return;

    var sequence = { disponible: 'reservada', reservada: 'ocupada', ocupada: 'disponible' };
    var nuevoEstado = sequence[mesa.estado] || 'disponible';

    if (nuevoEstado === 'disponible' && mesaTienePedidoActivo(mesa.id)) {
      if (window.RestoToast) {
        window.RestoToast.warning('La mesa #' + mesa.numero + ' tiene un pedido activo y no puede liberarse.');
      }
      return;
    }

    mesa.estado = nuevoEstado;
    var numero = mesa.numero;
    var guardado = persist(null);
    window.RestoApp.refreshView();
    if (guardado && window.RestoToast) window.RestoToast.info('Mesa #' + numero + ' ahora está: ' + nuevoEstado.toUpperCase());
  }

  function liberarMesaSiProcede(mesaId) {
    var mesa = findMesa(mesaId);
    if (!mesa || mesa.estado === 'disponible') return;
    if (mesaTienePedidoActivo(mesaId)) return;
    mesa.estado = mesaTieneReservas(mesaId) ? 'reservada' : 'disponible';
  }

  function cancelReserva(reservaId) {
    if (!window.RestoAuth.checkRole(ROLES_SALA)) return;
    var idx = data.reservas.findIndex(function (r) { return r.id === reservaId; });
    if (idx === -1) return;

    var mesaId = data.reservas[idx].mesaId;
    data.reservas.splice(idx, 1);
    liberarMesaSiProcede(mesaId);

    var guardado = persist('Reserva cancelada correctamente.');
    window.RestoApp.refreshView();
    return guardado;
  }

  function cocinaAction(pedidoId, platoIndex, nuevoEstado) {
    if (!window.RestoAuth.checkRole(ROLES_COCINA)) return;
    var validEstados = ['pendiente', 'preparacion', 'listo'];
    if (validEstados.indexOf(nuevoEstado) === -1) return;

    var pedido = data.pedidos.find(function (p) { return p.id === pedidoId; });
    if (!pedido || !Array.isArray(pedido.platos)) return;

    if (pedido.estado === 'cerrado') {
      if (window.RestoToast) window.RestoToast.warning('El pedido #' + pedidoId + ' ya está cerrado.');
      return;
    }

    var index = Number(platoIndex);
    if (!Number.isInteger(index) || index < 0 || index >= pedido.platos.length) return;

    var plato = pedido.platos[index];
    if (!plato) return;

    plato.estado = nuevoEstado;
    var nombre = plato.nombre;
    var guardado = persist(null);
    window.RestoApp.refreshView();
    if (guardado && window.RestoToast) window.RestoToast.success('Plato "' + nombre + '" actualizado a: ' + nuevoEstado);
  }

  function cerrarPedidoEntregado(despacho) {
    var pedido = data.pedidos.find(function (p) { return p.id === despacho.pedidoId; });
    if (!pedido || pedido.estado === 'cerrado') return false;

    var quedanPlatosVivos = (pedido.platos || []).some(function (pl) { return pl.estado !== 'listo'; });
    if (quedanPlatosVivos || getDespachosActivos(pedido.id).length > 0) return false;

    pedido.estado = 'cerrado';
    liberarMesaSiProcede(pedido.mesaId);
    return true;
  }

  function despachoAction(despachoId, nuevoEstado) {
    if (!window.RestoAuth.checkRole(ROLES_DESPACHO)) return;
    if (window.RestoStorage.VALID_DESPACHO_ESTADOS.indexOf(nuevoEstado) === -1) return;

    var despacho = data.despachos.find(function (d) { return d.id === despachoId; });
    if (!despacho) return;

    if (despacho.estado === 'entregado') {
      if (window.RestoToast) window.RestoToast.warning('El despacho #' + despachoId + ' ya fue entregado.');
      return;
    }

    despacho.estado = nuevoEstado;
    var pedidoCerrado = nuevoEstado === 'entregado' ? cerrarPedidoEntregado(despacho) : false;

    var guardado = persist(null);
    window.RestoApp.refreshView();

    if (guardado && window.RestoToast) {
      window.RestoToast.success('Despacho #' + despachoId + ' ahora está: ' + nuevoEstado);
      if (pedidoCerrado) {
        window.RestoToast.info('Pedido #' + despacho.pedidoId + ' cerrado y mesa liberada.', 5000);
      }
    }
  }

  function renderTempDishesPills() {
    if (!tempDishesForOrder.length) {
      return '<span style="color:var(--text-muted); font-size:0.85rem;">No se han añadido platos aún.</span>';
    }
    return tempDishesForOrder.map(function (pl, idx) {
      return '<span class="badge badge-admin" style="font-size:0.85rem; padding:6px 12px;">' +
        escapeHtml(pl.nombre) +
        ' <i class="fas fa-times" style="cursor:pointer; margin-left:6px;" onclick="window.RestoApp.removePlatoFromOrder(' + idx + ')"></i>' +
      '</span>';
    }).join('');
  }

  function addPlatoToOrder() {
    var select = document.getElementById('modalPlatoSelect');
    if (!select) return;
    var platoId = parseInt(select.value, 10);
    var plato = data.platos.find(function (p) { return p.id === platoId; });
    if (!plato) return;
    tempDishesForOrder.push({ nombre: plato.nombre, estado: 'pendiente', precio: plato.precio });
    var listDiv = document.getElementById('platosOrderList');
    if (listDiv) listDiv.innerHTML = renderTempDishesPills();
  }

  function removePlatoFromOrder(idx) {
    tempDishesForOrder.splice(idx, 1);
    var listDiv = document.getElementById('platosOrderList');
    if (listDiv) listDiv.innerHTML = renderTempDishesPills();
  }

  function closeModal() {
    var overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('open');
    tempDishesForOrder = [];
  }

  function openModal(type, id) {
    if (type === 'reserva' || type === 'pedido') {
      if (!window.RestoAuth.checkRole(ROLES_SALA)) return;
    } else if (type === 'despacho') {
      if (!window.RestoAuth.checkRole(ROLES_DESPACHO)) return;
    } else if (type === 'usuario') {
      if (!window.RestoAuth.checkRole(ROLES_ADMIN)) return;
    }

    tempDishesForOrder = [];
    var title = '';
    var bodyHtml = '';

    if (type === 'reserva') {
      title = 'Nueva Reserva de Mesa';
      var mesasLibres = data.mesas.filter(function (m) { return m.estado !== 'ocupada'; });
      var mesasOpts = mesasLibres.length
        ? mesasLibres.map(function (m) { return '<option value="' + m.id + '">Mesa #' + m.numero + ' (' + (m.capacidad || 4) + ' personas)</option>'; }).join('')
        : '<option disabled>No hay mesas disponibles</option>';

      bodyHtml = '' +
        '<div class="form-group">' +
          '<label>Nombre del Cliente</label>' +
          '<div class="input-wrapper">' +
            '<input type="text" id="modalCliente" class="form-control" placeholder="Ej. Familia Rodríguez" required>' +
            '<i class="fas fa-user input-icon"></i>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Mesa Disponible</label>' +
          '<select id="modalMesa" class="form-control">' + mesasOpts + '</select>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Fecha</label>' +
            '<input type="date" id="modalFecha" class="form-control" value="' + new Date().toISOString().slice(0, 10) + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Hora</label>' +
            '<input type="time" id="modalHora" class="form-control" value="20:00">' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Número de Comensales</label>' +
          '<input type="number" id="modalPersonas" class="form-control" value="2" min="1" max="20">' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" onclick="window.RestoApp.closeModal()">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="window.RestoApp.saveReserva()">Guardar Reserva</button>' +
        '</div>';

    } else if (type === 'pedido') {
      var pedido = id ? data.pedidos.find(function (p) { return p.id === id; }) : null;
      title = pedido ? 'Editar Pedido #' + pedido.id : 'Registrar Nuevo Pedido';
      if (pedido && pedido.platos) {
        tempDishesForOrder = JSON.parse(JSON.stringify(pedido.platos));
      }

      var mesaPedidoOpts = data.mesas.map(function (m) {
        var selected = pedido && pedido.mesaId === m.id ? ' selected' : '';
        return '<option value="' + m.id + '"' + selected + '>Mesa #' + m.numero + ' (' + m.estado + ')</option>';
      }).join('');

      var platoSelectOpts = data.platos.map(function (p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.nombre) + ' - $' + p.precio.toFixed(2) + '</option>';
      }).join('');

      bodyHtml = '' +
        '<div class="form-group">' +
          '<label>Mesa Asignada</label>' +
          '<select id="modalMesaPedido" class="form-control">' + mesaPedidoOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Agregar Plato a la Comanda</label>' +
          '<div style="display:flex; gap:10px;">' +
            '<select id="modalPlatoSelect" class="form-control">' + platoSelectOpts + '</select>' +
            '<button class="btn btn-primary" type="button" onclick="window.RestoApp.addPlatoToOrder()">' +
              '<i class="fas fa-plus"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Platos en la Comanda:</label>' +
          '<div id="platosOrderList" style="min-height:50px; padding:10px; background:#f8fafc; border-radius:var(--radius-sm); border:1px dashed var(--border-color); display:flex; flex-wrap:wrap; gap:6px;">' +
            renderTempDishesPills() +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" onclick="window.RestoApp.closeModal()">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="window.RestoApp.savePedido(' + (id || 'null') + ')">Confirmar Pedido</button>' +
        '</div>';

    } else if (type === 'despacho') {
      title = 'Generar Entrega a Mesa';
      var pedidosDespachables = data.pedidos.filter(function (p) {
        return p.estado === 'activo' && tienePlatosListos(p) && getDespachosActivos(p.id).length === 0;
      });

      var pedidoDespachoOpts = pedidosDespachables.length
        ? pedidosDespachables.map(function (p) {
            return '<option value="' + p.id + '">Pedido #' + p.id + ' (Mesa ' + getMesaNumero(p.mesaId) + ')</option>';
          }).join('')
        : '<option disabled>No hay pedidos con platos listos pendientes de entrega</option>';

      bodyHtml = '' +
        '<div class="form-group">' +
          '<label>Pedido con Platos Listos</label>' +
          '<select id="modalPedidoDespacho" class="form-control">' + pedidoDespachoOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Responsable de la Entrega</label>' +
          '<div class="input-wrapper">' +
            '<input type="text" id="modalRepartidor" class="form-control" placeholder="Nombre del responsable" value="' + escapeHtml(currentUser.nombre) + '">' +
            '<i class="fas fa-user input-icon"></i>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" onclick="window.RestoApp.closeModal()">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="window.RestoApp.saveDespacho()">Crear Despacho</button>' +
        '</div>';

    } else if (type === 'usuario') {
      var usuario = id ? data.usuarios.find(function (u) { return u.id === id; }) : null;
      title = usuario ? 'Editar Usuario' : 'Registrar Nuevo Usuario';

      var rolOpts = window.RestoStorage.VALID_ROLES.map(function (rol) {
        var selected = usuario && usuario.rol === rol ? ' selected' : '';
        return '<option value="' + rol + '"' + selected + '>' + rol + '</option>';
      }).join('');

      bodyHtml = '' +
        '<div class="form-group">' +
          '<label>Correo Electrónico</label>' +
          '<div class="input-wrapper">' +
            '<input type="email" id="modalUsuarioEmail" class="form-control" placeholder="persona@dominio.com" value="' + escapeHtml(usuario ? usuario.email : '') + '">' +
            '<i class="fas fa-envelope input-icon"></i>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label>Nombre Completo</label>' +
          '<div class="input-wrapper">' +
            '<input type="text" id="modalUsuarioNombre" class="form-control" placeholder="Ej. Ana Martínez" value="' + escapeHtml(usuario ? usuario.nombre : '') + '">' +
            '<i class="fas fa-user input-icon"></i>' +
          '</div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label>Rol Asignado</label>' +
            '<select id="modalUsuarioRol" class="form-control">' + rolOpts + '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Estado</label>' +
            '<select id="modalUsuarioActivo" class="form-control">' +
              '<option value="true"' + (!usuario || usuario.activo ? ' selected' : '') + '>activo</option>' +
              '<option value="false"' + (usuario && !usuario.activo ? ' selected' : '') + '>inactivo</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" onclick="window.RestoApp.closeModal()">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="window.RestoApp.saveUsuario(' + (id || 'null') + ')">Guardar Usuario</button>' +
        '</div>';
    }

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('open');
  }

  function saveReserva() {
    if (!window.RestoAuth.checkRole(ROLES_SALA)) return;
    var cliente = window.RestoStorage.sanitizeInput(document.getElementById('modalCliente').value);
    var mesaId = parseInt(document.getElementById('modalMesa').value, 10);
    var fecha = document.getElementById('modalFecha').value;
    var hora = document.getElementById('modalHora').value;
    var personas = parseInt(document.getElementById('modalPersonas').value, 10);

    if (!cliente || isNaN(mesaId) || !window.RestoStorage.isValidDate(fecha) || !window.RestoStorage.isValidTime(hora) || !window.RestoStorage.isValidNumber(personas, 1, 20)) {
      if (window.RestoToast) window.RestoToast.warning('Por favor complete todos los campos de la reserva correctamente.');
      return;
    }

    var mesa = findMesa(mesaId);
    if (!mesa) {
      if (window.RestoToast) window.RestoToast.error('La mesa seleccionada no existe.');
      return;
    }

    if (mesa.estado === 'ocupada') {
      if (window.RestoToast) window.RestoToast.error('La mesa #' + mesa.numero + ' está ocupada.');
      return;
    }

    if (personas > mesa.capacidad) {
      if (window.RestoToast) {
        window.RestoToast.error('La mesa #' + mesa.numero + ' admite ' + mesa.capacidad + ' personas.');
      }
      return;
    }

    var franjaOcupada = data.reservas.some(function (r) {
      return r.mesaId === mesaId && r.fecha === fecha && r.hora === hora;
    });
    if (franjaOcupada) {
      if (window.RestoToast) {
        window.RestoToast.error('La mesa #' + mesa.numero + ' ya tiene una reserva el ' + fecha + ' a las ' + hora + '.');
      }
      return;
    }

    var nuevaReserva = {
      id: window.RestoStorage.nextId(data.reservas, Date.now()),
      cliente: cliente,
      mesaId: mesaId,
      fecha: fecha,
      hora: hora,
      personas: personas
    };

    if (!window.RestoStorage.isValidReserva(nuevaReserva)) {
      if (window.RestoToast) window.RestoToast.error('Los datos de la reserva no superaron la validación.');
      return;
    }

    var estadoPrevio = mesa.estado;
    data.reservas.push(nuevaReserva);
    if (mesa.estado === 'disponible') mesa.estado = 'reservada';

    if (!persist('Reserva agendada para ' + cliente + ' en Mesa #' + mesa.numero + '.')) {
      data.reservas = data.reservas.filter(function (r) { return r.id !== nuevaReserva.id; });
      mesa.estado = estadoPrevio;
      window.RestoApp.refreshView();
      return;
    }

    closeModal();
    window.RestoApp.refreshView();
  }

  function savePedido(id) {
    if (!window.RestoAuth.checkRole(ROLES_SALA)) return;
    var mesaId = parseInt(document.getElementById('modalMesaPedido').value, 10);
    if (!mesaId || isNaN(mesaId)) {
      if (window.RestoToast) window.RestoToast.warning('Seleccione una mesa válida.');
      return;
    }

    if (!tempDishesForOrder.length) {
      if (window.RestoToast) window.RestoToast.warning('Agregue al menos un plato a la comanda.');
      return;
    }

    var mesa = findMesa(mesaId);
    if (!mesa) {
      if (window.RestoToast) window.RestoToast.error('La mesa seleccionada no existe.');
      return;
    }

    var pedido = id ? data.pedidos.find(function (p) { return p.id === id; }) : null;
    if (id && !pedido) {
      if (window.RestoToast) window.RestoToast.error('El pedido #' + id + ' ya no existe.');
      return;
    }

    if (pedido && pedido.estado === 'cerrado') {
      if (window.RestoToast) window.RestoToast.warning('El pedido #' + id + ' está cerrado y no admite cambios.');
      return;
    }

    var candidato = {
      id: pedido ? pedido.id : window.RestoStorage.nextId(data.pedidos, 100),
      mesaId: mesaId,
      cliente: pedido ? pedido.cliente : 'Mesa ' + mesa.numero,
      hora: pedido ? pedido.hora : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estado: 'activo',
      platos: tempDishesForOrder
    };

    if (!window.RestoStorage.isValidPedido(candidato)) {
      if (window.RestoToast) window.RestoToast.error('Los datos del pedido no superaron la validación.');
      return;
    }

    var mesaPrevia = pedido ? pedido.mesaId : null;
    var mensaje;

    if (pedido) {
      pedido.mesaId = candidato.mesaId;
      pedido.platos = candidato.platos;
      mensaje = 'Pedido #' + pedido.id + ' actualizado.';
    } else {
      data.pedidos.push(candidato);
      mensaje = 'Pedido #' + candidato.id + ' registrado y enviado a cocina.';
    }

    mesa.estado = 'ocupada';
    if (mesaPrevia !== null && mesaPrevia !== mesaId) liberarMesaSiProcede(mesaPrevia);

    if (!persist(mensaje)) {
      window.RestoApp.refreshView();
      return;
    }

    closeModal();
    window.RestoApp.refreshView();
  }

  function saveDespacho() {
    if (!window.RestoAuth.checkRole(ROLES_DESPACHO)) return;
    var select = document.getElementById('modalPedidoDespacho');
    if (!select || !select.value) {
      if (window.RestoToast) window.RestoToast.warning('No hay pedidos válidos para despachar.');
      return;
    }

    var pedidoId = parseInt(select.value, 10);
    var pedido = data.pedidos.find(function (p) { return p.id === pedidoId; });
    if (!pedido || pedido.estado !== 'activo') {
      if (window.RestoToast) window.RestoToast.error('El pedido seleccionado no está activo.');
      return;
    }

    if (getDespachosActivos(pedidoId).length > 0) {
      if (window.RestoToast) window.RestoToast.error('El pedido #' + pedidoId + ' ya tiene un despacho en curso.');
      return;
    }

    var platosListos = (pedido.platos || [])
      .filter(function (pl) { return pl.estado === 'listo'; })
      .map(function (pl) { return pl.nombre; });

    if (!platosListos.length) {
      if (window.RestoToast) window.RestoToast.error('El pedido #' + pedidoId + ' no tiene platos listos.');
      return;
    }

    var repartidor = window.RestoStorage.sanitizeInput(document.getElementById('modalRepartidor').value) || currentUser.nombre;

    var nuevoDespacho = {
      id: window.RestoStorage.nextId(data.despachos, 500),
      pedidoId: pedidoId,
      mesaId: pedido.mesaId,
      repartidor: repartidor,
      platos: platosListos,
      estado: 'pendiente'
    };

    if (!window.RestoStorage.isValidDespacho(nuevoDespacho)) {
      if (window.RestoToast) window.RestoToast.error('Los datos del despacho no superaron la validación.');
      return;
    }

    data.despachos.push(nuevoDespacho);

    if (!persist('Despacho #' + nuevoDespacho.id + ' creado para la mesa ' + getMesaNumero(pedido.mesaId) + '.')) {
      data.despachos = data.despachos.filter(function (d) { return d.id !== nuevoDespacho.id; });
      window.RestoApp.refreshView();
      return;
    }

    closeModal();
    window.RestoApp.refreshView();
  }

  function saveUsuario(id) {
    if (!window.RestoAuth.checkRole(ROLES_ADMIN)) return;

    var email = window.RestoStorage.normalizeEmail(document.getElementById('modalUsuarioEmail').value);
    var nombre = window.RestoStorage.sanitizeInput(document.getElementById('modalUsuarioNombre').value);
    var rol = document.getElementById('modalUsuarioRol').value;
    var activo = document.getElementById('modalUsuarioActivo').value === 'true';

    if (!window.RestoStorage.isValidEmail(email)) {
      if (window.RestoToast) window.RestoToast.warning('Introduzca un correo electrónico válido.');
      return;
    }

    if (!window.RestoStorage.isValidText(nombre)) {
      if (window.RestoToast) window.RestoToast.warning('Introduzca un nombre válido.');
      return;
    }

    if (!window.RestoStorage.isValidRol(rol)) {
      if (window.RestoToast) window.RestoToast.warning('Seleccione un rol válido.');
      return;
    }

    var existente = id ? data.usuarios.find(function (u) { return u.id === id; }) : null;
    if (id && !existente) {
      if (window.RestoToast) window.RestoToast.error('El usuario ya no existe.');
      return;
    }

    var emailDuplicado = data.usuarios.some(function (u) {
      return u.email === email && (!existente || u.id !== existente.id);
    });
    if (emailDuplicado) {
      if (window.RestoToast) window.RestoToast.error('Ya existe un usuario con el correo ' + email + '.');
      return;
    }

    var candidato = {
      id: existente ? existente.id : window.RestoStorage.nextId(data.usuarios, 1),
      email: email,
      nombre: nombre,
      rol: rol,
      activo: activo
    };

    if (!window.RestoStorage.isValidUsuario(candidato)) {
      if (window.RestoToast) window.RestoToast.error('Los datos del usuario no superaron la validación.');
      return;
    }

    if (existente && dejariaSinAdministrador(existente, candidato)) {
      if (window.RestoToast) {
        window.RestoToast.error('Debe permanecer al menos un administrador activo.');
      }
      return;
    }

    if (existente) {
      existente.email = candidato.email;
      existente.nombre = candidato.nombre;
      existente.rol = candidato.rol;
      existente.activo = candidato.activo;
    } else {
      data.usuarios.push(candidato);
    }

    if (!persist('Usuario ' + email + ' guardado correctamente.')) {
      window.RestoApp.refreshView();
      return;
    }

    closeModal();
    window.RestoApp.refreshView();
  }

  function dejariaSinAdministrador(existente, candidato) {
    var seguiraSiendoAdmin = candidato && candidato.rol === 'administrador' && candidato.activo;
    if (seguiraSiendoAdmin) return false;

    return data.usuarios.filter(function (u) {
      return u.rol === 'administrador' && u.activo && u.id !== existente.id;
    }).length === 0;
  }

  function deleteUsuario(usuarioId) {
    if (!window.RestoAuth.checkRole(ROLES_ADMIN)) return;

    var usuario = data.usuarios.find(function (u) { return u.id === usuarioId; });
    if (!usuario) return;

    if (dejariaSinAdministrador(usuario, null)) {
      if (window.RestoToast) {
        window.RestoToast.error('Debe permanecer al menos un administrador activo.');
      }
      return;
    }

    if (usuario.email === currentUser.email) {
      if (window.RestoToast) window.RestoToast.error('No puede eliminar su propia cuenta en uso.');
      return;
    }

    data.usuarios = data.usuarios.filter(function (u) { return u.id !== usuarioId; });

    persist('Usuario ' + usuario.email + ' eliminado.');
    window.RestoApp.refreshView();
  }

  window.RestoModules = {
    escapeHtml: escapeHtml,
    init: init,
    updateData: updateData,
    viewDashboard: viewDashboard,
    viewMesas: viewMesas,
    viewReservas: viewReservas,
    viewPedidos: viewPedidos,
    viewCocina: viewCocina,
    viewDespachos: viewDespachos,
    viewUsuarios: viewUsuarios,
    toggleMesaEstado: toggleMesaEstado,
    cancelReserva: cancelReserva,
    cocinaAction: cocinaAction,
    despachoAction: despachoAction,
    openModal: openModal,
    closeModal: closeModal,
    addPlatoToOrder: addPlatoToOrder,
    removePlatoFromOrder: removePlatoFromOrder,
    saveReserva: saveReserva,
    savePedido: savePedido,
    saveDespacho: saveDespacho,
    saveUsuario: saveUsuario,
    deleteUsuario: deleteUsuario
  };

})(window);
