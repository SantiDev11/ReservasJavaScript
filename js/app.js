(function (window, document) {
  'use strict';

  var currentUser = null;
  var data = null;
  var currentView = 'dashboard';
  var clockTimer = null;
  var loginBound = false;
  var dashboardBound = false;
  var lampOn = false;
  var audioCtx = null;
  var LAMP_KEY = 'restoLampOn';

  var DOM = {};

  var MENU_ITEMS = [
    { id: 'dashboard', label: 'Panel de Control', icon: 'fa-chart-pie', roles: ['administrador', 'mesero', 'cocina', 'despacho'] },
    { id: 'mesas', label: 'Gestión de Mesas', icon: 'fa-chair', roles: ['administrador', 'mesero'] },
    { id: 'reservas', label: 'Reservas', icon: 'fa-calendar-check', roles: ['administrador', 'mesero'] },
    { id: 'pedidos', label: 'Pedidos / Comandas', icon: 'fa-clipboard-list', roles: ['administrador', 'mesero'] },
    { id: 'cocina', label: 'Cola de Cocina', icon: 'fa-fire', roles: ['administrador', 'cocina'] },
    { id: 'despachos', label: 'Despachos / Entregas', icon: 'fa-truck-fast', roles: ['administrador', 'mesero', 'despacho'] },
    { id: 'usuarios', label: 'Administración', icon: 'fa-sliders-h', roles: ['administrador'] }
  ];

  var VIEW_TITLES = {
    dashboard: 'Panel de Control',
    mesas: 'Gestión y Estado de Mesas',
    reservas: 'Gestión de Reservas',
    pedidos: 'Pedidos Activos',
    cocina: 'Cola de Producción en Cocina',
    despachos: 'Despachos y Entregas',
    usuarios: 'Configuración y Datos del Sistema'
  };

  function initDOM() {
    DOM.loginView = document.getElementById('loginView');
    DOM.dashboardView = document.getElementById('dashboardView');
    DOM.loginForm = document.getElementById('loginForm');
    DOM.loginUser = document.getElementById('loginUser');
    DOM.loginPass = document.getElementById('loginPass');
    DOM.togglePassword = document.getElementById('togglePassword');
    DOM.submitBtn = document.getElementById('submitBtn');
    DOM.googleSignInBtn = document.getElementById('googleSignInBtn');
    DOM.googleAuthStatus = document.getElementById('googleAuthStatus');
    DOM.localAccessBlock = document.getElementById('localAccessBlock');
    DOM.lampSwitch = document.getElementById('lampSwitch');
    DOM.lockNotice = document.getElementById('lockNotice');
    DOM.forgotPassLink = document.getElementById('forgotPassLink');
    DOM.createAccountLink = document.getElementById('createAccountLink');
    DOM.sidebar = document.getElementById('sidebar');
    DOM.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    DOM.menuContainer = document.getElementById('menuContainer');
    DOM.pageContent = document.getElementById('pageContent');
    DOM.viewTitle = document.getElementById('viewTitle');
    DOM.roleBadge = document.getElementById('roleBadge');
    DOM.userNameDisplay = document.getElementById('userNameDisplay');
    DOM.userRoleDisplay = document.getElementById('userRoleDisplay');
    DOM.userAvatarDisplay = document.getElementById('userAvatarDisplay');
    DOM.hamburgerBtn = document.getElementById('hamburgerBtn');
    DOM.logoutBtn = document.getElementById('logoutBtn');
    DOM.liveClock = document.getElementById('liveClock');
    DOM.modalOverlay = document.getElementById('modalOverlay');
    DOM.modalCloseBtn = document.getElementById('modalCloseBtn');
  }

  function startLiveClock() {
    if (clockTimer !== null) return;
    var update = function () {
      if (!DOM.liveClock) return;
      var now = new Date();
      DOM.liveClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    update();
    clockTimer = window.setInterval(update, 1000);
  }

  function stopLiveClock() {
    if (clockTimer === null) return;
    window.clearInterval(clockTimer);
    clockTimer = null;
  }

  function getMenuItems(role) {
    return MENU_ITEMS.filter(function (item) { return item.roles.indexOf(role) !== -1; });
  }

  function isViewAllowed(viewId, role) {
    return getMenuItems(role).some(function (item) { return item.id === viewId; });
  }

  function renderSidebarMenu() {
    if (!currentUser || !DOM.menuContainer) return;

    DOM.menuContainer.innerHTML =
      '<div class="menu-label">Navegación</div>' +
      getMenuItems(currentUser.rol).map(function (item) {
        return '<div class="menu-item ' + (item.id === currentView ? 'active' : '') + '" data-view="' + item.id + '">' +
          '<i class="fas ' + item.icon + '"></i>' +
          '<span>' + item.label + '</span>' +
        '</div>';
      }).join('');

    DOM.menuContainer.querySelectorAll('.menu-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var view = el.getAttribute('data-view');
        if (view) switchView(view);
        closeMobileSidebar();
      });
    });
  }

  function closeMobileSidebar() {
    if (DOM.sidebar) DOM.sidebar.classList.remove('open');
    if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.classList.remove('open');
  }

  function switchView(viewId) {
    if (!currentUser) return;

    if (!isViewAllowed(viewId, currentUser.rol)) {
      if (window.RestoToast) window.RestoToast.error('No tienes acceso a esta sección.');
      return;
    }

    currentView = viewId;

    if (DOM.viewTitle) DOM.viewTitle.textContent = VIEW_TITLES[viewId] || 'Panel';

    if (DOM.menuContainer) {
      DOM.menuContainer.querySelectorAll('.menu-item').forEach(function (el) {
        el.classList.toggle('active', el.getAttribute('data-view') === viewId);
      });
    }

    var Mod = window.RestoModules;
    var contentHtml = '';
    switch (viewId) {
      case 'dashboard': contentHtml = Mod.viewDashboard(); break;
      case 'mesas': contentHtml = Mod.viewMesas(); break;
      case 'reservas': contentHtml = Mod.viewReservas(); break;
      case 'pedidos': contentHtml = Mod.viewPedidos(); break;
      case 'cocina': contentHtml = Mod.viewCocina(); break;
      case 'despachos': contentHtml = Mod.viewDespachos(); break;
      case 'usuarios': contentHtml = Mod.viewUsuarios(); break;
      default: contentHtml = '';
    }

    if (DOM.pageContent) {
      DOM.pageContent.innerHTML = '<div class="view-section active">' + contentHtml + '</div>';
    }
  }

  function refreshView() {
    if (!currentUser) return;
    if (!isViewAllowed(currentView, currentUser.rol)) currentView = 'dashboard';
    switchView(currentView);
  }

  function resetDemoData() {
    if (!window.RestoAuth.checkRole(['administrador'])) return;
    if (!window.confirm('¿Confirmas que deseas reiniciar todos los datos a los valores de prueba por defecto?')) return;

    var result = window.RestoStorage.reset();
    data = result.data;
    window.RestoModules.updateData(data);
    refreshView();

    if (!result.ok) {
      if (window.RestoToast) window.RestoToast.error('No se pudo escribir en el almacenamiento (' + result.error + ').', 9000);
      return;
    }
    if (window.RestoToast) window.RestoToast.success('Datos restablecidos con éxito.');
  }

  function reportStorageHealth() {
    var report = window.RestoStorage.getLastReport();
    if (!window.RestoToast) return;

    if (!report.available) {
      window.RestoToast.error('Este navegador está bloqueando localStorage. Nada de lo que hagas se guardará al recargar.', 12000);
      return;
    }
    if (report.tampered) {
      window.RestoToast.warning('Se detectó manipulación externa en los datos guardados. Se restauró una versión validada.', 9000);
      return;
    }
    if (report.repaired) {
      window.RestoToast.warning('Se detectaron inconsistencias en los datos guardados: ' + report.removed + ' registro(s) inválido(s) descartado(s).', 9000);
    }
  }

  function showGoogleStatus(message) {
    if (!DOM.googleAuthStatus) return;
    if (!message) {
      DOM.googleAuthStatus.textContent = '';
      DOM.googleAuthStatus.style.display = 'none';
      return;
    }
    DOM.googleAuthStatus.textContent = message;
    DOM.googleAuthStatus.style.display = 'block';
  }

  function setupGoogleSignIn() {
    window.RestoAuth.setSignInHandler(function (error, user) {
      if (error) {
        if (window.RestoToast) window.RestoToast.error(error.message, 8000);
        return;
      }
      if (window.RestoToast) {
        window.RestoToast.success('Bienvenido ' + user.nombre + ' (' + user.rol.toUpperCase() + ')');
      }
      renderSession();
    });

    window.GoogleAuth.init('googleSignInBtn').then(function (status) {
      showGoogleStatus(status.ready ? '' : status.reason);
    });
  }

  function submitLocalLogin() {
    var username = DOM.loginUser ? DOM.loginUser.value.trim() : '';
    var password = DOM.loginPass ? DOM.loginPass.value : '';

    if (!username) {
      if (DOM.loginUser) DOM.loginUser.focus();
      if (window.RestoToast) window.RestoToast.warning('Por favor ingrese su usuario o correo.');
      return;
    }

    if (!password) {
      if (DOM.loginPass) DOM.loginPass.focus();
      if (window.RestoToast) window.RestoToast.warning('Por favor ingrese su contraseña.');
      return;
    }

    var originalBtnText = DOM.submitBtn ? DOM.submitBtn.innerHTML : '';
    if (DOM.submitBtn) {
      DOM.submitBtn.disabled = true;
      DOM.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';
    }

    var result = window.RestoAuth.login(username, password);

    if (DOM.submitBtn) {
      DOM.submitBtn.disabled = false;
      DOM.submitBtn.innerHTML = originalBtnText;
    }

    if (!result.success) {
      if (window.RestoToast) window.RestoToast.error(result.error);
      return;
    }

    if (DOM.loginPass) DOM.loginPass.value = '';
    if (window.RestoToast) {
      window.RestoToast.success('¡Bienvenido ' + result.user.nombre + '!');
    }
    renderSession();
  }

  function playSwitchSound() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();

      var now = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.06);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {
      /* El navegador bloqueó el audio: la funcionalidad continúa igual. */
    }
  }

  function setLoginControlsEnabled(enabled) {
    var controls = [
      DOM.loginUser, DOM.loginPass, DOM.togglePassword, DOM.submitBtn,
      DOM.forgotPassLink, DOM.createAccountLink
    ];
    controls.forEach(function (el) {
      if (el) el.disabled = !enabled;
    });
    document.querySelectorAll('.role-pill-btn').forEach(function (el) {
      el.disabled = !enabled;
    });
    if (DOM.googleSignInBtn) {
      if (enabled) DOM.googleSignInBtn.removeAttribute('inert');
      else DOM.googleSignInBtn.setAttribute('inert', '');
    }
  }

  function applyLampState(userTriggered) {
    if (DOM.loginView) DOM.loginView.classList.toggle('is-locked', !lampOn);
    setLoginControlsEnabled(lampOn);

    if (DOM.lampSwitch) {
      DOM.lampSwitch.setAttribute('aria-pressed', lampOn ? 'true' : 'false');
      DOM.lampSwitch.setAttribute(
        'aria-label',
        lampOn ? 'Apagar la lámpara' : 'Encender la lámpara para desbloquear el acceso'
      );
    }

    try {
      window.sessionStorage.setItem(LAMP_KEY, lampOn ? '1' : '0');
    } catch (e) {
      /* sessionStorage no disponible: el estado vive solo en memoria. */
    }

    if (!userTriggered) return;

    playSwitchSound();

    if (DOM.lampSwitch) {
      DOM.lampSwitch.classList.remove('tugging');
      void DOM.lampSwitch.offsetWidth;
      DOM.lampSwitch.classList.add('tugging');
      window.setTimeout(function () {
        if (DOM.lampSwitch) DOM.lampSwitch.classList.remove('tugging');
      }, 480);
    }

    if (lampOn) {
      if (window.RestoToast) window.RestoToast.info('Lámpara encendida · acceso desbloqueado', 2200);
      window.setTimeout(function () {
        try { if (DOM.loginUser) DOM.loginUser.focus(); } catch (e) {}
      }, 220);
    }
  }

  function bindLoginView() {
    if (loginBound) return;
    loginBound = true;

    if (DOM.lampSwitch) {
      DOM.lampSwitch.addEventListener('click', function () {
        lampOn = !lampOn;
        applyLampState(true);
      });
    }

    if (DOM.forgotPassLink) {
      DOM.forgotPassLink.addEventListener('click', function () {
        if (window.RestoToast) {
          window.RestoToast.info('Las cuentas reales se gestionan con Google. Para la demo, usa el panel de Acceso Rápido de Prueba.', 6000);
        }
      });
    }

    if (DOM.createAccountLink) {
      DOM.createAccountLink.addEventListener('click', function () {
        if (window.RestoToast) {
          window.RestoToast.info('Tu cuenta se crea automáticamente al iniciar sesión con Google por primera vez.', 6000);
        }
      });
    }

    if (DOM.togglePassword && DOM.loginPass) {
      DOM.togglePassword.addEventListener('click', function () {
        var isPassword = DOM.loginPass.type === 'password';
        DOM.loginPass.type = isPassword ? 'text' : 'password';
        var icon = DOM.togglePassword.querySelector('i');
        if (icon) icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      });
    }

    document.querySelectorAll('.role-pill-btn').forEach(function (pill) {
      pill.addEventListener('click', function () {
        document.querySelectorAll('.role-pill-btn').forEach(function (p) { p.classList.remove('active'); });
        pill.classList.add('active');

        var role = pill.getAttribute('data-role');
        if (!role || !DOM.loginUser || !DOM.loginPass) return;
        DOM.loginUser.value = role;
        DOM.loginPass.value = role + '123';
        if (window.RestoToast) {
          window.RestoToast.info('Credenciales demo seleccionadas: ' + role.toUpperCase(), 2000);
        }
      });
    });

    if (DOM.loginForm) {
      DOM.loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitLocalLogin();
      });
    }

    setupGoogleSignIn();
  }

  function renderLoginView() {
    currentUser = null;
    stopLiveClock();
    window.RestoModules.closeModal();

    document.body.className = 'login-body';
    if (DOM.dashboardView) DOM.dashboardView.hidden = true;
    if (DOM.loginView) DOM.loginView.hidden = false;

    var localEnabled = window.RestoAuth.isLocalAccessEnabled();
    if (DOM.localAccessBlock) DOM.localAccessBlock.hidden = !localEnabled;

    var remembered = false;
    try {
      remembered = window.sessionStorage.getItem(LAMP_KEY) === '1';
    } catch (e) {
      remembered = false;
    }
    lampOn = remembered;
    applyLampState(false);

    bindLoginView();
  }

  function renderUserProfile(user) {
    if (DOM.userNameDisplay) DOM.userNameDisplay.textContent = user.nombre;
    if (DOM.userRoleDisplay) DOM.userRoleDisplay.textContent = user.rol;

    if (DOM.userAvatarDisplay) {
      DOM.userAvatarDisplay.textContent = '';
      if (user.picture) {
        var avatar = document.createElement('img');
        avatar.src = user.picture;
        avatar.alt = '';
        DOM.userAvatarDisplay.appendChild(avatar);
      } else {
        DOM.userAvatarDisplay.textContent = user.nombre.charAt(0).toUpperCase();
      }
    }

    if (DOM.roleBadge) {
      DOM.roleBadge.textContent = user.rol.toUpperCase();
      DOM.roleBadge.className = 'badge badge-' + user.rol;
    }
  }

  function bindDashboardView() {
    if (dashboardBound) return;
    dashboardBound = true;

    if (DOM.hamburgerBtn) {
      DOM.hamburgerBtn.addEventListener('click', function () {
        if (DOM.sidebar) DOM.sidebar.classList.toggle('open');
        if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.classList.toggle('open');
      });
    }

    if (DOM.sidebarBackdrop) {
      DOM.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    }

    if (DOM.logoutBtn) {
      DOM.logoutBtn.addEventListener('click', function () {
        if (!window.confirm('¿Cerrar sesión?')) return;
        window.RestoAuth.logout();
        renderSession();
      });
    }

    if (DOM.modalCloseBtn) {
      DOM.modalCloseBtn.addEventListener('click', function () {
        window.RestoModules.closeModal();
      });
    }

    if (DOM.modalOverlay) {
      DOM.modalOverlay.addEventListener('click', function (e) {
        if (e.target === DOM.modalOverlay) window.RestoModules.closeModal();
      });
    }
  }

  function renderDashboardView(user) {
    currentUser = user;

    document.body.className = 'dashboard-layout';
    if (DOM.loginView) DOM.loginView.hidden = true;
    if (DOM.dashboardView) DOM.dashboardView.hidden = false;

    data = window.RestoStorage.load();
    window.RestoModules.init(data, currentUser);
    reportStorageHealth();

    if (currentUser.provider === window.RestoAuth.PROVIDER_GOOGLE) {
      window.RestoAuth.revalidateSession().catch(function () {
        if (window.RestoToast) {
          window.RestoToast.error('Tu sesión de Google ya no es válida. Vuelve a iniciar sesión.', 6000);
        }
        window.setTimeout(renderSession, 1200);
      });
    }

    renderUserProfile(currentUser);
    bindDashboardView();

    currentView = 'dashboard';
    closeMobileSidebar();
    renderSidebarMenu();
    switchView('dashboard');
    startLiveClock();
  }

  function renderSession() {
    var user = window.RestoAuth.requireAuth();
    if (user) renderDashboardView(user);
    else renderLoginView();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDOM();
    window.RestoAuth.setDenialHandler(function (message) {
      if (window.RestoToast) window.RestoToast.error(message);
    });
    renderSession();
  });

  window.RestoApp = {
    switchView: switchView,
    refreshView: refreshView,
    resetDemoData: resetDemoData,
    toggleMesaEstado: function (id) { window.RestoModules.toggleMesaEstado(id); },
    cancelReserva: function (id) { window.RestoModules.cancelReserva(id); },
    cocinaAction: function (pedidoId, platoIndex, nuevoEstado) { window.RestoModules.cocinaAction(pedidoId, platoIndex, nuevoEstado); },
    despachoAction: function (despachoId, nuevoEstado) { window.RestoModules.despachoAction(despachoId, nuevoEstado); },
    openModal: function (type, id) { window.RestoModules.openModal(type, id); },
    closeModal: function () { window.RestoModules.closeModal(); },
    addPlatoToOrder: function () { window.RestoModules.addPlatoToOrder(); },
    removePlatoFromOrder: function (idx) { window.RestoModules.removePlatoFromOrder(idx); },
    saveReserva: function () { window.RestoModules.saveReserva(); },
    savePedido: function (id) { window.RestoModules.savePedido(id); },
    saveDespacho: function () { window.RestoModules.saveDespacho(); },
    saveUsuario: function (id) { window.RestoModules.saveUsuario(id); },
    deleteUsuario: function (id) { window.RestoModules.deleteUsuario(id); }
  };

})(window, document);
