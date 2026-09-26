// Reports Module - KPI Dashboard, Report 1 (Sales) & Report 2 (Detailed with Order #) & CSV Export

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const reports = {
  startDate: '',
  endDate: '',
  activeTab: 'report-1',

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.setupDefaultDates();
    this.bindEvents();
  },

  setupDefaultDates() {
    const today = formatLocalDate(new Date());
    this.startDate = today;
    this.endDate = today;

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');

    if (startInput) startInput.value = today;
    if (endInput) endInput.value = today;
  },

  bindEvents() {
    // Preset buttons
    document.querySelectorAll('.report-date-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.report-date-preset').forEach(b => b.classList.remove('active', 'btn-primary'));
        btn.classList.add('active', 'btn-primary');

        const preset = btn.getAttribute('data-preset');
        const now = new Date();

        if (preset === 'today') {
          const today = formatLocalDate(now);
          this.startDate = today;
          this.endDate = today;
        } else if (preset === 'week') {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(now.setDate(diff));
          this.startDate = formatLocalDate(monday);
          this.endDate = formatLocalDate(new Date());
        } else if (preset === 'month') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          this.startDate = formatLocalDate(firstDay);
          this.endDate = formatLocalDate(new Date());
        }

        document.getElementById('report-start-date').value = this.startDate;
        document.getElementById('report-end-date').value = this.endDate;
        this.loadReports();
      });
    });

    // Custom date range filter button
    const btnApply = document.getElementById('btn-apply-report-dates');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        this.startDate = document.getElementById('report-start-date').value;
        this.endDate = document.getElementById('report-end-date').value;
        this.loadReports();
      });
    }

    // Tabs switch between Report 1 and Report 2
    const tab1 = document.getElementById('tab-report-1');
    const tab2 = document.getElementById('tab-report-2');
    const container1 = document.getElementById('container-report-1');
    const container2 = document.getElementById('container-report-2');

    if (tab1 && tab2) {
      tab1.addEventListener('click', () => {
        this.activeTab = 'report-1';
        tab1.className = 'btn btn-primary';
        tab2.className = 'btn btn-secondary';
        container1.style.display = 'block';
        container2.style.display = 'none';
      });

      tab2.addEventListener('click', () => {
        this.activeTab = 'report-2';
        tab2.className = 'btn btn-primary';
        tab1.className = 'btn btn-secondary';
        container2.style.display = 'block';
        container1.style.display = 'none';
      });
    }

    // CSV Download Buttons
    const btnCsv1 = document.getElementById('btn-export-report-1-csv');
    if (btnCsv1) {
      btnCsv1.addEventListener('click', async () => {
        try {
          showToast('Generando y descargando Reporte 1 (Ventas Generales)...', 'info');
          const url = `/sales/report/csv/general?startDate=${this.startDate}&endDate=${this.endDate}`;
          await api.downloadFile(url, `Reporte1_Ventas_${this.startDate}_${this.endDate}.csv`);
          showToast('Reporte 1 descargado correctamente', 'success');
        } catch (err) {
          showToast(err.message || 'Error al descargar Reporte 1', 'error');
        }
      });
    }

    const btnCsv2 = document.getElementById('btn-export-report-2-csv');
    if (btnCsv2) {
      btnCsv2.addEventListener('click', async () => {
        try {
          showToast('Generando y descargando Reporte 2 (Detallado por Platillo con No. Orden)...', 'info');
          const url = `/sales/report/csv/detailed-products?startDate=${this.startDate}&endDate=${this.endDate}`;
          await api.downloadFile(url, `Reporte2_Platillos_Ordenes_${this.startDate}_${this.endDate}.csv`);
          showToast('Reporte 2 descargado correctamente', 'success');
        } catch (err) {
          showToast(err.message || 'Error al descargar Reporte 2', 'error');
        }
      });
    }
  },

  async loadReports() {
    try {
      const [sumRes, rep1Res, rep2Res] = await Promise.all([
        api.sales.getSummary(this.startDate, this.endDate),
        api.sales.getReport1(this.startDate, this.endDate),
        api.sales.getReport2(this.startDate, this.endDate)
      ]);

      if (sumRes.success) {
        this.renderKpis(sumRes.summary);
      }

      if (rep1Res.success) {
        this.renderReport1(rep1Res.sales);
      }

      if (rep2Res.success) {
        this.renderReport2(rep2Res.items);
      }
    } catch (err) {
      console.error('Error al generar reportes:', err);
      showToast('Error al consultar reportes de ventas', 'error');
    }
  },

  renderKpis(summary) {
    document.getElementById('kpi-total-sales').textContent = formatMoney(summary.total_sales || 0);
    document.getElementById('kpi-total-orders').textContent = (summary.total_orders || 0).toLocaleString();
    document.getElementById('kpi-avg-ticket').textContent = formatMoney(summary.average_ticket || 0);
    document.getElementById('kpi-total-discounts').textContent = formatMoney(summary.total_discounts || 0);
  },

  renderReport1(sales) {
    const tbody = document.getElementById('report-1-table-body');
    if (!tbody) return;

    if (!sales || sales.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No hay registros de ventas en el período seleccionado.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    sales.forEach(s => {
      html += `
        <tr>
          <td><strong style="color: var(--primary-700);">#${s.order_number}</strong></td>
          <td style="font-size: 0.84rem;">${formatDate(s.created_at)}</td>
          <td>
            <span class="badge ${s.sale_type === 'dining' ? 'badge-warning' : 'badge-info'}">
              ${s.sale_type === 'dining' ? 'Comedor' : 'Mostrador'}
            </span>
          </td>
          <td>
            <div style="font-weight: 600;">${s.customer_name}</div>
            ${s.customer_phone ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${s.customer_phone}</div>` : ''}
          </td>
          <td><span class="badge badge-primary">${(s.payment_method || 'Efectivo').toUpperCase()}</span></td>
          <td>${formatMoney(s.subtotal)}</td>
          <td style="color: var(--danger-600);">${s.discount > 0 ? `-${formatMoney(s.discount)}` : '$0.00'}</td>
          <td><strong style="color: var(--text-main); font-size: 0.95rem;">${formatMoney(s.total)}</strong></td>
          <td style="font-size: 0.85rem;">${s.cashier_name || 'N/A'}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="customers.viewSaleTicket('${s.order_number}')">
              <span data-icon="receipt"></span>
              <span>Ticket</span>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    renderIcons();
  },

  renderReport2(items) {
    const tbody = document.getElementById('report-2-table-body');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No hay registros de platillos vendidos en el período seleccionado.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    items.forEach(it => {
      const isHalf = it.portion_type === 'half';
      html += `
        <tr>
          <td><strong style="color: var(--primary-700);">#${it.order_number}</strong></td>
          <td style="font-size: 0.82rem;">${formatDate(it.created_at)}</td>
          <td><strong style="color: var(--text-main);">${it.product_name}</strong></td>
          <td><span class="badge badge-primary">${it.category_name || 'General'}</span></td>
          <td>
            <span class="badge ${isHalf ? 'badge-warning' : 'badge-success'}">
              ${isHalf ? 'Media Ración' : 'Ración Completa'}
            </span>
          </td>
          <td style="font-weight: 700;">${it.quantity}</td>
          <td>${formatMoney(it.unit_price)}</td>
          <td><strong style="color: var(--primary-700);">${formatMoney(it.subtotal)}</strong></td>
          <td><span class="badge badge-info">${(it.payment_method || 'Efectivo').toUpperCase()}</span></td>
          <td style="font-size: 0.85rem;">${it.customer_name}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    renderIcons();
  }
};
