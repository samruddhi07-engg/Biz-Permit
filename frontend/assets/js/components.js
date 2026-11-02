/**
 * BizPermit Shared Component Renderers & UI Utilities
 * High-performance, accessible, responsive component architecture
 */

// Toast Notifications
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} fade-in-up`;
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size: 20px; flex-shrink: 0;">${icon}</span>
    <span style="flex: 1;">${message}</span>
    <button type="button" aria-label="Close notification" style="color: inherit; opacity: 0.7; padding: 2px;" onclick="this.parentElement.remove()">
      <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
    </button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate3d(0, 8px, 0)';
    toast.style.transition = 'all var(--transition-fast)';
    setTimeout(() => toast.remove(), 200);
  }, 4500);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

function formatStatusBadge(status) {
  const map = {
    DRAFT: { label: 'Draft', class: 'badge-draft' },
    SUBMITTED: { label: 'Submitted', class: 'badge-submitted' },
    UNDER_REVIEW: { label: 'Under Review', class: 'badge-review' },
    CORRECTION_REQUIRED: { label: 'Action Required', class: 'badge-correction' },
    INSPECTION_REQUIRED: { label: 'Inspection Required', class: 'badge-review' },
    APPROVED: { label: 'Approved', class: 'badge-approved' },
    REJECTED: { label: 'Rejected', class: 'badge-rejected' },
    WITHDRAWN: { label: 'Withdrawn', class: 'badge-draft' },
    ACTIVE: { label: 'Active', class: 'badge-active' },
    EXPIRED: { label: 'Expired', class: 'badge-rejected' },
    PASSED: { label: 'Passed', class: 'badge-passed' },
    FAILED: { label: 'Failed', class: 'badge-failed' },
    PENDING: { label: 'Pending', class: 'badge-draft' },
    REQUIRES_FOLLOWUP: { label: 'Requires Followup', class: 'badge-correction' },
    VERIFIED: { label: 'Verified', class: 'badge-approved' }
  };
  const item = map[status] || { label: status, class: 'badge-draft' };
  return `<span class="badge ${item.class}">${item.label}</span>`;
}

// Render Public Header
function renderPublicHeader(activeLink = 'home') {
  const header = document.getElementById('public-header');
  if (!header) return;

  const user = API.getUser();
  const token = API.getToken();

  let authButtons = `
    <a href="/login.html" class="btn btn-secondary btn-sm">Sign In</a>
    <a href="/register.html" class="btn btn-primary btn-sm">Get Started</a>
  `;

  if (token && user) {
    const dashboardLink = Auth.getDefaultRedirect(user.roles);
    authButtons = `
      <a href="${dashboardLink}" class="btn btn-primary btn-sm" style="display:flex;align-items:center;gap:6px;">
        <span class="material-symbols-outlined" style="font-size:16px;">dashboard</span>
        <span>Dashboard</span>
      </a>
      <button onclick="Auth.logout()" class="btn btn-secondary btn-sm" title="Sign Out">
        <span class="material-symbols-outlined" style="font-size:16px;">logout</span>
      </button>
    `;
  }

  header.innerHTML = `
    <div class="container">
      <a href="/" class="brand-logo" aria-label="BizPermit Home">
        <div class="brand-icon">
          <span class="material-symbols-outlined" style="font-size: 22px;">account_balance</span>
        </div>
        <div class="brand-text">
          <span class="brand-name">BizPermit</span>
          <span class="brand-sub">Municipal Licensure</span>
        </div>
      </a>
      <nav class="public-nav" aria-label="Main Navigation">
        <a href="/" class="${activeLink === 'home' ? 'active' : ''}">Home</a>
        <a href="/licenses.html" class="${activeLink === 'licenses' ? 'active' : ''}">Explore Licenses</a>
        <a href="/how-it-works.html" class="${activeLink === 'how-it-works' ? 'active' : ''}">How It Works</a>
        <a href="/standards.html" class="${activeLink === 'standards' ? 'active' : ''}">Municipal Standards</a>
        <a href="/help.html" class="${activeLink === 'help' ? 'active' : ''}">Help &amp; FAQs</a>
      </nav>
      <div class="header-actions">
        ${authButtons}
        <button class="mobile-menu-btn" onclick="toggleMobileNav()" aria-label="Toggle navigation menu" aria-expanded="false">
          <span class="material-symbols-outlined">menu</span>
        </button>
      </div>
    </div>
  `;
}

function toggleMobileNav() {
  const nav = document.querySelector('.public-nav');
  const btn = document.querySelector('.mobile-menu-btn');
  if (nav) {
    const isOpen = nav.classList.toggle('open');
    if (btn) {
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      btn.innerHTML = `<span class="material-symbols-outlined">${isOpen ? 'close' : 'menu'}</span>`;
    }
  }
}

// Render Public Footer
function renderPublicFooter() {
  const footer = document.getElementById('public-footer');
  if (!footer) return;

  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-column">
          <div class="brand-logo" style="margin-bottom: 1.25rem;">
            <div class="brand-icon">
              <span class="material-symbols-outlined" style="font-size: 22px;">account_balance</span>
            </div>
            <div class="brand-text">
              <span class="brand-name">BizPermit</span>
              <span class="brand-sub">Municipal Licensure</span>
            </div>
          </div>
          <p style="font-size: 0.85rem; max-width: 320px; margin-bottom: 1.25rem;">
            Smart business license management system integrating 4 distinct database architectures: MySQL, MongoDB, Neo4j, and Redis.
          </p>
          <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:var(--color-surface);border:1px solid var(--color-border);font-size:0.75rem;font-weight:600;color:var(--color-text-secondary);">
            <span class="material-symbols-outlined" style="font-size:14px;color:var(--color-success);">check_circle</span>
            <span>Multi-Database DBMS Verified</span>
          </div>
        </div>

        <div class="footer-column">
          <h4>Portal Framework</h4>
          <ul>
            <li><a href="/licenses.html">License Catalog</a></li>
            <li><a href="/how-it-works.html">Application Workflow</a></li>
            <li><a href="/standards.html">Statutory Standards</a></li>
            <li><a href="/help.html">Document Checklists</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h4>Workspaces</h4>
          <ul>
            <li><a href="/owner/dashboard.html">Business Owner Portal</a></li>
            <li><a href="/staff/dashboard.html">Licensing Officer Desk</a></li>
            <li><a href="/staff/inspections.html">Inspector Field Audit</a></li>
            <li><a href="/admin/dashboard.html">Municipal Administration</a></li>
          </ul>
        </div>

        <div class="footer-column">
          <h4>Governance</h4>
          <ul>
            <li><a href="/standards.html">Municipal Code Revision: 2026.2</a></li>
            <li><a href="/help.html#faq">Licensing FAQs</a></li>
            <li><a href="/help.html#support">Contact Municipal Clerk</a></li>
            <li><a href="/admin/license-graph.html">Neo4j Dependency Graph</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>© 2026 BizPermit Civic Architecture. Academic DBMS Implementation with 4 Database Engines (MySQL, MongoDB, Neo4j, Redis).</p>
        <div style="display:flex;flex-wrap:wrap;gap:1.5rem;font-weight:600;font-size:0.75rem;">
          <span>MySQL 8+</span>
          <span>MongoDB 7.0+</span>
          <span>Neo4j 5.20+</span>
          <span>Redis / Memurai</span>
        </div>
      </div>
    </div>
  `;
}

