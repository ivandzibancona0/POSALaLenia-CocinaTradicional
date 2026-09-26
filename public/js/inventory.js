// Inventory & Products Management Module for A La Leña POS

const inventory = {
  page: 1,
  limit: 20,
  hasMore: true,
  isLoading: false,
  searchQuery: '',
  selectedCategory: '',
  lowStockOnly: false,
  productsList: [],
  categories: [],

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
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No se encontraron productos en el inventario.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    productsToAdd.forEach(p => {
      const stock = parseFloat(p.stock) || 0;
      const minStock = parseFloat(p.min_stock) || 5;

      let stockBadge = `<span class="badge badge-success">${stock} ${p.unit || 'ración'}</span>`;
      if (stock <= 0) {
        stockBadge = '<span class="badge badge-danger">AGOTADO (0)</span>';
      } else if (stock <= minStock) {
        stockBadge = `<span class="badge badge-warning">${stock} (Bajo)</span>`;
      }

      html += `
        <tr>
          <td><code style="font-weight: 700; color: var(--text-muted);">${p.code || 'S/C'}</code></td>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${p.name}</div>
            ${p.description ? `<div style="font-size: 0.76rem; color: var(--text-muted); max-width: 250px;">${p.description}</div>` : ''}
          </td>
          <td>
            <span class="badge badge-primary">${p.category_name || 'Sin Categoría'}</span>
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
            <span class="badge badge-success">Activo</span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm" onclick="inventory.openStockAdjustModal(${p.id})" title="Ajustar Stock Rápido">
                <span data-icon="plus-minus"></span>
                <span>Ajustar</span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.openProductModal(${p.id})" title="Editar">
                <span data-icon="edit"></span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.deleteProduct(${p.id})" title="Eliminar" style="color: var(--danger-600);">
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
    await this.loadCategories();
    this.renderCategoriesTable();
    openModal('modal-categories');
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

    if (this.categories.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No hay categorías registradas.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    this.categories.forEach(c => {
      html += `
        <tr>
          <td><span data-icon="${c.icon || 'utensils'}"></span></td>
          <td><strong style="color: var(--text-main); font-size: 0.9rem;">${c.name}</strong></td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${c.description || 'Sin descripción'}</td>
          <td><span class="badge badge-info">${c.product_count || 0} platillo(s)</span></td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.editCategory(${c.id})" title="Editar">
                <span data-icon="edit"></span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="inventory.deleteCategory(${c.id})" title="Eliminar" style="color: var(--danger-600);">
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

  editCategory(id) {
    const cat = this.categories.find(c => c.id === id);
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
      this.renderCategoriesTable();
      if (pos) pos.loadInitialData();
    } catch (err) {
      showToast(err.message || 'Error al guardar categoría', 'error');
    }
  },

  async deleteCategory(id) {
    const cat = this.categories.find(c => c.id === id);
    if (cat && cat.product_count > 0) {
      showToast(`No se puede eliminar porque contiene ${cat.product_count} platillos`, 'warning');
      return;
    }
    if (!confirm('¿Está seguro de eliminar esta categoría?')) return;

    try {
      const res = await api.categories.delete(id);
      if (res.success) {
        showToast('Categoría eliminada', 'info');
        await this.loadCategories();
        this.renderCategoriesTable();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar categoría', 'error');
    }
  },

  async deleteProduct(id) {
    if (!confirm('¿Desea dar de baja este producto del catálogo?')) return;
    try {
      const res = await api.products.delete(id);
      if (res.success) {
        showToast('Producto eliminado', 'info');
        this.resetAndLoad();
        if (pos) pos.loadInitialData();
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar producto', 'error');
    }
  }
};
