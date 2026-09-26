// Dining Room & Tables Module for A La Leña POS

const dining = {
  tables: [],
  activeTableId: null,
  activeTableData: null,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindEvents();
  },

  bindEvents() {
    const refreshBtn = document.getElementById('btn-refresh-tables');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadTables();
        showToast('Mesas actualizadas', 'info', 1500);
      });
    }

    // Modal Table actions
    const btnAddItem = document.getElementById('btn-dining-add-item-to-table');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => this.addItemToActiveTable());
    }

    const btnPreCheck = document.getElementById('btn-dining-pre-check');
    if (btnPreCheck) {
      btnPreCheck.addEventListener('click', () => this.generatePreCheckTicket());
    }

    const btnTransfer = document.getElementById('btn-dining-transfer-to-cashier');
    if (btnTransfer) {
      btnTransfer.addEventListener('click', () => this.transferActiveTableToCashier());
    }

    const btnReset = document.getElementById('btn-dining-reset-table');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetActiveTable());
    }

    // Product Search Input in Dining Modal
    const searchProdInput = document.getElementById('dining-product-search-input');
    if (searchProdInput) {
      searchProdInput.addEventListener('input', (e) => {
        this.populateProductsSelect(e.target.value.trim());
      });
    }

    // Manage Tables Button & Form
    const btnManage = document.getElementById('btn-manage-tables');
    if (btnManage) {
      btnManage.addEventListener('click', () => this.openManageTablesModal());
    }

    const tableForm = document.getElementById('table-form');
    if (tableForm) {
      tableForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveTable();
      });
    }

    const btnCancelEdit = document.getElementById('btn-cancel-table-edit');
    if (btnCancelEdit) {
      btnCancelEdit.addEventListener('click', () => this.resetTableForm());
    }
  },

  async openManageTablesModal() {
    try {
      this.resetTableForm();
      await this.loadTables();
      this.renderTablesAdminTable();
    } catch (err) {
      console.error('Error cargando mesas para administración:', err);
    } finally {
      openModal('modal-manage-tables');
    }
  },

  resetTableForm() {
    const form = document.getElementById('table-form');
    if (form) form.reset();
    document.getElementById('tbl-form-id').value = '';
    document.getElementById('tbl-form-title').textContent = 'Agregar Nueva Mesa al Comedor';
    document.getElementById('btn-save-table-text').textContent = 'Guardar Mesa';
    const cancelBtn = document.getElementById('btn-cancel-table-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  },

  renderTablesAdminTable() {
    const tbody = document.getElementById('tables-admin-table-body');
    if (!tbody) return;

    if (this.tables.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No hay mesas registradas en el comedor.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.tables.forEach(t => {
      let statusBadge = '<span class="badge badge-success">Libre</span>';
      if (t.status === 'occupied') {
        statusBadge = '<span class="badge badge-danger">Ocupada</span>';
      } else if (t.status === 'billed') {
        statusBadge = '<span class="badge badge-warning">En Pre-Corte</span>';
      }

      html += `
        <tr>
          <td><span class="dining-table-number-badge" style="width: 28px; height: 28px; font-size: 0.85rem;">${t.table_number}</span></td>
          <td><strong style="color: var(--text-main); font-size: 0.9rem;">${t.name}</strong></td>
          <td><span class="badge badge-info">${t.capacity || 4} comensales</span></td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm btn-icon" onclick="dining.editTable(${t.id})" title="Editar">
                <span data-icon="edit"></span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="dining.deleteTable(${t.id})" title="Eliminar" style="color: var(--danger-600);">
                <span data-icon="trash-2"></span>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    renderIcons();
  },

  editTable(id) {
    const table = this.tables.find(t => t.id === id);
    if (!table) return;

    document.getElementById('tbl-form-id').value = table.id;
    document.getElementById('tbl-number').value = table.table_number;
    document.getElementById('tbl-name').value = table.name;
    document.getElementById('tbl-capacity').value = table.capacity || 4;
    document.getElementById('tbl-form-title').textContent = `Editar Mesa: ${table.name}`;
    document.getElementById('btn-save-table-text').textContent = 'Actualizar Mesa';

    const cancelBtn = document.getElementById('btn-cancel-table-edit');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  },

  async saveTable() {
    const id = document.getElementById('tbl-form-id').value;
    const data = {
      table_number: parseInt(document.getElementById('tbl-number').value),
      name: document.getElementById('tbl-name').value.trim(),
      capacity: parseInt(document.getElementById('tbl-capacity').value) || 4
    };

    try {
      if (id) {
        const res = await api.dining.updateTable(id, data);
        if (res.success) {
          showToast('Mesa actualizada exitosamente', 'success');
        }
      } else {
        const res = await api.dining.createTable(data);
        if (res.success) {
          showToast('Nueva mesa agregada al comedor', 'success');
        }
      }
      this.resetTableForm();
      await this.loadTables();
      this.renderTablesAdminTable();
    } catch (err) {
      showToast(err.message || 'Error al guardar mesa', 'error');
    }
  },

  async deleteTable(id) {
    const table = this.tables.find(t => t.id === id);
    if (table && table.status !== 'free') {
      showToast('No se puede eliminar una mesa ocupada o con cuenta activa', 'warning');
      return;
    }
    if (!confirm('¿Está seguro de eliminar esta mesa del comedor?')) return;

    try {
      const res = await api.dining.deleteTable(id);
      if (res.success) {
        showToast('Mesa eliminada del comedor', 'info');
        await this.loadTables();
        this.renderTablesAdminTable();
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar mesa', 'error');
    }
  },

  async loadTables() {
    try {
      const res = await api.dining.getTables();
      if (res.success) {
        this.tables = res.tables;
        this.renderTablesGrid();
      }
    } catch (err) {
      console.error('Error al cargar mesas:', err);
      showToast('Error al consultar mesas del comedor', 'error');
    }
  },

  renderTablesGrid() {
    const container = document.getElementById('dining-tables-grid');
    if (!container) return;

    let html = '';
    this.tables.forEach(t => {
      let statusClass = 'free';
      let statusBadge = '<span class="badge badge-success">Libre</span>';
      
      if (t.status === 'occupied') {
        statusClass = 'occupied';
        statusBadge = '<span class="badge badge-warning">Ocupada</span>';
      } else if (t.status === 'billed') {
        statusClass = 'billed';
        statusBadge = '<span class="badge badge-primary">Pre-corte Entregado</span>';
      }

      const guestName = t.guest_name || (t.customer_first_name ? `${t.customer_first_name} ${t.customer_last_name}` : 'Mesa Disponible');

      html += `
        <div class="table-card ${statusClass}" onclick="dining.openTableAccountModal(${t.id})">
          <div class="table-card-header">
            <div class="table-number-badge">${t.table_number}</div>
            ${statusBadge}
          </div>

          <div class="table-info">
            <div class="table-name">${t.name}</div>
            <div class="table-guest">
              <span data-icon="user" style="width: 14px; height: 14px;"></span>
              <span>${guestName}</span>
            </div>
          </div>

          <div class="table-metrics">
            <span class="table-items-count">${t.items_count || 0} platillo(s)</span>
            <span class="table-total-amount">${formatMoney(t.current_total || 0)}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    renderIcons();
  },

  async openTableAccountModal(tableId) {
    this.activeTableId = tableId;
    try {
      const res = await api.dining.getTable(tableId);
      if (!res.success) return;

      this.activeTableData = res;
      const table = res.table;

      document.getElementById('dining-modal-table-title').textContent = `${table.name} (Mesa ${table.table_number})`;
      document.getElementById('dining-guest-name').value = table.guest_name || (table.first_name ? `${table.first_name} ${table.last_name}` : '');

      const statusBadge = document.getElementById('dining-account-status-badge');
      if (statusBadge) {
        if (table.status === 'free') {
          statusBadge.className = 'badge badge-success';
          statusBadge.textContent = 'Libre';
        } else if (table.status === 'occupied') {
          statusBadge.className = 'badge badge-warning';
          statusBadge.textContent = 'Ocupada / Consumiendo';
        } else {
          statusBadge.className = 'badge badge-primary';
          statusBadge.textContent = 'Pre-corte Emitido';
        }
      }

      // Populate products select
      const searchProdInput = document.getElementById('dining-product-search-input');
      if (searchProdInput) searchProdInput.value = '';
      this.populateProductsSelect('');

      // Render consumed items
      this.renderTableItems(res.items, res.total);

      openModal('modal-dining-account');
    } catch (err) {
      console.error(err);
      showToast('Error al abrir cuenta de mesa', 'error');
    }
  },

  populateProductsSelect(filterQuery = '') {
    const select = document.getElementById('dining-add-product-select');
    if (!select || !pos.products) return;

    let filtered = pos.products;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      filtered = pos.products.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No se encontraron platillos con esa búsqueda</option>';
      const portionSelect = document.getElementById('dining-add-portion-select');
      if (portionSelect) portionSelect.innerHTML = '<option value="full">Ración Completa</option>';
      return;
    }

    select.innerHTML = filtered.map(p => `
      <option value="${p.id}" data-has-half="${p.has_half_portion ? '1' : '0'}" data-price="${p.price}" data-half-price="${p.half_price}">
        ${p.name} - ${formatMoney(p.price)} ${p.has_half_portion ? `(1/2 ${formatMoney(p.half_price)})` : ''}
      </option>
    `).join('');

    const portionSelect = document.getElementById('dining-add-portion-select');
    select.onchange = () => {
      const selectedOpt = select.options[select.selectedIndex];
      const hasHalf = selectedOpt && selectedOpt.getAttribute('data-has-half') === '1';
      if (portionSelect) {
        portionSelect.innerHTML = hasHalf ? `
          <option value="full">Ración Completa</option>
          <option value="half">Media Ración</option>
        ` : `
          <option value="full">Ración Completa</option>
        `;
      }
    };
    select.onchange();
  },

  renderTableItems(items, total) {
    const container = document.getElementById('dining-modal-items-list');
    const totalEl = document.getElementById('dining-modal-total-display');

    if (totalEl) totalEl.textContent = formatMoney(total || 0);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No hay platillos ordenados en esta mesa aún.
        </div>
      `;
      return;
    }

    let html = '';
    items.forEach(it => {
      const isHalf = it.portion_type === 'half';
      const sub = it.quantity * it.unit_price;

      html += `
        <div class="dining-item-row">
          <div>
            <div style="font-weight: 700; font-size: 0.85rem;">${it.product_name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ${it.quantity}x • ${isHalf ? 'Media Ración' : 'Completa'} (${formatMoney(it.unit_price)})
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-weight: 800; font-size: 0.9rem; color: var(--primary-700);">${formatMoney(sub)}</span>
            <button class="btn-icon btn-sm" onclick="dining.removeItemFromTable(${it.id})" title="Quitar" style="color: var(--danger-600);">
              <span data-icon="trash-2"></span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    renderIcons();
  },

  async addItemToActiveTable() {
    if (!this.activeTableId) return;

    const prodSelect = document.getElementById('dining-add-product-select');
    const portionSelect = document.getElementById('dining-add-portion-select');
    const qtyInput = document.getElementById('dining-add-qty');
    const guestInput = document.getElementById('dining-guest-name');

    const productId = prodSelect.value;
    const portionType = portionSelect ? portionSelect.value : 'full';
    const quantity = parseFloat(qtyInput.value) || 1;
    const guestName = guestInput ? guestInput.value.trim() : '';

    try {
      // If table has guest name, update it first
      if (guestName && this.activeTableData && !this.activeTableData.table.guest_name) {
        await api.dining.openTable(this.activeTableId, { guest_name: guestName });
      }

      const res = await api.dining.addItem(this.activeTableId, {
        product_id: productId,
        portion_type: portionType,
        quantity: quantity
      });

      if (res.success) {
        showToast('Platillo agregado a la cuenta', 'success', 1800);
        // Reload active table details & grid
        const updated = await api.dining.getTable(this.activeTableId);
        this.activeTableData = updated;
        this.renderTableItems(updated.items, updated.total);
        this.loadTables();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error al agregar platillo', 'error');
    }
  },

  async removeItemFromTable(itemId) {
    try {
      await api.dining.removeItem(itemId);
      showToast('Platillo removido de la cuenta', 'info', 1500);
      const updated = await api.dining.getTable(this.activeTableId);
      this.activeTableData = updated;
      this.renderTableItems(updated.items, updated.total);
      this.loadTables();
    } catch (err) {
      showToast('Error al eliminar platillo', 'error');
    }
  },

  async generatePreCheckTicket() {
    if (!this.activeTableId) return;

    try {
      const res = await api.dining.getPreCheck(this.activeTableId);
      if (res.success) {
        ticketPrinter.showTicketModal(res);
        this.loadTables();
        showToast('Ticket de pre-corte generado para el comensal', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Error al generar pre-corte', 'warning');
    }
  },

  transferActiveTableToCashier() {
    if (!this.activeTableData || !this.activeTableData.items || this.activeTableData.items.length === 0) {
      showToast('La mesa no tiene consumos registrados para cobrar', 'warning');
      return;
    }

    closeModal('modal-dining-account');
    pos.loadDiningAccount(
      this.activeTableData.table,
      this.activeTableData.items,
      this.activeTableData.table.customer_id ? {
        id: this.activeTableData.table.customer_id,
        first_name: this.activeTableData.table.first_name,
        last_name: this.activeTableData.table.last_name,
        phone: this.activeTableData.table.phone,
        address: this.activeTableData.table.address
      } : null
    );
  },

  async resetActiveTable() {
    if (!this.activeTableId) return;
    if (!confirm('¿Desea liberar y reiniciar esta mesa? Se borrarán los consumos pendientes no cobrados.')) return;

    try {
      const res = await api.dining.resetTable(this.activeTableId);
      if (res.success) {
        closeModal('modal-dining-account');
        showToast('Mesa liberada correctamente', 'info');
        this.loadTables();
      }
    } catch (err) {
      showToast('Error al liberar mesa', 'error');
    }
  }
};
