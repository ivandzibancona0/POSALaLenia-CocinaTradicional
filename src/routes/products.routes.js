const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// ==========================================
// CATEGORIES ROUTES
// ==========================================

// GET /api/categories - List all categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categories = await db.all(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
      WHERE c.active = 1
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);
    res.json({ success: true, categories });
  } catch (err) {
    console.error('Error al obtener categorías:', err);
    res.status(500).json({ success: false, message: 'Error al consultar categorías' });
  }
});

// POST /api/categories - Create category (Admin only)
router.post('/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, icon, sort_order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio' });
    }

    const result = await db.run(
      'INSERT INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)',
      [name.trim(), description || '', icon || 'utensils', sort_order || 0]
    );

    const newCategory = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Categoría creada exitosamente', category: newCategory });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry') || err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'Ya existe una categoría con ese nombre' });
    }
    res.status(500).json({ success: false, message: 'Error al crear categoría' });
  }
});

// PUT /api/categories/:id - Update category (Admin only)
router.put('/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, sort_order, active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio' });
    }

    await db.run(
      'UPDATE categories SET name = ?, description = ?, icon = ?, sort_order = ?, active = ? WHERE id = ?',
      [name.trim(), description || '', icon || 'utensils', sort_order || 0, active !== undefined ? active : 1, id]
    );

    const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Categoría actualizada exitosamente', category: updatedCategory });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar categoría' });
  }
});

// DELETE /api/categories/:id - Delete/Deactivate category (Admin only)
router.delete('/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Check if products exist
    const prodCount = await db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ? AND active = 1', [id]);
    if (prodCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar la categoría porque contiene ${prodCount.count} productos activos. Reasígnelos primero.`
      });
    }

    await db.run('UPDATE categories SET active = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Categoría eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar categoría' });
  }
});

// ==========================================
// PRODUCTS ROUTES
// ==========================================

// GET /api/products - List products with infinite scroll pagination, search, category filter
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';
    const categoryId = req.query.category_id || '';
    const lowStockOnly = req.query.low_stock === 'true';

    let whereClause = 'WHERE p.active = 1';
    const params = [];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (categoryId) {
      whereClause += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    if (lowStockOnly) {
      whereClause += ' AND p.stock <= p.min_stock';
    }

    // Count total matching items
    const countSql = `
      SELECT COUNT(*) as total 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ${whereClause}
    `;
    const countRow = await db.get(countSql, params);
    const total = countRow.total;

    // Fetch page items
    const querySql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY c.sort_order ASC, p.name ASC
      LIMIT ? OFFSET ?
    `;
    const queryParams = [...params, limit, offset];
    const products = await db.all(querySql, queryParams);

    const hasMore = offset + products.length < total;

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore
      }
    });
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ success: false, message: 'Error al consultar catálogo de productos' });
  }
});

// GET /api/products/all-active - Return full active catalog for POS caching/fast search
router.get('/products/all-active', authenticateToken, async (req, res) => {
  try {
    const products = await db.all(`
      SELECT p.*, c.name as category_name, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
      ORDER BY c.sort_order ASC, p.name ASC
    `);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar productos' });
  }
});

// GET /api/products/:id - Get single product details
router.get('/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await db.get(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `, [req.params.id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar producto' });
  }
});

// POST /api/products - Create product (Admin only)
router.post('/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      code,
      name,
      category_id,
      description,
      price,
      has_half_portion,
      half_price,
      cost,
      stock,
      min_stock,
      unit,
      image_url
    } = req.body;

    if (!name || !name.trim() || price === undefined || price === null) {
      return res.status(400).json({ success: false, message: 'Nombre y precio de venta son campos requeridos' });
    }

    // Auto-generate code if empty
    const productCode = code && code.trim() ? code.trim() : `PROD-${Date.now().toString().slice(-5)}`;

    const result = await db.run(`
      INSERT INTO products (
        code, name, category_id, description, price, 
        has_half_portion, half_price, cost, stock, min_stock, unit, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      productCode,
      name.trim(),
      category_id || null,
      description || '',
      parseFloat(price) || 0,
      has_half_portion ? 1 : 0,
      has_half_portion ? (parseFloat(half_price) || 0) : 0,
      parseFloat(cost) || 0,
      parseFloat(stock) || 0,
      parseFloat(min_stock) || 5,
      unit || 'ración',
      image_url || ''
    ]);

    // Record initial stock movement
    if (parseFloat(stock) > 0) {
      await db.run(`
        INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id)
        VALUES (?, 'initial', ?, 0, ?, 'Inventario inicial al dar de alta producto', ?)
      `, [result.lastID, parseFloat(stock), parseFloat(stock), req.user.id]);
    }

    const createdProduct = await db.get('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [result.lastID]);
    res.status(201).json({ success: true, message: 'Producto registrado exitosamente', product: createdProduct });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry') || err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'El código de producto ya está en uso' });
    }
    console.error('Error al registrar producto:', err);
    res.status(500).json({ success: false, message: 'Error al registrar el producto' });
  }
});

// PUT /api/products/:id - Update product (Admin only)
router.put('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      category_id,
      description,
      price,
      has_half_portion,
      half_price,
      cost,
      min_stock,
      unit,
      image_url,
      active
    } = req.body;

    if (!name || !name.trim() || price === undefined) {
      return res.status(400).json({ success: false, message: 'Nombre y precio son obligatorios' });
    }

    await db.run(`
      UPDATE products SET
        code = ?,
        name = ?,
        category_id = ?,
        description = ?,
        price = ?,
        has_half_portion = ?,
        half_price = ?,
        cost = ?,
        min_stock = ?,
        unit = ?,
        image_url = ?,
        active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      code || `PROD-${id}`,
      name.trim(),
      category_id || null,
      description || '',
      parseFloat(price) || 0,
      has_half_portion ? 1 : 0,
      has_half_portion ? (parseFloat(half_price) || 0) : 0,
      parseFloat(cost) || 0,
      parseFloat(min_stock) || 5,
      unit || 'ración',
      image_url || '',
      active !== undefined ? active : 1,
      id
    ]);

    const updatedProduct = await db.get('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [id]);
    res.json({ success: true, message: 'Producto actualizado exitosamente', product: updatedProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar producto: ' + err.message });
  }
});

// POST /api/products/:id/adjust-stock - Quick stock increment/decrement
router.post('/products/:id/adjust-stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body; // adjustment can be positive or negative e.g. +5, -1, +0.5

    const delta = parseFloat(adjustment);
    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'Cantidad de ajuste no válida' });
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    }

    const previousStock = parseFloat(product.stock) || 0;
    const newStock = Math.max(0, previousStock + delta);

    await db.run('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, id]);

    await db.run(`
      INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      delta > 0 ? 'restock' : 'adjustment',
      Math.abs(delta),
      previousStock,
      newStock,
      reason || (delta > 0 ? 'Reabastecimiento rápido de cocina' : 'Merma / Ajuste manual'),
      req.user.id
    ]);

    res.json({
      success: true,
      message: `Stock actualizado a ${newStock} ${product.unit}(es)`,
      previousStock,
      newStock,
      product_id: id
    });
  } catch (err) {
    console.error('Error al ajustar stock:', err);
    res.status(500).json({ success: false, message: 'Error al modificar stock' });
  }
});

// DELETE /api/products/:id - Delete product (Admin only)
router.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    res.json({ success: true, message: 'Producto eliminado del catálogo' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar producto' });
  }
});

module.exports = router;
