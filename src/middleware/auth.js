const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'a-la-lena-secret-key-super-segura-pos-yucateco-2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Support token via query param for file downloads
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado. Se requiere inicio de sesión.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Sesión inválida o expirada. Inicie sesión nuevamente.'
      });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Este módulo o acción es exclusivo para Administradores.'
    });
  }
  next();
}

function requireCashierOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'cashier')) {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Permisos insuficientes.'
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireCashierOrAdmin,
  JWT_SECRET
};
