const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

const TABLES = [
  'settings',
  'users',
  'categories',
  'products',
  'customers',
  'dining_tables',
  'dining_items',
  'sales',
  'sale_items',
  'stock_movements'
];

// Generate a full MySQL SQL dump representation of the database
async function generateSqlDump() {
  let sqlDump = `-- ========================================================\n`;
  sqlDump += `-- RESPALDO BASE DE DATOS: A LA LEÑA - SISTEMA POS (MySQL)\n`;
  sqlDump += `-- Generado: ${new Date().toISOString()}\n`;
  sqlDump += `-- ========================================================\n\n`;
  sqlDump += `SET FOREIGN_KEY_CHECKS = 0;\nSTART TRANSACTION;\n\n`;

  for (const table of TABLES) {
    try {
      const rows = await db.all(`SELECT * FROM \`${table}\``);
      if (rows && rows.length > 0) {
        sqlDump += `-- Registros de la tabla: ${table} (${rows.length} registros)\n`;
        const columns = Object.keys(rows[0]);
        const escapedColumns = columns.map(col => `\`${col}\``).join(', ');

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
            // Escape single quotes and backslashes for MySQL
            const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `'${escaped}'`;
          });
          sqlDump += `INSERT INTO \`${table}\` (${escapedColumns}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += `\n`;
      }
    } catch (err) {
      console.error(`Error al respaldar tabla ${table}:`, err.message);
    }
  }

  sqlDump += `COMMIT;\nSET FOREIGN_KEY_CHECKS = 1;\n`;
  return sqlDump;
}

// Restore database from SQL text content
async function restoreFromSql(sqlContent) {
  try {
    // Clear current tables before restoring
    await db.exec(`
      SET FOREIGN_KEY_CHECKS = 0;
      DELETE FROM stock_movements;
      DELETE FROM sale_items;
      DELETE FROM sales;
      DELETE FROM dining_items;
      DELETE FROM dining_tables;
      DELETE FROM customers;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM users;
      DELETE FROM settings;
      SET FOREIGN_KEY_CHECKS = 1;
    `);

    // Execute the SQL dump script with foreign keys temporarily disabled
    await db.exec(`
      SET FOREIGN_KEY_CHECKS = 0;
      ${sqlContent}
      SET FOREIGN_KEY_CHECKS = 1;
    `);

    return { success: true, message: 'Base de datos MySQL restaurada correctamente desde archivo .SQL' };
  } catch (err) {
    console.error('Error restaurando SQL:', err);
    throw new Error('Error al procesar el archivo SQL: ' + err.message);
  }
}

// Reset database completely to clean state or initial demo state
async function resetDatabaseToFactory({ mode = 'clean', adminPassword = 'admin123' } = {}) {
  try {
    // 1. Wipe all database tables and reset auto_increment counters
    await db.exec(`
      SET FOREIGN_KEY_CHECKS = 0;
      TRUNCATE TABLE stock_movements;
      TRUNCATE TABLE sale_items;
      TRUNCATE TABLE sales;
      TRUNCATE TABLE dining_items;
      TRUNCATE TABLE dining_tables;
      TRUNCATE TABLE customers;
      TRUNCATE TABLE products;
      TRUNCATE TABLE categories;
      TRUNCATE TABLE users;
      TRUNCATE TABLE settings;
      SET FOREIGN_KEY_CHECKS = 1;
    `);

    // 2. Insert fresh default settings
    await db.run(`
      INSERT INTO settings (id, business_name, slogan, rfc, phone, address, ticket_footer, paper_width, font_size, auto_cut, show_logo, currency_symbol, tax_percentage)
      VALUES (1, 'A La Leña - Cocina Tradicional', 'El sabor auténtico de la leña yucateca', 'ALN230915ABC', '999-923-4567', 'Calle 60 #450 x 49 y 51, Centro, Mérida, Yucatán', '¡Gracias por su visita a A La Leña! Buen provecho.', '80mm', 'medium', 1, 1, '$', 0)
    `);

    if (mode === 'demo') {
      // 3a. Populate with full Yucatecan catalog and users
      const { seedInitialData } = require('./seedData');
      await seedInitialData();
      return {
        success: true,
        message: 'Base de datos reiniciada con éxito con catálogo y configuración de demostración.',
        defaultCredentials: {
          adminUser: 'admin',
          adminPass: 'admin123',
          cashierUser: 'cajero',
          cashierPass: 'cajero123'
        }
      };
    } else {
      // 3b. Clean state: Only default Administrator user and base dining tables
      const adminHash = await bcrypt.hash(adminPassword || 'admin123', 10);
      await db.run(
        'INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
        ['Administrador General', 'admin', adminHash, 'admin', 'active']
      );

      // Default dining tables so the floor plan is ready
      const defaultTables = [
        { number: 1, name: 'Mesa 1 (Ventanal)', capacity: 4 },
        { number: 2, name: 'Mesa 2 (Centro)', capacity: 4 },
        { number: 3, name: 'Mesa 3 (Rincón)', capacity: 2 },
        { number: 4, name: 'Mesa 4 (Familiar)', capacity: 6 },
        { number: 5, name: 'Mesa 5 (Comedor)', capacity: 4 },
        { number: 6, name: 'Mesa 6 (Terraza)', capacity: 4 },
        { number: 7, name: 'Mesa 7 (Terraza)', capacity: 4 },
        { number: 8, name: 'Mesa 8 (Barra 1)', capacity: 2 }
      ];

      for (const t of defaultTables) {
        await db.run(
          'INSERT INTO dining_tables (table_number, name, capacity, status) VALUES (?, ?, ?, ?)',
          [t.number, t.name, t.capacity, 'free']
        );
      }

      return {
        success: true,
        message: 'Base de datos restablecida a estado limpio desde cero. Se ha configurado el usuario administrador.',
        defaultCredentials: {
          adminUser: 'admin',
          adminPass: 'admin123'
        }
      };
    }
  } catch (err) {
    console.error('Error al restablecer base de datos:', err);
    throw new Error('Error al restablecer la base de datos: ' + err.message);
  }
}

module.exports = {
  generateSqlDump,
  restoreFromSql,
  resetDatabaseToFactory
};
