// Authentication & Role-Based Access Control Module for A La Leña POS

const auth = {
  currentUser: null,
  INACTIVITY_LIMIT_MS: 30 * 60 * 1000, // 30 minutes
  inactivityInterval: null,
  lastActivityAt: 0,
  activityListenersBound: false,
  _boundActivityHandler: null,
  _boundVisibilityHandler: null,

  init() {
    // Clean up any legacy persistent session from localStorage
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');

    this.setupLoginForm();
    this.checkSession();
  },

  setupLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        showToast('Por favor ingrese usuario y contraseña', 'warning');
        return;
      }

      const submitBtn = document.getElementById('btn-login-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Verificando...</span>';

      try {
        const res = await api.auth.login(username, password);
        if (res.success) {
          sessionStorage.setItem('pos_token', res.token);
          sessionStorage.setItem('pos_user', JSON.stringify(res.user));
          this.recordActivity(true);
          this.currentUser = res.user;
          showToast(`¡Bienvenido al sistema, ${res.user.name}!`, 'success');
          this.renderAuthenticatedApp();
        }
      } catch (err) {
        showToast(err.message || 'Error al iniciar sesión', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Iniciar Sesión</span>';
      }
    });

    // Logout buttons
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    const drawerLogoutBtn = document.getElementById('btn-drawer-logout');
    if (drawerLogoutBtn) drawerLogoutBtn.addEventListener('click', () => this.logout());
  },

  async checkSession() {
    const token = sessionStorage.getItem('pos_token');
    const storedUser = sessionStorage.getItem('pos_user');

    if (!token || !storedUser) {
      this.showLogin();
      return;
    }

    // Check if session exceeded 30 minutes of inactivity before reload
    const storedLastActivity = parseInt(sessionStorage.getItem('pos_last_activity') || '0', 10);
    if (storedLastActivity > 0 && (Date.now() - storedLastActivity) >= this.INACTIVITY_LIMIT_MS) {
      this.clearSessionStorage();
      this.showLogin();
      return;
    }

    try {
      this.currentUser = JSON.parse(storedUser);
      const res = await api.auth.me();
      if (res.success && res.user) {
        this.currentUser = res.user;
        sessionStorage.setItem('pos_user', JSON.stringify(res.user));
        this.recordActivity(true);
        this.renderAuthenticatedApp();
      } else {
        this.clearSessionStorage();
        this.showLogin();
      }
    } catch (err) {
      console.warn('Sesión expirada o inválida:', err);
      this.clearSessionStorage();
      this.showLogin();
    }
  },

  clearSessionStorage() {
    sessionStorage.removeItem('pos_token');
    sessionStorage.removeItem('pos_user');
    sessionStorage.removeItem('pos_last_activity');
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
  },

  recordActivity(force = false) {
    const now = Date.now();
    if (!force && (now - this.lastActivityAt) < 1000) return;
    this.lastActivityAt = now;
    if (sessionStorage.getItem('pos_token')) {
      sessionStorage.setItem('pos_last_activity', String(now));
    }
  },

  startInactivityMonitor() {
    this.stopInactivityMonitor();
    this.recordActivity(true);

    if (!this.activityListenersBound) {
      this._boundActivityHandler = () => {
        if (this.currentUser) {
          this.recordActivity(false);
        }
      };
      this._boundVisibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.currentUser) {
          this.checkInactivity();
        }
      };

      const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll'];
      activityEvents.forEach(ev => {
        window.addEventListener(ev, this._boundActivityHandler, { passive: true });
      });
      document.addEventListener('visibilitychange', this._boundVisibilityHandler);
      this.activityListenersBound = true;
    }

    this.inactivityInterval = setInterval(() => {
      this.checkInactivity();
    }, 30 * 1000);
  },

  stopInactivityMonitor() {
    if (this.inactivityInterval) {
      clearInterval(this.inactivityInterval);
      this.inactivityInterval = null;
    }
  },

  checkInactivity() {
    if (!this.currentUser) return;
    const storedLast = parseInt(sessionStorage.getItem('pos_last_activity') || '0', 10);
    const lastActive = Math.max(this.lastActivityAt || 0, storedLast || 0);
    if (lastActive > 0 && (Date.now() - lastActive) >= this.INACTIVITY_LIMIT_MS) {
      this.logout('Sesión cerrada automáticamente por 30 minutos de inactividad', 'warning');
    }
  },

  closeOpenModals() {
    document.querySelectorAll('.modal-overlay.open').forEach(modal => {
      modal.classList.remove('open');
    });
  },

  showLogin() {
    this.stopInactivityMonitor();
    this.closeOpenModals();
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    renderIcons();
  },

  renderAuthenticatedApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    const user = this.currentUser || {};
    
    // Update Header Pill
    const avatar = document.getElementById('header-user-avatar');
    if (avatar) avatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

    const nameEl = document.getElementById('header-user-name');
    if (nameEl) nameEl.textContent = user.name || 'Usuario';

    const roleEl = document.getElementById('header-user-role');
    if (roleEl) {
      roleEl.textContent = user.role === 'admin' ? 'ADMINISTRADOR' : 'CAJERO';
      roleEl.style.color = user.role === 'admin' ? 'var(--amber-400)' : '#86efac';
    }

    // Role-based visibility
    const isAdmin = user.role === 'admin';
    document.querySelectorAll('.role-admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    renderIcons();
    this.startInactivityMonitor();

    // Trigger App modules refresh
    if (typeof app !== 'undefined' && app.onAuthenticated) {
      app.onAuthenticated();
    }
  },

  logout(message = 'Sesión cerrada correctamente', toastType = 'info') {
    this.stopInactivityMonitor();
    this.clearSessionStorage();
    this.currentUser = null;
    this.lastActivityAt = 0;
    showToast(message, toastType);
    this.showLogin();
  },

  onLogout() {
    this.stopInactivityMonitor();
    this.clearSessionStorage();
    this.currentUser = null;
    this.lastActivityAt = 0;
    this.showLogin();
  },

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }
};
