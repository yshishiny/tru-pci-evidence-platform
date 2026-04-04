/**
 * Cloud Sync UI Component
 * Manages Google Drive and Dropbox synchronization
 */

window.CloudSyncModule = {
  currentProvider: 'google_drive',
  syncInProgress: false,

  /**
   * Initialize the cloud sync panel
   */
  async init() {
    this.setupEventListeners();
    await this.loadStatus();
  },

  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Provider tab switching
    document.querySelectorAll('.cloud-sync-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const button = e.currentTarget;
        this.switchProvider(button.dataset.provider);
      });
    });

    // Google Drive config form
    const gdConfigForm = document.getElementById('gd-config-form');
    if (gdConfigForm) {
      gdConfigForm.addEventListener('submit', (e) => this.saveGoogleDriveConfig(e));
    }

    // Dropbox config form
    const dbConfigForm = document.getElementById('db-config-form');
    if (dbConfigForm) {
      dbConfigForm.addEventListener('submit', (e) => this.saveDropboxConfig(e));
    }

    // Sync buttons
    document.getElementById('gd-sync-btn')?.addEventListener('click', () => this.triggerSync('google_drive'));
    document.getElementById('db-sync-btn')?.addEventListener('click', () => this.triggerSync('dropbox'));
  },

  /**
   * Switch between Google Drive and Dropbox tabs
   */
  switchProvider(provider) {
    this.currentProvider = provider;

    // Update tab active state
    document.querySelectorAll('.cloud-sync-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.provider === provider);
    });

    // Update panel visibility
    document.querySelectorAll('.cloud-sync-content').forEach(content => {
      content.style.display = content.id.startsWith('gd-') && provider === 'google_drive'
        ? 'block'
        : content.id.startsWith('db-') && provider === 'dropbox'
          ? 'block'
          : 'none';
    });

    this.loadStatus();
  },

  /**
   * Load sync status from server
   */
  async loadStatus() {
    try {
      const response = await fetch(
        `/api/cloud-sync/status?provider=${this.currentProvider}`,
        {
          headers: { 'Authorization': `Bearer ${window.API.token}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load status');
      }

      const data = await response.json();
      this.displayStatus(data.status);
    } catch (err) {
      console.error('Error loading status:', err);
    }
  },

  /**
   * Display sync status
   */
  displayStatus(status) {
    const prefix = this.currentProvider === 'google_drive' ? 'gd' : 'db';
    const statusDiv = document.getElementById(`${prefix}-status`);
    if (!statusDiv) return;

    const lastSyncTime = status.lastSyncTime
      ? new Date(status.lastSyncTime).toLocaleString()
      : 'Never';

    statusDiv.innerHTML = `
      <div class="status-info">
        <p><strong>Last Sync:</strong> ${lastSyncTime}</p>
        <p><strong>Files Synced:</strong> ${status.totalSyncedFiles}</p>
        <p><strong>Errors:</strong> ${status.syncErrors}</p>
      </div>
    `;
  },

  /**
   * Save Google Drive configuration
   */
  async saveGoogleDriveConfig(e) {
    e.preventDefault();

    const folderId = document.getElementById('gd-folder-id').value?.trim();
    const credentialsJson = document.getElementById('gd-credentials-json').value?.trim();
    const activate = document.getElementById('gd-activate').checked;

    if (!folderId || !credentialsJson) {
      window.App.toast('Please fill in the Folder ID and paste the Service Account JSON key', 'error');
      return;
    }

    // Validate the JSON
    try {
      JSON.parse(credentialsJson);
    } catch (e) {
      window.App.toast('The Service Account JSON is not valid. Please paste the entire contents of the downloaded .json key file.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/cloud-sync/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.API.token}`
        },
        body: JSON.stringify({
          provider: 'google_drive',
          config_data: {
            parent_folder_id: folderId,
            credentials_json: credentialsJson,
            auth_type: 'service_account'
          },
          activate
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save configuration');
      }

      window.App.toast('Google Drive configuration saved successfully', 'success');
      if (activate) {
        await this.loadStatus();
      }
    } catch (err) {
      console.error('Error saving Google Drive config:', err);
      window.App.toast(err.message, 'error');
    }
  },

  /**
   * Save Dropbox configuration
   */
  async saveDropboxConfig(e) {
    e.preventDefault();

    const accessToken = document.getElementById('db-access-token').value?.trim();
    const parentPath = document.getElementById('db-parent-path').value?.trim();
    const activate = document.getElementById('db-activate').checked;

    if (!accessToken || !parentPath) {
      window.App.toast('Please fill in all Dropbox configuration fields', 'error');
      return;
    }

    try {
      const response = await fetch('/api/cloud-sync/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.API.token}`
        },
        body: JSON.stringify({
          provider: 'dropbox',
          config_data: {
            access_token: accessToken,
            parent_path: parentPath
          },
          activate
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save configuration');
      }

      window.App.toast('Dropbox configuration saved successfully', 'success');
      if (activate) {
        await this.loadStatus();
      }
    } catch (err) {
      console.error('Error saving Dropbox config:', err);
      window.App.toast(err.message, 'error');
    }
  },

  /**
   * Trigger a full sync
   */
  async triggerSync(provider) {
    if (this.syncInProgress) {
      window.App.toast('Sync already in progress', 'error');
      return;
    }

    const providerName = provider === 'google_drive' ? 'Google Drive' : 'Dropbox';
    if (!confirm(`Start ${providerName} sync? This may take a few minutes.`)) {
      return;
    }

    this.syncInProgress = true;
    const prefix = provider === 'google_drive' ? 'gd' : 'db';
    const syncBtn = document.getElementById(`${prefix}-sync-btn`);
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Syncing...';
    }

    try {
      const response = await fetch('/api/cloud-sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.API.token}`
        },
        body: JSON.stringify({ provider })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Sync failed');
      }

      const data = await response.json();
      window.App.toast(
        `Sync complete: ${data.stats.uploaded} uploaded, ${data.stats.updated} updated, ${data.stats.skipped} skipped`,
        'success'
      );
      await this.loadStatus();
    } catch (err) {
      console.error('Error triggering sync:', err);
      window.App.toast(err.message, 'error');
    } finally {
      this.syncInProgress = false;
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = `Sync ${providerName}`;
      }
    }
  },

  /**
   * Get cloud sync link for evidence file
   */
  async getCloudLink(evidenceId, provider) {
    try {
      const response = await fetch(
        `/api/cloud-sync/link/${evidenceId}?provider=${provider}`,
        {
          headers: { 'Authorization': `Bearer ${window.API.token}` }
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get link');
      }

      const data = await response.json();
      return data.link;
    } catch (err) {
      console.error('Error getting cloud link:', err);
      return null;
    }
  }
};

// Initialize when DOM is ready and cloud-sync-panel exists
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('cloud-sync-panel')) {
    window.CloudSyncModule.init();
  }
});
