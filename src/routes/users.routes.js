const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require Admin permission
router.use(authenticateToken, requireAdmin);

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const users = await db.all(`
      SELECT id, name, username, role, status, created_at, updated_at
      FROM users
      ORDER BY role ASC, name ASC
    `);
    res.json({ success: true, users });
  } catch (err) {
    console.error('Error al listar usuarios:', err);
    res.status(500).json({ success: false, message: 'Error al consultar usuarios' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { name, username, password, role, status } = req.body;

    if (!name || !username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, usuario, contraseña y rol son obligatorios'
      });
    }

    if (!['admin', 'cashier'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rol no válido. Debe ser admin o cashier' });
    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    const result = await db.run(`
      INSERT INTO users (name, username, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?)
    `, [
      name.trim(),
      username.trim().toLowerCase(),
      passwordHash,
      role,
      status || 'active'
    ]);

    const newUser = await db.get(
      'SELECT id, name, username, role, status, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: newUser
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry') || err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está registrado' });
    }
    res.status(500).json({ success: false, message: 'Error al registrar usuario' });
  }
});

// PUT /api/users/:id - Update user details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, role, status, password } = req.body;

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Protect against self-deactivation if last admin
    if (user.role === 'admin' && (role !== 'admin' || status === 'inactive')) {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin" AND status = "active"');
      if (adminCount.count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No puede desactivar o cambiar el rol del único Administrador activo del sistema'
        });
      }
    }

    let passwordHash = user.password_hash;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    await db.run(`
      UPDATE users SET
        name = ?,
        username = ?,
        password_hash = ?,
        role = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name ? name.trim() : user.name,
      username ? username.trim().toLowerCase() : user.username,
      passwordHash,
      role || user.role,
      status || user.status,
      id
    ]);

    const updatedUser = await db.get('SELECT id, name, username, role, status, created_at, updated_at FROM users WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: updatedUser
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('Duplicate entry') || err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso' });
    }
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'No puede eliminar su propia cuenta en uso' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (user.role === 'admin') {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin" AND status = "active"');
      if (adminCount.count <= 1) {
        return res.status(400).json({ success: false, message: 'No se puede eliminar el único Administrador' });
      }
    }

    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
});

module.exports = router;
