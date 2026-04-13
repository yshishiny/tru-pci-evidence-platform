/**
 * Reports View - Daily HTML Report Snapshots
 * Lists, previews, and generates daily evidence status reports
 */

window.ReportsView = {
  currentReports: [],
  selectedReport: null,

  /**
   * Render reports section
   */
  async render() {
    const app = document.getElementById('app');

    const styles = `
      <style>
        .reports-container {
          background: #0a0e1a;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          padding: 2rem;
          min-height: 100vh;
        }

        .reports-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .reports-header h2 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0;
        }

        .generate-btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .generate-btn:hover {
          background: #2563eb;
        }

        .generate-btn:disabled {
          background: #64748b;
          cursor: not-allowed;
        }

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .report-card {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 12px;
          padding: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .report-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          border-color: #3b82f6;
        }

        .report-date {
          font-size: 1.1rem;
          font-weight: 600;
          color: #3b82f6;
          margin-bottom: 0.5rem;
        }

        .report-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          font-size: 0.85rem;
          margin: 1rem 0;
        }

        .report-stat {
          background: #0f1419;
          padding: 0.75rem;
          border-radius: 6px;
        }

        .report-stat-label {
          color: #94a3b8;
          font-size: 0.75rem;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .report-stat-value {
          color: #f1f5f9;
          font-weight: 600;
          font-size: 1rem;
        }

        .report-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .report-btn {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #2a3550;
          background: transparent;
          color: #3b82f6;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          transition: all 0.2s;
        }

        .report-btn:hover {
          background: #2a3550;
          border-color: #3b82f6;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 12px;
          max-width: 90vw;
          max-height: 90vh;
          overflow: auto;
          position: relative;
        }

        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: transparent;
          border: none;
          color: #f1f5f9;
          font-size: 1.5rem;
          cursor: pointer;
          z-index: 1001;
        }

        .report-iframe {
          width: 100%;
          height: 100%;
          border: none;
          display: block;
        }

        .loading {
          text-align: center;
          color: #64748b;
          padding: 2rem;
        }

        .no-reports {
          background: #1a2236;
          border: 1px dashed #2a3550;
          border-radius: 12px;
          padding: 3rem;
          text-align: center;
          color: #94a3b8;
        }

        .admin-only {
          opacity: 1;
        }

        .not-admin {
          opacity: 0.5;
          pointer-events: none;
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
            <li><a href="#/reports" style="color: #3b82f6; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem; border-bottom: 2px solid #3b82f6;">Reports</a></li>
            ${isAdmin ? '<li><a href="#/review" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Review</a></li>' : ''}
            ${isAdmin ? '<li><a href="#/alerts" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Alerts</a></li>' : ''}
            ${isAdmin ? '<li><a href="#/admin" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Admin</a></li>' : ''}
          </ul>
        </div>
        <button id="logoutBtn" style="background: transparent; border: 1px solid #2a3550; color: #3b82f6; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Logout</button>
      </div>
      <div class="reports-container">
        <div class="reports-header">
          <h2>Daily Reports</h2>
          <button class="generate-btn ${isAdmin ? 'admin-only' : 'not-admin'}" id="generateReportBtn" ${!isAdmin ? 'disabled' : ''}>
            Generate Today's Report
          </button>
        </div>

        <div id="reportsGrid" class="reports-grid">
          <div class="loading">Loading reports...</div>
        </div>

        <div id="reportModal" class="modal-overlay" style="display: none;">
          <div class="modal">
            <button class="modal-close" id="modalCloseBtn">✕</button>
            <div id="modalContent"></div>
          </div>
        </div>
      </div>
    `;

    // Load reports
    await this.loadReports();

    // Event listeners
    document.getElementById('logoutBtn').addEventListener('click', () => {
      window.App.logout();
    });

    if (isAdmin) {
      document.getElementById('generateReportBtn').addEventListener('click', () => this.generateReport());
    }

    document.getElementById('modalCloseBtn').addEventListener('click', () => {
      document.getElementById('reportModal').style.display = 'none';
    });

    document.getElementById('reportModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('reportModal')) {
        document.getElementById('reportModal').style.display = 'none';
      }
    });
  },

  /**
   * Load all reports
   */
  async loadReports() {
    try {
      const response = await fetch('/api/reports?limit=50', {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load reports');

      const data = await response.json();
      this.currentReports = data.reports;

      this.renderReportsList();
    } catch (err) {
      console.error('Load reports error:', err);
      document.getElementById('reportsGrid').innerHTML = `
        <div class="no-reports">
          <p>Failed to load reports</p>
          <p style="font-size: 0.85rem;">${err.message}</p>
        </div>
      `;
    }
  },

  /**
   * Render reports list
   */
  renderReportsList() {
    const grid = document.getElementById('reportsGrid');

    if (this.currentReports.length === 0) {
      grid.innerHTML = `
        <div class="no-reports" style="grid-column: 1 / -1;">
          <p style="margin: 0 0 0.5rem 0;">No reports generated yet</p>
          <p style="font-size: 0.85rem; color: #64748b;">Generate your first daily report to see it here</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.currentReports.map(report => `
      <div class="report-card" data-id="${report.id}">
        <div class="report-date">${new Date(report.report_date).toLocaleDateString()}</div>
        <div class="report-stats">
          <div class="report-stat">
            <div class="report-stat-label">Total</div>
            <div class="report-stat-value">${report.total}</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-label">Completed</div>
            <div class="report-stat-value">${report.filled}</div>
          </div>
        </div>
        <div style="background: #0f1419; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;">
          <div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.5rem;">Progress</div>
          <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;">${report.percentage}%</div>
        </div>
        <div class="report-actions">
          <button class="report-btn view-btn" data-id="${report.id}">View Report</button>
          <button class="report-btn download-btn" data-id="${report.id}">Download</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    grid.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewReport(btn.dataset.id);
      });
    });

    grid.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadReport(btn.dataset.id);
      });
    });
  },

  /**
   * View report in modal
   */
  async viewReport(reportId) {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load report');

      const data = await response.json();

      const modal = document.getElementById('reportModal');
      const content = document.getElementById('modalContent');

      // Create iframe with report HTML
      const iframe = document.createElement('iframe');
      iframe.className = 'report-iframe';
      iframe.style.height = '80vh';

      content.innerHTML = '';
      content.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.write(data.html_content);
      doc.close();

      modal.style.display = 'flex';
    } catch (err) {
      console.error('View report error:', err);
      window.App.toast(`Failed to load report: ${err.message}`, 'error');
    }
  },

  /**
   * Download report as HTML file
   */
  async downloadReport(reportId) {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load report');

      const data = await response.json();

      // Create blob and download
      const blob = new Blob([data.html_content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TRU-PCI-Report-${data.report_date}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.App.toast('Report downloaded successfully', 'success');
    } catch (err) {
      console.error('Download report error:', err);
      window.App.toast(`Failed to download report: ${err.message}`, 'error');
    }
  },

  /**
   * Generate today's report
   */
  async generateReport() {
    const btn = document.getElementById('generateReportBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.API.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 409) {
        // Report already exists for today
        const data = await response.json();
        const override = confirm('Report already exists for today. Generate a new one?');
        if (!override) {
          btn.disabled = false;
          btn.textContent = 'Generate Today\'s Report';
          return;
        }

        // Regenerate
        const retryResponse = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${window.API.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ force: true })
        });

        if (!retryResponse.ok) throw new Error('Failed to regenerate report');
      } else if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      window.App.toast('Report generated successfully', 'success');
      await this.loadReports();
    } catch (err) {
      console.error('Generate report error:', err);
      window.App.toast(`Failed to generate report: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate Today\'s Report';
    }
  }
};
