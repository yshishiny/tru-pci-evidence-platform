/**
 * Shared Navigation Component
 * Consistent topbar across all views matching TRU_PCI_DSS_Evidence_Dashboard.html style
 */

window.Nav = {
  /**
   * Render the navigation topbar
   * @param {string} activePage - Current active page name
   * @returns {string} HTML string for the topbar
   */
  render(activePage) {
    const user = window.App.currentUser;
    const role = user?.role || '';
    const displayName = user?.display_name || user?.username || '';

    // Build nav items based on role
    const navItems = [
      { id: 'dashboard', label: 'Dashboard', hash: '#/dashboard', roles: ['admin', 'tru_team', 'iexpert_pm', 'iexpert_grc', 'assessor'] },
      { id: 'review', label: 'Review', hash: '#/review', roles: ['admin', 'iexpert_pm', 'iexpert_grc', 'assessor'] },
      { id: 'reports', label: 'Reports', hash: '#/reports', roles: ['admin', 'tru_team', 'iexpert_pm', 'iexpert_grc', 'assessor'] },
      { id: 'cloud-storage', label: 'Cloud Storage', hash: '#/cloud-storage', roles: ['admin', 'tru_team', 'iexpert_pm', 'iexpert_grc', 'assessor'] },
      { id: 'alerts', label: 'Alerts', hash: '#/alerts', roles: ['admin'] },
      { id: 'admin', label: 'Admin', hash: '#/admin', roles: ['admin'] }
    ];

    const visibleItems = navItems.filter(item => item.roles.includes(role));

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    // Calculate sprint day
    const sprintStart = new Date('2026-03-31');
    const diffDays = Math.floor((today - sprintStart) / (1000 * 60 * 60 * 24)) + 1;
    const sprintDay = diffDays > 0 ? diffDays : 1;

    return `
      <div class="nav-topbar">
        <div class="nav-left">
          <div class="nav-logo">TRU</div>
          <div class="nav-brand">
            <div class="nav-title">PCI DSS v4.0 Evidence Tracker</div>
            <div class="nav-subtitle">iExperts Compliance Program</div>
          </div>
          <nav class="nav-links">
            ${visibleItems.map(item => `
              <a href="${item.hash}" class="nav-link ${activePage === item.id ? 'active' : ''}">${item.label}</a>
            `).join('')}
          </nav>
        </div>
        <div class="nav-right">
          <div class="nav-date">${dateStr}</div>
          <div class="nav-phase">Day ${sprintDay}</div>
          <div class="nav-user">
            <span class="nav-user-name">${displayName}</span>
            <span class="nav-user-role">${role}</span>
          </div>
          <button class="nav-logout" onclick="window.App.logout()">Logout</button>
        </div>
      </div>
    `;
  },

  /**
   * Get the CSS styles for the navigation
   */
  getStyles() {
    return `
      .nav-topbar {
        background: linear-gradient(135deg, #0f1b33 0%, #162040 50%, #1a1040 100%);
        border-bottom: 1px solid #2a3550;
        padding: 0 24px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 200;
        backdrop-filter: blur(12px);
      }

      .nav-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .nav-logo {
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #3b82f6, #06b6d4);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 13px;
        color: #fff;
        letter-spacing: -0.5px;
        box-shadow: 0 0 20px rgba(59,130,246,.3);
        flex-shrink: 0;
      }

      .nav-brand {
        margin-right: 16px;
      }

      .nav-title {
        font-size: 14px;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.3px;
        white-space: nowrap;
      }

      .nav-subtitle {
        font-size: 10px;
        color: #64748b;
        font-weight: 400;
      }

      .nav-links {
        display: flex;
        gap: 0;
      }

      .nav-link {
        color: #94a3b8;
        text-decoration: none;
        padding: 8px 14px;
        font-weight: 600;
        font-size: 12px;
        border-radius: 6px;
        transition: all 0.15s;
        white-space: nowrap;
      }

      .nav-link:hover {
        color: #f1f5f9;
        background: rgba(255,255,255,0.05);
      }

      .nav-link.active {
        color: #3b82f6;
        background: rgba(59,130,246,0.1);
      }

      .nav-right {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .nav-date {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 500;
        white-space: nowrap;
      }

      .nav-phase {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #000;
        padding: 4px 12px;
        border-radius: 16px;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }

      .nav-user {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .nav-user-name {
        font-size: 12px;
        font-weight: 600;
        color: #f1f5f9;
      }

      .nav-user-role {
        font-size: 9px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .nav-logout {
        background: transparent;
        border: 1px solid #2a3550;
        color: #94a3b8;
        padding: 6px 14px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s;
      }

      .nav-logout:hover {
        border-color: #3b82f6;
        color: #3b82f6;
      }

      @media (max-width: 1200px) {
        .nav-brand { display: none; }
        .nav-topbar { padding: 0 16px; }
      }

      @media (max-width: 900px) {
        .nav-date, .nav-user { display: none; }
      }
    `;
  }
};
