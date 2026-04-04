/**
 * Dashboard View
 * Main dashboard with KPI cards, requirements table, and sidebar
 */

window.DashboardView = {
    refreshInterval: null,
    data: {},

    /**
     * Render dashboard
     */
    async render() {
        const app = document.getElementById('app');

        // Show loading state
        app.innerHTML = `
            <div class="topbar">
                <div class="topbar-left">
                    <div class="topbar-logo">TRU</div>
                    <ul class="topbar-nav">
                        <li><a href="#/dashboard" class="active">Dashboard</a></li>
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
            <div class="dashboard">
                <div class="dashboard-main">
                    <div class="loading-container">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;

        // Setup user info and logout
        await this.setupUserInfo();
        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.App.logout();
        });

        // Fetch and render data
        try {
            await this.fetchData();
            this.renderContent();
            this.startAutoRefresh();
        } catch (error) {
            window.App.toast('Failed to load dashboard: ' + error.message, 'error');
            app.querySelector('.dashboard-main').innerHTML = `
                <div style="padding: 2rem; color: var(--color-text-secondary);">
                    Error loading dashboard. Please refresh the page.
                </div>
            `;
        }
    },

    /**
     * Setup user info in topbar
     */
    async setupUserInfo() {
        try {
            const user = await window.API.getCurrentUser();
            if (user) {
                const nameEl = document.getElementById('userName');
                const roleEl = document.getElementById('userRole');
                const avatarEl = document.getElementById('userAvatar');
                const roleBadge = document.getElementById('roleBadge');
                const adminLink = document.getElementById('adminLink');

                nameEl.textContent = user.display_name || user.username;
                roleEl.textContent = user.role;
                avatarEl.textContent = (user.display_name || user.username).substring(0, 1).toUpperCase();
                roleBadge.textContent = user.role.toUpperCase();

                // Show admin link for admin users
                if (user.role === 'admin') {
                    adminLink.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    },

    /**
     * Fetch dashboard data
     */
    async fetchData() {
        const stats = await window.API.getDashboardStats();
        const requirements = await window.API.getDashboardRequirements();

        this.data = {
            stats,
            requirements
        };
    },

    /**
     * Render dashboard content
     */
    renderContent() {
        const stats = this.data.stats || {};
        const requirements = this.data.requirements || [];

        const mainContent = document.querySelector('.dashboard-main');
        mainContent.innerHTML = '';

        // Create dashboard structure
        const dashboard = document.createElement('div');
        dashboard.className = 'dashboard-main';

        // Header
        const header = document.createElement('div');
        header.className = 'dashboard-header';
        header.innerHTML = '<h1 class="dashboard-title">Dashboard</h1>';
        dashboard.appendChild(header);

        // KPI Grid
        const kpiGrid = document.createElement('div');
        kpiGrid.className = 'kpi-grid';

        const kpis = [
            { label: 'Total EPs', value: stats.total_eps || 0 },
            { label: 'Filled', value: stats.filled || 0 },
            { label: 'Remaining', value: stats.remaining || 0 },
            { label: 'Documents', value: stats.documents_uploaded || 0 },
            { label: 'Requirements at 100%', value: stats.reqs_complete || 0 },
            { label: 'Status', value: stats.overall_status || 'In Progress' }
        ];

        kpis.forEach(kpi => {
            const card = document.createElement('div');
            card.className = 'kpi-card';
            card.innerHTML = `
                <div class="kpi-label">${kpi.label}</div>
                <div class="kpi-value">${kpi.value}</div>
            `;
            kpiGrid.appendChild(card);
        });

        dashboard.appendChild(kpiGrid);

        // Progress section
        const progressSection = document.createElement('div');
        progressSection.className = 'progress-section';

        const progressPercentage = stats.overall_progress || 0;
        progressSection.innerHTML = `
            <div class="progress-label">
                <span>Overall Progress</span>
                <span class="progress-percentage">${Math.round(progressPercentage)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercentage}%"></div>
            </div>
        `;
        dashboard.appendChild(progressSection);

        // Requirements table
        const reqSection = document.createElement('div');
        reqSection.className = 'requirements-table-section';

        let reqTableHtml = `
            <div class="table-header">
                <div class="table-title">Requirements Progress</div>
            </div>
            <table class="requirements-table">
                <thead>
                    <tr>
                        <th>Requirement</th>
                        <th>Progress</th>
                        <th>Coverage</th>
                        <th>Folders</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (requirements.length > 0) {
            requirements.forEach(req => {
                const progress = req.progress || 0;
                reqTableHtml += `
                    <tr class="req-row" data-req-id="${req.gid}">
                        <td class="req-name">${req.name}</td>
                        <td>
                            <div class="req-progress">
                                <div class="req-progress-bar">
                                    <div class="req-progress-fill" style="width: ${progress}%"></div>
                                </div>
                                <div class="req-percentage">${Math.round(progress)}%</div>
                            </div>
                        </td>
                        <td>${req.coverage || '0%'}</td>
                        <td>${req.folder_count || 0}</td>
                        <td>
                            <button class="action-button view-req-btn" data-req-id="${req.gid}">
                                View
                            </button>
                        </td>
                    </tr>
                `;
            });
        } else {
            reqTableHtml += `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
                        No requirements found
                    </td>
                </tr>
            `;
        }

        reqTableHtml += `
                </tbody>
            </table>
        `;

        reqSection.innerHTML = reqTableHtml;
        dashboard.appendChild(reqSection);

        // Replace content
        const oldDashboard = document.querySelector('.dashboard');
        const oldMain = oldDashboard.querySelector('.dashboard-main');
        oldMain.parentNode.removeChild(oldMain);
        oldDashboard.insertBefore(dashboard, oldDashboard.firstChild);

        // Add sidebar
        const hasSidebar = oldDashboard.querySelector('.dashboard-sidebar');
        if (!hasSidebar) {
            const sidebar = this.renderSidebar();
            oldDashboard.appendChild(sidebar);
        } else {
            hasSidebar.parentNode.removeChild(hasSidebar);
            oldDashboard.appendChild(this.renderSidebar());
        }

        // Attach event listeners
        document.querySelectorAll('.view-req-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const reqId = btn.dataset.reqId;
                window.App.navigate(`requirement/${reqId}`);
            });
        });

        document.querySelectorAll('.req-row').forEach(row => {
            row.addEventListener('click', () => {
                const reqId = row.dataset.reqId;
                window.App.navigate(`requirement/${reqId}`);
            });
        });
    },

    /**
     * Render sidebar with donut chart and team cards
     */
    renderSidebar() {
        const sidebar = document.createElement('div');
        sidebar.className = 'dashboard-sidebar';

        const stats = this.data.stats || {};

        // Donut chart section
        const donutSection = document.createElement('div');
        donutSection.className = 'sidebar-section';
        donutSection.innerHTML = `
            <div class="sidebar-title">Status Distribution</div>
            <div class="donut-container">
                <svg class="donut-chart" viewBox="0 0 100 100">
                    ${this.generateDonutChart(stats)}
                </svg>
            </div>
        `;
        sidebar.appendChild(donutSection);

        // Team section
        const teamSection = document.createElement('div');
        teamSection.className = 'sidebar-section';
        teamSection.innerHTML = '<div class="sidebar-title">Team Overview</div>';

        const teams = stats.teams || [];
        teams.forEach(team => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.innerHTML = `
                <div class="team-name">${team.name}</div>
                <div class="team-pending">${team.pending_count || 0} pending</div>
            `;
            teamSection.appendChild(card);
        });

        if (teams.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.color = 'var(--color-text-muted)';
            emptyMsg.style.fontSize = '0.9rem';
            emptyMsg.textContent = 'No team data available';
            teamSection.appendChild(emptyMsg);
        }

        sidebar.appendChild(teamSection);

        return sidebar;
    },

    /**
     * Generate SVG donut chart
     */
    generateDonutChart(stats) {
        const statuses = {
            empty: stats.status_empty || 0,
            uploaded: stats.status_uploaded || 0,
            under_review: stats.status_under_review || 0,
            approved: stats.status_approved || 0
        };

        const total = Object.values(statuses).reduce((a, b) => a + b, 0) || 1;
        const colors = {
            empty: '#6b7280',
            uploaded: '#3b82f6',
            under_review: '#f59e0b',
            approved: '#10b981'
        };

        let angle = 0;
        let svg = '';

        Object.entries(statuses).forEach(([status, count]) => {
            const percent = count / total;
            const sliceAngle = percent * 360;

            const startAngle = angle;
            const endAngle = angle + sliceAngle;

            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;

            const x1 = 50 + 30 * Math.cos(startRad);
            const y1 = 50 + 30 * Math.sin(startRad);
            const x2 = 50 + 30 * Math.cos(endRad);
            const y2 = 50 + 30 * Math.sin(endRad);

            const largeArc = sliceAngle > 180 ? 1 : 0;

            const pathData = `
                M 50 50
                L ${x1} ${y1}
                A 30 30 0 ${largeArc} 1 ${x2} ${y2}
                Z
            `;

            svg += `
                <path
                    d="${pathData}"
                    fill="${colors[status]}"
                    stroke="var(--color-secondary-bg)"
                    stroke-width="2"
                    opacity="0.8"
                />
            `;

            angle = endAngle;
        });

        // Inner circle for donut effect
        svg += `
            <circle cx="50" cy="50" r="18" fill="var(--color-secondary-bg)" />
        `;

        return svg;
    },

    /**
     * Start auto-refresh timer
     */
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            try {
                await this.fetchData();
                this.renderContent();
            } catch (error) {
                console.error('Dashboard refresh error:', error);
            }
        }, 30000); // 30 seconds
    },

    /**
     * Clean up on unmount
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
};
