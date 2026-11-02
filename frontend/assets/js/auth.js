/**
 * BizPermit Client-Side Authentication Guard & Session Helper
 */
const Auth = {
  async init() {
    // If on a protected route, verify current user
    const path = window.location.pathname;
    const isProtected = path.includes('/owner/') || path.includes('/staff/') || path.includes('/admin/');

    const token = API.getToken();
    if (!token && isProtected) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(path);
      return;
    }

    if (token) {
      try {
        const res = await API.get('/auth/me');
        if (res.success && res.data.user) {
          API.setUser(res.data.user);
          this.enforceRoleAccess(path, res.data.user.roles);
        }
      } catch (err) {
        if (isProtected) {
          API.setToken(null);
          API.setUser(null);
          window.location.href = '/login.html?redirect=' + encodeURIComponent(path);
        }
      }
    }
  },

  enforceRoleAccess(path, roles = []) {
    if (path.includes('/admin/') && !roles.includes('ADMIN')) {
      alert('Access Restricted: Administrator credentials required.');
      window.location.href = roles.includes('OFFICER') ? '/staff/dashboard.html' : '/owner/dashboard.html';
    } else if (path.includes('/staff/') && !roles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r))) {
      alert('Access Restricted: Municipal staff credentials required.');
      window.location.href = '/owner/dashboard.html';
    }
  },

  async logout() {
    try {
      await API.post('/auth/logout', {});
    } catch (e) { /* ignore */ }
    API.setToken(null);
    API.setUser(null);
    window.location.href = '/login.html';
  },

  getDefaultRedirect(roles = []) {
    if (roles.includes('ADMIN')) return '/admin/dashboard.html';
    if (roles.includes('OFFICER') || roles.includes('INSPECTOR')) return '/staff/dashboard.html';
    return '/owner/dashboard.html';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
