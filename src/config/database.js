require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'pos_alalena';

let poolInstance = null;

function getPool() {
  if (!poolInstance) {
    poolInstance = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      timezone: 'local',
      decimalNumbers: true
    });
  }
  return poolInstance;
}

// Ensure database exists before creating pool
async function ensureDatabaseExists() {
  try {
    const tempConn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });

    await tempConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await tempConn.end();
  } catch (err) {
    console.error('❌ Error conectando a MySQL para verificar o crear la base de datos:');
    console.error(`Host: ${DB_HOST}:${DB_PORT} | Usuario: ${DB_USER}`);
    console.error(`Mensaje: ${err.message}`);
    throw err;
  }
}

// Promisified database helpers (matching standard POS API)
const db = {
  get: async (sql, params = []) => {
    const pool = getPool();
    const [rows] = await pool.query(sql, params);
    return rows && rows.length > 0 ? rows[0] : undefined;
  },
  all: async (sql, params = []) => {
    const pool = getPool();
    const [rows] = await pool.query(sql, params);
    return rows || [];
  },
  run: async (sql, params = []) => {
    const pool = getPool();
    const [result] = await pool.query(sql, params);
    return {
      lastID: result.insertId,
      insertId: result.insertId,
      changes: result.affectedRows,
      affectedRows: result.affectedRows
    };
  },
  exec: async (sql) => {
    const pool = getPool();
    const [result] = await pool.query(sql);
    return result;
  },
  close: async () => {
    if (poolInstance) {
      await poolInstance.end();
      poolInstance = null;
    }
  },
  reopen: async () => {
    if (poolInstance) {
      await poolInstance.end();
      poolInstance = null;
    }
    return getPool();
  },
  getPool
};

async function initDatabase() {
  await ensureDatabaseExists();
  console.log(`✅ Conexión establecida con la base de datos MySQL: ${DB_NAME}@${DB_HOST}:${DB_PORT}`);

  const pool = getPool();

  // Create tables in MySQL
  await pool.query(`
    SET FOREIGN_KEY_CHECKS = 1;

    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY,
      business_name VARCHAR(255) NOT NULL DEFAULT 'A La Leña - Cocina Tradicional',
      slogan VARCHAR(255) DEFAULT 'El sabor auténtico de la leña yucateca',
      rfc VARCHAR(50) DEFAULT 'XEXX010101000',
      phone VARCHAR(50) DEFAULT '999-123-4567',
      address VARCHAR(255) DEFAULT 'Calle 60 #450 x 49 y 51, Centro, Mérida, Yucatán',
      ticket_footer TEXT,
      paper_width VARCHAR(20) DEFAULT '80mm',
      font_size VARCHAR(20) DEFAULT 'medium',
      auto_cut TINYINT(1) DEFAULT 1,
      show_logo TINYINT(1) DEFAULT 1,
      currency_symbol VARCHAR(10) DEFAULT '$',
      tax_percentage DECIMAL(5, 2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'cashier') NOT NULL DEFAULT 'cashier',
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(50) DEFAULT 'utensils',
      sort_order INT DEFAULT 0,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE,
      name VARCHAR(150) NOT NULL,
      category_id INT,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      has_half_portion TINYINT(1) DEFAULT 0,
      half_price DECIMAL(10, 2) DEFAULT 0,
      cost DECIMAL(10, 2) DEFAULT 0,
      stock DECIMAL(10, 2) DEFAULT 0,
      min_stock DECIMAL(10, 2) DEFAULT 5,
      unit VARCHAR(50) DEFAULT 'ración',
      image_url TEXT,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      phone VARCHAR(50),
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS dining_tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_number INT NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      capacity INT DEFAULT 4,
      status ENUM('free', 'occupied', 'billed') NOT NULL DEFAULT 'free',
      customer_id INT,
      guest_name VARCHAR(100),
      notes TEXT,
      opened_at DATETIME,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS dining_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_id INT NOT NULL,
      product_id INT NOT NULL,
      portion_type ENUM('full', 'half') NOT NULL DEFAULT 'full',
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(100) NOT NULL UNIQUE,
      customer_id INT,
      user_id INT,
      dining_table_id INT,
      sale_type ENUM('takeout', 'dining') NOT NULL DEFAULT 'takeout',
      subtotal DECIMAL(10, 2) NOT NULL,
      discount DECIMAL(10, 2) DEFAULT 0,
      total DECIMAL(10, 2) NOT NULL,
      payment_method ENUM('cash', 'card', 'transfer', 'mixed') NOT NULL DEFAULT 'cash',
      amount_paid DECIMAL(10, 2) DEFAULT 0,
      change_due DECIMAL(10, 2) DEFAULT 0,
      notes TEXT,
      status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (dining_table_id) REFERENCES dining_tables(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      product_id INT,
      product_name VARCHAR(150) NOT NULL,
      category_name VARCHAR(100),
      portion_type ENUM('full', 'half') NOT NULL DEFAULT 'full',
      quantity DECIMAL(10, 2) NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      type ENUM('sale', 'adjustment', 'initial', 'restock', 'cancellation') NOT NULL,
      quantity DECIMAL(10, 2) NOT NULL,
      previous_stock DECIMAL(10, 2) NOT NULL,
      new_stock DECIMAL(10, 2) NOT NULL,
      reason TEXT,
      user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Ensure default settings exist
  const existingSettings = await db.get('SELECT id FROM settings WHERE id = 1');
  if (!existingSettings) {
    await db.run(`
      INSERT INTO settings (id, business_name, slogan, rfc, phone, address, ticket_footer, paper_width)
      VALUES (1, 'A La Leña - Cocina Tradicional', 'El sabor auténtico de la leña yucateca', 'ALN230915ABC', '999-923-4567', 'Calle 60 #450 x 49 y 51, Centro, Mérida, Yucatán', '¡Gracias por su visita a A La Leña! Buen provecho.', '80mm')
    `);
  }
}

module.exports = {
  db,
  initDatabase,
  getPool
};
