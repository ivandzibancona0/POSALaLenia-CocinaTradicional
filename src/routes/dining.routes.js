const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/dining/tables - List all tables with their active accounts and totals
router.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await db.all(`
      SELECT t.*, 
        c.first_name as customer_first_name, 
        c.last_name as customer_last_name,
        c.phone as customer_phone,
        (SELECT COUNT(*) FROM dining_items di WHERE di.table_id = t.id) as items_count,
        (SELECT COALESCE(SUM(di.quantity * di.unit_price), 0) FROM dining_items di WHERE di.table_id = t.id) as current_total
      FROM dining_tables t
      LEFT JOIN customers c ON t.customer_id = c.id
      ORDER BY t.table_number ASC
    `);

    res.json({ success: true, tables });
  } catch (err) {
    console.error('Error al listar mesas:', err);
    res.status(500).json({ success: false, message: 'Error al consultar mesas' });
  }
});

// GET /api/dining/tables/:id - Get single table with its consumed items
router.get('/tables/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const table = await db.get(`
      SELECT t.*, 
        c.first_name, c.last_name, c.phone, c.address
      FROM dining_tables t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.id = ?
    `, [id]);

    if (!table) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    const items = await db.all(`
      SELECT di.*, p.name as product_name, p.code as product_code, c.name as category_name
      FROM dining_items di
      JOIN products p ON di.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE di.table_id = ?
      ORDER BY di.created_at ASC
    `, [id]);

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    res.json({
      success: true,
      table,
      items,
      total
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar detalle de mesa' });
  }
});

// POST /api/dining/tables/:id/open - Open or configure table for diner
router.post('/tables/:id/open', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_id, guest_name, notes } = req.body;

    const table = await db.get('SELECT * FROM dining_tables WHERE id = ?', [id]);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    await db.run(`
      UPDATE dining_tables SET
        status = 'occupied',
        customer_id = ?,
        guest_name = ?,
        notes = ?,
        opened_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [customer_id || null, guest_name ? guest_name.trim() : null, notes || '', id]);

    res.json({ success: true, message: `Mesa ${table.table_number} abierta correctamente` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al abrir mesa' });
  }
});

// POST /api/dining/tables/:id/items - Add item (full/half portion) to table account
router.post('/tables/:id/items', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, portion_type, quantity, notes } = req.body;

    const product = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const portion = portion_type === 'half' && product.has_half_portion ? 'half' : 'full';
    const unitPrice = portion === 'half' ? product.half_price : product.price;
    const qty = parseFloat(quantity) || 1;

    // Check if table is free, auto-occupy
    const table = await db.get('SELECT * FROM dining_tables WHERE id = ?', [id]);
    if (table && table.status === 'free') {
      await db.run('UPDATE dining_tables SET status = "occupied", opened_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }

    await db.run(`
      INSERT INTO dining_items (table_id, product_id, portion_type, quantity, unit_price, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, product_id, portion, qty, unitPrice, notes || '']);

    res.json({ success: true, message: 'Producto agregado a la cuenta de la mesa' });
  } catch (err) {
    console.error('Error al agregar item a mesa:', err);
    res.status(500).json({ success: false, message: 'Error al agregar producto a la mesa' });
  }
});

// DELETE /api/dining/items/:itemId - Remove item from table account
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    await db.run('DELETE FROM dining_items WHERE id = ?', [itemId]);
    res.json({ success: true, message: 'Producto removido de la cuenta' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
});

// GET /api/dining/tables/:id/pre-check - Generates pre-cut consumption ticket data
router.get('/tables/:id/pre-check', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const table = await db.get(`
      SELECT t.*, 
        c.first_name, c.last_name, c.phone, c.address
      FROM dining_tables t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.id = ?
    `, [id]);

    if (!table) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    const items = await db.all(`
      SELECT di.*, p.name as product_name
      FROM dining_items di
      JOIN products p ON di.product_id = p.id
      WHERE di.table_id = ?
      ORDER BY di.created_at ASC
    `, [id]);

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'La mesa no tiene consumos registrados' });
    }

    // Mark status as 'billed' (Pre-cuenta entregada)
    await db.run('UPDATE dining_tables SET status = "billed" WHERE id = ?', [id]);

    const settings = await db.get('SELECT * FROM settings WHERE id = 1');
    const total = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);

    res.json({
      success: true,
      ticket_type: 'pre_check',
      title: 'ESTADO DE CUENTA / PRE-CORTE DE COMEDOR',
      table_number: table.table_number,
      table_name: table.name,
      guest_name: table.guest_name || (table.first_name ? `${table.first_name} ${table.last_name}` : 'Comensal General'),
      customer: table.customer_id ? {
        name: `${table.first_name} ${table.last_name}`,
        phone: table.phone,
        address: table.address
      } : null,
      opened_at: table.opened_at,
      printed_at: new Date().toISOString(),
      waiter: req.user.name,
      settings,
      items,
      total
    });
  } catch (err) {
    console.error('Error al generar pre-corte:', err);
    res.status(500).json({ success: false, message: 'Error al generar ticket de pre-corte' });
  }
});

// POST /api/dining/tables - Create a new dining table
router.post('/tables', authenticateToken, async (req, res) => {
  try {
    const { table_number, name, capacity } = req.body;

    if (!table_number || !name) {
      return res.status(400).json({ success: false, message: 'Número y nombre de mesa son obligatorios' });
    }

    const num = parseInt(table_number);
    const existing = await db.get('SELECT id FROM dining_tables WHERE table_number = ?', [num]);
    if (existing) {
      return res.status(400).json({ success: false, message: `Ya existe una mesa con el número ${num}` });
    }

    const result = await db.run(`
      INSERT INTO dining_tables (table_number, name, capacity, status)
      VALUES (?, ?, ?, 'free')
    `, [num, name.trim(), parseInt(capacity) || 4]);

    const newTable = await db.get('SELECT * FROM dining_tables WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Mesa creada exitosamente', table: newTable });
  } catch (err) {
    console.error('Error al crear mesa:', err);
    res.status(500).json({ success: false, message: 'Error al registrar mesa' });
  }
});

// PUT /api/dining/tables/:id/edit - Update table details
router.put('/tables/:id/edit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { table_number, name, capacity } = req.body;

    if (!table_number || !name) {
      return res.status(400).json({ success: false, message: 'Número y nombre son obligatorios' });
    }

    const num = parseInt(table_number);
    const existing = await db.get('SELECT id FROM dining_tables WHERE table_number = ? AND id != ?', [num, id]);
    if (existing) {
      return res.status(400).json({ success: false, message: `El número de mesa ${num} ya está en uso por otra mesa` });
    }

    await db.run(`
      UPDATE dining_tables SET
        table_number = ?,
        name = ?,
        capacity = ?
      WHERE id = ?
    `, [num, name.trim(), parseInt(capacity) || 4, id]);

    const updated = await db.get('SELECT * FROM dining_tables WHERE id = ?', [id]);
    res.json({ success: true, message: 'Mesa actualizada exitosamente', table: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar mesa' });
  }
});

// DELETE /api/dining/tables/:id - Delete a table
router.delete('/tables/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const table = await db.get('SELECT * FROM dining_tables WHERE id = ?', [id]);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Mesa no encontrada' });
    }

    if (table.status !== 'free') {
      return res.status(400).json({ success: false, message: 'No se puede eliminar una mesa que tiene consumos activos o está ocupada' });
    }

    await db.run('DELETE FROM dining_tables WHERE id = ?', [id]);
    res.json({ success: true, message: 'Mesa eliminada del comedor' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar mesa' });
  }
});

module.exports = router;
