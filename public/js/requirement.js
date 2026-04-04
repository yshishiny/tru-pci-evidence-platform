/**
 * Requirement Detail View
 * Shows evidence points for a specific requirement with filtering
 */

window.RequirementView = {
    currentReqId: null,
    evidenceData: [],
    filteredData: [],

    /**
     * Render requirement view
     */
    async render(reqId) {
        this.currentReqId = reqId;

        const app = document.getElementById('app');

        // Show loading state
        app.innerHTML = `
            <div class="topbar">
                <div class="topbar-left">
                    <div class="topbar-logo">TRU</div>
                    <ul class="topbar-nav">
                        <li><a href="#/dashboard">Dashboard</a></li>
                        <li><a href="#/admin" id="adminLink" style="display: none;">Admin</a></li>
                    </ul>
                </div>
                <div class="topbar-right">
                    <div class="user-info">
                        <div class="user-avatar" id="userAvatar">A</div>
                        <div class="user-details">
                            <div class="user-name" id="userName">Loading...</div>
                            <div class="user-role" id="userRole"></div>
                        </div>
                        <span class="role-badge" id="roleBadge">USER</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="logoutBtn">
                        Logout
                    </button>
                </div>
            </div>
            <div class="requirement-view">
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
            // Fetch data
            const req = await window.API.getRequirement(reqId);
            const evidencePoints = await window.API.getEvidencePoints(reqId);

            this.evidenceData = evidencePoints.evidence || [];
            this.filteredData = [...this.evidenceData];

            this.renderContent(req);
        } catch (error) {
            window.App.toast('Failed to load requirement: ' + error.message, 'error');
            document.querySelector('.requirement-view').innerHTML = `
                <div style="padding: 2rem; color: var(--color-text-secondary);">
                    Error loading requirement. <a href="#/dashboard">Go back to dashboard</a>
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
                document.getElementById('roleBadge').textContent = user.role.toUpperCase();

                if (user.role === 'admin') {
                    document.getElementById('adminLink').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    },

    /**
     * Render content
     */
    renderContent(req) {
        const container = document.querySelector('.requirement-view');
        container.innerHTML = '';

        // Breadcrumb
        const breadcrumb = document.createElement('div');
        breadcrumb.className = 'breadcrumb';
        breadcrumb.innerHTML = `
            <a href="#/dashboard" class="breadcrumb-item">Dashboard</a>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">${req.name || 'Requirement'}</span>
        `;
        container.appendChild(breadcrumb);

        // Header
        const header = document.createElement('div');
        header.innerHTML = `<h1 class="dashboard-title">${req.name}</h1>`;
        container.appendChild(header);

        // Filter bar
        const filterBar = document.createElement('div');
        filterBar.className = 'filter-bar';
        filterBar.innerHTML = `
            <select class="filter-select" id="statusFilter">
                <option value="">All Statuses</option>
                <option value="empty">Empty</option>
                <option value="uploaded">Uploaded</option>
                <option value="under_review">Under Review</option>
                <option value="pm_approved">PM Approved</option>
                <option value="grc_approved">GRC Approved</option>
                <option value="pm_revision">PM Revision</option>
                <option value="grc_revision">GRC Revision</option>
                <option value="admin_approved">Admin Approved</option>
                <option value="assessor_approved">Assessor Approved</option>
                <option value="assessor_rejected">Assessor Rejected</option>
            </select>
            <select class="filter-select" id="typeFilter">
                <option value="">All Types</option>
                <option value="policy">Policy</option>
                <option value="procedure">Procedure</option>
                <option value="evidence">Evidence</option>
                <option value="scan">Scan Result</option>
            </select>
            <input
                type="text"
                class="filter-search"
                id="searchInput"
                placeholder="Search by name or description..."
            >
        `;
        container.appendChild(filterBar);

        // Attach filter listeners
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());

        // Evidence table
        const tableSection = document.createElement('div');
        tableSection.className = 'evidence-table';

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>EP Name</th>
                        <th>Sub-Requirement</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.filteredData.length > 0) {
            this.filteredData.forEach(ep => {
                const statusClass = `status-${ep.status || 'empty'}`;
                tableHtml += `
                    <tr>
                        <td class="ep-name">${ep.name}</td>
                        <td>${ep.sub_requirement || '-'}</td>
                        <td><span class="type-badge">${ep.type || 'Evidence'}</span></td>
                        <td><span class="status-badge ${statusClass}">${(ep.status || 'empty').replace(/_/g, ' ')}</span></td>
                        <td>${ep.owner || 'Unassigned'}</td>
                        <td>${this.formatDate(ep.last_updated)}</td>
                        <td>
                            <button class="action-button view-btn" data-ep-id="${ep.gid}">
                                View
                            </button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No evidence points found matching the filters
                    </td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        tableSection.innerHTML = tableHtml;
        container.appendChild(tableSection);

        // Attach view button listeners
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const epId = btn.dataset.epId;
                window.EvidenceView.open(epId);
            });
        });
    },

    /**
     * Apply filters
     */
    applyFilters() {
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();

        this.filteredData = this.evidenceData.filter(ep => {
            const matchesStatus = !statusFilter || ep.status === statusFilter;
            const matchesType = !typeFilter || ep.type === typeFilter;
            const matchesSearch = !searchTerm ||
                ep.name.toLowerCase().includes(searchTerm) ||
                (ep.description && ep.description.toLowerCase().includes(searchTerm));

            return matchesStatus && matchesType && matchesSearch;
        });

        // Re-render table
        const container = document.querySelector('.requirement-view');
        const oldTable = container.querySelector('.evidence-table');
        const req = { name: 'Requirement' };

        // Recreate just the table
        const tableSection = document.createElement('div');
        tableSection.className = 'evidence-table';

        let tableHtml = `
            <table>
                <thead>
                    <tr>
                        <th>EP Name</th>
                        <th>Sub-Requirement</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.filteredData.length > 0) {
            this.filteredData.forEach(ep => {
                const statusClass = `status-${ep.status || 'empty'}`;
                tableHtml += `
                    <tr>
                        <td class="ep-name">${ep.name}</td>
                        <td>${ep.sub_requirement || '-'}</td>
                        <td><span class="type-badge">${ep.type || 'Evidence'}</span></td>
                        <td><span class="status-badge ${statusClass}">${(ep.status || 'empty').replace(/_/g, ' ')}</span></td>
                        <td>${ep.owner || 'Unassigned'}</td>
                        <td>${this.formatDate(ep.last_updated)}</td>
                        <td>
                            <button class="action-button view-btn" data-ep-id="${ep.gid}">
                                View
                            </button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tableHtml += `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No evidence points found matching the filters
                    </td>
                </tr>
            `;
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        tableSection.innerHTML = tableHtml;
        oldTable.parentNode.replaceChild(tableSection, oldTable);

        // Attach view button listeners
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const epId = btn.dataset.epId;
                window.EvidenceView.open(epId);
            });
        });
    },

    /**
     * Format date
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    }
};
