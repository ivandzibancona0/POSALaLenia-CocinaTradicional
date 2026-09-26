const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/customers - Infinite scroll & search list
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    let whereClause = '';
    const params = [];

    if (search) {
      whereClause = 'WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR address LIKE ?';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countRow = await db.get(`SELECT COUNT(*) as total FROM customers ${whereClause}`, params);
    const total = countRow.total;

    const customers = await db.all(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id AND s.status = 'completed') as total_orders,
        (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.customer_id = c.id AND s.status = 'completed') as total_spent
      FROM customers c
      ${whereClause}
      ORDER BY c.first_name ASC, c.last_name ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + customers.length < total
      }
    });
  } catch (err) {
    console.error('Error al listar clientes:', err);
    res.status(500).json({ success: false, message: 'Error al consultar clientes' });
  }
});

// GET /api/customers/search - Fast autocomplete for Cashier search bar
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q) {
      const defaultList = await db.all('SELECT id, first_name, last_name, phone, address FROM customers ORDER BY first_name ASC LIMIT 10');
      return res.json({ success: true, customers: defaultList });
    }

    const customers = await db.all(`
      SELECT id, first_name, last_name, phone, address 
      FROM customers 
      WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?
      ORDER BY first_name ASC
      LIMIT 15
    `, [`%${q}%`, `%${q}%`, `%${q}%`]);

    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al buscar clientes' });
  }
});

// GET /api/customers/:id - Single customer info
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }
    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar cliente' });
  }
});

// GET /api/customers/:id/history - Full purchase history with item breakdown for modal
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const offset = (page - 1) * limit;

    const customer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const countRow = await db.get('SELECT COUNT(*) as total FROM sales WHERE customer_id = ?', [id]);
    const totalOrders = countRow ? countRow.total : 0;

    const sales = await db.all(`
      SELECT s.*, u.name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.customer_id = ?
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, limit, offset]);

    // Attach items for each sale
    for (const sale of sales) {
      const items = await db.all(`
        SELECT si.* 
        FROM sale_items si 
        WHERE si.sale_id = ?
      `, [sale.id]);
      sale.items = items;
    }

    const stats = await db.get(`
      SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as total_spent,
        COALESCE(AVG(total), 0) as average_ticket
      FROM sales
      WHERE customer_id = ? AND status = 'completed'
    `, [id]);

    const hasMore = (offset + sales.length) < totalOrders;

    res.json({
      success: true,
      customer,
      stats,
      sales,
      pagination: {
        page,
        limit,
        total: totalOrders,
        hasMore
      }
    });
  } catch (err) {
    console.error('Error al obtener historial del cliente:', err);
    res.status(500).json({ success: false, message: 'Error al consultar historial del cliente' });
  }
});

// POST /api/customers - Create new customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, address, notes } = req.body;

    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y Apellido son campos requeridos'
      });
    }

    const result = await db.run(`
      INSERT INTO customers (first_name, last_name, phone, address, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      first_name.trim(),
      last_name.trim(),
      phone ? phone.trim() : '',
      address ? address.trim() : '',
      notes ? notes.trim() : ''
    ]);

    const newCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [result.lastID]);
    res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente',
      customer: newCustomer
    });
  } catch (err) {
    console.error('Error al crear cliente:', err);
    res.status(500).json({ success: false, message: 'Error al registrar cliente' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, address, notes } = req.body;

    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y Apellido son obligatorios'
      });
    }

    await db.run(`
      UPDATE customers SET
        first_name = ?,
        last_name = ?,
        phone = ?,
        address = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      first_name.trim(),
      last_name.trim(),
      phone ? phone.trim() : '',
      address ? address.trim() : '',
      notes ? notes.trim() : '',
      id
    ]);

    const updatedCustomer = await db.get('SELECT * FROM customers WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      customer: updatedCustomer
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar cliente' });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar cliente' });
  }
});

module.exports = router;
