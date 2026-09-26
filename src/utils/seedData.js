const bcrypt = require('bcryptjs');
const { db } = require('../config/database');

async function seedInitialData() {
  // 1. Seed Users
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const cashierHash = await bcrypt.hash('cajero123', 10);

    await db.run(
      'INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Administrador General', 'admin', adminHash, 'admin', 'active']
    );

    await db.run(
      'INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Cajero Principal', 'cajero', cashierHash, 'cashier', 'active']
    );

    console.log('✅ Usuarios iniciales creados (admin / admin123, cajero / cajero123)');
  }

  // 2. Seed Categories
  const catCount = await db.get('SELECT COUNT(*) as count FROM categories');
  if (catCount.count === 0) {
    const categories = [
      { name: 'Platillos Tradicionales', description: 'Guisos típicos yucatecos hechos a la leña', icon: 'flame', sort_order: 1 },
      { name: 'Antojitos Yucatecos', description: 'Panuchos, salbutes y polcanes', icon: 'utensils', sort_order: 2 },
      { name: 'Tacos y Tortas', description: 'Servidos en pan francés crujiente o tortilla de comal', icon: 'sandwich', sort_order: 3 },
      { name: 'Bebidas y Aguas Frescas', description: 'Aguas naturales de la región y refrescos', icon: 'cup-soda', sort_order: 4 },
      { name: 'Postres Regionales', description: 'Dulces tradicionales de Yucatán', icon: 'cake', sort_order: 5 }
    ];

    for (const cat of categories) {
      await db.run(
        'INSERT INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)',
        [cat.name, cat.description, cat.icon, cat.sort_order]
      );
    }
    console.log('✅ Categorías de comida regional creadas');
  }

  // 3. Seed Products with Yucatecan Menu & Portion Pricing
  const prodCount = await db.get('SELECT COUNT(*) as count FROM products');
  if (prodCount.count === 0) {
    const categories = await db.all('SELECT id, name FROM categories');
    const catMap = {};
    categories.forEach(c => { catMap[c.name] = c.id; });

    const products = [
      // Platillos Tradicionales
      {
        code: 'PLAT-001',
        name: 'Cochinita Pibil Tradicional',
        category_id: catMap['Platillos Tradicionales'],
        description: 'Carne de cerdo marinada en recado rojo y naranja agria, cocida a fuego lento a la leña. Acompañada de cebolla morada y frijol colado.',
        price: 150.00,
        has_half_portion: 1,
        half_price: 90.00,
        cost: 65.00,
        stock: 35.0,
        min_stock: 5.0,
        unit: 'orden'
      },
      {
        code: 'PLAT-002',
        name: 'Poc Chuc Especial',
        category_id: catMap['Platillos Tradicionales'],
        description: 'Delgadas lonchas de carne de cerdo asadas al carbón y leña, con chiltomate, cebolla asada, aguacate y frijol kabax.',
        price: 165.00,
        has_half_portion: 1,
        half_price: 100.00,
        cost: 75.00,
        stock: 25.0,
        min_stock: 5.0,
        unit: 'orden'
      },
      {
        code: 'PLAT-003',
        name: 'Relleno Negro Enterrado',
        category_id: catMap['Platillos Tradicionales'],
        description: 'Pavo bañado en recado negro tradicional con but (albóndiga de carne molida) y huevo cocido.',
        price: 160.00,
        has_half_portion: 1,
        half_price: 95.00,
        cost: 70.00,
        stock: 20.0,
        min_stock: 4.0,
        unit: 'orden'
      },
      {
        code: 'PLAT-004',
        name: 'Queso Relleno Yucateco',
        category_id: catMap['Platillos Tradicionales'],
        description: 'Queso de bola holandés relleno de picadillo de cerdo con pasitas, alcaparras y bañado en salsa blanca (k\'ool) y chiltomate.',
        price: 180.00,
        has_half_portion: 1,
        half_price: 110.00,
        cost: 85.00,
        stock: 18.0,
        min_stock: 3.0,
        unit: 'orden'
      },
      {
        code: 'PLAT-005',
        name: 'Sopa de Lima con Pavo',
        category_id: catMap['Platillos Tradicionales'],
        description: 'Caldo de pavo aromatizado con lima agria de Yucatán, pavo deshebrado y tiras de tortilla crujiente.',
        price: 110.00,
        has_half_portion: 1,
        half_price: 70.00,
        cost: 45.00,
        stock: 30.0,
        min_stock: 6.0,
        unit: 'tazón'
      },
      {
        code: 'PLAT-006',
        name: 'Papadzules con Salsa de Pepita',
        category_id: catMap['Platillos Tradicionales'],
        description: 'Tortillas rellenas de huevo cocido bañadas en salsa verde de pepita de calabaza y salsa de chiltomate.',
        price: 120.00,
        has_half_portion: 1,
        half_price: 75.00,
        cost: 40.00,
        stock: 22.0,
        min_stock: 4.0,
        unit: 'orden'
      },

      // Antojitos Yucatecos
      {
        code: 'ANT-001',
        name: 'Panuchos de Cochinita (Orden 3 pzas)',
        category_id: catMap['Antojitos Yucatecos'],
        description: 'Tortillas hechas a mano rellenas de frijol negro colado, fritas y cubiertas con cochinita pibil, lechuga y cebolla morada.',
        price: 85.00,
        has_half_portion: 1,
        half_price: 50.00,
        cost: 32.00,
        stock: 50.0,
        min_stock: 10.0,
        unit: 'orden'
      },
      {
        code: 'ANT-002',
        name: 'Panuchos de Pavo Asado (Orden 3 pzas)',
        category_id: catMap['Antojitos Yucatecos'],
        description: 'Panuchos con frijol colado y pavo asado deshebrado a la leña, aguacate y tomate.',
        price: 85.00,
        has_half_portion: 1,
        half_price: 50.00,
        cost: 32.00,
        stock: 45.0,
        min_stock: 10.0,
        unit: 'orden'
      },
      {
        code: 'ANT-003',
        name: 'Salbutes Surtidos (Orden 3 pzas)',
        category_id: catMap['Antojitos Yucatecos'],
        description: 'Tortillas infladas fritas con carne de pavo, lechuga, cebolla curtida y aguacate.',
        price: 80.00,
        has_half_portion: 1,
        half_price: 48.00,
        cost: 30.00,
        stock: 40.0,
        min_stock: 8.0,
        unit: 'orden'
      },
      {
        code: 'ANT-004',
        name: 'Empanadas de Chaya con Queso de Bola (3 pzas)',
        category_id: catMap['Antojitos Yucatecos'],
        description: 'Empanadas doradas rellenas de queso Edam con masa martajada de chaya fresca.',
        price: 90.00,
        has_half_portion: 1,
        half_price: 55.00,
        cost: 35.00,
        stock: 30.0,
        min_stock: 6.0,
        unit: 'orden'
      },

      // Tacos y Tortas
      {
        code: 'TAC-001',
        name: 'Torta de Cochinita en Pan Francés',
        category_id: catMap['Tacos y Tortas'],
        description: 'Crujiente pan francés tradicional relleno de cochinita pibil jugosa y cebolla morada con habanero al gusto.',
        price: 55.00,
        has_half_portion: 0,
        half_price: 0,
        cost: 22.00,
        stock: 60.0,
        min_stock: 15.0,
        unit: 'pieza'
      },
      {
        code: 'TAC-002',
        name: 'Torta de Lechón al Horno con Cuerito Crujiente',
        category_id: catMap['Tacos y Tortas'],
        description: 'Lechón horneado con su cuerito tostado en pan francés artesanal.',
        price: 65.00,
        has_half_portion: 0,
        half_price: 0,
        cost: 26.00,
        stock: 45.0,
        min_stock: 10.0,
        unit: 'pieza'
      },
      {
        code: 'TAC-003',
        name: 'Tacos de Poc Chuc (Orden 3 pzas)',
        category_id: catMap['Tacos y Tortas'],
        description: 'Tacos con carne asada al carbón, cebollitas asadas y salsa chiltomate.',
        price: 75.00,
        has_half_portion: 0,
        half_price: 0,
        cost: 28.00,
        stock: 40.0,
        min_stock: 8.0,
        unit: 'orden'
      },

      // Bebidas
      {
        code: 'BEB-001',
        name: 'Agua de Horchata con Chaya y Limón (1 L)',
        category_id: catMap['Bebidas y Aguas Frescas'],
        description: 'Agua fresca artesanal de horchata yucateca con infusión de chaya verde y toque de limón.',
        price: 45.00,
        has_half_portion: 1,
        half_price: 28.00,
        cost: 12.00,
        stock: 50.0,
        min_stock: 10.0,
        unit: 'litro'
      },
      {
        code: 'BEB-002',
        name: 'Agua de Jamaica con Naranja Agria (1 L)',
        category_id: catMap['Bebidas y Aguas Frescas'],
        description: 'Infusión de flor de jamaica fresca con toque cítrico tradicional.',
        price: 40.00,
        has_half_portion: 1,
        half_price: 25.00,
        cost: 10.00,
        stock: 45.0,
        min_stock: 10.0,
        unit: 'litro'
      },
      {
        code: 'BEB-003',
        name: 'Refresco Cristal Negra / Embotellado (355 ml)',
        category_id: catMap['Bebidas y Aguas Frescas'],
        description: 'Refresco yucateco tradicional sabor vainilla negra o sabores surtidos.',
        price: 28.00,
        has_half_portion: 0,
        half_price: 0,
        cost: 14.00,
        stock: 80.0,
        min_stock: 20.0,
        unit: 'botella'
      },

      // Postres
      {
        code: 'POS-001',
        name: 'Dulce de Papaya con Queso de Bola',
        category_id: catMap['Postres Regionales'],
        description: 'Papaya verde en almíbar de canela espolvoreada con queso holandés rallado.',
        price: 55.00,
        has_half_portion: 0,
        half_price: 0,
        cost: 18.00,
        stock: 25.0,
        min_stock: 5.0,
        unit: 'porción'
      },
      {
        code: 'POS-002',
        name: 'Caballeros Pobres Yucatecos',
        category_id: catMap['Postres Regionales'],
        description: 'Rebanadas de pan francés capeadas y endulzadas en jarabe especiado con pasas.',
        price: 50.00,
        has_half_portion: 0,
        half_price: 0,
        cost: 15.00,
        stock: 20.0,
        min_stock: 5.0,
        unit: 'porción'
      }
    ];

    for (const p of products) {
      await db.run(
        `INSERT INTO products (code, name, category_id, description, price, has_half_portion, half_price, cost, stock, min_stock, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.code, p.name, p.category_id, p.description, p.price, p.has_half_portion, p.half_price, p.cost, p.stock, p.min_stock, p.unit]
      );
    }
    console.log('✅ Platillos yucatecos iniciales registrados con soporte de media ración');
  }

  // 4. Seed Dining Tables
  const tableCount = await db.get('SELECT COUNT(*) as count FROM dining_tables');
  if (tableCount.count === 0) {
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
    console.log('✅ Mesas del comedor configuradas');
  }

  // 5. Seed Initial Customers
  const custCount = await db.get('SELECT COUNT(*) as count FROM customers');
  if (custCount.count === 0) {
    const defaultCustomers = [
      {
        first_name: 'Don Manuel',
        last_name: 'Pech Canché',
        phone: '999-555-1234',
        address: 'Calle 59 #320 x 42, Col. Santiago, Mérida',
        notes: 'Cliente frecuente, prefiere la cochinita con poca grasa'
      },
      {
        first_name: 'Doña María',
        last_name: 'Cervera Solís',
        phone: '999-444-5678',
        address: 'Calle 21 #104, García Ginerés, Mérida',
        notes: 'Siempre pide agua de horchata con chaya'
      },
      {
        first_name: 'Carlos',
        last_name: 'Zapata Moguel',
        phone: '999-333-7890',
        address: 'Fracc. Las Américas, Mérida',
        notes: 'Pedidos para llevar oficina'
      }
    ];

    for (const c of defaultCustomers) {
      await db.run(
        'INSERT INTO customers (first_name, last_name, phone, address, notes) VALUES (?, ?, ?, ?, ?)',
        [c.first_name, c.last_name, c.phone, c.address, c.notes]
      );
    }
    console.log('✅ Clientes iniciales registrados');
  }
}

module.exports = {
  seedInitialData
};
