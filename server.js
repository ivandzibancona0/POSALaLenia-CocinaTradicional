const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { initDatabase } = require('./src/config/database');
const { seedInitialData } = require('./src/utils/seedData');

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const productsRoutes = require('./src/routes/products.routes');
const diningRoutes = require('./src/routes/dining.routes');
const salesRoutes = require('./src/routes/sales.routes');
const customersRoutes = require('./src/routes/customers.routes');
const usersRoutes = require('./src/routes/users.routes');
const backupRoutes = require('./src/routes/backup.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allows inline scripts/styles for dynamic POS and CDN fonts
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
// Fallback for logo
app.get('/logo-a-la-leña.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo-a-la-leña.jpg'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', productsRoutes);
app.use('/api/dining', diningRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', backupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'POS - A La Leña',
    time: new Date().toISOString()
  });
});

// SPA Fallback: send index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  } else {
    res.status(404).json({ success: false, message: 'Endpoint no encontrado' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Ocurrió un error inesperado en el servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
async function start() {
  try {
    console.log('🚀 Inicializando Sistema POS "A La Leña"...');
    await initDatabase();
    await seedInitialData();
    
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🔥 Sistema POS "A La Leña" listo y escuchando en:`);
      console.log(`👉 http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (error) {
    console.error('Error fatal al iniciar servidor:', error);
    process.exit(1);
  }
}

start();
