// Settings & Backup/Restore Module for A La Leña POS

const settings = {
  currentSettings: {},

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindEvents();
  },

  bindEvents() {
    // Business info form
    const bizForm = document.getElementById('form-business-settings');
    if (bizForm) {
      bizForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveBusinessSettings();
      });
    }

    // Printer settings form
    const printForm = document.getElementById('form-printer-settings');
    if (printForm) {
      printForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePrinterSettings();
      });
    }

    // Test print button
    const btnTest = document.getElementById('btn-test-print-ticket');
    if (btnTest) {
      btnTest.addEventListener('click', () => this.previewSampleTicket());
    }

    // Download SQL Backup
    const btnSql = document.getElementById('btn-download-sql-backup');
    if (btnSql) {
      btnSql.addEventListener('click', () => {
        window.open(api.settings.getSqlBackupUrl(), '_blank');
        showToast('Descargando copia de seguridad SQL...', 'info');
      });
    }

    // Restore SQL Form
    const restoreSqlForm = document.getElementById('form-restore-sql');
    if (restoreSqlForm) {
      restoreSqlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('input-restore-sql');
        if (!fileInput.files || fileInput.files.length === 0) {
          showToast('Seleccione un archivo .sql', 'warning');
          return;
        }

        if (!confirm('⚠️ ¡ADVERTENCIA! Restaurar una base de datos reemplazará la información actual del sistema. ¿Desea continuar?')) return;

        const formData = new FormData();
        formData.append('sqlFile', fileInput.files[0]);

        try {
          showToast('Restaurando base de datos MySQL...', 'info', 5000);
          const res = await api.settings.restoreSql(formData);
          if (res.success) {
            showToast(res.message, 'success');
            setTimeout(() => window.location.reload(), 1500);
          }
        } catch (err) {
          showToast(err.message || 'Error al restaurar SQL', 'error');
        }
      });
    }

    // Open Reset Database Modal
    const btnOpenReset = document.getElementById('btn-open-reset-modal');
    if (btnOpenReset) {
      btnOpenReset.addEventListener('click', () => {
        const inputConfirm = document.getElementById('input-confirm-reset');
        const btnSubmitReset = document.getElementById('btn-submit-reset-db');
        const formReset = document.getElementById('form-reset-database');
        if (formReset) formReset.reset();
        if (inputConfirm) inputConfirm.value = '';
        if (btnSubmitReset) {
          btnSubmitReset.disabled = true;
          btnSubmitReset.style.opacity = '0.5';
          btnSubmitReset.style.cursor = 'not-allowed';
        }
        openModal('modal-reset-database');
      });
    }

    // Validate confirmation keyword in real-time
    const inputConfirmReset = document.getElementById('input-confirm-reset');
    if (inputConfirmReset) {
      inputConfirmReset.addEventListener('input', (e) => {
        const val = e.target.value.trim().toUpperCase();
        const btnSubmit = document.getElementById('btn-submit-reset-db');
        if (btnSubmit) {
          const isValid = val === 'REINICIAR' || val === 'ELIMINAR';
          btnSubmit.disabled = !isValid;
          btnSubmit.style.opacity = isValid ? '1' : '0.5';
          btnSubmit.style.cursor = isValid ? 'pointer' : 'not-allowed';
        }
      });
    }

    // Reset Database Form submission
    const formResetDb = document.getElementById('form-reset-database');
    if (formResetDb) {
      formResetDb.addEventListener('submit', async (e) => {
        e.preventDefault();
        const confirmText = (document.getElementById('input-confirm-reset').value || '').trim();
        const modeRadio = document.querySelector('input[name="reset_mode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'clean';

        if (confirmText.toUpperCase() !== 'REINICIAR' && confirmText.toUpperCase() !== 'ELIMINAR') {
          showToast('Debe escribir exactamente la palabra "REINICIAR" para continuar', 'warning');
          return;
        }

        const btnSubmit = document.getElementById('btn-submit-reset-db');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Restableciendo sistema...</span>';

        try {
          showToast('Reiniciando base de datos a valores de fábrica...', 'info', 6000);
          const res = await api.settings.resetDatabase({ confirmText, mode });
          if (res.success) {
            closeModal('modal-reset-database');
            showToast(res.message, 'success', 8000);
            
            // Inform the user and log out to cleanly transition to login screen
            setTimeout(() => {
              auth.logout();
              const loginUser = document.getElementById('login-username');
              if (loginUser) loginUser.value = 'admin';
              const loginPass = document.getElementById('login-password');
              if (loginPass) {
                loginPass.value = '';
                loginPass.focus();
              }
              showToast('🔑 Ingrese con el usuario: admin y contraseña: admin123', 'info', 10000);
            }, 1200);
          }
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Error al reiniciar la base de datos', 'error');
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<span data-icon="trash-2"></span><span>Sí, Eliminar y Reiniciar Todo</span>`;
          renderIcons();
        }
      });
    }
  },

  async loadSettings() {
    try {
      const res = await api.settings.get();
      if (res.success && res.settings) {
        this.currentSettings = res.settings;
        this.populateForm(res.settings);
      }
    } catch (err) {
      console.error(err);
      showToast('Error al cargar configuraciones', 'error');
    }
  },

  populateForm(s) {
    document.getElementById('setting-business-name').value = s.business_name || '';
    document.getElementById('setting-slogan').value = s.slogan || '';
    document.getElementById('setting-rfc').value = s.rfc || '';
    document.getElementById('setting-phone').value = s.phone || '';
    document.getElementById('setting-address').value = s.address || '';
    document.getElementById('setting-ticket-footer').value = s.ticket_footer || '';

    // Printer
    document.getElementById('setting-paper-width').value = s.paper_width || '80mm';
    document.getElementById('setting-font-size').value = s.font_size || 'medium';
    document.getElementById('setting-show-logo').checked = s.show_logo == 1;
    document.getElementById('setting-auto-cut').checked = s.auto_cut == 1;
  },

  async saveBusinessSettings() {
    const data = {
      ...this.currentSettings,
      business_name: document.getElementById('setting-business-name').value.trim(),
      slogan: document.getElementById('setting-slogan').value.trim(),
      rfc: document.getElementById('setting-rfc').value.trim(),
      phone: document.getElementById('setting-phone').value.trim(),
      address: document.getElementById('setting-address').value.trim(),
      ticket_footer: document.getElementById('setting-ticket-footer').value.trim()
    };

    try {
      const res = await api.settings.update(data);
      if (res.success) {
        this.currentSettings = res.settings;
        showToast('Datos del negocio guardados exitosamente', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Error al guardar configuraciones', 'error');
    }
  },

  async savePrinterSettings() {
    const data = {
      ...this.currentSettings,
      paper_width: document.getElementById('setting-paper-width').value,
      font_size: document.getElementById('setting-font-size').value,
      show_logo: document.getElementById('setting-show-logo').checked ? 1 : 0,
      auto_cut: document.getElementById('setting-auto-cut').checked ? 1 : 0
    };

    try {
      const res = await api.settings.update(data);
      if (res.success) {
        this.currentSettings = res.settings;
        showToast('Configuraciones de impresora guardadas', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Error al guardar impresora', 'error');
    }
  },

  previewSampleTicket() {
    const sampleData = {
      order_number: 'ORD-DEMO-0001',
      printed_at: new Date().toISOString(),
      waiter: auth.currentUser ? auth.currentUser.name : 'Administrador',
      settings: this.currentSettings,
      sale: {
        order_number: 'ORD-DEMO-0001',
        created_at: new Date().toISOString(),
        cashier_name: auth.currentUser ? auth.currentUser.name : 'Administrador',
        customer_first_name: 'Don Manuel',
        customer_last_name: 'Pech Canché',
        customer_phone: '999-555-1234',
        customer_address: 'Calle 59 #320 x 42, Mérida',
        sale_type: 'dining',
        payment_method: 'cash',
        subtotal: 295.00,
        discount: 0,
        total: 295.00,
        amount_paid: 300.00,
        change_due: 5.00,
        notes: 'Mesa 2 - Bien crujiente la cochinita'
      },
      items: [
        { product_name: 'Cochinita Pibil Tradicional', portion_type: 'full', quantity: 1, unit_price: 150.00, subtotal: 150.00 },
        { product_name: 'Poc Chuc Especial', portion_type: 'half', quantity: 1, unit_price: 100.00, subtotal: 100.00 },
        { product_name: 'Agua de Horchata con Chaya (1 L)', portion_type: 'full', quantity: 1, unit_price: 45.00, subtotal: 45.00 }
      ]
    };

    ticketPrinter.showTicketModal(sampleData);
  }
};
