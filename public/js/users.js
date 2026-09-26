// Users Management Module for A La Leña POS

const users = {
  usersList: [],

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.bindEvents();
  },

  bindEvents() {
    const btnNew = document.getElementById('btn-new-user-modal');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openUserModal());
    }

    const form = document.getElementById('user-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveUser();
      });
    }
  },

  async loadUsers() {
    if (!auth.isAdmin()) return;
    try {
      const res = await api.users.getAll();
      if (res.success) {
        this.usersList = res.users;
        this.renderUsersTable();
      }
    } catch (err) {
      console.error(err);
      showToast('Error al consultar usuarios', 'error');
    }
  },

  renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    let html = '';
    this.usersList.forEach(u => {
      const isAdmin = u.role === 'admin';
      const isActive = u.status === 'active';

      html += `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${u.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Registrado: ${formatDate(u.created_at)}</div>
          </td>
          <td><code>@${u.username}</code></td>
          <td>
            <span class="badge ${isAdmin ? 'badge-primary' : 'badge-warning'}">
              ${isAdmin ? 'Administrador' : 'Cajero'}
            </span>
          </td>
          <td>
            <span style="font-size: 0.84rem; color: var(--text-muted);">
              ${isAdmin ? 'Acceso total a todos los módulos' : 'Caja, Comedor y Clientes'}
            </span>
          </td>
          <td>
            <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
              ${isActive ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm btn-icon" onclick="users.openUserModal(${u.id})" title="Editar Usuario">
                <span data-icon="edit"></span>
              </button>
              <button class="btn btn-secondary btn-sm btn-icon" onclick="users.deleteUser(${u.id})" title="Eliminar Usuario" style="color: var(--danger-600);">
                <span data-icon="trash-2"></span>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    renderIcons();
  },

  openUserModal(userId = null) {
    const titleEl = document.getElementById('user-form-title');
    const form = document.getElementById('user-form');
    form.reset();

    const pwHelper = document.getElementById('user-pw-helper');
    const pwInput = document.getElementById('user-form-password');

    if (userId) {
      titleEl.textContent = 'Editar Usuario';
      document.getElementById('user-form-id').value = userId;
      pwHelper.style.display = 'block';
      pwInput.required = false;

      const u = this.usersList.find(item => item.id === userId);
      if (u) {
        document.getElementById('user-form-name').value = u.name;
        document.getElementById('user-form-username').value = u.username;
        document.getElementById('user-form-role').value = u.role;
        document.getElementById('user-form-status').value = u.status;
      }
    } else {
      titleEl.textContent = 'Registrar Nuevo Usuario';
      document.getElementById('user-form-id').value = '';
      pwHelper.style.display = 'none';
      pwInput.required = true;
    }

    openModal('modal-user-form');
  },

  async saveUser() {
    const id = document.getElementById('user-form-id').value;
    const data = {
      name: document.getElementById('user-form-name').value.trim(),
      username: document.getElementById('user-form-username').value.trim(),
      password: document.getElementById('user-form-password').value,
      role: document.getElementById('user-form-role').value,
      status: document.getElementById('user-form-status').value
    };

    try {
      if (id) {
        const res = await api.users.update(id, data);
        if (res.success) {
          showToast('Usuario actualizado exitosamente', 'success');
        }
      } else {
        const res = await api.users.create(data);
        if (res.success) {
          showToast('Usuario registrado exitosamente', 'success');
        }
      }
      closeModal('modal-user-form');
      this.loadUsers();
    } catch (err) {
      showToast(err.message || 'Error al guardar usuario', 'error');
    }
  },

  async deleteUser(id) {
    if (!confirm('¿Está seguro de eliminar este usuario del sistema?')) return;
    try {
      const res = await api.users.delete(id);
      if (res.success) {
        showToast('Usuario eliminado', 'info');
        this.loadUsers();
      }
    } catch (err) {
      showToast(err.message || 'Error al eliminar usuario', 'error');
    }
  }
};
