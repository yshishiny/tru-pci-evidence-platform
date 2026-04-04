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
     * Format time
     */
    formatTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString();
    }
};
