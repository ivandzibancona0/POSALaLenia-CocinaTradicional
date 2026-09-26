const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

function getLocalDateComponents(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    dateIso: `${year}-${month}-${day}`,
    dateCompact: `${year}${month}${day}`
  };
}

// Helper to generate formatted Order Number: ORD-YYYYMMDD-XXXX
async function generateOrderNumber() {
  const { dateCompact } = getLocalDateComponents(new Date());
  const prefix = `ORD-${dateCompact}-`;

  // Find the latest order with today's prefix
  const lastOrder = await db.get(
    'SELECT order_number FROM sales WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (lastOrder && lastOrder.order_number) {
    const parts = lastOrder.order_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  // Ensure no collisions can ever occur
  let orderNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  while (await db.get('SELECT id FROM sales WHERE order_number = ?', [orderNumber])) {
    nextSeq++;
    orderNumber = `${prefix}${nextSeq.toString().padStart(4, '0')}`;
  }

  return orderNumber;
}

// Serialization mutex to eliminate race conditions when generating order numbers and checking out
let saleProcessingLock = Promise.resolve();

function acquireSaleLock() {
  let release;
  const nextLock = new Promise(resolve => {
    release = resolve;
  });
  const currentLock = saleProcessingLock;
  saleProcessingLock = saleProcessingLock.then(() => nextLock);
  return currentLock.then(() => release);
}

// POST /api/sales - Register a new sale / checkout
router.post('/', authenticateToken, async (req, res) => {
  const releaseLock = await acquireSaleLock();
  try {
    const {
      customer_id,
      dining_table_id,
      sale_type, // 'takeout' | 'dining'
      items, // array of { product_id, portion_type: 'full'|'half', quantity, unit_price, product_name, category_name }
      discount,
      payment_method, // 'cash' | 'card' | 'transfer' | 'mixed'
      amount_paid,
      notes
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'El carrito de compras no tiene productos' });
    }

    const orderNumber = await generateOrderNumber();
    const parsedDiscount = parseFloat(discount) || 0;

    let subtotal = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unit_price) || 0;
      subtotal += qty * price;
    }

    const total = Math.max(0, subtotal - parsedDiscount);
    const parsedPaid = parseFloat(amount_paid) || total;
    const changeDue = Math.max(0, parsedPaid - total);

    // Insert Sale record
    const saleResult = await db.run(`
      INSERT INTO sales (
        order_number, customer_id, user_id, dining_table_id, sale_type,
        subtotal, discount, total, payment_method, amount_paid, change_due, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `, [
      orderNumber,
      customer_id || null,
      req.user.id,
      dining_table_id || null,
      sale_type || (dining_table_id ? 'dining' : 'takeout'),
      subtotal,
      parsedDiscount,
      total,
      payment_method || 'cash',
      parsedPaid,
      changeDue,
      notes || ''
    ]);

    const saleId = saleResult.lastID;

    // Process each item & update fractional stock
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unit_price) || 0;
      const itemSubtotal = qty * price;
      const portion = item.portion_type === 'half' ? 'half' : 'full';

      // Insert into sale_items
      await db.run(`
        INSERT INTO sale_items (
          sale_id, product_id, product_name, category_name, portion_type, quantity, unit_price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        saleId,
        item.product_id || null,
        item.product_name,
        item.category_name || '',
        portion,
        qty,
        price,
        itemSubtotal
      ]);

      // Deduct stock if product exists (full portion = 1.0, half portion = 0.5)
      if (item.product_id) {
        const prod = await db.get('SELECT id, stock, unit FROM products WHERE id = ?', [item.product_id]);
        if (prod) {
          const stockFactor = portion === 'half' ? 0.5 : 1.0;
          const stockDeduction = qty * stockFactor;
          const prevStock = parseFloat(prod.stock) || 0;
          const newStock = Math.max(0, prevStock - stockDeduction);

          await db.run('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, item.product_id]);

          await db.run(`
            INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id)
            VALUES (?, 'sale', ?, ?, ?, ?, ?)
          `, [
            item.product_id,
            stockDeduction,
            prevStock,
            newStock,
            `Venta #${orderNumber} (${qty} x ${portion === 'half' ? 'Media ración' : 'Ración completa'})`,
            req.user.id
          ]);
        }
      }
    }

    // If this sale was from a Dining Table, reset the table
    if (dining_table_id) {
      await db.run('DELETE FROM dining_items WHERE table_id = ?', [dining_table_id]);
      await db.run(`
        UPDATE dining_tables SET
          status = 'free',
          customer_id = NULL,
          guest_name = NULL,
          notes = NULL,
          opened_at = NULL
        WHERE id = ?
      `, [dining_table_id]);
    }

    // Fetch complete sale and customer for ticket printing
    const saleData = await db.get(`
      SELECT s.*, 
        u.name as cashier_name,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `, [saleId]);

    const saleItems = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    const settings = await db.get('SELECT * FROM settings WHERE id = 1');

    res.status(201).json({
      success: true,
      message: `Venta registrada con éxito. Orden #${orderNumber}`,
      sale: saleData,
      items: saleItems,
      settings,
      order_number: orderNumber
    });
  } catch (err) {
    console.error('Error al registrar venta:', err);

    // If duplicate entry occurred due to simultaneous client submissions, return the already created sale
    if (err.code === 'ER_DUP_ENTRY' || (err.message && err.message.includes('Duplicate entry'))) {
      try {
        const lastSale = await db.get(
          'SELECT * FROM sales WHERE user_id = ? ORDER BY id DESC LIMIT 1',
          [req.user.id]
        );
        if (lastSale) {
          const items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [lastSale.id]);
          const settings = await db.get('SELECT * FROM settings WHERE id = 1');
          return res.status(200).json({
            success: true,
            message: `Venta registrada con éxito. Orden #${lastSale.order_number}`,
            sale: lastSale,
            items,
            settings,
            order_number: lastSale.order_number
          });
        }
      } catch (recoveryErr) {
        console.error('Error al recuperar venta existente:', recoveryErr);
      }
    }

    res.status(500).json({ success: false, message: 'Error al procesar la venta: ' + err.message });
  } finally {
    releaseLock();
  }
});

