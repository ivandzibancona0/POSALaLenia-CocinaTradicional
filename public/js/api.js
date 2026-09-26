// API Client Module - Handles REST requests with JWT authentication for A La Leña POS

const API_BASE = '/api';

const api = {
  // Base Request Method
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('pos_token');
    const headers = {
      'Accept': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      // Handle CSV or file downloads
      if (options.responseType === 'blob') {
        if (!response.ok) throw new Error('Error al descargar archivo');
        return await response.blob();
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('pos_token');
          localStorage.removeItem('pos_user');
          if (typeof auth !== 'undefined' && auth.onLogout) {
            auth.onLogout();
          }
        }
        throw new Error(data.message || 'Error en la petición al servidor');
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  auth: {
    login: (username, password) => api.request('/auth/login', { method: 'POST', body: { username, password } }),
    me: () => api.request('/auth/me')
  },

  // Products & Categories Endpoints
  products: {
    getAllActive: () => api.request('/products/all-active'),
    getPaginated: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return api.request(`/products?${qs}`);
    },
    getById: (id) => api.request(`/products/${id}`),
    create: (data) => api.request('/products', { method: 'POST', body: data }),
    update: (id, data) => api.request(`/products/${id}`, { method: 'PUT', body: data }),
    adjustStock: (id, adjustment, reason) => api.request(`/products/${id}/adjust-stock`, { method: 'POST', body: { adjustment, reason } }),
    delete: (id) => api.request(`/products/${id}`, { method: 'DELETE' })
  },

  categories: {
    getAll: () => api.request('/categories'),
    create: (data) => api.request('/categories', { method: 'POST', body: data }),
    update: (id, data) => api.request(`/categories/${id}`, { method: 'PUT', body: data }),
    delete: (id) => api.request(`/categories/${id}`, { method: 'DELETE' })
  },

  // Dining Tables Endpoints
  dining: {
    getTables: () => api.request('/dining/tables'),
    getTable: (id) => api.request(`/dining/tables/${id}`),
    createTable: (data) => api.request('/dining/tables', { method: 'POST', body: data }),
    updateTable: (id, data) => api.request(`/dining/tables/${id}/edit`, { method: 'PUT', body: data }),
    deleteTable: (id) => api.request(`/dining/tables/${id}`, { method: 'DELETE' }),
    openTable: (id, data) => api.request(`/dining/tables/${id}/open`, { method: 'POST', body: data }),
    addItem: (id, item) => api.request(`/dining/tables/${id}/items`, { method: 'POST', body: item }),
    removeItem: (itemId) => api.request(`/dining/items/${itemId}`, { method: 'DELETE' }),
    getPreCheck: (id) => api.request(`/dining/tables/${id}/pre-check`),
    resetTable: (id) => api.request(`/dining/tables/${id}/reset`, { method: 'POST' })
  },

  // Customers Endpoints
  customers: {
    getPaginated: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return api.request(`/customers?${qs}`);
    },
    search: (q) => api.request(`/customers/search?q=${encodeURIComponent(q)}`),
    getById: (id) => api.request(`/customers/${id}`),
    getHistory: (id, page = 1, limit = 10) => api.request(`/customers/${id}/history?page=${page}&limit=${limit}`),
    create: (data) => api.request('/customers', { method: 'POST', body: data }),
    update: (id, data) => api.request(`/customers/${id}`, { method: 'PUT', body: data }),
    delete: (id) => api.request(`/customers/${id}`, { method: 'DELETE' })
  },

  // Helper for downloading files with Authorization headers
  downloadFile: async (endpoint, defaultFilename) => {
    const token = localStorage.getItem('pos_token');
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al descargar archivo');
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  // Sales & Reports Endpoints
  sales: {
    create: (saleData) => api.request('/sales', { method: 'POST', body: saleData }),
    getById: (id) => api.request(`/sales/${id}`),
    getSummary: (startDate, endDate) => api.request(`/sales/report/summary?startDate=${startDate}&endDate=${endDate}`),
    getReport1: (startDate, endDate) => api.request(`/sales/report/general?startDate=${startDate}&endDate=${endDate}`),
    getReport2: (startDate, endDate) => api.request(`/sales/report/detailed-products?startDate=${startDate}&endDate=${endDate}`),
    getCsvGeneralUrl: (startDate, endDate) => {
      const token = localStorage.getItem('pos_token') || '';
      return `${API_BASE}/sales/report/csv/general?startDate=${startDate}&endDate=${endDate}&token=${token}`;
    },
    getCsvDetailedUrl: (startDate, endDate) => {
      const token = localStorage.getItem('pos_token') || '';
      return `${API_BASE}/sales/report/csv/detailed-products?startDate=${startDate}&endDate=${endDate}&token=${token}`;
    }
  },

  // Users Endpoints
  users: {
    getAll: () => api.request('/users'),
    create: (data) => api.request('/users', { method: 'POST', body: data }),
    update: (id, data) => api.request(`/users/${id}`, { method: 'PUT', body: data }),
    delete: (id) => api.request(`/users/${id}`, { method: 'DELETE' })
  },

  // Settings & Backups Endpoints
  settings: {
    get: () => api.request('/settings'),
    update: (data) => api.request('/settings', { method: 'PUT', delay: 0, body: data }),
    getSqlBackupUrl: () => {
      const token = localStorage.getItem('pos_token') || '';
      return `${API_BASE}/settings/backup/sql?token=${token}`;
    },
    getDbBackupUrl: () => {
      const token = localStorage.getItem('pos_token') || '';
      return `${API_BASE}/settings/backup/db?token=${token}`;
    },
    restoreSql: (formData) => api.request('/settings/restore/sql', { method: 'POST', body: formData }),
    restoreDb: (formData) => api.request('/settings/restore/db', { method: 'POST', body: formData }),
    resetDatabase: (data) => api.request('/settings/reset-database', { method: 'POST', body: data })
  }
};
