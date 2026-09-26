const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { generateSqlDump, restoreFromSql, resetDatabaseToFactory } = require('../utils/backupManager');

// Multer storage for uploaded backup files
const uploadDir = path.join(__dirname, '../../data/temp_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'backup-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// GET /api/settings - Get business info and POS printer settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await db.get('SELECT * FROM settings WHERE id = 1');
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error al obtener configuraciones:', err);
    res.status(500).json({ success: false, message: 'Error al consultar configuraciones' });
  }
});

// PUT /api/settings - Update business info and printer settings (Admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      business_name,
      slogan,
      rfc,
      phone,
      address,
      ticket_footer,
      paper_width,
      font_size,
      auto_cut,
      show_logo,
      tax_percentage
    } = req.body;

    await db.run(`
      UPDATE settings SET
        business_name = ?,
        slogan = ?,
        rfc = ?,
        phone = ?,
        address = ?,
        ticket_footer = ?,
        paper_width = ?,
        font_size = ?,
        auto_cut = ?,
        show_logo = ?,
        tax_percentage = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `, [
      business_name || 'A La Leña - Cocina Tradicional',
      slogan || '',
      rfc || '',
      phone || '',
      address || '',
      ticket_footer || '',
      paper_width || '80mm',
      font_size || 'medium',
      auto_cut ? 1 : 0,
      show_logo ? 1 : 0,
      parseFloat(tax_percentage) || 0
    ]);

    const updated = await db.get('SELECT * FROM settings WHERE id = 1');
    res.json({ success: true, message: 'Configuraciones actualizadas correctamente', settings: updated });
  } catch (err) {
    console.error('Error al actualizar configuraciones:', err);
    res.status(500).json({ success: false, message: 'Error al guardar configuraciones' });
  }
});

// GET /api/settings/backup/sql - Download SQL dump
router.get('/backup/sql', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dump = await generateSqlDump();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Respaldo_ALaLena_${dateStr}.sql`;

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(dump);
  } catch (err) {
    console.error('Error generando respaldo SQL:', err);
    res.status(500).json({ success: false, message: 'Error al generar respaldo SQL' });
  }
});

// GET /api/settings/backup/db - Deprecated SQLite endpoint
router.get('/backup/db', authenticateToken, requireAdmin, (req, res) => {
  res.status(400).json({
    success: false,
    message: 'El sistema ahora utiliza MySQL. Utilice la opción de respaldo en formato .SQL.'
  });
});

// POST /api/settings/restore/sql - Restore database from uploaded .sql file
router.post('/restore/sql', authenticateToken, requireAdmin, upload.single('sqlFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo .sql' });
    }

    const sqlContent = fs.readFileSync(req.file.path, 'utf8');
    const result = await restoreFromSql(sqlContent);

    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json(result);
  } catch (err) {
    console.error('Error restaurando SQL:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ success: false, message: err.message });
  }
});
// POST /api/settings/restore/db - Deprecated SQLite endpoint
router.post('/restore/db', authenticateToken, requireAdmin, (req, res) => {
  res.status(400).json({
    success: false,
    message: 'El sistema ahora utiliza MySQL. Utilice la opción de restauración en formato .SQL.'
  });
});

// POST /api/settings/reset-database - Factory reset / wipe database and start from scratch
router.post('/reset-database', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { confirmText, mode = 'clean' } = req.body;

    if (!confirmText || (confirmText.trim().toUpperCase() !== 'REINICIAR' && confirmText.trim().toUpperCase() !== 'ELIMINAR')) {
      return res.status(400).json({
        success: false,
        message: 'Confirmación inválida. Debe escribir la palabra "REINICIAR" para proceder con esta acción destructiva.'
      });
    }

    const result = await resetDatabaseToFactory({ mode: mode === 'demo' ? 'demo' : 'clean' });
    res.json(result);
  } catch (err) {
    console.error('Error al reiniciar base de datos:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
