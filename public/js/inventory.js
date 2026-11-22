// Inventory & Products Management Module for A La Leña POS

const inventory = {
  page: 1,
  limit: 20,
  hasMore: true,
  isLoading: false,
  searchQuery: '',
  selectedCategory: '',
  statusFilter: 'active',
  lowStockOnly: false,
  productsList: [],
  categories: [],
  modalCategories: [],
  categoryStatusFilter: 'active',

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindEvents();
    this.setupInfiniteScroll();
  },

  bindEvents() {
    const searchInput = document.getElementById('inventory-search-input');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.searchQuery = e.target.value.trim();
          this.resetAndLoad();
        }, 300);
      });
    }

    const catFilter = document.getElementById('inventory-category-filter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.resetAndLoad();
      });
    }

    const statusFilterEl = document.getElementById('inventory-status-filter');
    if (statusFilterEl) {
      statusFilterEl.addEventListener('change', (e) => {
        this.statusFilter = e.target.value || 'active';
        this.resetAndLoad();
      });
    }

    const catStatusFilterEl = document.getElementById('categories-status-filter');
    if (catStatusFilterEl) {
      catStatusFilterEl.addEventListener('change', (e) => {
        this.categoryStatusFilter = e.target.value || 'active';
        this.loadModalCategories();
      });
    }

    const btnLowStock = document.getElementById('btn-filter-low-stock');
    if (btnLowStock) {
      btnLowStock.addEventListener('click', () => {
        this.lowStockOnly = !this.lowStockOnly;
        btnLowStock.classList.toggle('btn-primary', this.lowStockOnly);
        btnLowStock.classList.toggle('btn-secondary', !this.lowStockOnly);
        this.resetAndLoad();
      });
    }

    const btnNewProd = document.getElementById('btn-new-product-modal');
    if (btnNewProd) {
      btnNewProd.addEventListener('click', () => this.openProductModal());
    }

    // Manage Categories Button
    const btnCategories = document.getElementById('btn-manage-categories');
    if (btnCategories) {
      btnCategories.addEventListener('click', () => this.openCategoriesModal());
    }

    // Category Form Submit
    const catForm = document.getElementById('category-form');
    if (catForm) {
      catForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCategory();
      });
    }

    const btnCancelCat = document.getElementById('btn-cancel-cat-edit');
    if (btnCancelCat) {
      btnCancelCat.addEventListener('click', () => this.resetCategoryForm());
    }

    // Toggle half-portion price input visibility in form
    const chkHalf = document.getElementById('prod-has-half');
    const groupHalf = document.getElementById('group-prod-half-price');
    if (chkHalf && groupHalf) {
      chkHalf.addEventListener('change', (e) => {
        groupHalf.style.display = e.target.checked ? 'block' : 'none';
        const halfInput = document.getElementById('prod-half-price');
        if (halfInput) halfInput.required = e.target.checked;
      });
    }

    // Product Form Submit
    const prodForm = document.getElementById('product-form');
    if (prodForm) {
      prodForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProduct();
      });
    }

    // Stock Adjust Form Submit
    const adjustForm = document.getElementById('stock-adjust-form');
    if (adjustForm) {
      adjustForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitStockAdjustment();
      });
    }

    // Stock Adjustment Type Selector
    document.querySelectorAll('.adjust-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.adjust-type-btn').forEach(b => {
          b.classList.remove('btn-success', 'btn-danger', 'active');
          b.classList.add('btn-secondary');
        });
        const type = btn.getAttribute('data-type');
        btn.classList.remove('btn-secondary');
        btn.classList.add(type === 'add' ? 'btn-success' : 'btn-danger', 'active');
      });
    });
  },

  setupInfiniteScroll() {
    const sentinel = document.getElementById('inventory-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMore && !this.isLoading) {
        this.loadMoreProducts();
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
  },

  async loadCategories() {
    try {
      const res = await api.categories.getAll();
      if (res.success) {
        this.categories = res.categories;
        const filterSelect = document.getElementById('inventory-category-filter');
        const formSelect = document.getElementById('prod-category');

        if (filterSelect) {
          filterSelect.innerHTML = '<option value="">Todas las Categorías</option>' + 
            this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
          const stillExists = this.categories.some(c => String(c.id) === String(this.selectedCategory));
          if (this.selectedCategory && stillExists) {
            filterSelect.value = this.selectedCategory;
          } else {
            this.selectedCategory = '';
            filterSelect.value = '';
          }
        }

        if (formSelect) {
          formSelect.innerHTML = '<option value="">Seleccione Categoría</option>' + 
            this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  async resetAndLoad() {
    this.page = 1;
    this.productsList = [];
    this.hasMore = true;
    const tbody = document.getElementById('inventory-table-body');
    if (tbody) tbody.innerHTML = '';
    await this.loadMoreProducts();
  },

  async loadMoreProducts() {
    if (this.isLoading || !this.hasMore) return;
    this.isLoading = true;

    const sentinel = document.getElementById('inventory-sentinel');
    if (sentinel) sentinel.style.display = 'flex';

    try {
      const res = await api.products.getPaginated({
        page: this.page,
        limit: this.limit,
        search: this.searchQuery,
        category_id: this.selectedCategory,
        status: this.statusFilter,
        low_stock: this.lowStockOnly
      });

      if (res.success) {
        this.productsList.push(...res.products);
        this.hasMore = res.pagination.hasMore;
        this.page += 1;
        this.renderProductRows(res.products);
      }
    } catch (err) {
      console.error('Error cargando inventario:', err);
      showToast('Error al consultar inventario', 'error');
    } finally {
      this.isLoading = false;
      if (sentinel) sentinel.style.display = this.hasMore ? 'flex' : 'none';
    }
  },

  renderProductRows(productsToAdd) {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    if (this.productsList.length === 0) {
      const emptyMsg = this.statusFilter === 'inactive'
        ? 'No hay platillos inactivos (dados de baja).'
        : 'No se encontraron productos en el inventario.';
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            ${emptyMsg}
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    productsToAdd.forEach(p => {
      const isActive = Number(p.active) === 1;
      const stock = parseFloat(p.stock) || 0;
      const minStock = parseFloat(p.min_stock) || 5;

      let stockBadge = `<span class="badge badge-success">${stock} ${p.unit || 'ración'}</span>`;
      if (stock <= 0) {
        stockBadge = '<span class="badge badge-danger">AGOTADO (0)</span>';
      } else if (stock <= minStock) {
        stockBadge = `<span class="badge badge-warning">${stock} (Bajo)</span>`;
      }

      const categoryInactiveTag = p.category_name && Number(p.category_active) === 0
        ? ' <span style="font-size: 0.7rem; color: var(--danger-600); font-weight: 700;">(Cat. inactiva)</span>'
        : '';

      const statusBadge = isActive
        ? '<span class="badge badge-success">Activo</span>'
        : '<span class="badge badge-danger">Inactivo</span>';

      const actionsHtml = isActive
        ? `
            <button class="btn btn-secondary btn-sm" onclick="inventory.openStockAdjustModal(${p.id})" title="Ajustar Stock Rápido">
              <span data-icon="plus-minus"></span>
              <span>Ajustar</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.openProductModal(${p.id})" title="Editar">
              <span data-icon="edit"></span>
            </button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.deactivateProduct(${p.id})" title="Dar de baja (ocultar del catálogo)" style="color: var(--amber-600);">
              <span data-icon="archive"></span>
            </button>
          `
        : `
            <button class="btn btn-success btn-sm" onclick="inventory.restoreProduct(${p.id})" title="Reactivar platillo en el catálogo">
              <span data-icon="rotate-cw"></span>
              <span>Reactivar</span>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="inventory.permanentDeleteProduct(${p.id})" title="Eliminar permanentemente de la base de datos">
              <span data-icon="trash-2"></span>
            </button>
          `;

      html += `
        <tr class="${isActive ? '' : 'row-inactive'}">
          <td><code style="font-weight: 700; color: var(--text-muted);">${p.code || 'S/C'}</code></td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${p.name}</div>
            ${p.description ? `<div style="font-size: 0.76rem; color: var(--text-muted); max-width: 250px;">${p.description}</div>` : ''}
          </td>
          <td>
            <span class="badge badge-primary">${p.category_name || 'Sin Categoría'}</span>${categoryInactiveTag}
          </td>
          <td>
            <strong style="color: var(--primary-700); font-size: 0.95rem;">${formatMoney(p.price)}</strong>
          </td>
          <td>
            ${p.has_half_portion ? `
              <strong style="color: var(--amber-600); font-size: 0.95rem;">${formatMoney(p.half_price)}</strong>
            ` : `
              <span style="color: var(--text-light); font-size: 0.8rem;">No aplica</span>
            `}
          </td>
          <td>
            ${stockBadge}
          </td>
          <td>
            ${statusBadge}
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.insertAdjacentHTML('beforeend', html);
    renderIcons();
  },

  openProductModal(productId = null) {
    const titleEl = document.getElementById('product-form-title');
    const form = document.getElementById('product-form');
    form.reset();

    const chkHalf = document.getElementById('prod-has-half');
    const groupHalf = document.getElementById('group-prod-half-price');

    if (productId) {
      titleEl.textContent = 'Editar Platillo / Producto';
      document.getElementById('prod-form-id').value = productId;
      const p = this.productsList.find(item => item.id === productId);
      if (p) {
        document.getElementById('prod-code').value = p.code || '';
        document.getElementById('prod-category').value = p.category_id || '';
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-desc').value = p.description || '';
        document.getElementById('prod-price').value = p.price;
        chkHalf.checked = p.has_half_portion == 1;
        groupHalf.style.display = p.has_half_portion == 1 ? 'block' : 'none';
        document.getElementById('prod-half-price').value = p.half_price || '';
        document.getElementById('prod-cost').value = p.cost || '';
        document.getElementById('prod-stock').value = p.stock || 0;
        document.getElementById('prod-min-stock').value = p.min_stock || 5;
        document.getElementById('prod-unit').value = p.unit || 'orden';
      }
    } else {
      titleEl.textContent = 'Registrar Nuevo Platillo';
      document.getElementById('prod-form-id').value = '';
      chkHalf.checked = false;
      groupHalf.style.display = 'none';
    }

    openModal('modal-product-form');
  },

  async saveProduct() {
    const id = document.getElementById('prod-form-id').value;
    const hasHalf = document.getElementById('prod-has-half').checked;

    const data = {
      code: document.getElementById('prod-code').value.trim(),
      category_id: document.getElementById('prod-category').value || null,
      name: document.getElementById('prod-name').value.trim(),
      description: document.getElementById('prod-desc').value.trim(),
      price: parseFloat(document.getElementById('prod-price').value) || 0,
      has_half_portion: hasHalf ? 1 : 0,
      half_price: hasHalf ? (parseFloat(document.getElementById('prod-half-price').value) || 0) : 0,
      cost: parseFloat(document.getElementById('prod-cost').value) || 0,
      stock: parseFloat(document.getElementById('prod-stock').value) || 0,
      min_stock: parseFloat(document.getElementById('prod-min-stock').value) || 5,
      unit: document.getElementById('prod-unit').value.trim() || 'orden'
    };

    try {
      if (id) {
        const res = await api.products.update(id, data);
        if (res.success) {
          showToast('Platillo actualizado exitosamente', 'success');
        }
      } else {
        const res = await api.products.create(data);
        if (res.success) {
          showToast('Platillo registrado en el catálogo', 'success');
        }
      }
      closeModal('modal-product-form');
      this.resetAndLoad();
      // Also update POS catalog
      if (pos) pos.loadInitialData();
    } catch (err) {
      showToast(err.message || 'Error al guardar platillo', 'error');
    }
  },

  openStockAdjustModal(productId) {
    const p = this.productsList.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('adjust-prod-id').value = productId;
    document.getElementById('adjust-prod-name').textContent = p.name;
    document.getElementById('adjust-prod-current-stock').textContent = `${p.stock} ${p.unit || 'orden'}(es)`;
    document.getElementById('adjust-amount').value = '';
    document.getElementById('adjust-reason').value = '';

    openModal('modal-stock-adjust');
  },

  async submitStockAdjustment() {
    const prodId = document.getElementById('adjust-prod-id').value;
    const amount = parseFloat(document.getElementById('adjust-amount').value);
    const reason = document.getElementById('adjust-reason').value.trim();

    const activeTypeBtn = document.querySelector('.adjust-type-btn.active');
    const isSub = activeTypeBtn && activeTypeBtn.getAttribute('data-type') === 'sub';
    const delta = isSub ? -amount : amount;

    try {
      const res = await api.products.adjustStock(prodId, delta, reason);
      if (res.success) {
        showToast(res.message, 'success');
        closeModal('modal-stock-adjust');
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al ajustar existencias', 'error');
    }
  },

  async openCategoriesModal() {
    this.resetCategoryForm();
    const filterEl = document.getElementById('categories-status-filter');
    if (filterEl) filterEl.value = this.categoryStatusFilter;
    await this.loadCategories();
    await this.loadModalCategories();
    openModal('modal-categories');
  },

  async loadModalCategories() {
    try {
      const res = await api.categories.getAll(this.categoryStatusFilter);
      if (res.success) {
        this.modalCategories = res.categories;
        this.renderCategoriesTable();
      }
    } catch (err) {
      console.error('Error al cargar categorías:', err);
      showToast('Error al consultar categorías', 'error');
    }
  },

  resetCategoryForm() {
    const form = document.getElementById('category-form');
    if (form) form.reset();
    document.getElementById('cat-form-id').value = '';
    document.getElementById('cat-form-title').textContent = 'Crear Nueva Categoría';
    document.getElementById('btn-save-cat-text').textContent = 'Guardar Categoría';
    const cancelBtn = document.getElementById('btn-cancel-cat-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
  },

  renderCategoriesTable() {
    const tbody = document.getElementById('categories-table-body');
    if (!tbody) return;

    if (this.modalCategories.length === 0) {
      const emptyMsg = this.categoryStatusFilter === 'inactive'
        ? 'No hay categorías inactivas (dadas de baja).'
        : 'No hay categorías registradas.';
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            ${emptyMsg}
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.modalCategories.forEach(c => {
      const isActive = Number(c.active) === 1;
      const statusBadge = isActive
        ? '<span class="badge badge-success">Activa</span>'
        : '<span class="badge badge-danger">Inactiva</span>';

      const actionsHtml = isActive
        ? `
            <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.editCategory(${c.id})" title="Editar">
              <span data-icon="edit"></span>
            </button>
            <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.deactivateCategory(${c.id})" title="Dar de baja (ocultar)" style="color: var(--amber-600);">
              <span data-icon="archive"></span>
            </button>
          `
        : `
            <button class="btn btn-success btn-sm" onclick="inventory.restoreCategory(${c.id})" title="Reactivar categoría">
              <span data-icon="rotate-cw"></span>
              <span>Reactivar</span>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" onclick="inventory.permanentDeleteCategory(${c.id})" title="Eliminar permanentemente de la base de datos">
              <span data-icon="trash-2"></span>
            </button>
          `;

      html += `
        <tr class="${isActive ? '' : 'row-inactive'}">
          <td><span data-icon="${c.icon || 'utensils'}"></span></td>
          <td><strong style="color: var(--text-main); font-size: 0.9rem;">${c.name}</strong></td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${c.description || 'Sin descripción'}</td>
          <td><span class="badge badge-info">${Number(c.product_count) || 0} platillo(s)</span></td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    renderIcons();
  },

  editCategory(id) {
    const cat = this.modalCategories.find(c => c.id === id) || this.categories.find(c => c.id === id);
    if (!cat) return;

    document.getElementById('cat-form-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-icon').value = cat.icon || 'utensils';
    document.getElementById('cat-desc').value = cat.description || '';
    document.getElementById('cat-form-title').textContent = `Editar Categoría: ${cat.name}`;
    document.getElementById('btn-save-cat-text').textContent = 'Actualizar Categoría';
    
    const cancelBtn = document.getElementById('btn-cancel-cat-edit');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  },

  async saveCategory() {
    const id = document.getElementById('cat-form-id').value;
    const data = {
      name: document.getElementById('cat-name').value.trim(),
      icon: document.getElementById('cat-icon').value,
      description: document.getElementById('cat-desc').value.trim()
    };

    try {
      if (id) {
        const res = await api.categories.update(id, data);
        if (res.success) {
          showToast('Categoría actualizada', 'success');
        }
      } else {
        const res = await api.categories.create(data);
        if (res.success) {
          showToast('Nueva categoría creada con éxito', 'success');
        }
      }
      this.resetCategoryForm();
      await this.loadCategories();
      await this.loadModalCategories();
      this.resetAndLoad();
      if (pos) pos.loadInitialData();
    } catch (err) {
      showToast(err.message || 'Error al guardar categoría', 'error');
    }
  },

  async deactivateCategory(id) {
    const cat = this.modalCategories.find(c => c.id === id) || this.categories.find(c => c.id === id);
    if (cat && Number(cat.product_count) > 0) {
      showToast(`No se puede dar de baja porque contiene ${cat.product_count} platillo(s) activo(s)`, 'warning');
      return;
    }
    if (!confirm('¿Desea dar de baja esta categoría?\n\nPodrá reactivarla o eliminarla definitivamente desde el filtro de "Inactivas".')) return;

    try {
      const res = await api.categories.delete(id, false);
      if (res.success) {
        showToast(res.message || 'Categoría dada de baja', 'info');
        await this.loadCategories();
        await this.loadModalCategories();
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al dar de baja categoría', 'error');
    }
  },

  async restoreCategory(id) {
    try {
      const res = await api.categories.restore(id);
      if (res.success) {
        showToast(res.message || 'Categoría reactivada exitosamente', 'success');
        await this.loadCategories();
        await this.loadModalCategories();
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al reactivar categoría', 'error');
    }
  },

  async permanentDeleteCategory(id) {
    const cat = this.modalCategories.find(c => c.id === id);
    const catName = cat ? `"${cat.name}"` : 'esta categoría';
    const msg = `⚠️ ELIMINACIÓN PERMANENTE\n\n¿Está seguro de eliminar definitivamente ${catName} de la base de datos MySQL?\n\nEsta acción es irreversible. Si había platillos inactivos asignados, quedarán "Sin Categoría".`;
    if (!confirm(msg)) return;

    try {
      const res = await api.categories.delete(id, true);
      if (res.success) {
        showToast(res.message || 'Categoría eliminada permanentemente', 'success');
        await this.loadCategories();
        await this.loadModalCategories();
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar permanentemente la categoría', 'error');
    }
  },

  async deleteCategory(id) {
    return this.deactivateCategory(id);
  },

  async deactivateProduct(id) {
    if (!confirm('¿Desea dar de baja este platillo del catálogo?\n\nSe ocultará de Caja y Comedor pero conservará su historial. Podrá reactivarlo o eliminarlo definitivamente desde el filtro "Inactivos".')) return;
    try {
      const res = await api.products.delete(id, false);
      if (res.success) {
        showToast(res.message || 'Platillo dado de baja', 'info');
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al dar de baja platillo', 'error');
    }
  },

  async restoreProduct(id) {
    try {
      const res = await api.products.restore(id);
      if (res.success) {
        showToast(res.message || 'Platillo reactivado', res.categoryInactive ? 'warning' : 'success', res.categoryInactive ? 5500 : 3500);
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al reactivar platillo', 'error');
    }
  },

  async permanentDeleteProduct(id) {
    const prod = this.productsList.find(item => item.id === id);
    const prodLabel = prod ? `"${prod.name}" (${prod.code || 'S/C'})` : 'este platillo';
    const msg = `⚠️ ELIMINACIÓN PERMANENTE\n\n¿Está seguro de eliminar definitivamente ${prodLabel} de la base de datos MySQL?\n\n• Esta acción NO se puede deshacer.\n• Se borrará su historial de movimientos en Kardex (stock_movements).\n• Las ventas pasadas conservarán su nombre e importe en reportes.\n• El código SKU quedará libre para reutilizarse.`;
    if (!confirm(msg)) return;

    try {
      const res = await api.products.delete(id, true);
      if (res.success) {
        showToast(res.message || 'Platillo eliminado permanentemente', 'success');
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar permanentemente el platillo', 'error');
    }
  },

  async deleteProduct(id) {
    return this.deactivateProduct(id);
  }
};
