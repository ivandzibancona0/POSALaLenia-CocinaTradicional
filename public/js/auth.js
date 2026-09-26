// Authentication & Role-Based Access Control Module for A La Leña POS

const auth = {
  currentUser: null,

  init() {
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
          localStorage.setItem('pos_token', res.token);
          localStorage.setItem('pos_user', JSON.stringify(res.user));
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
    const token = localStorage.getItem('pos_token');
    const storedUser = localStorage.getItem('pos_user');

    if (!token || !storedUser) {
      this.showLogin();
      return;
    }

    try {
      this.currentUser = JSON.parse(storedUser);
      const res = await api.auth.me();
      if (res.success && res.user) {
        this.currentUser = res.user;
        localStorage.setItem('pos_user', JSON.stringify(res.user));
        this.renderAuthenticatedApp();
      } else {
        this.showLogin();
      }
    } catch (err) {
      console.warn('Sesión expirada o inválida:', err);
      this.showLogin();
    }
  },

  showLogin() {
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

    // Trigger App modules refresh
    if (typeof app !== 'undefined' && app.onAuthenticated) {
      app.onAuthenticated();
    }
  },

  logout() {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    this.currentUser = null;
    showToast('Sesión cerrada correctamente', 'info');
    this.showLogin();
  },

  onLogout() {
    this.showLogin();
  },

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'admin';
  }
};
