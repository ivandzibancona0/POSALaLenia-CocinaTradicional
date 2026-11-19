// Ticket Printer Module - Generates Physical POS Thermal Format & Digital PDF for A La Leña

const ticketPrinter = {
  currentTicketData: null,
  cachedLogo: null,
  pendingCancelSale: null,

  // Render HTML Ticket for Preview and Printing
  renderTicketHtml(data) {
    this.currentTicketData = data;
    const settings = data.settings || {};
    const sale = data.sale || {};
    const items = data.items || [];
    const paperWidth = settings.paper_width || '80mm';
    const fontSize = ['small', 'medium', 'large'].includes(settings.font_size) ? settings.font_size : 'medium';

    const isPreCheck = data.ticket_type === 'pre_check';
    const orderNum = sale.order_number || data.order_number || 'S/N';
    const dateFormatted = formatDate(sale.created_at || data.printed_at || new Date());
    const cashierName = sale.cashier_name || data.waiter || 'Cajero';

    // Customer details
    const custName = sale.customer_first_name 
      ? `${sale.customer_first_name} ${sale.customer_last_name}` 
      : (data.guest_name || (data.customer ? data.customer.name : 'Público General'));
    const custPhone = sale.customer_phone || (data.customer ? data.customer.phone : '');
    const custAddress = sale.customer_address || (data.customer ? data.customer.address : '');

    let itemsHtml = '';
    items.forEach(it => {
      const portionText = it.portion_type === 'half' ? ' [Media Ración]' : '';
      const unitPrice = parseFloat(it.unit_price) || 0;
      const subtotal = parseFloat(it.subtotal || (it.quantity * it.unit_price)) || 0;
      const qty = it.quantity;

      itemsHtml += `
        <tr>
          <td style="width: 15%;">${qty}x</td>
          <td style="width: 55%;">
            <strong>${it.product_name || it.name}</strong>
            ${portionText ? `<div class="ticket-item-subtext">${portionText}</div>` : ''}
            ${it.notes ? `<div class="ticket-item-subtext"><em>Nota: ${it.notes}</em></div>` : ''}
          </td>
          <td style="width: 30%; text-align: right;">${formatMoney(subtotal)}</td>
        </tr>
      `;
    });

    const subtotal = parseFloat(sale.subtotal || data.total) || 0;
    const discount = parseFloat(sale.discount) || 0;
    const total = parseFloat(sale.total || data.total) || 0;
    const amountPaid = parseFloat(sale.amount_paid) || total;
    const changeDue = parseFloat(sale.change_due) || 0;
    const payMethod = (sale.payment_method || 'Efectivo').toUpperCase();

    const html = `
      <div class="pos-ticket paper-${paperWidth} font-${fontSize}">
        <div class="ticket-header">
          ${settings.show_logo ? `<img src="assets/logo-a-la-leña.jpg" class="ticket-logo" alt="Logo">` : ''}
          <div class="ticket-business-name">${settings.business_name || 'A LA LEÑA'}</div>
          <div class="ticket-slogan">${settings.slogan || 'Cocina Tradicional Yucateca'}</div>
          <div class="ticket-business-info">
            <div>RFC: ${settings.rfc || 'XEXX010101000'}</div>
            <div>Tel: ${settings.phone || '999-123-4567'}</div>
            <div>${settings.address || 'Mérida, Yucatán'}</div>
          </div>
        </div>

        <div class="ticket-divider"></div>

        <div class="ticket-order-box">
          ${isPreCheck ? `*** PRE-CORTE DE COMEDOR ***<br>${data.table_name || 'Mesa'}` : `ORDEN: #${orderNum}`}
        </div>

        <div class="ticket-meta-row">
          <span>Fecha: ${dateFormatted}</span>
          <span>Atendió: ${cashierName}</span>
        </div>

        <div class="ticket-meta-row">
          <span>Tipo: ${sale.sale_type === 'dining' ? 'Comedor' : 'Mostrador / Para Llevar'}</span>
          <span>Estado: ${isPreCheck ? 'Por Cobrar' : 'Pagado'}</span>
        </div>

        <!-- Customer Information -->
        <div class="ticket-customer-box">
          <div><strong>CLIENTE:</strong> ${custName}</div>
          ${custPhone ? `<div><strong>Teléfono:</strong> ${custPhone}</div>` : ''}
          ${custAddress ? `<div><strong>Dirección:</strong> ${custAddress}</div>` : ''}
        </div>

        <div class="ticket-divider"></div>

        <!-- Items Table -->
        <table class="ticket-items-table">
          <thead>
            <tr>
              <th>Cant</th>
              <th>Descripción</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="ticket-divider"></div>

        <!-- Totals & Payment -->
        <table class="ticket-summary-table">
          ${discount > 0 ? `
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right;">${formatMoney(subtotal)}</td>
            </tr>
            <tr>
              <td>Descuento:</td>
              <td style="text-align: right;">-${formatMoney(discount)}</td>
            </tr>
          ` : ''}
          <tr class="ticket-total-row">
            <td>TOTAL A PAGAR:</td>
            <td style="text-align: right;">${formatMoney(total)}</td>
          </tr>
          ${!isPreCheck ? `
            <tr>
              <td>Método de Pago:</td>
              <td style="text-align: right;">${payMethod}</td>
            </tr>
            <tr>
              <td>Monto Recibido:</td>
              <td style="text-align: right;">${formatMoney(amountPaid)}</td>
            </tr>
            <tr>
              <td>Cambio:</td>
              <td style="text-align: right;">${formatMoney(changeDue)}</td>
            </tr>
          ` : ''}
        </table>

        ${sale.notes ? `
          <div class="ticket-divider"></div>
          <div style="font-size: 11px;">
            <strong>Comentarios:</strong> ${sale.notes}
          </div>
        ` : ''}

        <div class="ticket-double-divider"></div>

        <div class="ticket-footer">
          <div>${settings.ticket_footer || '¡Gracias por su compra! Vuelva pronto.'}</div>
          <div style="margin-top: 4px; font-size: 10px; color: #555;">*** Comprobante de Venta sin validez fiscal ***</div>
        </div>
      </div>
    `;

    const printArea = document.getElementById('printable-ticket-area');
    if (printArea) {
      printArea.innerHTML = html;
    }

    return html;
  },

  // Check whether current ticket represents a real cancellable sale for an admin
  canCancelTicket(ticketData) {
    if (!ticketData || ticketData.ticket_type === 'pre_check') return false;
    if (typeof auth === 'undefined' || !auth.isAdmin()) return false;
    const sale = ticketData.sale;
    if (!sale || !sale.id) return false;
    if (sale.status === 'cancelled') return false;
    return true;
  },

  // Open Preview Modal
  showTicketModal(ticketData) {
    this.renderTicketHtml(ticketData);
    const titleEl = document.getElementById('ticket-modal-title');
    if (titleEl) {
      titleEl.textContent = ticketData.ticket_type === 'pre_check' 
        ? 'Pre-corte de Comedor / Cuenta de Mesa' 
        : `Ticket de Venta #${ticketData.sale ? ticketData.sale.order_number : ticketData.order_number}`;
    }

    const btnCancel = document.getElementById('btn-cancel-sale-from-ticket');
    if (btnCancel) {
      btnCancel.style.display = this.canCancelTicket(ticketData) ? '' : 'none';
    }

    openModal('modal-ticket-preview');
  },

  // Open reusable cancel-order modal (from Reports or Ticket Preview)
  openCancelSaleModal({ saleId, orderNumber, closeTicketModal = false, onSuccess = null }) {
    if (typeof auth === 'undefined' || !auth.isAdmin()) {
      showToast('Acceso denegado. Solo los administradores pueden cancelar órdenes.', 'warning');
      return;
    }

    this.pendingCancelSale = { saleId, orderNumber, closeTicketModal, onSuccess };

    const labelEl = document.getElementById('cancel-sale-order-label');
    if (labelEl) labelEl.textContent = `#${orderNumber || saleId}`;

    const reasonInput = document.getElementById('cancel-sale-reason');
    if (reasonInput) reasonInput.value = '';

    const restoreCheck = document.getElementById('cancel-sale-restore-stock');
    if (restoreCheck) restoreCheck.checked = true;

    openModal('modal-cancel-sale');
  },

  openCancelFromCurrentTicket() {
    if (!this.canCancelTicket(this.currentTicketData)) return;
    const sale = this.currentTicketData.sale;
    this.openCancelSaleModal({
      saleId: sale.id,
      orderNumber: sale.order_number || this.currentTicketData.order_number,
      closeTicketModal: true,
      onSuccess: () => {
        if (typeof reports !== 'undefined' && typeof reports.loadReports === 'function') {
          const reportsView = document.getElementById('view-reports');
          if (reportsView && reportsView.classList.contains('active')) {
            reports.loadReports();
          }
        }
      }
    });
  },

  async submitCancelSale() {
    if (!this.pendingCancelSale) return;

    const { saleId, closeTicketModal, onSuccess } = this.pendingCancelSale;
    const reasonEl = document.getElementById('cancel-sale-reason');
    const restoreEl = document.getElementById('cancel-sale-restore-stock');
    const submitBtn = document.getElementById('btn-confirm-cancel-sale');

    const reason = reasonEl ? reasonEl.value.trim() : '';
    const restoreStock = restoreEl ? restoreEl.checked : true;

    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await api.sales.cancel(saleId, { reason, restore_stock: restoreStock });
      if (res.success) {
        closeModal('modal-cancel-sale');
        if (closeTicketModal) {
          closeModal('modal-ticket-preview');
        }
        if (this.currentTicketData && this.currentTicketData.sale && this.currentTicketData.sale.id === saleId) {
          this.currentTicketData.sale.status = 'cancelled';
        }
        this.pendingCancelSale = null;
        showToast(res.message || 'Orden cancelada correctamente', 'success');

        if (restoreStock && typeof pos !== 'undefined' && typeof pos.loadInitialData === 'function') {
          pos.loadInitialData();
        }
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      }
    } catch (err) {
      showToast(err.message || 'Error al cancelar la orden', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  // Physical POS Print
  printPhysical() {
    const logoImg = document.querySelector('#printable-ticket-area .ticket-logo');
    if (logoImg && !logoImg.complete) {
      const triggerPrint = () => window.print();
      logoImg.addEventListener('load', triggerPrint, { once: true });
      logoImg.addEventListener('error', triggerPrint, { once: true });
      return;
    }
    window.print();
  },

  // Load business logo as DataURL with natural dimensions for jsPDF
  loadLogoForPdf(logoUrl = 'assets/logo-a-la-leña.jpg') {
    if (this.cachedLogo) {
      return Promise.resolve(this.cachedLogo);
    }

    const loadImage = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          if (!width || !height) {
            resolve(null);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          resolve({ dataUrl, width, height });
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = src;
    });

    return loadImage(logoUrl)
      .catch(() => loadImage(encodeURI(logoUrl)))
      .then((result) => {
        if (result) this.cachedLogo = result;
        return result;
      })
      .catch((err) => {
        console.warn('No se pudo cargar el logotipo para el ticket PDF:', err);
        return null;
      });
  },

  // Resolve PDF page geometry & typography based on printer settings
  getPdfLayoutConfig(settings = {}) {
    const is58mm = settings.paper_width === '58mm';
    const pageWidth = is58mm ? 58 : 80;
    const marginX = is58mm ? 4 : 5;
    const contentWidth = pageWidth - (marginX * 2);
    const centerX = pageWidth / 2;
    const rightX = pageWidth - marginX;
    const sizeKey = ['small', 'medium', 'large'].includes(settings.font_size) ? settings.font_size : 'medium';

    const scales = is58mm
      ? {
          small: { title: 8.5, subtitle: 7.5, body: 6, lineHeight: 3.0, titleLineHeight: 3.8, subtitleLineHeight: 3.4 },
          medium: { title: 9.5, subtitle: 8.5, body: 7, lineHeight: 3.5, titleLineHeight: 4.2, subtitleLineHeight: 3.8 },
          large: { title: 10.5, subtitle: 9.5, body: 8, lineHeight: 4.0, titleLineHeight: 4.6, subtitleLineHeight: 4.2 }
        }
      : {
          small: { title: 10, subtitle: 9, body: 7, lineHeight: 3.5, titleLineHeight: 4.4, subtitleLineHeight: 4.0 },
          medium: { title: 11, subtitle: 10, body: 8, lineHeight: 4.0, titleLineHeight: 4.8, subtitleLineHeight: 4.4 },
          large: { title: 12, subtitle: 11, body: 9, lineHeight: 4.5, titleLineHeight: 5.2, subtitleLineHeight: 4.8 }
        };

    return {
      is58mm,
      pageWidth,
      marginX,
      contentWidth,
      centerX,
      rightX,
      ...scales[sizeKey]
    };
  },

  // Render ticket content onto a jsPDF instance and return final required height (mm)
  renderPdfContent(doc, data, layout, logoData = null) {
    const settings = data.settings || {};
    const sale = data.sale || {};
    const items = data.items || [];
    const isPreCheck = data.ticket_type === 'pre_check';
    const orderNum = sale.order_number || data.order_number || 'ORD-000';

    const drawWrapped = (text, x, currentY, maxWidth, stepY, options = {}) => {
      const safeText = String(text ?? '');
      const lines = doc.splitTextToSize(safeText, maxWidth);
      lines.forEach((line, idx) => {
        doc.text(line, x, currentY + (idx * stepY), options);
      });
      return currentY + (lines.length * stepY);
    };

    let y = 9;
    const showLogo = settings.show_logo == 1 || settings.show_logo === true;
    if (showLogo && logoData && logoData.dataUrl && logoData.width && logoData.height) {
      const logoWidth = layout.is58mm ? 16 : 20;
      const logoHeight = logoWidth * (logoData.height / logoData.width);
      const logoX = (layout.pageWidth - logoWidth) / 2;
      doc.addImage(logoData.dataUrl, 'JPEG', logoX, y - 3, logoWidth, logoHeight);
      y += logoHeight + 3;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(layout.title);
    y = drawWrapped(
      settings.business_name || 'A LA LEÑA',
      layout.centerX,
      y,
      layout.contentWidth,
      layout.titleLineHeight,
      { align: 'center' }
    );

    y += 1;
    doc.setFont('courier', 'normal');
    doc.setFontSize(layout.body);
    y = drawWrapped(
      settings.slogan || 'Cocina Tradicional Yucateca',
      layout.centerX,
      y,
      layout.contentWidth,
      layout.lineHeight,
      { align: 'center' }
    );

    y = drawWrapped(
      `RFC: ${settings.rfc || 'XEXX010101000'}`,
      layout.centerX,
      y,
      layout.contentWidth,
      layout.lineHeight,
      { align: 'center' }
    );
    y = drawWrapped(
      `Tel: ${settings.phone || '999-123-4567'}`,
      layout.centerX,
      y,
      layout.contentWidth,
      layout.lineHeight,
      { align: 'center' }
    );

    y += 1.5;
    doc.line(layout.marginX, y, layout.rightX, y);

    y += 4.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(layout.subtitle);
    const headerTitle = isPreCheck
      ? `PRE-CORTE: ${data.table_name || 'Mesa'}`
      : `ORDEN: #${orderNum}`;
    y = drawWrapped(headerTitle, layout.centerX, y, layout.contentWidth, layout.subtitleLineHeight, { align: 'center' });

    y += 1;
    doc.setFont('courier', 'normal');
    doc.setFontSize(layout.body);
    y = drawWrapped(
      `Fecha: ${formatDate(sale.created_at || data.printed_at || new Date())}`,
      layout.marginX,
      y,
      layout.contentWidth,
      layout.lineHeight
    );
    y = drawWrapped(
      `Atendio: ${sale.cashier_name || data.waiter || 'Cajero'}`,
      layout.marginX,
      y,
      layout.contentWidth,
      layout.lineHeight
    );

    // Customer
    const custName = sale.customer_first_name
      ? `${sale.customer_first_name} ${sale.customer_last_name}`
      : (data.guest_name || (data.customer ? data.customer.name : 'Publico General'));
    const custPhone = sale.customer_phone || (data.customer ? data.customer.phone : '');
    const custAddress = sale.customer_address || (data.customer ? data.customer.address : '');

    y = drawWrapped(`Cliente: ${custName}`, layout.marginX, y, layout.contentWidth, layout.lineHeight);
    if (custPhone) {
      y = drawWrapped(`Tel: ${custPhone}`, layout.marginX, y, layout.contentWidth, layout.lineHeight);
    }
    if (custAddress) {
      y = drawWrapped(`Dir: ${custAddress}`, layout.marginX, y, layout.contentWidth, layout.lineHeight);
    }

    y += 1.5;
    doc.line(layout.marginX, y, layout.rightX, y);

    y += 4.5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(layout.body);
    doc.text('CANT  PRODUCTO', layout.marginX, y);
    doc.text('TOTAL', layout.rightX, y, { align: 'right' });
    doc.line(layout.marginX, y + 1.2, layout.rightX, y + 1.2);

    y += layout.lineHeight + 1.5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(layout.body);
    items.forEach(it => {
      const name = it.product_name || it.name || '';
      const portion = it.portion_type === 'half' ? ' (1/2)' : '';
      const totalStr = formatMoney(it.subtotal || (it.quantity * it.unit_price));
      const priceColWidth = Math.max(doc.getTextWidth(totalStr) + 2.5, layout.is58mm ? 16 : 19);
      const descMaxWidth = Math.max(layout.contentWidth - priceColWidth, 20);
      const itemLines = doc.splitTextToSize(`${it.quantity}x ${name}${portion}`, descMaxWidth);

      itemLines.forEach((line, idx) => {
        doc.text(line, layout.marginX, y + (idx * layout.lineHeight));
      });
      doc.text(totalStr, layout.rightX, y, { align: 'right' });
      y += (itemLines.length * layout.lineHeight) + 0.5;
    });

    y += 1;
    doc.line(layout.marginX, y, layout.rightX, y);

    y += 4.5;
    const discount = parseFloat(sale.discount) || 0;
    if (discount > 0) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(layout.body);
      y = drawWrapped(
        `Subtotal: ${formatMoney(sale.subtotal || data.total)}`,
        layout.rightX,
        y,
        layout.contentWidth,
        layout.lineHeight,
        { align: 'right' }
      );
      y = drawWrapped(
        `Descuento: -${formatMoney(discount)}`,
        layout.rightX,
        y,
        layout.contentWidth,
        layout.lineHeight,
        { align: 'right' }
      );
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(layout.subtitle);
    y = drawWrapped(
      `TOTAL: ${formatMoney(sale.total ?? data.total ?? 0)}`,
      layout.rightX,
      y,
      layout.contentWidth,
      layout.subtitleLineHeight,
      { align: 'right' }
    );

    if (!isPreCheck) {
      y += 1;
      doc.setFont('courier', 'normal');
      doc.setFontSize(layout.body);
      y = drawWrapped(
        `Metodo: ${(sale.payment_method || 'Efectivo').toUpperCase()}`,
        layout.marginX,
        y,
        layout.contentWidth,
        layout.lineHeight
      );
      y = drawWrapped(
        `Recibido: ${formatMoney(sale.amount_paid ?? sale.total ?? data.total ?? 0)}`,
        layout.marginX,
        y,
        layout.contentWidth,
        layout.lineHeight
      );
      y = drawWrapped(
        `Cambio: ${formatMoney(sale.change_due || 0)}`,
        layout.marginX,
        y,
        layout.contentWidth,
        layout.lineHeight
      );
    }

    y += 3;
    doc.line(layout.marginX, y, layout.rightX, y);
    y += 4.5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(layout.body);
    y = drawWrapped(
      settings.ticket_footer || 'Gracias por su preferencia!',
      layout.centerX,
      y,
      layout.contentWidth,
      layout.lineHeight,
      { align: 'center' }
    );

    return y + 4;
  },

  // Digital PDF Export using jsPDF
  async downloadPdf() {
    if (!this.currentTicketData) {
      showToast('No hay información de ticket para exportar', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const data = this.currentTicketData;
    const settings = data.settings || {};
    const sale = data.sale || {};
    const orderNum = sale.order_number || data.order_number || 'ORD-000';
    const layout = this.getPdfLayoutConfig(settings);
    const showLogo = settings.show_logo == 1 || settings.show_logo === true;
    const logoData = showLogo ? await this.loadLogoForPdf() : null;

    // Pass 1: measure exact required height using active paper width, font scale & logo
    const measureDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [layout.pageWidth, 200]
    });
    const requiredHeight = Math.max(Math.ceil(this.renderPdfContent(measureDoc, data, layout, logoData)), 80);

    // Pass 2: generate final PDF with exact dynamic page height
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [layout.pageWidth, requiredHeight]
    });
    this.renderPdfContent(doc, data, layout, logoData);

    doc.save(`Ticket_${orderNum}.pdf`);
    showToast(`Ticket digital descargado: Ticket_${orderNum}.pdf`, 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnPrint = document.getElementById('btn-print-ticket-physical');
  if (btnPrint) btnPrint.addEventListener('click', () => ticketPrinter.printPhysical());

  const btnPdf = document.getElementById('btn-download-ticket-pdf');
  if (btnPdf) btnPdf.addEventListener('click', () => ticketPrinter.downloadPdf());

  const btnCancelFromTicket = document.getElementById('btn-cancel-sale-from-ticket');
  if (btnCancelFromTicket) {
    btnCancelFromTicket.addEventListener('click', () => ticketPrinter.openCancelFromCurrentTicket());
  }

  const formCancelSale = document.getElementById('form-cancel-sale');
  if (formCancelSale) {
    formCancelSale.addEventListener('submit', (e) => {
      e.preventDefault();
      ticketPrinter.submitCancelSale();
    });
  }
});