// GET /api/sales/:id - Get sale details and ticket data
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const sale = await db.get(`
      SELECT s.*, 
        u.name as cashier_name,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ? OR s.order_number = ?
    `, [req.params.id, req.params.id]);

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }

    const items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    const settings = await db.get('SELECT * FROM settings WHERE id = 1');

    res.json({
      success: true,
      sale,
      items,
      settings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar venta' });
  }
});

// ==========================================
// REPORTS ROUTES
// ==========================================

// Helper date range parser
function parseDateRange(query) {
  const { dateIso } = getLocalDateComponents(new Date());
  let startDate = query.startDate || dateIso;
  let endDate = query.endDate || dateIso;

  // Add full day time bounds
  const startBound = `${startDate} 00:00:00`;
  const endBound = `${endDate} 23:59:59`;

  return { startDate, endDate, startBound, endBound };
}

// GET /api/sales/report/summary - Dashboard KPI metrics
router.get('/report/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startBound, endBound } = parseDateRange(req.query);

    const totals = await db.get(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(AVG(total), 0) as average_ticket,
        COALESCE(SUM(discount), 0) as total_discounts
      FROM sales
      WHERE created_at BETWEEN ? AND ? AND status = 'completed'
    `, [startBound, endBound]);

    const paymentMethods = await db.all(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE created_at BETWEEN ? AND ? AND status = 'completed'
      GROUP BY payment_method
    `, [startBound, endBound]);

    const salesByType = await db.all(`
      SELECT sale_type, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales
      WHERE created_at BETWEEN ? AND ? AND status = 'completed'
      GROUP BY sale_type
    `, [startBound, endBound]);

    const topProducts = await db.all(`
      SELECT 
        si.product_name, 
        si.category_name,
        SUM(si.quantity) as total_qty,
        SUM(si.subtotal) as total_amount
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at BETWEEN ? AND ? AND s.status = 'completed'
      GROUP BY si.product_name, si.category_name
      ORDER BY total_amount DESC
      LIMIT 5
    `, [startBound, endBound]);

    res.json({
      success: true,
      summary: {
        total_orders: totals.total_orders || 0,
        total_sales: totals.total_sales || 0,
        average_ticket: totals.average_ticket || 0,
        total_discounts: totals.total_discounts || 0,
        payment_methods: paymentMethods,
        sales_by_type: salesByType,
        top_products: topProducts
      }
    });
  } catch (err) {
    console.error('Error al generar resumen de ventas:', err);
    res.status(500).json({ success: false, message: 'Error al generar resumen de reporte' });
  }
});

// GET /api/sales/report/general - Report 1: Sales list
router.get('/report/general', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startBound, endBound } = parseDateRange(req.query);

    const sales = await db.all(`
      SELECT 
        s.id,
        s.order_number,
        s.created_at,
        s.sale_type,
        s.payment_method,
        s.subtotal,
        s.discount,
        s.total,
        s.notes,
        u.name as cashier_name,
        CASE 
          WHEN s.customer_id IS NOT NULL THEN CONCAT(c.first_name, ' ', c.last_name)
          ELSE 'Público General'
        END as customer_name,
        c.phone as customer_phone,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at BETWEEN ? AND ? AND s.status = 'completed'
      ORDER BY s.created_at DESC
    `, [startBound, endBound]);

    res.json({ success: true, sales });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al generar reporte de ventas' });
  }
});

