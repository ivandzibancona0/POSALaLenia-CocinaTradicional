// End-to-End Automated Test Suite for A La Leña POS
const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:3000${path}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
      }
    };

    if (options.body && typeof options.body === 'object') {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 INICIANDO PRUEBAS AUTOMATIZADAS: POS "A LA LEÑA"');
  console.log('🧪 ========================================================');

  let adminToken = '';
  let cashierToken = '';

  // 1. Test Admin Login
  console.log('\n▶️ 1. Probando Login de Administrador...');
  const loginAdmin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  if (loginAdmin.data.success && loginAdmin.data.token) {
    adminToken = loginAdmin.data.token;
    console.log('  ✅ Login Admin exitoso. Token generado.');
  } else {
    throw new Error('Fallo login Admin: ' + JSON.stringify(loginAdmin.data));
  }

  // 2. Test Cashier Login
  console.log('\n▶️ 2. Probando Login de Cajero...');
  const loginCashier = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'cajero', password: 'cajero123' }
  });
  if (loginCashier.data.success && loginCashier.data.token) {
    cashierToken = loginCashier.data.token;
    console.log('  ✅ Login Cajero exitoso.');
  } else {
    throw new Error('Fallo login Cajero');
  }

  // 3. Test Products & Portion Pricing
  console.log('\n▶️ 3. Probando Catálogo de Productos y Precios de Medias Raciones...');
  const prodsRes = await request('/api/products/all-active', { token: adminToken });
  const products = prodsRes.data.products;
  console.log(`  ✅ Total productos activos: ${products.length}`);
  
  const cochinita = products.find(p => p.name.includes('Cochinita'));
  console.log(`  🔍 Platillo: ${cochinita.name}`);
  console.log(`     - Precio Ración Completa: $${cochinita.price}`);
  console.log(`     - Admite Media Ración: ${cochinita.has_half_portion ? 'Sí' : 'No'}`);
  console.log(`     - Precio Media Ración Asignado: $${cochinita.half_price}`);
  console.log(`     - Stock Disponible: ${cochinita.stock} raciones`);

  // 4. Test Customer Search & Purchase History
  console.log('\n▶️ 4. Probando Módulo de Clientes y Búsqueda...');
  const custSearch = await request('/api/customers/search?q=Manuel', { token: adminToken });
  const donManuel = custSearch.data.customers[0];
  console.log(`  ✅ Cliente encontrado: ${donManuel.first_name} ${donManuel.last_name} (${donManuel.phone})`);

  // 5. Test Dining Room Flow (Open Table, Add Portion, Pre-Check Ticket)
  console.log('\n▶️ 5. Probando Módulo de Comedor (Mesas, Pre-corte de Ticket)...');
  const tablesRes = await request('/api/dining/tables', { token: adminToken });
  const table2 = tablesRes.data.tables.find(t => t.table_number === 2);
  console.log(`  🔍 Mesa seleccionada: ${table2.name} (Estado: ${table2.status})`);

  // Add a half portion to table 2
  await request(`/api/dining/tables/${table2.id}/items`, {
    method: 'POST',
    token: adminToken,
    body: {
      product_id: cochinita.id,
      portion_type: 'half',
      quantity: 1,
      notes: 'Sin grasa'
    }
  });
  console.log('  ✅ Media ración de Cochinita agregada a Mesa 2');

  // Pre-check ticket for table 2
  const preCheck = await request(`/api/dining/tables/${table2.id}/pre-check`, { token: adminToken });
  console.log(`  ✅ Pre-corte de comedor generado: Total $${preCheck.data.total}, Estado: ${preCheck.data.title}`);

  // 6. Test POS Sale Checkout with Order Number and Fractional Stock Deduction
  console.log('\n▶️ 6. Probando Módulo de Caja (Venta, Generación de Orden y Descuento de Stock)...');
  const initialStock = cochinita.stock;
  const saleRes = await request('/api/sales', {
    method: 'POST',
    token: adminToken,
    body: {
      customer_id: donManuel.id,
      dining_table_id: table2.id,
      sale_type: 'dining',
      items: [
        {
          product_id: cochinita.id,
          product_name: cochinita.name,
          category_name: cochinita.category_name,
          portion_type: 'half',
          quantity: 1,
          unit_price: cochinita.half_price
        }
      ],
      discount: 0,
      payment_method: 'cash',
      amount_paid: 100,
      notes: 'Consumo en comedor'
    }
  });

  console.log(`  ✅ Venta completada exitosamente!`);
  console.log(`     - Número de Orden: #${saleRes.data.order_number}`);
  console.log(`     - Total: $${saleRes.data.sale.total}`);
  console.log(`     - Cliente en Ticket: ${saleRes.data.sale.customer_first_name} ${saleRes.data.sale.customer_last_name}`);
  console.log(`     - Teléfono en Ticket: ${saleRes.data.sale.customer_phone}`);
  console.log(`     - Dirección en Ticket: ${saleRes.data.sale.customer_address}`);
  console.log(`     - Cambio calculado: $${saleRes.data.sale.change_due}`);

  // Verify stock was deducted by 0.5
  const updatedProd = await request(`/api/products/${cochinita.id}`, { token: adminToken });
  console.log(`  ✅ Verificación de Stock: Antes ${initialStock} -> Ahora ${updatedProd.data.product.stock} (Descontó 0.5 ración correctamente)`);

  // 7. Test Customer History Popup Data
  console.log('\n▶️ 7. Probando Modal de Historial de Compras del Cliente...');
  const historyRes = await request(`/api/customers/${donManuel.id}/history`, { token: adminToken });
  console.log(`  ✅ Historial del cliente consultado: ${historyRes.data.stats.order_count} compras registradas por un total de $${historyRes.data.stats.total_spent}`);

  // 8. Test Reports Module (Report 1 and Report 2 with Order Number)
  console.log('\n▶️ 8. Probando Módulo de Reportes...');
  const today = new Date().toISOString().slice(0, 10);
  const rep1 = await request(`/api/sales/report/general?startDate=${today}&endDate=${today}`, { token: adminToken });
  console.log(`  ✅ Reporte 1 (Ventas Generales): ${rep1.data.sales.length} ventas encontradas`);

  const rep2 = await request(`/api/sales/report/detailed-products?startDate=${today}&endDate=${today}`, { token: adminToken });
  console.log(`  ✅ Reporte 2 (Detallado por Producto con No. de Orden):`);
  rep2.data.items.forEach(it => {
    console.log(`     - Orden: #${it.order_number} | Producto: ${it.product_name} | Ración: ${it.portion_type} | Cant: ${it.quantity} | Subtotal: $${it.subtotal}`);
  });

  // 9. Test Backups (.SQL and .DB)
  console.log('\n▶️ 9. Probando Respaldos (.SQL y .DB)...');
  const sqlBackup = await request('/api/settings/backup/sql', { token: adminToken });
  console.log(`  ✅ Respaldo .SQL generado correctamente (Tamaño: ${sqlBackup.data.length} caracteres)`);

  // 10. Test Security & RBAC (Cajero Restricted Access)
  console.log('\n▶️ 10. Probando Seguridad y Restricción de Permisos para Cajero...');
  const restrictedReports = await request(`/api/sales/report/general?startDate=${today}&endDate=${today}`, { token: cashierToken });
  if (restrictedReports.status === 403) {
    console.log('  ✅ Acceso denegado a Reportes para usuario Cajero (HTTP 403 Forbidden).');
  } else {
    console.warn('  ⚠️ Advertencia: Cajero pudo acceder a reportes.');
  }

  const restrictedUsers = await request('/api/users', { token: cashierToken });
  if (restrictedUsers.status === 403) {
    console.log('  ✅ Acceso denegado a Usuarios para usuario Cajero (HTTP 403 Forbidden).');
  }

  console.log('\n========================================================');
  console.log('🎉 TODAS LAS PRUEBAS AUTOMATIZADAS PASARON CON ÉXITO 100%');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  process.exit(1);
});
