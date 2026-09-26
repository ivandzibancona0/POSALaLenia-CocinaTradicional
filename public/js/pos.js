// POS Cashier Module - Catalog, Real-time Stock, Portion Selectors, Cart & Checkout

const pos = {
  products: [],
  categories: [],
  cart: [],
  selectedCustomer: null,
  selectedCategory: '',
  searchQuery: '',
  discount: 0,
  paymentMethod: 'cash',
  amountPaid: 0,
  isDiningTransfer: false,
  transferDiningTableId: null,
  isSubmitting: false,
  isInitialized: false,

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindEvents();
    this.updateHeldOrdersIndicators();
  },

  async loadInitialData() {
    try {
      const [catsRes, prodsRes] = await Promise.all([
        api.categories.getAll(),
        api.products.getAllActive()
      ]);

      if (catsRes.success) {
        this.categories = catsRes.categories;
        this.renderCategoryTabs();
      }

      if (prodsRes.success) {
        this.products = prodsRes.products;
        this.renderProducts();
      }
    } catch (err) {
      console.error('Error cargando catálogo POS:', err);
      showToast('Error al cargar catálogo de productos', 'error');
    }
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('pos-product-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderProducts();
      });
    }

    // Customer search autocomplete
    const custInput = document.getElementById('pos-customer-search-input');
    const custResults = document.getElementById('pos-customer-results');
    if (custInput && custResults) {
      custInput.addEventListener('input', async (e) => {
        const q = e.target.value.trim();
        if (q.length === 0) {
          custResults.classList.remove('open');
          return;
        }

        try {
          const res = await api.customers.search(q);
          if (res.success && res.customers.length > 0) {
            custResults.innerHTML = res.customers.map(c => `
              <div class="customer-search-item" data-cust-id="${c.id}">
                <span class="customer-search-item-name">${c.first_name} ${c.last_name}</span>
                <span class="customer-search-item-phone">${c.phone || 'Sin tel'} - ${c.address || 'Sin dir'}</span>
              </div>
            `).join('');
            custResults.classList.add('open');

            custResults.querySelectorAll('.customer-search-item').forEach(item => {
              item.addEventListener('click', () => {
                const id = item.getAttribute('data-cust-id');
                const cust = res.customers.find(c => c.id == id);
                if (cust) pos.setCustomer(cust);
                custResults.classList.remove('open');
                custInput.value = '';
              });
            });
          } else {
            custResults.innerHTML = '<div style="padding: 0.6rem; font-size: 0.8rem; color: var(--text-muted);">No se encontraron clientes</div>';
            custResults.classList.add('open');
          }
        } catch (err) {
          console.error(err);
        }
      });

      // Close autocomplete on click outside
      document.addEventListener('click', (e) => {
        if (!custInput.contains(e.target) && !custResults.contains(e.target)) {
          custResults.classList.remove('open');
        }
      });
    }

    // Remove selected customer
    const btnRemoveCust = document.getElementById('btn-remove-selected-customer');
    if (btnRemoveCust) {
      btnRemoveCust.addEventListener('click', () => this.setCustomer(null));
    }

    // Quick New Customer Button
    const btnQuickCust = document.getElementById('btn-quick-new-customer');
    if (btnQuickCust) {
      btnQuickCust.addEventListener('click', () => {
        customers.openFormModal();
      });
    }

    // Discount Input
    const discountInput = document.getElementById('cart-discount-input');
    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        this.discount = parseFloat(e.target.value) || 0;
        this.updateCartTotals();
      });
    }

    // Clear Cart Button
    const btnClear = document.getElementById('btn-clear-cart');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (this.cart.length === 0) return;
        if (confirm('¿Desea vaciar la orden actual?')) {
          this.clearCart();
        }
      });
    }

    // Hold / Pause Cart Button
    const btnHold = document.getElementById('btn-cart-hold');
    if (btnHold) {
      btnHold.addEventListener('click', () => this.openHeldOrdersModal());
    }

    const btnConfirmHold = document.getElementById('btn-confirm-hold-cart');
    if (btnConfirmHold) {
      btnConfirmHold.addEventListener('click', () => this.holdCurrentCart());
    }

    // Open Checkout Button
    const btnCheckout = document.getElementById('btn-open-checkout');
    if (btnCheckout) {
      btnCheckout.addEventListener('click', () => this.openCheckoutModal());
    }

    // Checkout Payment Methods Selector
    document.querySelectorAll('.payment-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.payment-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.paymentMethod = btn.getAttribute('data-method');

        const cashFields = document.getElementById('cash-payment-fields');
        const paidInput = document.getElementById('checkout-amount-paid');
        const total = this.getCartTotal();

        if (this.paymentMethod === 'cash') {
          if (cashFields) cashFields.style.display = 'block';
        } else if (this.paymentMethod === 'card' || this.paymentMethod === 'transfer') {
          if (cashFields) cashFields.style.display = 'block';
          if (paidInput) paidInput.value = total.toFixed(2);
        } else {
          if (cashFields) cashFields.style.display = 'block';
        }

        this.recalcChange();
      });
    });

    // Quick Cash Pills
    document.querySelectorAll('.quick-cash-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        const total = this.getCartTotal();
        const input = document.getElementById('checkout-amount-paid');

        if (val === 'exact') {
          input.value = total.toFixed(2);
        } else {
          input.value = parseFloat(val).toFixed(2);
        }
        this.recalcChange();
      });
    });

    // Cash Paid Input
    const cashPaidInput = document.getElementById('checkout-amount-paid');
    if (cashPaidInput) {
      cashPaidInput.addEventListener('input', () => this.recalcChange());
    }

    // Confirm Checkout
    const btnConfirm = document.getElementById('btn-confirm-checkout');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => this.submitSale());
    }
  },

  renderCategoryTabs() {
    const container = document.getElementById('pos-category-tabs');
    if (!container) return;

    let html = `
      <button class="category-tab ${this.selectedCategory === '' ? 'active' : ''}" data-cat-id="">
        <span data-icon="layout-grid"></span>
        <span>Todos</span>
      </button>
    `;

    this.categories.forEach(c => {
      const active = this.selectedCategory == c.id ? 'active' : '';
      html += `
        <button class="category-tab ${active}" data-cat-id="${c.id}">
          <span data-icon="${c.icon || 'utensils'}"></span>
          <span>${c.name}</span>
        </button>
      `;
    });

    container.innerHTML = html;
    renderIcons();

    container.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.selectedCategory = tab.getAttribute('data-cat-id');
        this.renderProducts();
      });
    });
  },

  renderProducts() {
    const container = document.getElementById('pos-products-grid');
    if (!container) return;

    const filtered = this.products.filter(p => {
      const matchCat = !this.selectedCategory || p.category_id == this.selectedCategory;
      const matchSearch = !this.searchQuery || 
        p.name.toLowerCase().includes(this.searchQuery) || 
        (p.code && p.code.toLowerCase().includes(this.searchQuery));
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 1rem; text-align: center; color: var(--text-muted);">
          <span data-icon="search" style="width: 36px; height: 36px; opacity: 0.5;"></span>
          <p style="margin-top: 0.5rem; font-weight: 600;">No se encontraron platillos con ese criterio</p>
        </div>
      `;
      renderIcons();
      return;
    }

    let html = '';
    filtered.forEach(p => {
      const stock = parseFloat(p.stock) || 0;
      const minStock = parseFloat(p.min_stock) || 5;

      let stockBadgeClass = 'in-stock';
      let stockText = `Disponible: ${stock} ${p.unit || 'ración'}(es)`;

      if (stock <= 0) {
        stockBadgeClass = 'out-of-stock';
        stockText = 'AGOTADO';
      } else if (stock <= minStock) {
        stockBadgeClass = 'low-stock';
        stockText = `Bajo Stock: ${stock} disp.`;
      }

      html += `
        <div class="product-card" data-prod-id="${p.id}">
          <div class="product-card-top">
            <span class="product-category-tag">${p.category_name || 'Comida Yucateca'}</span>
            <div class="product-name">${p.name}</div>
            ${p.description ? `<div class="product-description">${p.description}</div>` : ''}
            
            <!-- Real-time Stock Indicator -->
            <div class="stock-badge-container">
              <span class="stock-badge ${stockBadgeClass}">
                <span data-icon="${stock <= 0 ? 'alert-triangle' : 'check-circle-2'}"></span>
                <span>${stockText}</span>
              </span>
            </div>
          </div>

          <!-- Portion Options & Add Buttons -->
          <div class="product-actions-wrapper">
            ${p.has_half_portion ? `
              <button class="btn-add-portion btn-add-full" data-prod-id="${p.id}" data-portion="full" ${stock <= 0 ? 'disabled' : ''}>
                <span class="portion-label">Ración Completa</span>
                <span class="portion-price">${formatMoney(p.price)}</span>
              </button>
              <button class="btn-add-portion btn-add-half" data-prod-id="${p.id}" data-portion="half" ${stock < 0.5 ? 'disabled' : ''} style="background: var(--amber-50); border-color: rgba(245, 158, 11, 0.4);">
                <span class="portion-label" style="color: var(--amber-600);">Media Ración</span>
                <span class="portion-price" style="color: var(--amber-600);">${formatMoney(p.half_price)}</span>
              </button>
            ` : `
              <button class="btn-add-portion btn-add-full" data-prod-id="${p.id}" data-portion="full" ${stock <= 0 ? 'disabled' : ''}>
                <span class="portion-label">Agregar Orden</span>
                <span class="portion-price">${formatMoney(p.price)}</span>
              </button>
            `}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    renderIcons();

    // Bind add-to-cart clicks
    container.querySelectorAll('.btn-add-portion').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-prod-id');
        const portion = btn.getAttribute('data-portion');
        const product = this.products.find(p => p.id == prodId);
        if (product) {
          this.addToCart(product, portion);
        }
      });
    });
  },

  addToCart(product, portion = 'full') {
    const isHalf = portion === 'half';
    const unitPrice = isHalf ? parseFloat(product.half_price) : parseFloat(product.price);
    const requiredStockFactor = isHalf ? 0.5 : 1.0;

    // Check available stock
    const currentCartUsage = this.cart
      .filter(item => item.product_id === product.id)
      .reduce((sum, item) => sum + (item.quantity * (item.portion_type === 'half' ? 0.5 : 1.0)), 0);

    if ((currentCartUsage + requiredStockFactor) > product.stock) {
      showToast(`Stock insuficiente para agregar más de ${product.name}`, 'warning');
      return;
    }

    // Find existing item with exact same product and portion
    const existingIndex = this.cart.findIndex(item => item.product_id === product.id && item.portion_type === portion);

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
    } else {
      this.cart.push({
        product_id: product.id,
        product_name: product.name,
        category_name: product.category_name,
        portion_type: portion,
        unit_price: unitPrice,
        quantity: 1,
        notes: ''
      });
    }

    showToast(`Agregado: ${product.name} (${isHalf ? 'Media' : 'Completa'})`, 'info', 1800);
    this.renderCart();
  },

  updateCartItemQty(index, delta) {
    const item = this.cart[index];
    if (!item) return;

    const product = this.products.find(p => p.id === item.product_id);
    const isHalf = item.portion_type === 'half';
    const factor = isHalf ? 0.5 : 1.0;

    if (delta > 0 && product) {
      const currentUsage = this.cart
        .filter(it => it.product_id === product.id)
        .reduce((sum, it) => sum + (it.quantity * (it.portion_type === 'half' ? 0.5 : 1.0)), 0);

      if ((currentUsage + factor) > product.stock) {
        showToast(`Stock insuficiente de ${product.name}`, 'warning');
        return;
      }
    }

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart.splice(index, 1);
    }
    this.renderCart();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.renderCart();
  },

  clearCart() {
    this.cart = [];
    this.selectedCustomer = null;
    this.discount = 0;
    this.isDiningTransfer = false;
    this.transferDiningTableId = null;

    const discInput = document.getElementById('cart-discount-input');
    if (discInput) discInput.value = 0;

    const notesInput = document.getElementById('pos-sale-notes');
    if (notesInput) notesInput.value = '';

    this.setCustomer(null);
    this.renderCart();
  },

  setCustomer(cust) {
    this.selectedCustomer = cust;
    const pill = document.getElementById('selected-customer-display');
    const searchBox = document.getElementById('customer-search-box');

    if (cust) {
      document.getElementById('cart-customer-name').textContent = `${cust.first_name} ${cust.last_name}`;
      document.getElementById('cart-customer-phone').textContent = `${cust.phone || 'Sin tel'} • ${cust.address || 'Sin dir'}`;
      if (pill) pill.style.display = 'flex';
      if (searchBox) searchBox.style.display = 'none';
    } else {
      if (pill) pill.style.display = 'none';
      if (searchBox) searchBox.style.display = 'flex';
      const custInput = document.getElementById('pos-customer-search-input');
      if (custInput) custInput.value = '';
    }
  },

  renderCart() {
    const container = document.getElementById('cart-items-list');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <span data-icon="shopping-bag" style="width: 42px; height: 42px; opacity: 0.4;"></span>
          <p>El carrito está vacío</p>
          <span style="font-size: 0.78rem;">Seleccione platillos del catálogo</span>
        </div>
      `;
      this.updateCartTotals();
      renderIcons();
      return;
    }

    let html = '';
    this.cart.forEach((item, index) => {
      const itemSubtotal = item.quantity * item.unit_price;
      const isHalf = item.portion_type === 'half';

      html += `
        <div class="cart-item">
          <div class="cart-item-row-1">
            <div>
              <div class="cart-item-name">${item.product_name}</div>
              <span class="portion-pill" style="${isHalf ? 'background: var(--amber-100); color: var(--amber-600);' : 'background: var(--primary-100); color: var(--primary-700);'}">
                ${isHalf ? 'Media Ración' : 'Ración Completa'}
              </span>
            </div>
            <button class="btn-icon btn-sm" onclick="pos.removeFromCart(${index})" title="Eliminar" style="color: var(--danger-600);">
              <span data-icon="trash-2"></span>
            </button>
          </div>

          <div class="cart-item-row-2">
            <div class="qty-controls">
              <button class="btn-qty" onclick="pos.updateCartItemQty(${index}, -1)">-</button>
              <span class="qty-display">${item.quantity}</span>
              <button class="btn-qty" onclick="pos.updateCartItemQty(${index}, 1)">+</button>
            </div>
            <div class="cart-item-price">${formatMoney(itemSubtotal)}</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    renderIcons();
    this.updateCartTotals();
  },

  getCartSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  },

  getCartTotal() {
    const subtotal = this.getCartSubtotal();
    return Math.max(0, subtotal - this.discount);
  },

  updateCartTotals() {
    const subtotal = this.getCartSubtotal();
    const total = this.getCartTotal();

    const subEl = document.getElementById('cart-subtotal-val');
    if (subEl) subEl.textContent = formatMoney(subtotal);

    const totEl = document.getElementById('cart-total-val');
    if (totEl) totEl.textContent = formatMoney(total);
  },

  openCheckoutModal() {
    if (this.cart.length === 0) {
      showToast('Agregue productos al carrito antes de cobrar', 'warning');
      return;
    }

    this.paymentMethod = 'cash';
    document.querySelectorAll('.payment-opt-btn').forEach(btn => {
      if (btn.getAttribute('data-method') === 'cash') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const total = this.getCartTotal();
    document.getElementById('checkout-total-display').textContent = formatMoney(total);
    
    // Default cash amount to total
    const cashInput = document.getElementById('checkout-amount-paid');
    if (cashInput) cashInput.value = total.toFixed(2);

    this.recalcChange();
    renderIcons();
    openModal('modal-checkout');
  },

  recalcChange() {
    const total = this.getCartTotal();
    const paidInput = document.getElementById('checkout-amount-paid');
    const changeDisplay = document.getElementById('checkout-change-display');

    if (!paidInput || !changeDisplay) return;

    let paid = parseFloat(paidInput.value);
    if (isNaN(paid)) paid = total;

    const change = Math.max(0, paid - total);
    changeDisplay.textContent = formatMoney(change);
  },

  async submitSale() {
    if (this.isSubmitting) return;
    if (this.cart.length === 0) return;
    this.isSubmitting = true;

    const total = this.getCartTotal();
    const subtotal = this.getCartSubtotal();
    const paidInput = document.getElementById('checkout-amount-paid');
    let amountPaid = parseFloat(paidInput.value);
    if (isNaN(amountPaid)) amountPaid = total;

    if (amountPaid < total && this.paymentMethod === 'cash') {
      showToast('El monto recibido es menor al total a pagar', 'warning');
      return;
    }

    const notes = document.getElementById('pos-sale-notes').value.trim();

    const payload = {
      customer_id: this.selectedCustomer ? this.selectedCustomer.id : null,
      dining_table_id: this.transferDiningTableId || null,
      sale_type: this.isDiningTransfer ? 'dining' : 'takeout',
      items: this.cart,
      discount: this.discount,
      payment_method: this.paymentMethod,
      amount_paid: amountPaid,
      notes: notes
    };

    const confirmBtn = document.getElementById('btn-confirm-checkout');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>Procesando venta...</span>';

    try {
      const res = await api.sales.create(payload);
      if (res.success) {
        closeModal('modal-checkout');
        showToast(res.message, 'success');

        // Show ticket preview and printing modal
        ticketPrinter.showTicketModal({
          sale: res.sale,
          items: res.items,
          settings: res.settings,
          order_number: res.order_number
        });

        // Reset cart
        this.clearCart();

        // Refresh products catalog stock
        this.loadInitialData();

        // If from dining table, refresh tables
        if (typeof dining !== 'undefined') {
          dining.loadTables();
        }
      }
    } catch (err) {
      console.error('Error procesando venta:', err);
      showToast(err.message || 'Error al procesar cobro', 'error');
    } finally {
      this.isSubmitting = false;
      const btn = document.getElementById('btn-confirm-checkout');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <span data-icon="printer"></span>
          <span>Finalizar e Imprimir Ticket</span>
        `;
      }
      renderIcons();
    }
  },

  // Receive a dining table account into the cash register
  loadDiningAccount(table, items, customer) {
    this.clearCart();
    this.isDiningTransfer = true;
    this.transferDiningTableId = table.id;

    if (customer) {
      this.setCustomer(customer);
    } else if (table.guest_name) {
      this.setCustomer({
        id: null,
        first_name: table.guest_name,
        last_name: `(Mesa ${table.table_number})`,
        phone: '',
        address: 'Consumo en Comedor'
      });
    }

    items.forEach(it => {
      this.cart.push({
        product_id: it.product_id,
        product_name: it.product_name,
        category_name: it.category_name,
        portion_type: it.portion_type || 'full',
        unit_price: parseFloat(it.unit_price),
        quantity: parseFloat(it.quantity),
        notes: it.notes || ''
      });
    });

    const notesEl = document.getElementById('pos-sale-notes');
    if (notesEl) {
      notesEl.value = `Consumo de ${table.name}${table.notes ? ` - ${table.notes}` : ''}`;
    }

    this.renderCart();
    app.navigateTo('pos');
    showToast(`Cuenta de ${table.name} cargada en caja para cobro`, 'info');
  },

  // ==========================================
  // HELD / PAUSED ORDERS MANAGEMENT
  // ==========================================
  getHeldOrders() {
    try {
      const stored = localStorage.getItem('alelena_held_orders');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  saveHeldOrders(orders) {
    try {
      localStorage.setItem('alelena_held_orders', JSON.stringify(orders));
    } catch (e) {}
    this.updateHeldOrdersIndicators();
  },

  updateHeldOrdersIndicators() {
    const orders = this.getHeldOrders();
    const count = orders.length;

    const badge = document.getElementById('held-orders-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    const indicatorBtn = document.getElementById('btn-held-orders-indicator');
    const countSpan = document.getElementById('held-indicator-count');
    if (indicatorBtn && countSpan) {
      countSpan.textContent = count;
      indicatorBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  },

  openHeldOrdersModal() {
    const hasItems = this.cart.length > 0;
    const holdSection = document.getElementById('hold-current-cart-section');
    if (holdSection) {
      holdSection.style.display = hasItems ? 'block' : 'none';
    }

    const noteInput = document.getElementById('hold-order-note');
    if (noteInput) noteInput.value = '';

    this.renderHeldOrdersTable();
    openModal('modal-held-orders');
  },

  holdCurrentCart() {
    if (this.cart.length === 0) {
      showToast('No hay platillos en el carrito para pausar', 'warning');
      return;
    }

    const noteInput = document.getElementById('hold-order-note');
    const note = noteInput ? noteInput.value.trim() : '';
    const total = this.getCartTotal();

    const heldOrder = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      note: note || (this.selectedCustomer ? `${this.selectedCustomer.first_name} ${this.selectedCustomer.last_name || ''}` : 'Venta General'),
      customer: this.selectedCustomer,
      items: JSON.parse(JSON.stringify(this.cart)),
      discount: this.discount,
      comments: document.getElementById('pos-sale-notes') ? document.getElementById('pos-sale-notes').value : '',
      total: total
    };

    const orders = this.getHeldOrders();
    orders.unshift(heldOrder);
    this.saveHeldOrders(orders);

    this.clearCart();
    closeModal('modal-held-orders');
    showToast('Orden guardada en espera. Carrito listo para el siguiente cliente.', 'success');
  },

  renderHeldOrdersTable() {
    const tbody = document.getElementById('held-orders-table-body');
    if (!tbody) return;

    const orders = this.getHeldOrders();
    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No hay órdenes pausadas en este momento.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    orders.forEach(o => {
      const itemsCount = o.items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 1), 0);
      const itemsSummary = o.items.map(it => `${it.quantity}x ${it.product_name}`).join(', ');

      html += `
        <tr>
          <td><code style="font-weight: 700;">${o.timestamp}</code></td>
          <td>
            <strong style="color: var(--text-main); font-size: 0.9rem;">${o.note}</strong>
            ${o.comments ? `<div style="font-size: 0.74rem; color: var(--text-muted);">${o.comments}</div>` : ''}
          </td>
          <td>
            <span class="badge badge-info">${itemsCount} item(s)</span>
            <div style="font-size: 0.74rem; color: var(--text-muted); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemsSummary}">
              ${itemsSummary}
            </div>
          </td>
          <td><strong style="color: var(--primary-700); font-size: 0.95rem;">${formatMoney(o.total)}</strong></td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button class="btn btn-primary btn-sm" onclick="pos.resumeHeldOrder(${o.id})" title="Cargar orden al carrito">
                <span data-icon="play"></span>
                <span>Reanudar</span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="pos.deleteHeldOrder(${o.id})" title="Descartar" style="color: var(--danger-600);">
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

  resumeHeldOrder(orderId) {
    const orders = this.getHeldOrders();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    if (this.cart.length > 0) {
      if (!confirm('El carrito actual contiene productos. ¿Desea reemplazarlos con la orden pausada?')) {
        return;
      }
    }

    const order = orders[orderIndex];
    this.clearCart();

    this.cart = order.items || [];
    this.selectedCustomer = order.customer || null;
    this.discount = order.discount || 0;

    const discountInput = document.getElementById('cart-discount-input');
    if (discountInput) discountInput.value = this.discount;

    const notesEl = document.getElementById('pos-sale-notes');
    if (notesEl) notesEl.value = order.comments || '';

    // Remove from held orders
    orders.splice(orderIndex, 1);
    this.saveHeldOrders(orders);

    closeModal('modal-held-orders');
    this.renderCart();
    showToast('Orden pausada recuperada con éxito en el carrito', 'success');
  },

  deleteHeldOrder(orderId) {
    if (!confirm('¿Desea descartar esta orden pausada?')) return;
    let orders = this.getHeldOrders();
    orders = orders.filter(o => o.id !== orderId);
    this.saveHeldOrders(orders);
    this.renderHeldOrdersTable();
    showToast('Orden pausada eliminada', 'info');
  }
};