// GET /api/sales/report/detailed-products - Report 2: Detailed Sales by Product WITH ORDER NUMBER
router.get('/report/detailed-products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startBound, endBound } = parseDateRange(req.query);

    const detailedItems = await db.all(`
      SELECT 
        s.order_number,
        s.created_at,
        s.payment_method,
        s.sale_type,
        CASE 
          WHEN s.customer_id IS NOT NULL THEN CONCAT(c.first_name, ' ', c.last_name)
          ELSE 'Público General'
        END as customer_name,
        u.name as cashier_name,
        si.product_name,
        si.category_name,
        si.portion_type,
        si.quantity,
        si.unit_price,
        si.subtotal
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at BETWEEN ? AND ? AND s.status = 'completed'
      ORDER BY s.created_at DESC, si.id ASC
    `, [startBound, endBound]);

    res.json({ success: true, items: detailedItems });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al generar reporte detallado por producto' });
  }
});

// GET /api/sales/report/csv/general - Download Report 1 as CSV
router.get('/report/csv/general', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, startBound, endBound } = parseDateRange(req.query);

    const sales = await db.all(`
      SELECT 
        s.order_number,
        s.created_at,
        CASE WHEN s.sale_type = 'dining' THEN 'Comedor' ELSE 'Para Llevar / Mostrador' END as tipo_venta,
        CASE 
          WHEN s.customer_id IS NOT NULL THEN CONCAT(c.first_name, ' ', c.last_name)
          ELSE 'Público General'
        END as cliente,
        COALESCE(c.phone, 'N/A') as telefono,
        s.payment_method as metodo_pago,
        s.subtotal,
        s.discount as descuento,
        s.total,
        u.name as cajero,
        s.notes as comentarios
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at BETWEEN ? AND ? AND s.status = 'completed'
      ORDER BY s.created_at DESC
    `, [startBound, endBound]);

    // CSV Headers
    const headers = [
      'No. Orden',
      'Fecha y Hora',
      'Tipo de Venta',
      'Cliente',
      'Teléfono',
      'Método de Pago',
      'Subtotal ($)',
      'Descuento ($)',
      'Total ($)',
      'Cajero',
      'Comentarios'
    ];

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(',') + '\r\n';

    sales.forEach(s => {
      const row = [
        `"${s.order_number}"`,
        `"${s.created_at}"`,
        `"${s.tipo_venta}"`,
        `"${(s.cliente || '').replace(/"/g, '""')}"`,
        `"${s.telefono}"`,
        `"${s.metodo_pago}"`,
        s.subtotal.toFixed(2),
        s.descuento.toFixed(2),
        s.total.toFixed(2),
        `"${(s.cajero || '').replace(/"/g, '""')}"`,
        `"${(s.comentarios || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Ventas_${startDate}_a_${endDate}.csv`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error al exportar CSV ventas:', err);
    res.status(500).send('Error al exportar reporte');
  }
});

// GET /api/sales/report/csv/detailed-products - Download Report 2 as CSV WITH ORDER NUMBER
router.get('/report/csv/detailed-products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, startBound, endBound } = parseDateRange(req.query);

    const items = await db.all(`
      SELECT 
        s.order_number,
        s.created_at,
        si.product_name,
        si.category_name,
        CASE WHEN si.portion_type = 'half' THEN 'Media Ración' ELSE 'Ración Completa' END as tipo_porcion,
        si.quantity,
        si.unit_price,
        si.subtotal,
        s.payment_method,
        CASE 
          WHEN s.customer_id IS NOT NULL THEN CONCAT(c.first_name, ' ', c.last_name)
          ELSE 'Público General'
        END as cliente,
        u.name as cajero
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at BETWEEN ? AND ? AND s.status = 'completed'
      ORDER BY s.created_at DESC, si.id ASC
    `, [startBound, endBound]);

    const headers = [
      'No. Orden',
      'Fecha y Hora',
      'Producto / Platillo',
      'Categoría',
      'Tipo de Ración',
      'Cantidad',
      'Precio Unitario ($)',
      'Subtotal ($)',
      'Método de Pago',
      'Cliente',
      'Cajero'
    ];

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += headers.join(',') + '\r\n';

    items.forEach(it => {
      const row = [
        `"${it.order_number}"`,
        `"${it.created_at}"`,
        `"${(it.product_name || '').replace(/"/g, '""')}"`,
        `"${(it.category_name || '').replace(/"/g, '""')}"`,
        `"${it.tipo_porcion}"`,
        it.quantity,
        it.unit_price.toFixed(2),
        it.subtotal.toFixed(2),
        `"${it.payment_method}"`,
        `"${(it.cliente || '').replace(/"/g, '""')}"`,
        `"${(it.cajero || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Detallado_Productos_${startDate}_a_${endDate}.csv`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error al exportar CSV productos:', err);
    res.status(500).send('Error al exportar reporte detallado');
  }
});

module.exports = router;
