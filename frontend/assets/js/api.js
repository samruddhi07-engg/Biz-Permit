/**
 * BizPermit Client-Side API Utility Wrapper
 */
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('bizpermit_token') || null;
  },

  setToken(token) {
    if (token) localStorage.setItem('bizpermit_token', token);
    else localStorage.removeItem('bizpermit_token');
  },

  getUser() {
    const u = localStorage.getItem('bizpermit_user');
    return u ? JSON.parse(u) : null;
  },

  setUser(user) {
    if (user) localStorage.setItem('bizpermit_user', JSON.stringify(user));
    else localStorage.removeItem('bizpermit_user');
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers,
      credentials: 'include'
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          this.setToken(null);
          this.setUser(null);
          if (window.location.pathname.includes('/owner/') || window.location.pathname.includes('/staff/') || window.location.pathname.includes('/admin/')) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
          }
        }
        const errorMsg = (data && data.error && data.error.message) || data.message || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      console.error(`[API Error ${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};