// Render Dashboard Sidebar
function renderSidebar(activeItem = 'dashboard', workspace = 'owner') {
  const sidebar = document.getElementById('dashboard-sidebar');
  if (!sidebar) return;

  const ws = (workspace || 'owner').toLowerCase();

  // Add mobile backdrop element if not already present
  let backdrop = document.getElementById('sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.addEventListener('click', toggleSidebar);
    document.body.appendChild(backdrop);
  }

  const user = API.getUser() || { full_name: 'Authorized User', email: 'user@bizpermit.demo', roles: [] };
  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  const showStaff = userRoles.some(r => ['OFFICER', 'INSPECTOR', 'ADMIN'].includes(r));
  const showAdmin = userRoles.includes('ADMIN');

  let navItems = [];

  if (ws === 'owner') {
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/owner/dashboard.html' },
      { id: 'businesses', label: 'My Businesses', icon: 'storefront', href: '/owner/businesses.html' },
      { id: 'find-license', label: 'Find Licenses (Neo4j)', icon: 'hub', href: '/owner/find-license.html' },
      { id: 'applications', label: 'My Applications', icon: 'assignment', href: '/owner/applications.html' },
      { id: 'documents', label: 'Documents Vault', icon: 'folder_open', href: '/owner/documents.html' },
      { id: 'payments', label: 'Payments & Receipts', icon: 'receipt_long', href: '/owner/payments.html' },
      { id: 'licenses', label: 'My Licenses', icon: 'verified', href: '/owner/licenses.html' },
      { id: 'notifications', label: 'Notifications', icon: 'notifications', href: '/owner/notifications.html' },
      { id: 'profile', label: 'Profile & Settings', icon: 'manage_accounts', href: '/owner/profile.html' }
    ];
  } else if (ws === 'staff') {
    navItems = [
      { id: 'dashboard', label: 'Staff Dashboard', icon: 'dashboard', href: '/staff/dashboard.html' },
      { id: 'assigned', label: 'Assigned Applications', icon: 'inbox', href: '/staff/assigned.html' },
      { id: 'inspections', label: 'Field Inspections', icon: 'fact_check', href: '/staff/inspections.html' },
      { id: 'history', label: 'Decision History', icon: 'history', href: '/staff/history.html' }
    ];
  } else if (ws === 'admin') {
    navItems = [
      { id: 'dashboard', label: 'Overview', icon: 'dashboard', href: '/admin/dashboard.html' },
      { id: 'users', label: 'User Directory', icon: 'group', href: '/admin/users.html' },
      { id: 'departments', label: 'Departments', icon: 'domain', href: '/admin/departments.html' },
      { id: 'staff', label: 'Staff Roster', icon: 'badge', href: '/admin/staff.html' },
      { id: 'license-types', label: 'License Types', icon: 'format_list_bulleted', href: '/admin/license-types.html' },
      { id: 'requirements', label: 'Document Rules', icon: 'rule', href: '/admin/requirements.html' },
      { id: 'license-graph', label: 'Neo4j Graph Explorer', icon: 'account_tree', href: '/admin/license-graph.html' },
      { id: 'applications', label: 'All Applications', icon: 'folder_shared', href: '/admin/applications.html' },
      { id: 'inspections', label: 'All Inspections', icon: 'fact_check', href: '/admin/inspections.html' },
      { id: 'reports', label: 'Reports & Analytics', icon: 'analytics', href: '/admin/reports.html' },
      { id: 'audit-logs', label: 'Audit Trail', icon: 'security', href: '/admin/audit-logs.html' }
    ];
  }

  const navHtml = navItems.map(item => `
    <a href="${item.href}" class="sidebar-link ${activeItem === item.id ? 'active' : ''}">
      <span class="material-symbols-outlined">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <a href="/" class="brand-logo">
        <div class="brand-icon" style="width:34px;height:34px;border-radius:8px;">
          <span class="material-symbols-outlined" style="font-size: 18px;">account_balance</span>
        </div>
        <div class="brand-text">
          <span class="brand-name" style="font-size:1.05rem;">BizPermit</span>
          <span class="brand-sub">${workspace.toUpperCase()} PORTAL</span>
        </div>
      </a>
    </div>

    <div class="sidebar-nav">
      <span class="sidebar-label">Navigation</span>
      ${navHtml}

      <span class="sidebar-label" style="margin-top:1.25rem;">Switch Workspace</span>
      <a href="/owner/dashboard.html" class="sidebar-link" style="font-size:0.8rem;">
        <span class="material-symbols-outlined" style="font-size:18px;">person</span>
        <span>Owner Workspace</span>
      </a>
      ${showStaff ? `<a href="/staff/dashboard.html" class="sidebar-link" style="font-size:0.8rem;">
        <span class="material-symbols-outlined" style="font-size:18px;">supervisor_account</span>
        <span>Staff Workspace</span>
      </a>` : ''}
      ${showAdmin ? `<a href="/admin/dashboard.html" class="sidebar-link" style="font-size:0.8rem;">
        <span class="material-symbols-outlined" style="font-size:18px;">admin_panel_settings</span>
        <span>Admin Console</span>
      </a>` : ''}
    </div>

    <div class="sidebar-footer">
      <div style="display:flex;align-items:center;gap:10px;overflow:hidden;flex:1;">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0;">
          ${(user.full_name || 'U').charAt(0).toUpperCase()}
        </div>
        <div style="overflow:hidden;line-height:1.2;">
          <div style="font-weight:700;font-size:0.825rem;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.full_name || 'User'}</div>
          <div style="font-size:0.7rem;color:var(--color-muted);white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${user.email || ''}</div>
        </div>
      </div>
      <button onclick="Auth.logout()" title="Sign Out" style="background:none;border:none;cursor:pointer;color:var(--color-muted);padding:4px;display:flex;" onmouseover="this.style.color='var(--color-text)'" onmouseout="this.style.color='var(--color-muted)'">
        <span class="material-symbols-outlined" style="font-size:20px;">logout</span>
      </button>
    </div>
  `;
}

function toggleSidebar() {
  const sidebar = document.querySelector('.dashboard-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
      backdrop.classList.toggle('active', isOpen);
    }
  }
}

// Render Topbar on Dashboard Pages
function renderTopbar(pageTitle = 'Dashboard') {
  const topbar = document.getElementById('dashboard-topbar');
  if (!topbar) return;

  topbar.innerHTML = `
    <div class="topbar-left">
      <button class="mobile-menu-btn" style="display:flex;margin-right:0.25rem;" onclick="toggleSidebar()" aria-label="Toggle navigation drawer">
        <span class="material-symbols-outlined">menu</span>
      </button>
      <h2 style="font-size:1.35rem;font-weight:800;letter-spacing:-0.02em;">${pageTitle}</h2>
    </div>
    <div class="topbar-right">
      <a href="/owner/notifications.html" style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text);" title="Notifications" aria-label="View notifications">
        <span class="material-symbols-outlined" style="font-size:20px;">notifications</span>
      </a>
      <a href="/licenses.html" class="btn btn-secondary btn-sm" target="_blank" style="display:flex;align-items:center;gap:4px;">
        <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
        <span>Public Catalog</span>
      </a>
    </div>
  `;
}
