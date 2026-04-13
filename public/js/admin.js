/**
 * Admin Panel
 * Administrative interface for users, scans, and audit logs
 */

window.AdminView = {
    activeTab: 'users',
    users: [],
    scanResults: null,
    auditLogs: [],

    /**
     * Render admin panel
     */
    async render() {
        const app = document.getElementById('app');

        // Show loading state
        app.innerHTML = `
            <style>${window.Nav.getStyles()}</style>
            ${window.Nav.render('admin')}
            <div class="admin-panel">
                <div class="loading-container">
                    <div class="spinner"></div>
                </div>
            </div>
        `;

        // Setup user info (nav handles logout)
        await this.setupUserInfo();

        try {
            // Load data
            await this.loadData();
            this.renderContent();
        } catch (error) {
            window.App.toast('Failed to load admin panel: ' + error.message, 'error');
            document.querySelector('.admin-panel').innerHTML = `
                <div style="padding: 2rem; color: var(--color-text-secondary);">
                    Error loading admin panel. <a href="#/dashboard">Go back to dashboard</a>
                </div>
            `;
        }
    },

    /**
     * Setup user info
     */
    async setupUserInfo() {
        try {
            const user = await window.API.getCurrentUser();
            // User info now displayed in shared nav component
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    },

    /**
     * Load data for all tabs
     */
    async loadData() {
        try {
            const usersResp = await window.API.getUsers();
            this.users = usersResp.users || usersResp || [];
            const auditResp = await window.API.getAuditLog();
            this.auditLogs = auditResp.entries || auditResp || [];
        } catch (error) {
            console.error('Failed to load admin data:', error);
        }
    },

    /**
     * Render content
     */
    renderContent() {
        const container = document.querySelector('.admin-panel');
        container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.innerHTML = '<h1 class="dashboard-title">Administration</h1>';
        container.appendChild(header);

        // Tabs
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'admin-tabs';
        tabsDiv.innerHTML = `
            <div class="admin-tab active" data-tab="users">Users</div>
            <div class="admin-tab" data-tab="scan">Folder Scan</div>
            <div class="admin-tab" data-tab="cloud">Cloud Sync</div>
            <div class="admin-tab" data-tab="audit">Audit Log</div>
        `;
        container.appendChild(tabsDiv);

        // Tab content
        const usersContent = document.createElement('div');
        usersContent.className = 'admin-content active';
        usersContent.id = 'users-content';
        usersContent.appendChild(this.renderUsersTab());
        container.appendChild(usersContent);

        const scanContent = document.createElement('div');
        scanContent.className = 'admin-content';
        scanContent.id = 'scan-content';
        scanContent.appendChild(this.renderScanTab());
        container.appendChild(scanContent);

        const cloudContent = document.createElement('div');
        cloudContent.className = 'admin-content';
        cloudContent.id = 'cloud-content';
        cloudContent.appendChild(this.renderCloudSyncTab());
        container.appendChild(cloudContent);

        const auditContent = document.createElement('div');
        auditContent.className = 'admin-content';
        auditContent.id = 'audit-content';
        auditContent.appendChild(this.renderAuditTab());
        container.appendChild(auditContent);

        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    },

    /**
     * Switch tab
     */
    switchTab(tabName) {
        this.activeTab = tabName;

        // Update active tab styling
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show/hide content
        document.querySelectorAll('.admin-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-content`).classList.add('active');
    },

    /**
     * Render users tab
     */
    renderUsersTab() {
        const container = document.createElement('div');

        const table = document.createElement('div');
        table.className = 'admin-table';

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Assigned Reqs</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.users.length > 0) {
            this.users.forEach(user => {
                const isActive = user.is_active !== undefined ? user.is_active : user.active;
                const assignedCount = user.assigned_requirements ? (Array.isArray(user.assigned_requirements) ? user.assigned_requirements.length : user.assigned_requirements.split(',').length) : 0;
                tableHtml += `
                    <tr>
                        <td>${user.display_name || 'N/A'}</td>
                        <td>${user.username}</td>
                        <td><span class="role-badge">${user.role.toUpperCase()}</span></td>
                        <td>${assignedCount}</td>
                        <td>
                            <span class="status-badge status-${isActive ? 'uploaded' : 'empty'}">
                                ${isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <div class="admin-actions">
                                <button class="btn btn-secondary btn-sm edit-user-btn" data-user-id="${user.id}">
                                    Edit
                                </button>
                                <button class="btn btn-${isActive ? 'danger' : 'primary'} btn-sm toggle-user-btn" data-user-id="${user.id}">
                                    ${isActive ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No users found
                    </td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        table.innerHTML = tableHtml;
        container.appendChild(table);

        // Attach event listeners
        setTimeout(() => {
            document.querySelectorAll('.edit-user-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const userId = parseInt(btn.dataset.userId);
                    const user = this.users.find(u => u.id === userId);
                    if (user) this.showEditUserModal(user);
                });
            });

            document.querySelectorAll('.toggle-user-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = parseInt(btn.dataset.userId);
                    const user = this.users.find(u => u.id === userId);
                    if (user) await this.toggleUserActive(userId, !(user.is_active !== undefined ? user.is_active : user.active));
                });
            });
        }, 0);

        return container;
    },

    /**
     * Render scan tab
     */
    renderScanTab() {
        const container = document.createElement('div');

        const scanSection = document.createElement('div');
        scanSection.className = 'scan-section';

        scanSection.innerHTML = `
            <h3 style="margin-bottom: 1rem;">Folder Scan</h3>
            <p style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">
                Trigger a scan of shared folders to detect new evidence files.
            </p>
            <button class="btn btn-primary scan-button" id="scanBtn">
                Start Scan
            </button>
            <div id="scanResults"></div>
        `;

        container.appendChild(scanSection);

        // Attach event listener
        setTimeout(() => {
            document.getElementById('scanBtn').addEventListener('click', () => {
                this.triggerScan();
            });
        }, 0);

        return container;
    },

    /**
     * Render audit tab
     */
    renderAuditTab() {
        const container = document.createElement('div');

        const table = document.createElement('div');
        table.className = 'admin-table';

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Entity Type</th>
                        <th>Entity ID</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.auditLogs.length > 0) {
            this.auditLogs.forEach(log => {
                tableHtml += `
                    <tr>
                        <td>${this.formatTime(log.timestamp || log.created_at)}</td>
                        <td>${log.user_name || log.username || 'System'}</td>
                        <td><span class="type-badge">${log.action}</span></td>
                        <td>${log.entity_type || log.target || '-'}</td>
                        <td>${log.entity_id || '-'}</td>
                        <td style="font-size: 0.85rem; color: var(--color-text-muted);">${log.details || '-'}</td>
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No audit logs found
                    </td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        table.innerHTML = tableHtml;
        container.appendChild(table);

        return container;
    },

    /**
     * Show edit user modal
     */
    showEditUserModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-title">Edit User</div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Display Name</label>
                    <input type="text" class="form-input" id="editDisplayName" value="${user.display_name || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Role</label>
                    <select class="filter-select" id="editRole" style="width: 100%;">
                        <option value="tru_team" ${user.role === 'tru_team' ? 'selected' : ''}>TRU Team</option>
                        <option value="iexpert_pm" ${user.role === 'iexpert_pm' ? 'selected' : ''}>iExpert PM</option>
                        <option value="iexpert_grc" ${user.role === 'iexpert_grc' ? 'selected' : ''}>iExpert GRC</option>
                        <option value="assessor" ${user.role === 'assessor' ? 'selected' : ''}>Assessor</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
                <button class="btn btn-primary" id="saveBtn">Save Changes</button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('cancelBtn').addEventListener('click', () => {
            overlay.remove();
        });

        document.getElementById('saveBtn').addEventListener('click', async () => {
            const newDisplayName = document.getElementById('editDisplayName').value;
            const newRole = document.getElementById('editRole').value;

            try {
                await window.API.updateUser(user.id, {
                    display_name: newDisplayName,
                    role: newRole
                });

                window.App.toast('User updated successfully', 'success');
                overlay.remove();
                await this.loadData();
                this.renderContent();
            } catch (error) {
                window.App.toast('Failed to update user: ' + error.message, 'error');
            }
        });
    },

    /**
     * Toggle user active status
     */
    async toggleUserActive(userId, isActive) {
        try {
            await window.API.toggleUserActive(userId, isActive);
            window.App.toast(`User ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
            await this.loadData();
            this.renderContent();
        } catch (error) {
            window.App.toast('Failed to update user: ' + error.message, 'error');
        }
    },

    /**
     * Trigger folder scan
     */
    async triggerScan() {
        const scanBtn = document.getElementById('scanBtn');
        const resultsDiv = document.getElementById('scanResults');

        scanBtn.disabled = true;
        scanBtn.textContent = 'Scanning...';
        resultsDiv.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

        try {
            const result = await window.API.triggerFolderScan();

            resultsDiv.innerHTML = `
                <div class="scan-results">
                    <h4 style="margin: 1.5rem 0 1rem;">Scan Results</h4>
                    <div class="scan-stat">
                        <span class="scan-stat-label">Files Found</span>
                        <span class="scan-stat-value">${result.files_found || 0}</span>
                    </div>
                    <div class="scan-stat">
                        <span class="scan-stat-label">Files Processed</span>
                        <span class="scan-stat-value">${result.files_processed || 0}</span>
                    </div>
                    <div class="scan-stat">
                        <span class="scan-stat-label">Errors</span>
                        <span class="scan-stat-value">${result.errors || 0}</span>
                    </div>
                </div>
            `;

            window.App.toast('Scan completed', 'success');
            scanBtn.disabled = false;
            scanBtn.textContent = 'Start Scan';
        } catch (error) {
            resultsDiv.innerHTML = `
                <div style="color: var(--color-red); margin-top: 1rem;">
                    Error: ${error.message}
                </div>
            `;
            window.App.toast('Scan failed: ' + error.message, 'error');
            scanBtn.disabled = false;
            scanBtn.textContent = 'Start Scan';
        }
    },

    /**
     * Render cloud sync tab
     */
    renderCloudSyncTab() {
        const container = document.createElement('div');
        container.id = 'cloud-sync-panel';

        const html = `
            <h3 style="margin-bottom: 1.5rem;">Cloud Synchronization</h3>

            <div class="cloud-sync-tabs">
                <button class="cloud-sync-tab active" data-provider="google_drive">
                    <span class="icon">G</span> Google Drive
                </button>
                <button class="cloud-sync-tab" data-provider="dropbox">
                    <span class="icon">D</span> Dropbox
                </button>
            </div>

            <!-- Google Drive Section -->
            <div id="gd-content" class="cloud-sync-content" style="display: block;">
                <div class="cloud-sync-section">
                    <h4>Google Drive Configuration</h4>

                    <div id="gd-status" class="cloud-sync-status">
                        <p>Loading status...</p>
                    </div>

                    <form id="gd-config-form" class="cloud-sync-form">
                        <div class="form-group">
                            <label for="gd-folder-id">Google Drive Parent Folder ID</label>
                            <input type="text" id="gd-folder-id" placeholder="e.g., 1ABC123xyz..." required>
                            <small>Get the folder ID from the URL when you open the folder in Google Drive</small>
                        </div>

                        <div class="form-group">
                            <label for="gd-credentials-json">Service Account JSON Key (paste entire contents)</label>
                            <textarea id="gd-credentials-json" rows="6" placeholder='Paste the entire contents of your downloaded service-account-key.json file here' required style="font-family: monospace; font-size: 12px; width: 100%; background: #1a1a2e; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 10px;"></textarea>
                            <small>Path to your Google Cloud service account JSON key file</small>
                        </div>

                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="gd-activate">
                                Activate Google Drive sync
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary">Save Configuration</button>
                    </form>

                    <div class="cloud-sync-actions">
                        <button id="gd-sync-btn" class="btn btn-success">Sync Google Drive</button>
                        <small>Syncs all evidence files to Google Drive</small>
                    </div>
                </div>
            </div>

            <!-- Dropbox Section -->
            <div id="db-content" class="cloud-sync-content" style="display: none;">
                <div class="cloud-sync-section">
                    <h4>Dropbox Configuration</h4>

                    <div id="db-status" class="cloud-sync-status">
                        <p>Loading status...</p>
                    </div>

                    <form id="db-config-form" class="cloud-sync-form">
                        <div class="form-group">
                            <label for="db-access-token">Dropbox Access Token</label>
                            <input type="password" id="db-access-token" placeholder="sl.XXXXXXX..." required>
                            <small>Your Dropbox app access token (keep this secret)</small>
                        </div>

                        <div class="form-group">
                            <label for="db-parent-path">Parent Folder Path</label>
                            <input type="text" id="db-parent-path" placeholder="e.g., /PCI_Evidence" required>
                            <small>Path in Dropbox where evidence folders will be created</small>
                        </div>

                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="db-activate">
                                Activate Dropbox sync
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary">Save Configuration</button>
                    </form>

                    <div class="cloud-sync-actions">
                        <button id="db-sync-btn" class="btn btn-success">Sync Dropbox</button>
                        <small>Syncs all evidence files to Dropbox</small>
                    </div>
                </div>
            </div>

            <style>
                .cloud-sync-tabs {
                    display: flex;
                    gap: 0;
                    border-bottom: 1px solid var(--color-border, #e0e0e0);
                    margin-bottom: 2rem;
                }

                .cloud-sync-tab {
                    padding: 1rem 1.5rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: var(--color-text-secondary, #666);
                    transition: all 0.2s;
                }

                .cloud-sync-tab.active {
                    color: var(--color-primary, #2563eb);
                    border-bottom-color: var(--color-primary, #2563eb);
                }

                .cloud-sync-tab:hover {
                    color: var(--color-text, #333);
                }

                .cloud-sync-section {
                    background: var(--color-bg-secondary, #f9f9f9);
                    border-radius: 8px;
                    padding: 2rem;
                }

                .cloud-sync-section h4 {
                    margin-top: 0;
                    margin-bottom: 1.5rem;
                    color: var(--color-text, #333);
                }

                .cloud-sync-status {
                    background: white;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 6px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }

                .status-info p {
                    margin: 0.5rem 0;
                    font-size: 0.9rem;
                }

                .cloud-sync-form {
                    background: white;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 6px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .form-group {
                    margin-bottom: 1.25rem;
                }

                .form-group:last-of-type {
                    margin-bottom: 1.5rem;
                }

                .form-group label {
                    display: block;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                    color: var(--color-text, #333);
                }

                .form-group label input[type="checkbox"] {
                    margin-right: 0.5rem;
                }

                .form-group input[type="text"],
                .form-group input[type="password"] {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 4px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    box-sizing: border-box;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: var(--color-primary, #2563eb);
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
                }

                .form-group small {
                    display: block;
                    margin-top: 0.25rem;
                    color: var(--color-text-secondary, #666);
                    font-size: 0.8rem;
                }

                .cloud-sync-actions {
                    text-align: center;
                    padding: 1.5rem;
                    background: white;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 6px;
                }

                .cloud-sync-actions button {
                    width: 100%;
                }

                .cloud-sync-actions small {
                    display: block;
                    margin-top: 0.75rem;
                    color: var(--color-text-secondary, #666);
                }
            </style>
        `;

        container.innerHTML = html;

        // Initialize cloud sync module after adding content
        setTimeout(() => {
            window.CloudSyncModule.init();
        }, 0);

        return container;
    },

    /**
     * Format time
     */
    formatTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString();
    }
};/**
 * Admin Panel
 * Administrative interface for users, scans, and audit logs
 */

window.AdminView = {
    activeTab: 'users',
    users: [],
    scanResults: null,
    auditLogs: [],

    /**
     * Render admin panel
     */
    async render() {
        const app = document.getElementById('app');

        // Show loading state
        app.innerHTML = `
            <div class="topbar">
                <div class="topbar-left">
                    <div class="topbar-logo">TRU</div>
                    <ul class="topbar-nav">
                        <li><a href="#/dashboard">Dashboard</a></li>
                        <li><a href="#/admin" class="active">Admin</a></li>
                    </ul>
                </div>
                <div class="topbar-right">
                    <div class="user-info">
                        <div class="user-avatar" id="userAvatar">A</div>
                        <div class="user-details">
                            <div class="user-name" id="userName">Loading...</div>
                            <div class="user-role" id="userRole"></div>
                        </div>
                        <span class="role-badge" id="roleBadge">ADMIN</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="logoutBtn">
                        Logout
                    </button>
                </div>
            </div>
            <div class="admin-panel">
                <div class="loading-container">
                    <div class="spinner"></div>
                </div>
            </div>
        `;

        // Setup user info
        await this.setupUserInfo();
        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.App.logout();
        });

        try {
            // Load data
            await this.loadData();
            this.renderContent();
        } catch (error) {
            window.App.toast('Failed to load admin panel: ' + error.message, 'error');
            document.querySelector('.admin-panel').innerHTML = `
                <div style="padding: 2rem; color: var(--color-text-secondary);">
                    Error loading admin panel. <a href="#/dashboard">Go back to dashboard</a>
                </div>
            `;
        }
    },

    /**
     * Setup user info
     */
    async setupUserInfo() {
        try {
            const user = await window.API.getCurrentUser();
            if (user) {
                document.getElementById('userName').textContent = user.display_name || user.username;
                document.getElementById('userRole').textContent = user.role;
                document.getElementById('userAvatar').textContent = (user.display_name || user.username).substring(0, 1).toUpperCase();
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    },

    /**
     * Load data for all tabs
     */
    async loadData() {
        try {
            this.users = await window.API.getUsers();
            this.auditLogs = await window.API.getAuditLog();
        } catch (error) {
            console.error('Failed to load admin data:', error);
        }
    },

    /**
     * Render content
     */
    renderContent() {
        const container = document.querySelector('.admin-panel');
        container.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.innerHTML = '<h1 class="dashboard-title">Administration</h1>';
        container.appendChild(header);

        // Tabs
        const tabsDiv = document.createElement('div');
        tabsDiv.className = 'admin-tabs';
        tabsDiv.innerHTML = `
            <div class="admin-tab active" data-tab="users">Users</div>
            <div class="admin-tab" data-tab="scan">Folder Scan</div>
            <div class="admin-tab" data-tab="cloud">Cloud Sync</div>
            <div class="admin-tab" data-tab="audit">Audit Log</div>
        `;
        container.appendChild(tabsDiv);

        // Tab content
        const usersContent = document.createElement('div');
        usersContent.className = 'admin-content active';
        usersContent.id = 'users-content';
        usersContent.appendChild(this.renderUsersTab());
        container.appendChild(usersContent);

        const scanContent = document.createElement('div');
        scanContent.className = 'admin-content';
        scanContent.id = 'scan-content';
        scanContent.appendChild(this.renderScanTab());
        container.appendChild(scanContent);

        const cloudContent = document.createElement('div');
        cloudContent.className = 'admin-content';
        cloudContent.id = 'cloud-content';
        cloudContent.appendChild(this.renderCloudSyncTab());
        container.appendChild(cloudContent);

        const auditContent = document.createElement('div');
        auditContent.className = 'admin-content';
        auditContent.id = 'audit-content';
        auditContent.appendChild(this.renderAuditTab());
        container.appendChild(auditContent);

        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    },

    /**
     * Switch tab
     */
    switchTab(tabName) {
        this.activeTab = tabName;

        // Update active tab styling
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show/hide content
        document.querySelectorAll('.admin-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-content`).classList.add('active');
    },

    /**
     * Render users tab
     */
    renderUsersTab() {
        const container = document.createElement('div');

        const table = document.createElement('div');
        table.className = 'admin-table';

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Role</th>
                        <th>Assigned Reqs</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.users.length > 0) {
            this.users.forEach(user => {
                tableHtml += `
                    <tr>
                        <td>${user.display_name || 'N/A'}</td>
                        <td>${user.username}</td>
                        <td><span class="role-badge">${user.role.toUpperCase()}</span></td>
                        <td>${user.assigned_reqs || 0}</td>
                        <td>
                            <span class="status-badge status-${user.active ? 'uploaded' : 'empty'}">
                                ${user.active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <div class="admin-actions">
                                <button class="btn btn-secondary btn-sm edit-user-btn" data-user-id="${user.gid}">
                                    Edit
                                </button>
                                <button class="btn btn-${user.active ? 'danger' : 'primary'} btn-sm toggle-user-btn" data-user-id="${user.gid}">
                                    ${user.active ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No users found
                    </td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        table.innerHTML = tableHtml;
        container.appendChild(table);

        // Attach event listeners
        setTimeout(() => {
            document.querySelectorAll('.edit-user-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const userId = btn.dataset.userId;
                    const user = this.users.find(u => u.gid === userId);
                    this.showEditUserModal(user);
                });
            });

            document.querySelectorAll('.toggle-user-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userId;
                    const user = this.users.find(u => u.gid === userId);
                    await this.toggleUserActive(userId, !user.active);
                });
            });
        }, 0);

        return container;
    },

    /**
     * Render scan tab
     */
    renderScanTab() {
        const container = document.createElement('div');

        const scanSection = document.createElement('div');
        scanSection.className = 'scan-section';

        scanSection.innerHTML = `
            <h3 style="margin-bottom: 1rem;">Folder Scan</h3>
            <p style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">
                Trigger a scan of shared folders to detect new evidence files.
            </p>
            <button class="btn btn-primary scan-button" id="scanBtn">
                Start Scan
            </button>
            <div id="scanResults"></div>
        `;

        container.appendChild(scanSection);

        // Attach event listener
        setTimeout(() => {
            document.getElementById('scanBtn').addEventListener('click', () => {
                this.triggerScan();
            });
        }, 0);

        return container;
    },

    /**
     * Render audit tab
     */
    renderAuditTab() {
        const container = document.createElement('div');

        const table = document.createElement('div');
        table.className = 'admin-table';

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Entity Type</th>
                        <th>Entity ID</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.auditLogs.length > 0) {
            this.auditLogs.forEach(log => {
                tableHtml += `
                    <tr>
                        <td>${this.formatTime(log.timestamp)}</td>
                        <td>${log.user_name || 'System'}</td>
                        <td><span class="type-badge">${log.action}</span></td>
                        <td>${log.entity_type || '-'}</td>
                        <td>${log.entity_id || '-'}</td>
                        <td style="font-size: 0.85rem; color: var(--color-text-muted);">${log.details || '-'}</td>
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No audit logs found
                    </td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        table.innerHTML = tableHtml;
        container.appendChild(table);

        return container;
    },

    /**
     * Show edit user modal
     */
    showEditUserModal(user) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-title">Edit User</div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Display Name</label>
                    <input type="text" class="form-input" id="editDisplayName" value="${user.display_name || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Role</label>
                    <select class="filter-select" id="editRole" style="width: 100%;">
                        <option value="tru_team" ${user.role === 'tru_team' ? 'selected' : ''}>TRU Team</option>
                        <option value="iexpert_pm" ${user.role === 'iexpert_pm' ? 'selected' : ''}>iExpert PM</option>
                        <option value="iexpert_grc" ${user.role === 'iexpert_grc' ? 'selected' : ''}>iExpert GRC</option>
                        <option value="assessor" ${user.role === 'assessor' ? 'selected' : ''}>Assessor</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="cancelBtn">Cancel</button>
                <button class="btn btn-primary" id="saveBtn">Save Changes</button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay open';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('cancelBtn').addEventListener('click', () => {
            overlay.remove();
        });

        document.getElementById('saveBtn').addEventListener('click', async () => {
            const newDisplayName = document.getElementById('editDisplayName').value;
            const newRole = document.getElementById('editRole').value;

            try {
                await window.API.updateUser(user.gid, {
                    display_name: newDisplayName,
                    role: newRole
                });

                window.App.toast('User updated successfully', 'success');
                overlay.remove();
                await this.loadData();
                this.renderContent();
            } catch (error) {
                window.App.toast('Failed to update user: ' + error.message, 'error');
            }
        });
    },

    /**
     * Toggle user active status
     */
    async toggleUserActive(userId, active) {
        try {
            await window.API.toggleUserActive(userId, active);
            window.App.toast(`User ${active ? 'activated' : 'deactivated'} successfully`, 'success');
            await this.loadData();
            this.renderContent();
        } catch (error) {
            window.App.toast('Failed to update user: ' + error.message, 'error');
        }
    },

    /**
     * Trigger folder scan
     */
    async triggerScan() {
        const scanBtn = document.getElementById('scanBtn');
        const resultsDiv = document.getElementById('scanResults');

        scanBtn.disabled = true;
        scanBtn.textContent = 'Scanning...';
        resultsDiv.innerHTML = '<div class="spinner" style="margin: 2rem auto;"></div>';

        try {
            const result = await window.API.triggerFolderScan();

            resultsDiv.innerHTML = `
                <div class="scan-results">
                    <h4 style="margin: 1.5rem 0 1rem;">Scan Results</h4>
                    <div class="scan-stat">
                        <span class="scan-stat-label">Files Found</span>
                        <span class="scan-stat-value">${result.files_found || 0}</span>
                    </div>
                    <div class="scan-stat">
                        <span class="scan-stat-label">Files Processed</span>
                        <span class="scan-stat-value">${result.files_processed || 0}</span>
                    </div>
                    <div class="scan-stat">
                        <span class="scan-stat-label">Errors</span>
                        <span class="scan-stat-value">${result.errors || 0}</span>
                    </div>
                </div>
            `;

            window.App.toast('Scan completed', 'success');
            scanBtn.disabled = false;
            scanBtn.textContent = 'Start Scan';
        } catch (error) {
            resultsDiv.innerHTML = `
                <div style="color: var(--color-red); margin-top: 1rem;">
                    Error: ${error.message}
                </div>
            `;
            window.App.toast('Scan failed: ' + error.message, 'error');
            scanBtn.disabled = false;
            scanBtn.textContent = 'Start Scan';
        }
    },

    /**
     * Render cloud sync tab
     */
    renderCloudSyncTab() {
        const container = document.createElement('div');
        container.id = 'cloud-sync-panel';

        const html = `
            <h3 style="margin-bottom: 1.5rem;">Cloud Synchronization</h3>

            <div class="cloud-sync-tabs">
                <button class="cloud-sync-tab active" data-provider="google_drive">
                    <span class="icon">G</span> Google Drive
                </button>
                <button class="cloud-sync-tab" data-provider="dropbox">
                    <span class="icon">D</span> Dropbox
                </button>
            </div>

            <!-- Google Drive Section -->
            <div id="gd-content" class="cloud-sync-content" style="display: block;">
                <div class="cloud-sync-section">
                    <h4>Google Drive Configuration</h4>

                    <div id="gd-status" class="cloud-sync-status">
                        <p>Loading status...</p>
                    </div>

                    <form id="gd-config-form" class="cloud-sync-form">
                        <div class="form-group">
                            <label for="gd-folder-id">Google Drive Parent Folder ID</label>
                            <input type="text" id="gd-folder-id" placeholder="e.g., 1ABC123xyz..." required>
                            <small>Get the folder ID from the URL when you open the folder in Google Drive</small>
                        </div>

                        <div class="form-group">
                            <label for="gd-credentials-json">Service Account JSON Key (paste entire contents)</label>
                            <textarea id="gd-credentials-json" rows="6" placeholder='Paste the entire contents of your downloaded service-account-key.json file here' required style="font-family: monospace; font-size: 12px; width: 100%; background: #1a1a2e; color: #e0e0e0; border: 1px solid #333; border-radius: 6px; padding: 10px;"></textarea>
                            <small>Path to your Google Cloud service account JSON key file</small>
                        </div>

                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="gd-activate">
                                Activate Google Drive sync
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary">Save Configuration</button>
                    </form>

                    <div class="cloud-sync-actions">
                        <button id="gd-sync-btn" class="btn btn-success">Sync Google Drive</button>
                        <small>Syncs all evidence files to Google Drive</small>
                    </div>
                </div>
            </div>

            <!-- Dropbox Section -->
            <div id="db-content" class="cloud-sync-content" style="display: none;">
                <div class="cloud-sync-section">
                    <h4>Dropbox Configuration</h4>

                    <div id="db-status" class="cloud-sync-status">
                        <p>Loading status...</p>
                    </div>

                    <form id="db-config-form" class="cloud-sync-form">
                        <div class="form-group">
                            <label for="db-access-token">Dropbox Access Token</label>
                            <input type="password" id="db-access-token" placeholder="sl.XXXXXXX..." required>
                            <small>Your Dropbox app access token (keep this secret)</small>
                        </div>

                        <div class="form-group">
                            <label for="db-parent-path">Parent Folder Path</label>
                            <input type="text" id="db-parent-path" placeholder="e.g., /PCI_Evidence" required>
                            <small>Path in Dropbox where evidence folders will be created</small>
                        </div>

                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="db-activate">
                                Activate Dropbox sync
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary">Save Configuration</button>
                    </form>

                    <div class="cloud-sync-actions">
                        <button id="db-sync-btn" class="btn btn-success">Sync Dropbox</button>
                        <small>Syncs all evidence files to Dropbox</small>
                    </div>
                </div>
            </div>

            <style>
                .cloud-sync-tabs {
                    display: flex;
                    gap: 0;
                    border-bottom: 1px solid var(--color-border, #e0e0e0);
                    margin-bottom: 2rem;
                }

                .cloud-sync-tab {
                    padding: 1rem 1.5rem;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: var(--color-text-secondary, #666);
                    transition: all 0.2s;
                }

                .cloud-sync-tab.active {
                    color: var(--color-primary, #2563eb);
                    border-bottom-color: var(--color-primary, #2563eb);
                }

                .cloud-sync-tab:hover {
                    color: var(--color-text, #333);
                }

                .cloud-sync-section {
                    background: var(--color-bg-secondary, #f9f9f9);
                    border-radius: 8px;
                    padding: 2rem;
                }

                .cloud-sync-section h4 {
                    margin-top: 0;
                    margin-bottom: 1.5rem;
                    color: var(--color-text, #333);
                }

                .cloud-sync-status {
                    background: white;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 6px;
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }

                .status-info p {
                    margin: 0.5rem 0;
                    font-size: 0.9rem;
                }

                .cloud-sync-form {
                    background: white;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 6px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .form-group {
                    margin-bottom: 1.25rem;
                }

                .form-group:last-of-type {
                    margin-bottom: 1.5rem;
                }

                .form-group label {
                    display: block;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                    color: var(--color-text, #333);
                }

                .form-group label input[type="checkbox"] {
                    margin-right: 0.5rem;
                }

                .form-group input[type="text"],
                .form-group input[type="password"] {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 4px;
                    font-size: 0.9rem;
                    font-family: inherit;
                    box-sizing: border-box;
                }

                .form-group input:focus {
                    outline: none;
                    border-color: var(--color-primary, #2563eb);
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
                }

                .form-group small {
                    display: block;
                    margin-top: 0.25rem;
                    color: var(--color-text-secondary, #666);
                    font-size: 0.8rem;
                }

                .cloud-sync-actions {
                    text-align: center;
                    padding: 1.5rem;
                    background: white;
                    border: 1px solid var(--color-border, #e0e0e0);
                    border-radius: 6px;
                }

                .cloud-sync-actions button {
                    width: 100%;
                }

                .cloud-sync-actions small {
                    display: block;
                    margin-top: 0.75rem;
                    color: var(--color-text-secondary, #666);
                }
            </style>
        `;

        container.innerHTML = html;

        // Initialize cloud sync module after adding content
        setTimeout(() => {
            window.CloudSyncModule.init();
        }, 0);

        return container;
    },

    /**
     * Format time
     */
    formatTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString();
    }
};
