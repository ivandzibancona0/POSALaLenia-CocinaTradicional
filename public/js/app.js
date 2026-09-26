// Main App Controller & Router for A La Leña POS

const app = {
  currentView: 'pos',

  init() {
    console.log('🔥 Inicializando A La Leña POS Frontend...');
    this.setupNavigation();
    this.setupMobileDrawer();
    auth.init();
  },

  setupNavigation() {
    // Desktop Nav Items
    document.querySelectorAll('#nav-desktop .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.navigateTo(view);
      });
    });

    // Mobile Drawer Nav Items
    document.querySelectorAll('.drawer-nav .drawer-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.navigateTo(view);
        this.closeDrawer();
      });
    });
  },

  setupMobileDrawer() {
    const toggleBtn = document.getElementById('btn-toggle-mobile-menu');
    const closeBtn = document.getElementById('btn-close-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    const drawer = document.getElementById('mobile-drawer');

    if (toggleBtn && drawer && overlay) {
      toggleBtn.addEventListener('click', () => {
        drawer.classList.add('open');
        overlay.classList.add('open');
      });
    }

    if (closeBtn && drawer && overlay) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
      overlay.addEventListener('click', () => this.closeDrawer());
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  },

  navigateTo(viewId) {
    // Check role access
    const adminOnlyViews = ['inventory', 'reports', 'users', 'settings'];
    if (adminOnlyViews.includes(viewId) && !auth.isAdmin()) {
      showToast('Acceso restringido a administradores', 'warning');
      return;
    }

    this.currentView = viewId;

    // Switch active view container
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Update Nav Buttons Active State
    document.querySelectorAll('#nav-desktop .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    document.querySelectorAll('.drawer-nav .drawer-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    // Refresh view specific data
    this.refreshViewData(viewId);
  },

  refreshViewData(viewId) {
    if (viewId === 'pos') {
      if (pos && typeof pos.loadInitialData === 'function') pos.loadInitialData();
    } else if (viewId === 'dining') {
      if (dining && typeof dining.loadTables === 'function') dining.loadTables();
    } else if (viewId === 'customers') {
      if (customers && typeof customers.resetAndLoad === 'function') customers.resetAndLoad();
    } else if (viewId === 'inventory') {
      if (inventory && typeof inventory.loadCategories === 'function') {
        inventory.loadCategories();
        inventory.resetAndLoad();
      }
    } else if (viewId === 'reports') {
      if (reports && typeof reports.loadReports === 'function') reports.loadReports();
    } else if (viewId === 'users') {
      if (users && typeof users.loadUsers === 'function') users.loadUsers();
    } else if (viewId === 'settings') {
      if (settings && typeof settings.loadSettings === 'function') settings.loadSettings();
    }
  },

  onAuthenticated() {
    // Initialize module events and defaults
    pos.init();
    dining.init();
    customers.init();
    inventory.init();
    reports.init();
    users.init();
    settings.init();

    // Default to POS
    this.navigateTo('pos');
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  renderIcons();
  app.init();
});
