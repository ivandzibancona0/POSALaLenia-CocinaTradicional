// Manual de Usuarios - Interactividad (Filtro por rol, búsqueda, scroll-spy y acordeón)

(function () {
  const sections = Array.from(document.querySelectorAll('.doc-section'));
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const roleButtons = Array.from(document.querySelectorAll('.role-pill'));
  const searchInput = document.getElementById('manual-search');
  const searchStatus = document.getElementById('search-status');
  const searchStatusText = document.getElementById('search-status-text');
  const clearSearchBtn = document.getElementById('btn-clear-search');
  const sidebar = document.getElementById('manual-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const mobileMenuBtn = document.getElementById('btn-mobile-menu');
  const printBtn = document.getElementById('btn-print-manual');
  const backTopBtn = document.getElementById('btn-back-top');

  let activeRole = 'all';
  let searchQuery = '';

  function normalize(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function applyFilters() {
    const q = normalize(searchQuery.trim());
    let visibleCount = 0;

    sections.forEach(sec => {
      const roles = (sec.getAttribute('data-roles') || 'all').split(',');
      const matchesRole = activeRole === 'all' || roles.includes('all') || roles.includes(activeRole);
      const matchesQuery = !q || normalize(sec.textContent).includes(q);
      const show = matchesRole && matchesQuery;

      sec.classList.toggle('is-hidden', !show);
      if (show) visibleCount++;

      const id = sec.getAttribute('id');
      const link = navLinks.find(l => l.getAttribute('href') === `#${id}`);
      if (link) {
        link.style.display = show ? 'flex' : 'none';
      }
    });

    if (searchStatus && searchStatusText) {
      if (q || activeRole !== 'all') {
        const roleLabel = activeRole === 'admin' ? 'Administrador' : (activeRole === 'cashier' ? 'Cajero' : 'Todos los roles');
        const queryPart = q ? ` para "${searchQuery.trim()}"` : '';
        searchStatusText.textContent = `Mostrando ${visibleCount} de ${sections.length} secciones (${roleLabel}${queryPart}).`;
        searchStatus.style.display = 'flex';
      } else {
        searchStatus.style.display = 'none';
      }
    }
  }

  // Role filter buttons
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRole = btn.getAttribute('data-role') || 'all';
      applyFilters();
    });
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFilters();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchQuery = '';
      activeRole = 'all';
      if (searchInput) searchInput.value = '';
      roleButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-role') === 'all'));
      applyFilters();
    });
  }

  // Mobile sidebar toggle
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (sidebar) sidebar.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('open');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeSidebar();
    });
  });

  // Print manual
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (item) item.classList.toggle('open');
    });
  });

  // Scroll-spy & back to top button
  function updateScrollState() {
    const scrollPos = window.scrollY + 120;
    let currentId = null;

    sections.forEach(sec => {
      if (sec.classList.contains('is-hidden')) return;
      if (sec.offsetTop <= scrollPos) {
        currentId = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      const targetId = (link.getAttribute('href') || '').replace('#', '');
      link.classList.toggle('active', targetId === currentId);
    });

    if (backTopBtn) {
      backTopBtn.classList.toggle('visible', window.scrollY > 360);
    }
  }

  window.addEventListener('scroll', updateScrollState, { passive: true });
  updateScrollState();

  if (backTopBtn) {
    backTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
