/**
 * Alerts View - Email Alert System
 * SMTP configuration, alert sending, and history tracking
 */

window.AlertsView = {
  smtpConfig: null,
  alertHistory: [],
  users: [],

  /**
   * Render alerts section
   */
  async render() {
    const app = document.getElementById('app');

    const styles = `
      <style>
        .alerts-container {
          background: #0a0e1a;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          padding: 2rem;
          min-height: 100vh;
        }

        .alerts-header {
          margin-bottom: 2rem;
        }

        .alerts-header h2 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
        }

        .alerts-header p {
          color: #94a3b8;
          margin: 0;
        }

        .tabs {
          display: flex;
          gap: 0;
          margin-bottom: 2rem;
          border-bottom: 1px solid #2a3550;
        }

        .tab {
          padding: 1rem 1.5rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #f1f5f9;
        }

        .tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        .form-section {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 12px;
          padding: 2rem;
          margin-bottom: 2rem;
        }

        .form-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
          color: #f1f5f9;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: #f1f5f9;
          margin-bottom: 0.5rem;
        }

        .form-input,
        .form-select,
        .form-textarea {
          background: #0f1419;
          border: 1px solid #2a3550;
          color: #f1f5f9;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.9rem;
          font-family: inherit;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-hint {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #64748b;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          border: 1px solid #2a3550;
          color: #3b82f6;
        }

        .btn-secondary:hover {
          background: #2a3550;
        }

        .btn-success {
          background: #10b981;
          color: white;
        }

        .btn-success:hover {
          background: #059669;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .status-configured {
          background: #d1fae5;
          color: #065f46;
        }

        .status-not-configured {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-sent {
          background: #d1fae5;
          color: #065f46;
        }

        .status-failed {
          background: #fee2e2;
          color: #991b1b;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .history-table th {
          background: #1a2236;
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: #f1f5f9;
          border-bottom: 1px solid #2a3550;
        }

        .history-table td {
          padding: 1rem;
          border-bottom: 1px solid #2a3550;
        }

        .history-table tr:hover {
          background: #0f1419;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          color: #94a3b8;
        }

        .empty-state-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .evidence-selector {
          background: #0f1419;
          border: 1px solid #2a3550;
          border-radius: 6px;
          max-height: 300px;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .evidence-option {
          padding: 0.5rem;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #1a2236;
          cursor: pointer;
        }

        .evidence-option:last-child {
          border-bottom: none;
        }

        .evidence-option:hover {
          background: #1a2236;
        }

        .evidence-option input {
          margin-right: 0.75rem;
          cursor: pointer;
        }

        .success-message {
          background: #d1fae5;
          color: #065f46;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          border-left: 4px solid #10b981;
        }

        .error-message {
          background: #fee2e2;
          color: #991b1b;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          border-left: 4px solid #ef4444;
        }
      </style>
    `;

    const isAdmin = window.App.currentUser?.role === 'admin';

    app.innerHTML = styles + `
      <div class="topbar" style="background: #1a2236; border-bottom: 1px solid #2a3550; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center;">
        <div class="topbar-left" style="display: flex; align-items: center; gap: 2rem;">
          <div style="font-size: 1.25rem; font-weight: 700; color: #3b82f6;">TRU</div>
          <ul style="list-style: none; margin: 0; padding: 0; display: flex; gap: 0;">
            <li><a href="#/dashboard" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Dashboard</a></li>
            <li><a href="#/reports" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Reports</a></li>
            <li><a href="#/review" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Review</a></li>
            <li><a href="#/alerts" style="color: #3b82f6; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem; border-bottom: 2px solid #3b82f6;">Alerts</a></li>
            <li><a href="#/admin" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Admin</a></li>
          </ul>
        </div>
        <button id="logoutBtn" style="background: transparent; border: 1px solid #2a3550; color: #3b82f6; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Logout</button>
      </div>
      <div class="alerts-container">
        <div class="alerts-header">
          <h2>Email Alerts</h2>
          <p>Configure SMTP settings and send email notifications to team members</p>
        </div>

        <div class="tabs">
          <button class="tab active" data-tab="config">Configuration</button>
          <button class="tab" data-tab="send">Send Alerts</button>
          <button class="tab" data-tab="history">History</button>
        </div>

        <!-- Configuration Tab -->
        <div id="configTab" class="tab-content active">
          <div class="form-section">
            <div class="form-title">SMTP Configuration</div>
            <div id="configStatus"></div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">SMTP Host</label>
                <input type="text" id="smtpHost" class="form-input" placeholder="e.g., smtp.gmail.com" ${!isAdmin ? 'disabled' : ''}>
              </div>
              <div class="form-group">
                <label class="form-label">SMTP Port</label>
                <input type="number" id="smtpPort" class="form-input" placeholder="587" ${!isAdmin ? 'disabled' : ''}>
              </div>
              <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" id="smtpUser" class="form-input" placeholder="your-email@example.com" ${!isAdmin ? 'disabled' : ''}>
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="smtpPass" class="form-input" placeholder="••••••••" ${!isAdmin ? 'disabled' : ''}>
                <div class="form-hint">Password will not be displayed after saving</div>
              </div>
              <div class="form-group">
                <label class="form-label">From Email</label>
                <input type="email" id="smtpFrom" class="form-input" placeholder="noreply@example.com" ${!isAdmin ? 'disabled' : ''}>
              </div>
              <div class="form-group">
                <label class="form-label">Use TLS/SSL</label>
                <select id="smtpSecure" class="form-select" ${!isAdmin ? 'disabled' : ''}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
            <div class="button-group">
              <button class="btn btn-primary" id="saveConfigBtn" ${!isAdmin ? 'disabled' : ''}>Save Configuration</button>
              <button class="btn btn-secondary" id="testConfigBtn" ${!isAdmin ? 'disabled' : ''}>Test Connection</button>
            </div>
          </div>
        </div>

        <!-- Send Alerts Tab -->
        <div id="sendTab" class="tab-content">
          <div class="form-section">
            <div class="form-title">Send Email Alert</div>
            <div class="form-grid">
              <div class="form-group" style="grid-column: 1 / -1;">
                <label class="form-label">Recipient</label>
                <select id="recipientSelect" class="form-select" ${!isAdmin ? 'disabled' : ''}>
                  <option value="">Select a team member...</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
              <label class="form-label">Evidence Items</label>
              <div class="evidence-selector" id="evidenceList">
                <div style="padding: 1rem; color: #94a3b8; text-align: center;">Loading evidence...</div>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Deadline</label>
                <input type="text" id="deadline" class="form-input" placeholder="e.g., 7 days" value="7 days" ${!isAdmin ? 'disabled' : ''}>
              </div>
            </div>

            <div class="button-group">
              <button class="btn btn-primary" id="sendAlertBtn" ${!isAdmin ? 'disabled' : ''}>Send Alert</button>
              <button class="btn btn-success" id="sendBulkBtn" ${!isAdmin ? 'disabled' : ''}>Send to All with Pending Items</button>
            </div>
          </div>
        </div>

        <!-- History Tab -->
        <div id="historyTab" class="tab-content">
          <div id="historyContent" style="background: #1a2236; border: 1px solid #2a3550; border-radius: 12px; overflow: hidden;">
            <div class="empty-state">
              <div class="empty-state-icon">📧</div>
              <p>Loading alert history...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load initial data
    await this.loadSMTPConfig();
    await this.loadAlertHistory();
    await this.loadUsers();
    await this.loadEvidenceList();

    // Setup logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      window.App.logout();
    });

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
      });
    });

    // Event listeners (only if admin)
    if (isAdmin) {
      document.getElementById('saveConfigBtn').addEventListener('click', () => this.saveConfig());
      document.getElementById('testConfigBtn').addEventListener('click', () => this.testConfig());
      document.getElementById('sendAlertBtn').addEventListener('click', () => this.sendAlert());
      document.getElementById('sendBulkBtn').addEventListener('click', () => this.sendBulkAlerts());
      document.getElementById('recipientSelect').addEventListener('change', () => this.onRecipientChange());
    }
  },

  /**
   * Load SMTP configuration
   */
  async loadSMTPConfig() {
    try {
      const response = await fetch('/api/alerts/config', {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.smtpConfig = data;

        if (data.configured) {
          document.getElementById('smtpHost').value = data.host || '';
          document.getElementById('smtpPort').value = data.port || '';
          document.getElementById('smtpUser').value = data.user || '';
          document.getElementById('smtpFrom').value = data.from_email || '';
          document.getElementById('smtpSecure').value = data.secure ? 'true' : 'false';
          document.getElementById('smtpPass').value = '';

          const statusEl = document.getElementById('configStatus');
          statusEl.innerHTML = `
            <div class="success-message">
              ✓ SMTP configuration is ${data.is_active ? 'active' : 'inactive'}
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('Load SMTP config error:', err);
    }
  },

  /**
   * Save SMTP configuration
   */
  async saveConfig() {
    const btn = document.getElementById('saveConfigBtn');
    btn.disabled = true;

    try {
      const response = await fetch('/api/alerts/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.API.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: document.getElementById('smtpHost').value,
          port: document.getElementById('smtpPort').value,
          user: document.getElementById('smtpUser').value,
          pass: document.getElementById('smtpPass').value,
          from_email: document.getElementById('smtpFrom').value,
          secure: document.getElementById('smtpSecure').value === 'true'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || data.error);
      }

      window.App.toast('SMTP configuration saved', 'success');
      document.getElementById('smtpPass').value = '';
      await this.loadSMTPConfig();
    } catch (err) {
      window.App.toast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  },

  /**
   * Test SMTP connection
   */
  async testConfig() {
    window.App.toast('Connection test would send a test email (not implemented in mock)', 'info');
  },

  /**
   * Load users for recipient selection
   */
  async loadUsers() {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.users = data.users;

        const select = document.getElementById('recipientSelect');
        this.users.forEach(user => {
          if (user.email) {
            const option = document.createElement('option');
            option.value = JSON.stringify({ email: user.email, name: user.display_name });
            option.textContent = `${user.display_name} (${user.email})`;
            select.appendChild(option);
          }
        });
      }
    } catch (err) {
      console.error('Load users error:', err);
    }
  },

  /**
   * Load evidence list
   */
  async loadEvidenceList() {
    try {
      const response = await fetch('/api/evidence?status=empty,uploaded,under_review', {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const evidenceList = document.getElementById('evidenceList');

        if (data.evidence_points.length === 0) {
          evidenceList.innerHTML = '<div style="padding: 1rem; color: #94a3b8; text-align: center;">No pending evidence</div>';
          return;
        }

        evidenceList.innerHTML = data.evidence_points.slice(0, 20).map(ep => `
          <div class="evidence-option">
            <input type="checkbox" class="evidence-checkbox" data-id="${ep.id}" data-req="${ep.requirement_id}">
            <label style="flex: 1; cursor: pointer; margin: 0;">
              Req ${ep.requirement_id}: ${ep.folder_name} (${ep.status})
            </label>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Load evidence error:', err);
    }
  },

  /**
   * Load alert history
   */
  async loadAlertHistory() {
    try {
      const response = await fetch('/api/alerts/history?limit=50', {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        if (data.history.length === 0) {
          document.getElementById('historyContent').innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon">📭</div>
              <p>No alerts sent yet</p>
            </div>
          `;
          return;
        }

        let html = '<table class="history-table"><thead><tr><th>Date</th><th>Recipient</th><th>Subject</th><th>Status</th></tr></thead><tbody>';
        data.history.forEach(alert => {
          html += `
            <tr>
              <td>${new Date(alert.sent_at).toLocaleString()}</td>
              <td>${alert.recipient_name || alert.recipient_email}</td>
              <td>${alert.subject}</td>
              <td><span class="status-badge status-${alert.status}">${alert.status}</span></td>
            </tr>
          `;
        });
        html += '</tbody></table>';

        document.getElementById('historyContent').innerHTML = html;
      }
    } catch (err) {
      console.error('Load alert history error:', err);
    }
  },

  /**
   * Handle recipient change
   */
  onRecipientChange() {
    // Could filter evidence list by assignee here
  },

  /**
   * Send alert to selected recipient
   */
  async sendAlert() {
    const recipientValue = document.getElementById('recipientSelect').value;
    if (!recipientValue) {
      window.App.toast('Please select a recipient', 'error');
      return;
    }

    const recipient = JSON.parse(recipientValue);
    const selectedEvidenceIds = Array.from(
      document.querySelectorAll('.evidence-checkbox:checked')
    ).map(cb => parseInt(cb.dataset.id));

    if (selectedEvidenceIds.length === 0) {
      window.App.toast('Please select at least one evidence item', 'error');
      return;
    }

    const btn = document.getElementById('sendAlertBtn');
    btn.disabled = true;

    try {
      const response = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.API.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_email: recipient.email,
          recipient_name: recipient.name,
          evidence_ids: selectedEvidenceIds,
          deadline: document.getElementById('deadline').value
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || data.error);
      }

      window.App.toast('Alert sent successfully', 'success');
      document.getElementById('recipientSelect').value = '';
      document.querySelectorAll('.evidence-checkbox').forEach(cb => cb.checked = false);
      await this.loadAlertHistory();
    } catch (err) {
      window.App.toast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  },

  /**
   * Send bulk alerts
   */
  async sendBulkAlerts() {
    const btn = document.getElementById('sendBulkBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const response = await fetch('/api/alerts/send-bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.API.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deadline: document.getElementById('deadline').value
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.details || data.error);
      }

      const data = await response.json();
      window.App.toast(`Alerts sent to ${data.sent} users`, 'success');
      await this.loadAlertHistory();
    } catch (err) {
      window.App.toast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send to All with Pending Items';
    }
  }
};
