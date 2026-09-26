// Customers Module with Purchase History Modal & Infinite Scroll for A La Leña POS

const customers = {
  page: 1,
  limit: 15,
  hasMore: true,
  isLoading: false,
  searchQuery: '',
  customersList: [],

  historyCustomerId: null,
  historyPage: 1,
  historyLimit: 10,
  historyHasMore: true,
  historyIsLoading: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindEvents();
    this.setupInfiniteScroll();
    this.setupHistoryInfiniteScroll();
  },

  bindEvents() {
    const searchInput = document.getElementById('customers-search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.resetAndLoad();
        }, 300);
      });
    }

    const btnNewCust = document.getElementById('btn-add-customer-modal');
    if (btnNewCust) {
      btnNewCust.addEventListener('click', () => this.openFormModal());
    }

    const form = document.getElementById('customer-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCustomer();
      });
    }
  },

  setupInfiniteScroll() {
    const sentinel = document.getElementById('customers-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
        this.loadMoreCustomers();
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
  },

  async resetAndLoad() {
    this.page = 1;
    this.customersList = [];
    this.hasMore = true;
    const tbody = document.getElementById('customers-table-body');
    if (tbody) tbody.innerHTML = '';
    await this.loadMoreCustomers();
  },

  async loadMoreCustomers() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;

    const sentinel = document.getElementById('customers-sentinel');
    if (sentinel) sentinel.style.display = 'flex';

    try {
      const res = await api.customers.getPaginated({
        page: this.page,
        limit: this.limit,
        search: this.searchQuery
      });

      if (res.success) {
        this.customersList.push(...res.customers);
        this.hasMore = res.pagination.hasMore;
        this.page += 1;
        this.renderCustomerRows(res.customers);
      }
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      showToast('Error al consultar lista de clientes', 'error');
    } finally {
      this.isLoading = false;
      if (sentinel) sentinel.style.display = this.hasMore ? 'flex' : 'none';
    }
  },

  renderCustomerRows(customersToAdd) {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    if (this.customersList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
            No se encontraron clientes registrados.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    customersToAdd.forEach(c => {
      html += `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${c.first_name} ${c.last_name}</div>
            ${c.notes ? `<div style="font-size: 0.76rem; color: var(--amber-600);">Nota: ${c.notes}</div>` : ''}
          </td>
          <td>
            <span style="font-weight: 600;">${c.phone || '<span style="color: var(--text-light);">Sin teléfono</span>'}</span>
          </td>
          <td>
            <div style="max-width: 260px; font-size: 0.85rem; color: var(--text-muted);">${c.address || 'Sin dirección registrada'}</div>
          </td>
          <td>
            <span class="badge badge-info">${c.total_orders || 0} compras</span>
          </td>
          <td>
            <span style="font-weight: 800; color: var(--primary-700);">${formatMoney(c.total_spent || 0)}</span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="customers.openHistoryModal(${c.id})" title="Ver Historial de Compras">
                <span data-icon="history"></span>
                <span>Historial</span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="customers.openFormModal(${c.id})" title="Editar">
                <span data-icon="edit"></span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="customers.deleteCustomer(${c.id})" title="Eliminar" style="color: var(--danger-600);">
                <span data-icon="trash-2"></span>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.insertAdjacentHTML('beforeend', html);
    renderIcons();
  },

  openFormModal(customerId = null) {
    const titleEl = document.getElementById('customer-form-title');
    const form = document.getElementById('customer-form');
    form.reset();

    if (customerId) {
      titleEl.textContent = 'Editar Datos de Cliente';
      document.getElementById('cust-form-id').value = customerId;
      const cust = this.customersList.find(c => c.id === customerId);
      if (cust) {
        document.getElementById('cust-first-name').value = cust.first_name;
        document.getElementById('cust-last-name').value = cust.last_name;
        document.getElementById('cust-phone').value = cust.phone || '';
        document.getElementById('cust-address').value = cust.address || '';
        document.getElementById('cust-notes').value = cust.notes || '';
      }
    } else {
      titleEl.textContent = 'Registrar Nuevo Cliente';
      document.getElementById('cust-form-id').value = '';
    }

    openModal('modal-customer-form');
  },

  async saveCustomer() {
    const id = document.getElementById('cust-form-id').value;
    const data = {
      first_name: document.getElementById('cust-first-name').value.trim(),
      last_name: document.getElementById('cust-last-name').value.trim(),
      phone: document.getElementById('cust-phone').value.trim(),
      address: document.getElementById('cust-address').value.trim(),
      notes: document.getElementById('cust-notes').value.trim()
    };

    try {
      if (id) {
        const res = await api.customers.update(id, data);
        if (res.success) {
          showToast('Cliente actualizado exitosamente', 'success');
        }
      } else {
        const res = await api.customers.create(data);
        if (res.success) {
          showToast('Cliente registrado exitosamente', 'success');
          // If in Cashier, select newly created customer automatically
          if (pos && typeof pos.setCustomer === 'function') {
            pos.setCustomer(res.customer);
          }
        }
      }
      closeModal('modal-customer-form');
      this.resetAndLoad();
    } catch (err) {
      showToast(err.message || 'Error al guardar cliente', 'error');
    }
  },

  async deleteCustomer(id) {
    if (!confirm('¿Está seguro de eliminar este cliente del directorio?')) return;
    try {
      const res = await api.customers.delete(id);
      if (res.success) {
        showToast('Cliente eliminado', 'info');
        this.resetAndLoad();
      }
    } catch (err) {
      showToast('Error al eliminar cliente', 'error');
    }
  },

  // Setup Infinite Scroll specifically for Customer History Modal
  setupHistoryInfiniteScroll() {
    const sentinel = document.getElementById('customer-history-sentinel');
    const container = document.getElementById('customer-history-table-container');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.historyHasMore && !this.historyIsLoading && this.historyCustomerId) {
        this.loadMoreHistory();
      }
    }, {
      root: container || null,
      threshold: 0.1
    });

    observer.observe(sentinel);
  },

  // Open Detailed Customer Purchase History Modal with Infinite Scroll
  async openHistoryModal(customerId) {
    this.historyCustomerId = customerId;
    this.historyPage = 1;
    this.historyHasMore = true;
    this.historyIsLoading = false;

    const tbody = document.getElementById('customer-history-orders-body');
    if (tbody) tbody.innerHTML = '';

    const summaryBox = document.getElementById('customer-history-summary-box');
    if (summaryBox) summaryBox.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Cargando información del cliente...</div>';

    openModal('modal-customer-history');
    await this.loadMoreHistory(true);
  },

  async loadMoreHistory(isFirstPage = false) {
    if (this.historyIsLoading || (!this.historyHasMore && !isFirstPage)) return;
    this.historyIsLoading = true;

    const sentinel = document.getElementById('customer-history-sentinel');
    if (sentinel) sentinel.style.display = 'flex';

    try {
      const res = await api.customers.getHistory(this.historyCustomerId, this.historyPage, this.historyLimit);
      if (!res.success) return;

      const cust = res.customer;
      const stats = res.stats || {};
      const sales = res.sales || [];
      const pagination = res.pagination || {};

      if (isFirstPage) {
        document.getElementById('customer-history-title').textContent = `Historial de ${cust.first_name} ${cust.last_name}`;

        const summaryBox = document.getElementById('customer-history-summary-box');
        summaryBox.innerHTML = `
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Teléfono:</span>
            <div style="font-weight: 700;">${cust.phone || 'N/A'}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Dirección:</span>
            <div style="font-weight: 600; max-width: 250px;">${cust.address || 'N/A'}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Órdenes:</span>
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--primary-700);">${stats.order_count || 0}</div>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Monto Acumulado:</span>
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--success-600);">${formatMoney(stats.total_spent || 0)}</div>
          </div>
        `;
      }

      const tbody = document.getElementById('customer-history-orders-body');
      if (isFirstPage && sales.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
              Este cliente aún no tiene ventas registradas en el sistema.
            </td>
          </tr>
        `;
        this.historyHasMore = false;
      } else {
        sales.forEach(s => {
          const itemsSummary = (s.items || []).map(it => 
            `${it.quantity}x ${it.product_name} (${it.portion_type === 'half' ? '1/2' : 'Entera'})`
          ).join(', ');

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong style="color: var(--primary-700);">#${s.order_number}</strong></td>
            <td style="font-size: 0.82rem;">${formatDate(s.created_at)}</td>
            <td style="font-size: 0.85rem; max-width: 280px;">${itemsSummary || 'Venta general'}</td>
            <td><span class="badge badge-warning">${(s.payment_method || 'Efectivo').toUpperCase()}</span></td>
            <td><strong style="color: var(--text-main); font-size: 0.95rem;">${formatMoney(s.total)}</strong></td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="customers.viewSaleTicket('${s.order_number}')">
                <span data-icon="receipt"></span>
                <span>Ver Ticket</span>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        this.historyHasMore = pagination.hasMore === true;
        this.historyPage++;
      }

      renderIcons();
    } catch (err) {
      console.error(err);
      showToast('Error al consultar historial del cliente', 'error');
    } finally {
      this.historyIsLoading = false;
      if (sentinel) sentinel.style.display = this.historyHasMore ? 'flex' : 'none';
    }
  },

  async viewSaleTicket(orderNumber) {
    try {
      const res = await api.sales.getById(orderNumber);
      if (res.success) {
        ticketPrinter.showTicketModal(res);
      }
    } catch (err) {
      showToast('Error al consultar ticket de venta', 'error');
    }
  }
};
