// Ticket Printer Module - Generates Physical POS Thermal Format & Digital PDF for A La Leña

const ticketPrinter = {
  currentTicketData: null,

  // Render HTML Ticket for Preview and Printing
  renderTicketHtml(data) {
    this.currentTicketData = data;
    const settings = data.settings || {};
    const sale = data.sale || {};
    const items = data.items || [];
    const paperWidth = settings.paper_width || '80mm';

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
      <div class="pos-ticket paper-${paperWidth}">
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

  // Open Preview Modal
  showTicketModal(ticketData) {
    this.renderTicketHtml(ticketData);
    const titleEl = document.getElementById('ticket-modal-title');
    if (titleEl) {
      titleEl.textContent = ticketData.ticket_type === 'pre_check' 
        ? 'Pre-corte de Comedor / Cuenta de Mesa' 
        : `Ticket de Venta #${ticketData.sale ? ticketData.sale.order_number : ticketData.order_number}`;
    }
    openModal('modal-ticket-preview');
  },

  // Physical POS Print
  printPhysical() {
    window.print();
  },

  // Digital PDF Export using jsPDF
  downloadPdf() {
    if (!this.currentTicketData) {
      showToast('No hay información de ticket para exportar', 'warning');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200] // 80mm thermal roll format in PDF
    });

    const data = this.currentTicketData;
    const settings = data.settings || {};
    const sale = data.sale || {};
    const items = data.items || [];
    const orderNum = sale.order_number || data.order_number || 'ORD-000';

    let y = 10;
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.text(settings.business_name || 'A LA LEÑA', 40, y, { align: 'center' });

    y += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(settings.slogan || 'Cocina Tradicional Yucateca', 40, y, { align: 'center' });

    y += 4;
    doc.text(`RFC: ${settings.rfc || 'XEXX010101000'}`, 40, y, { align: 'center' });
    y += 4;
    doc.text(`Tel: ${settings.phone || '999-123-4567'}`, 40, y, { align: 'center' });

    y += 5;
    doc.line(5, y, 75, y);

    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(`ORDEN: #${orderNum}`, 40, y, { align: 'center' });

    y += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Fecha: ${formatDate(sale.created_at || new Date())}`, 5, y);
    y += 4;
    doc.text(`Atendio: ${sale.cashier_name || 'Cajero'}`, 5, y);

    // Customer
    const custName = sale.customer_first_name ? `${sale.customer_first_name} ${sale.customer_last_name}` : 'Publico General';
    y += 4;
    doc.text(`Cliente: ${custName}`, 5, y);
    if (sale.customer_phone) {
      y += 4;
      doc.text(`Tel: ${sale.customer_phone}`, 5, y);
    }
    if (sale.customer_address) {
      y += 4;
      doc.text(`Dir: ${sale.customer_address.slice(0, 32)}`, 5, y);
    }

    y += 5;
    doc.line(5, y, 75, y);

    y += 5;
    doc.setFont('courier', 'bold');
    doc.text('CANT  PRODUCTO             TOTAL', 5, y);
    doc.line(5, y + 1, 75, y + 1);

    y += 5;
    doc.setFont('courier', 'normal');
    items.forEach(it => {
      const name = (it.product_name || it.name || '').slice(0, 18);
      const portion = it.portion_type === 'half' ? '(1/2)' : '';
      const total = formatMoney(it.subtotal || (it.quantity * it.unit_price));
      doc.text(`${it.quantity}x  ${name} ${portion}`, 5, y);
      doc.text(total, 75, y, { align: 'right' });
      y += 4;
    });

    y += 2;
    doc.line(5, y, 75, y);

    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text(`TOTAL: ${formatMoney(sale.total || data.total)}`, 75, y, { align: 'right' });

    y += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text(`Metodo: ${(sale.payment_method || 'Efectivo').toUpperCase()}`, 5, y);
    y += 4;
    doc.text(`Recibido: ${formatMoney(sale.amount_paid || sale.total)}`, 5, y);
    y += 4;
    doc.text(`Cambio: ${formatMoney(sale.change_due || 0)}`, 5, y);

    y += 7;
    doc.line(5, y, 75, y);
    y += 5;
    doc.text(settings.ticket_footer || 'Gracias por su preferencia!', 40, y, { align: 'center' });

    doc.save(`Ticket_${orderNum}.pdf`);
    showToast(`Ticket digital descargado: Ticket_${orderNum}.pdf`, 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnPrint = document.getElementById('btn-print-ticket-physical');
  if (btnPrint) btnPrint.addEventListener('click', () => ticketPrinter.printPhysical());

  const btnPdf = document.getElementById('btn-download-ticket-pdf');
  if (btnPdf) btnPdf.addEventListener('click', () => ticketPrinter.downloadPdf());
});
