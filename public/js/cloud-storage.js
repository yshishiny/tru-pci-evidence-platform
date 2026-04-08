/**
 * Cloud Storage View - Evidence Sync Status
 * Shows local evidence and cloud-synced files for Dropbox and Google Drive
 */

window.CloudStorageView = {
  activeTab: 'local',
  localData: null,
  googleDriveData: null,
  dropboxData: null,

  /**
   * Render cloud storage page
   */
  async render() {
    const app = document.getElementById('app');

    const styles = `
      <style>
        .cloud-storage-container {
          background: #0a0e1a;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          padding: 2rem;
          min-height: 100vh;
        }

        .cloud-storage-header {
          margin-bottom: 2rem;
        }

        .cloud-storage-header h2 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 1rem 0;
        }

        .cloud-storage-header p {
          color: #94a3b8;
          margin: 0;
        }

        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .summary-card {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 8px;
          padding: 1.5rem;
          border-top: 3px solid #3b82f6;
        }

        .summary-card.synced-db { border-top-color: #10b981; }
        .summary-card.synced-gd { border-top-color: #06b6d4; }
        .summary-card.pending { border-top-color: #f59e0b; }

        .summary-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          font-weight: 600;
          letter-spacing: 0.1em;
        }

        .summary-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f1f5f9;
        }

        .tab-buttons {
          display: flex;
          gap: 0;
          margin-bottom: 2rem;
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 8px;
          overflow: hidden;
          width: fit-content;
        }

        .tab-button {
          padding: 0.75rem 1.5rem;
          background: transparent;
          color: #94a3b8;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }

        .tab-button:hover {
          color: #f1f5f9;
          background: #0f1419;
        }

        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          background: #0f1419;
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1.5rem;
          color: #f1f5f9;
        }

        .accordion {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .accordion-item {
          border-bottom: 1px solid #2a3550;
        }

        .accordion-item:last-child {
          border-bottom: none;
        }

        .accordion-header {
          padding: 1rem 1.5rem;
          background: #111827;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s;
        }

        .accordion-header:hover {
          background: #1a2236;
        }

        .accordion-header.open {
          background: #1a2236;
        }

        .accordion-title {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .accordion-badge {
          background: #3b82f6;
          color: white;
          border-radius: 4px;
          padding: 0.25rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .accordion-arrow {
          color: #64748b;
          transition: transform 0.2s;
        }

        .accordion-header.open .accordion-arrow {
          transform: rotate(180deg);
        }

        .accordion-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
        }

        .accordion-content.open {
          max-height: 2000px;
        }

        .accordion-body {
          padding: 0 1.5rem 1.5rem;
        }

        .file-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .file-card {
          background: #111827;
          border: 1px solid #2a3550;
          border-radius: 6px;
          padding: 1rem;
          transition: all 0.2s;
        }

        .file-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .file-card-name {
          font-weight: 600;
          color: #f1f5f9;
          margin-bottom: 0.5rem;
          word-break: break-word;
        }

        .file-card-meta {
          font-size: 0.8rem;
          color: #64748b;
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .file-card-status {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          background: #0f1419;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-dot.synced { background: #10b981; }
        .status-dot.pending { background: #f59e0b; }
        .status-dot.not-synced { background: #ef4444; }

        .file-card-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .file-card-button {
          padding: 0.5rem 0.75rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          flex: 1;
          min-width: 80px;
        }

        .file-card-button:hover {
          background: #2563eb;
        }

        .file-card-button.secondary {
          background: transparent;
          border: 1px solid #3b82f6;
          color: #3b82f6;
        }

        .file-card-button.secondary:hover {
          background: #1e3a8a;
          color: #60a5fa;
        }

        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          color: #64748b;
        }

        .empty-state-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-state-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        .empty-state-text {
          font-size: 0.9rem;
          color: #64748b;
        }

        .requirement-number {
          background: #3b82f6;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          font-weight: 700;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .tab-buttons {
            width: 100%;
          }

          .file-list {
            grid-template-columns: 1fr;
          }

          .cloud-storage-header h2 {
            font-size: 1.5rem;
          }
        }
      </style>
    `;

    app.innerHTML = `<style>${window.Nav.getStyles()}</style>` + styles + `
      ${window.Nav.render('cloud-storage')}
      <div class="cloud-storage-container">
        <div class="cloud-storage-header">
          <h2>Cloud Storage</h2>
          <p>View local evidence and cloud sync status</p>
        </div>

        <div id="summaryCards" class="summary-cards">
          <div class="summary-card">
            <div class="summary-label">Total Files</div>
            <div class="summary-value" id="totalFiles">--</div>
          </div>
          <div class="summary-card synced-db">
            <div class="summary-label">Synced to Dropbox</div>
            <div class="summary-value" id="dropboxFiles">--</div>
          </div>
          <div class="summary-card synced-gd">
            <div class="summary-label">Synced to Drive</div>
            <div class="summary-value" id="driveFiles">--</div>
          </div>
          <div class="summary-card pending">
            <div class="summary-label">Pending Sync</div>
            <div class="summary-value" id="pendingFiles">--</div>
          </div>
        </div>

        <div class="tab-buttons">
          <button class="tab-button active" data-tab="local">
            Local Evidence
          </button>
          <button class="tab-button" data-tab="drive">
            Google Drive
          </button>
          <button class="tab-button" data-tab="dropbox">
            Dropbox
          </button>
        </div>

        <div id="localTab" class="tab-content active">
          <div class="section-title">Local Evidence (Your Dropbox)</div>
          <div id="localContent">
            <div style="text-align: center; padding: 2rem; color: #64748b;">
              Loading local evidence...
            </div>
          </div>
        </div>

        <div id="driveTab" class="tab-content">
          <div class="section-title">Google Drive (Shared View)</div>
          <div id="driveContent">
            <div style="text-align: center; padding: 2rem; color: #64748b;">
              Loading Google Drive sync status...
            </div>
          </div>
        </div>

        <div id="dropboxTab" class="tab-content">
          <div class="section-title">Dropbox (Shared View)</div>
          <div id="dropboxContent">
            <div style="text-align: center; padding: 2rem; color: #64748b;">
              Loading Dropbox sync status...
            </div>
          </div>
        </div>
      </div>
    `;

    // Load data and setup
    await this.loadAllData();
    this.setupTabListeners();
    this.renderTabs();
  },

  /**
   * Load all data from APIs
   */
  async loadAllData() {
    try {
      // Load local files
      const localRes = await window.API.get('/cloud-sync/local-files');
      this.localData = localRes;

      // Load Google Drive sync
      const driveRes = await window.API.get('/cloud-sync/files?provider=google_drive');
      this.googleDriveData = driveRes;

      // Load Dropbox sync
      const dbRes = await window.API.get('/cloud-sync/files?provider=dropbox');
      this.dropboxData = dbRes;

      this.updateSummary();
    } catch (error) {
      console.error('Error loading cloud storage data:', error);
      window.App.toast('Failed to load cloud storage data', 'error');
    }
  },

  /**
   * Update summary cards
   */
  updateSummary() {
    let totalLocal = 0;
    let syncedDropbox = 0;
    let syncedDrive = 0;

    if (this.localData && this.localData.files) {
      totalLocal = this.localData.files.length;
    }

    if (this.dropboxData && this.dropboxData.files) {
      syncedDropbox = this.dropboxData.files.length;
    }

    if (this.googleDriveData && this.googleDriveData.files) {
      syncedDrive = this.googleDriveData.files.length;
    }

    const pending = Math.max(0, totalLocal - syncedDropbox - syncedDrive);

    document.getElementById('totalFiles').textContent = totalLocal;
    document.getElementById('dropboxFiles').textContent = syncedDropbox;
    document.getElementById('driveFiles').textContent = syncedDrive;
    document.getElementById('pendingFiles').textContent = pending;
  },

  /**
   * Setup tab click listeners
   */
  setupTabListeners() {
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Setup accordion listeners
    document.addEventListener('click', (e) => {
      if (e.target.closest('.accordion-header')) {
        const header = e.target.closest('.accordion-header');
        const item = header.closest('.accordion-item');
        const content = item.querySelector('.accordion-content');
        const isOpen = content.classList.contains('open');

        // Close all accordions in this tab
        item.closest('.accordion').querySelectorAll('.accordion-content').forEach(c => {
          c.classList.remove('open');
        });
        item.closest('.accordion').querySelectorAll('.accordion-header').forEach(h => {
          h.classList.remove('open');
        });

        // Open this one if it wasn't open
        if (!isOpen) {
          content.classList.add('open');
          header.classList.add('open');
        }
      }
    });
  },

  /**
   * Switch active tab
   */
  switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    const mapTabToId = {
      local: 'localTab',
      drive: 'driveTab',
      dropbox: 'dropboxTab'
    };

    document.getElementById(mapTabToId[tabName]).classList.add('active');
    this.activeTab = tabName;
  },

  /**
   * Render all tabs
   */
  renderTabs() {
    this.renderLocalTab();
    this.renderDriveTab();
    this.renderDropboxTab();
  },

  /**
   * Render local evidence tab
   */
  renderLocalTab() {
    const container = document.getElementById('localContent');

    if (!this.localData || !this.localData.grouped || Object.keys(this.localData.grouped).length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-title">No Local Evidence Found</div>
          <div class="empty-state-text">Evidence directory is empty or not accessible</div>
        </div>
      `;
      return;
    }

    let html = '<div class="accordion">';

    for (let reqId = 1; reqId <= 12; reqId++) {
      const files = this.localData.grouped[reqId] || [];
      const fileCount = files.length;

      if (fileCount === 0) continue;

      html += `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-title">
              <div class="requirement-number">${reqId}</div>
              <span>Requirement ${reqId}</span>
              <span class="accordion-badge">${fileCount} files</span>
            </div>
            <span class="accordion-arrow">▼</span>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${this.renderLocalFileList(files, reqId)}
            </div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Render local file list for a requirement
   */
  renderLocalFileList(files, reqId) {
    // Group by folder
    const grouped = {};
    files.forEach(file => {
      if (!grouped[file.folder_name]) {
        grouped[file.folder_name] = [];
      }
      grouped[file.folder_name].push(file);
    });

    let html = '<div class="file-list">';

    for (const [folderName, folderFiles] of Object.entries(grouped)) {
      // Check if any files from this folder are synced
      const dbSynced = this.dropboxData?.files?.some(f =>
        f.requirement_id === reqId && f.folder_name === folderName
      ) || false;

      const driveSynced = this.googleDriveData?.files?.some(f =>
        f.requirement_id === reqId && f.folder_name === folderName
      ) || false;

      let statusDot = 'not-synced';
      let statusText = 'Not Synced';
      if (dbSynced && driveSynced) {
        statusDot = 'synced';
        statusText = 'Synced (Both)';
      } else if (dbSynced || driveSynced) {
        statusDot = 'pending';
        statusText = dbSynced ? 'Synced (Dropbox)' : 'Synced (Drive)';
      }

      html += `
        <div class="file-card">
          <div class="file-card-name">${folderName}</div>
          <div class="file-card-meta">
            <div>Files: ${folderFiles.length}</div>
            <div>Size: ${this.formatSize(folderFiles.reduce((sum, f) => sum + (f.size || 0), 0))}</div>
          </div>
          <div class="file-card-status">
            <div class="status-dot ${statusDot}"></div>
            <span>${statusText}</span>
          </div>
          <div class="file-card-actions">
            <button class="file-card-button secondary" onclick="alert('View files in: ${folderName}')">
              View Files
            </button>
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * Render Google Drive tab
   */
  renderDriveTab() {
    const container = document.getElementById('driveContent');

    if (!this.googleDriveData || !this.googleDriveData.grouped || Object.keys(this.googleDriveData.grouped).length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚀</div>
          <div class="empty-state-title">No Google Drive Syncs</div>
          <div class="empty-state-text">No evidence has been synced to Google Drive yet. Run a full sync from Admin > Cloud Sync Settings.</div>
        </div>
      `;
      return;
    }

    let html = '<div class="accordion">';

    for (let reqId = 1; reqId <= 12; reqId++) {
      const files = this.googleDriveData.grouped[reqId] || [];
      const fileCount = files.length;

      if (fileCount === 0) continue;

      html += `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-title">
              <div class="requirement-number">${reqId}</div>
              <span>Requirement ${reqId}</span>
              <span class="accordion-badge">${fileCount} files</span>
            </div>
            <span class="accordion-arrow">▼</span>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${this.renderDriveFileList(files)}
            </div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Render Google Drive file list
   */
  renderDriveFileList(files) {
    let html = '<div class="file-list">';

    files.forEach(file => {
      const lastSynced = file.last_synced ? new Date(file.last_synced).toLocaleDateString() : 'Never';

      html += `
        <div class="file-card">
          <div class="file-card-name">${file.folder_name}</div>
          <div class="file-card-meta">
            <div>Last Synced: ${lastSynced}</div>
            <div>Status: ${file.status}</div>
            ${file.file_hash ? `<div>Hash: ${file.file_hash.substring(0, 8)}...</div>` : ''}
          </div>
          <div class="file-card-status">
            <div class="status-dot synced"></div>
            <span>Synced</span>
          </div>
          <div class="file-card-actions">
            ${file.drive_link ? `
              <a href="${file.drive_link}" target="_blank" class="file-card-button" style="text-decoration: none; display: flex; align-items: center; justify-content: center;">
                Open in Drive
              </a>
            ` : `
              <button class="file-card-button" disabled>No Link</button>
            `}
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  /**
   * Render Dropbox tab
   */
  renderDropboxTab() {
    const container = document.getElementById('dropboxContent');

    if (!this.dropboxData || !this.dropboxData.grouped || Object.keys(this.dropboxData.grouped).length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚀</div>
          <div class="empty-state-title">No Dropbox Syncs</div>
          <div class="empty-state-text">No evidence has been synced to Dropbox yet. Run a full sync from Admin > Cloud Sync Settings.</div>
        </div>
      `;
      return;
    }

    let html = '<div class="accordion">';

    for (let reqId = 1; reqId <= 12; reqId++) {
      const files = this.dropboxData.grouped[reqId] || [];
      const fileCount = files.length;

      if (fileCount === 0) continue;

      html += `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-title">
              <div class="requirement-number">${reqId}</div>
              <span>Requirement ${reqId}</span>
              <span class="accordion-badge">${fileCount} files</span>
            </div>
            <span class="accordion-arrow">▼</span>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${this.renderDropboxFileList(files)}
            </div>
          </div>
        </div>
      `;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * Render Dropbox file list
   */
  renderDropboxFileList(files) {
    let html = '<div class="file-list">';

    files.forEach(file => {
      const lastSynced = file.last_synced ? new Date(file.last_synced).toLocaleDateString() : 'Never';

      html += `
        <div class="file-card">
          <div class="file-card-name">${file.folder_name}</div>
          <div class="file-card-meta">
            <div>Path: ${file.dropbox_path || 'N/A'}</div>
            <div>Last Synced: ${lastSynced}</div>
            <div>Status: ${file.status}</div>
            ${file.file_hash ? `<div>Hash: ${file.file_hash.substring(0, 8)}...</div>` : ''}
          </div>
          <div class="file-card-status">
            <div class="status-dot synced"></div>
            <span>Synced</span>
          </div>
          <div class="file-card-actions">
            ${file.dropbox_link ? `
              <a href="${file.dropbox_link}" target="_blank" class="file-card-button" style="text-decoration: none; display: flex; align-items: center; justify-content: center;">
                Open in Dropbox
              </a>
            ` : `
              <button class="file-card-button" disabled>No Link</button>
            `}
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  },

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
};
