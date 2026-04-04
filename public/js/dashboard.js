/**
 * Dashboard View - Professional High-End Dashboard
 * KPI cards, requirements breakdown, progress tracking, team overview
 */

window.DashboardView = {
    refreshInterval: null,
    data: {},

    // Requirement color mapping
    reqColors: {
        1: '#3b82f6',   // blue
        2: '#10b981',   // green
        3: '#f59e0b',   // amber
        4: '#06b6d4',   // cyan
        5: '#f97316',   // orange
        6: '#8b5cf6',   // purple
        7: '#10b981',   // green
        8: '#ef4444',   // red
        9: '#06b6d4',   // cyan
        10: '#ef4444',  // red
        11: '#f97316',  // orange
        12: '#10b981'   // green
    },

    // Owner assignments
    owners: {
        'Amr Abdelnasr': { role: 'IT Infrastructure', reqs: [1, 2, 4, 5], avatar: 'AA', color: '#3b82f6' },
        'Tamer Sherif': { role: 'App Development', reqs: [3, 6, 8], avatar: 'TS', color: '#8b5cf6' },
        'Ahmad Sayed': { role: 'Cyber Force', reqs: [9, 10, 11], avatar: 'AS', color: '#10b981' }
    },

    /**
     * Render dashboard
     */
    async render() {
        const app = document.getElementById('app');

        // Inline styles for smooth animations
        const styles = `
            <style>
                .dashboard-container {
                    background: #0a0e1a;
                    color: #f1f5f9;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
                    padding: 2rem;
                    min-height: 100vh;
                }

                .phase-banner {
                    background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
                    padding: 1rem 1.5rem;
                    border-radius: 10px;
                    margin-bottom: 2rem;
                    font-size: 0.95rem;
                    font-weight: 500;
                }

                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .kpi-card {
                    background: #1a2236;
                    border: 1px solid #2a3550;
                    border-radius: 14px;
                    padding: 1.5rem;
                    border-top: 3px solid;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .kpi-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
                }

                .kpi-card.cyan-accent { border-top-color: #06b6d4; }
                .kpi-card.green-accent { border-top-color: #10b981; }
                .kpi-card.yellow-accent { border-top-color: #f59e0b; }
                .kpi-card.purple-accent { border-top-color: #8b5cf6; }
                .kpi-card.blue-accent { border-top-color: #3b82f6; }

                .kpi-label {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #94a3b8;
                    margin-bottom: 0.75rem;
                    font-weight: 600;
                }

                .kpi-value {
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: #f1f5f9;
                    margin-bottom: 0.5rem;
                }

                .kpi-detail {
                    font-size: 0.85rem;
                    color: #64748b;
                }

                .progress-section {
                    background: #1a2236;
                    border: 1px solid #2a3550;
                    border-radius: 14px;
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .progress-label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #f1f5f9;
                }

                .progress-percentage {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #10b981;
                }

                .progress-bar-container {
                    background: #0f1419;
                    border-radius: 8px;
                    height: 12px;
                    overflow: hidden;
                    margin-bottom: 1rem;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%);
                    border-radius: 8px;
                    transition: width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    width: 0%;
                }

                .progress-legend {
                    display: flex;
                    gap: 2rem;
                    font-size: 0.85rem;
                    color: #94a3b8;
                }

                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .legend-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }

                .dashboard-content {
                    display: grid;
                    grid-template-columns: 1fr 380px;
                    gap: 2rem;
                }

                .requirements-section {
                    background: #1a2236;
                    border: 1px solid #2a3550;
                    border-radius: 14px;
                    padding: 1.5rem;
                    overflow: hidden;
                }

                .section-header {
                    font-size: 1.1rem;
                    font-weight: 600;
                    margin-bottom: 1.5rem;
                    color: #f1f5f9;
                }

                .requirements-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .requirements-table thead tr {
                    border-bottom: 1px solid #2a3550;
                }

                .requirements-table th {
                    padding: 1rem;
                    text-align: left;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #94a3b8;
                    font-weight: 600;
                    background: #0f1419;
                }

                .requirements-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #2a3550;
                    color: #f1f5f9;
                }

                .requirements-table tbody tr {
                    cursor: pointer;
                    transition: background-color 0.2s;
                }

                .requirements-table tbody tr:hover {
                    background-color: #111827;
                }

                .req-badge {
                    display: inline-block;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 700;
                    margin-right: 0.5rem;
                }

                .req-name {
                    display: flex;
                    align-items: center;
                    font-weight: 500;
                }

                .progress-mini {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .progress-mini-bar {
                    flex: 1;
                    height: 6px;
                    background: #0f1419;
                    border-radius: 3px;
                    overflow: hidden;
                    min-width: 60px;
                }

                .progress-mini-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981, #06b6d4);
                    border-radius: 3px;
                }

                .percentage-bold {
                    font-weight: 700;
                    min-width: 50px;
                }

                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.85rem;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .sidebar-card {
                    background: #1a2236;
                    border: 1px solid #2a3550;
                    border-radius: 14px;
                    padding: 1.5rem;
                }

                .donut-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }

                .donut-svg {
                    width: 140px;
                    height: 140px;
                }

                .donut-center {
                    position: absolute;
                    width: 140px;
                    height: 140px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }

                .donut-percentage {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #10b981;
                }

                .donut-label {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                }

                .donut-legend {
                    width: 100%;
                    font-size: 0.8rem;
                    color: #94a3b8;
                }

                .donut-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0.4rem 0;
                }

                .donut-legend-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                }

                .owners-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }

                .owner-card {
                    background: #111827;
                    border: 1px solid #2a3550;
                    border-radius: 10px;
                    padding: 1rem;
                    display: flex;
                    gap: 1rem;
                }

                .owner-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 0.85rem;
                    font-weight: 700;
                    flex-shrink: 0;
                }

                .owner-info {
                    flex: 1;
                }

                .owner-name {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #f1f5f9;
                }

                .owner-role {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 0.25rem;
                }

                .owner-pending {
                    font-size: 0.8rem;
                    color: #f59e0b;
                    font-weight: 600;
                    margin-top: 0.5rem;
                }

                .timeline {
                    position: relative;
                    padding: 0;
                }

                .timeline-item {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    position: relative;
                }

                .timeline-item:not(:last-child)::after {
                    content: '';
                    position: absolute;
                    left: 11px;
                    top: 36px;
                    width: 2px;
                    height: calc(100% + 1.5rem);
                    background: #2a3550;
                }

                .timeline-dot {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: #2a3550;
                    flex-shrink: 0;
                    position: relative;
                    z-index: 1;
                    border: 2px solid #1a2236;
                }

                .timeline-dot.done {
                    background: #10b981;
                }

                .timeline-dot.current {
                    background: #f59e0b;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
                    50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
                }

                .timeline-content {
                    padding-top: 2px;
                }

                .timeline-date {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #f1f5f9;
                }

                .timeline-text {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    margin-top: 0.25rem;
                }

                @media (max-width: 1200px) {
                    .dashboard-content {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
        `;

        app.innerHTML = styles + `
            <div class="dashboard-container">
                <div class="phase-banner">
                    Phase Transition Complete: All 120+ policy/procedure documents deployed. Remaining items require IT team screenshots.
                </div>

                <div id="dashboard-content">
                    <div class="loading-spinner" style="text-align: center; padding: 3rem; color: #94a3b8;">
                        Loading dashboard...
                    </div>
                </div>
            </div>
        `;

        try {
            await this.fetchData();
            this.renderContent();
            this.startAutoRefresh();
        } catch (error) {
            console.error('Dashboard error:', error);
            document.getElementById('dashboard-content').innerHTML = `
                <div style="padding: 2rem; color: #f97316;">
                    Error loading dashboard. Please refresh.
                </div>
            `;
        }
    },

    /**
     * Fetch dashboard data
     */
    async fetchData() {
        try {
            const stats = await window.API.get('/dashboard/stats');
            const requirements = await window.API.get('/dashboard/requirements');

            this.data = {
                stats: stats || { total: 0, filled: 0, empty: 0, percentage: 0, by_status: {}, by_type: {}, by_requirement: [] },
                requirements: requirements.requirements || []
            };
        } catch (error) {
            console.error('Fetch error:', error);
            this.data = {
                stats: { total: 0, filled: 0, empty: 0, percentage: 0, by_status: {}, by_type: {}, by_requirement: [] },
                requirements: []
            };
        }
    },

    /**
     * Render dashboard content
     */
    renderContent() {
        const { stats, requirements } = this.data;
        const container = document.getElementById('dashboard-content');

        // Calculate derived values
        const total = stats.total || 0;
        const filled = stats.filled || 0;
        const remaining = (total - filled) || 0;
        const percentage = stats.percentage || 0;

        // Count requirements at 100%
        const reqsAt100 = requirements.filter(r => r.percentage === 100).length;

        // Calculate pending items by owner
        const ownersPending = this.calculateOwnersPending(requirements);

        // Build KPI cards HTML
        const kpiCards = `
            <div class="kpi-grid">
                <div class="kpi-card cyan-accent">
                    <div class="kpi-label">Total Evidence Points</div>
                    <div class="kpi-value">${total}</div>
                </div>
                <div class="kpi-card green-accent">
                    <div class="kpi-label">Folders Populated</div>
                    <div class="kpi-value">${filled}</div>
                </div>
                <div class="kpi-card yellow-accent">
                    <div class="kpi-label">Remaining Items</div>
                    <div class="kpi-value">${remaining}</div>
                </div>
                <div class="kpi-card green-accent">
                    <div class="kpi-label">Documents Created</div>
                    <div class="kpi-value">267</div>
                </div>
                <div class="kpi-card purple-accent">
                    <div class="kpi-label">Requirements at 100%</div>
                    <div class="kpi-value">${reqsAt100}</div>
                </div>
                <div class="kpi-card blue-accent">
                    <div class="kpi-label">Sprint Day</div>
                    <div class="kpi-value">5</div>
                    <div class="kpi-detail">Started Mar 31</div>
                </div>
            </div>
        `;

        // Build progress section HTML
        const progressHtml = `
            <div class="progress-section">
                <div class="progress-header">
                    <div class="progress-label">Overall Progress</div>
                    <div class="progress-percentage">${Math.round(percentage)}%</div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: 0%;" id="progressBar"></div>
                </div>
                <div class="progress-legend">
                    <div class="legend-item">
                        <div class="legend-dot" style="background: #10b981;"></div>
                        <span>Policy Docs (267)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background: #06b6d4;"></div>
                        <span>Other Evidence</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot" style="background: #f59e0b;"></div>
                        <span>Awaiting IT (${remaining})</span>
                    </div>
                </div>
            </div>
        `;

        // Build requirements table HTML
        const reqTableHtml = `
            <div class="requirements-section">
                <div class="section-header">Requirement Breakdown</div>
                <table class="requirements-table">
                    <thead>
                        <tr>
                            <th>Requirement</th>
                            <th>Progress</th>
                            <th style="width: 80px;">%</th>
                            <th style="width: 100px;">Folders</th>
                            <th style="width: 80px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requirements.map(req => this.renderRequirementRow(req)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Build sidebar HTML
        const sidebarHtml = `
            <div class="sidebar">
                ${this.renderDonutCard()}
                ${this.renderOwnersCard(ownersPending)}
                ${this.renderSprintCard()}
            </div>
        `;

        // Set content
        container.innerHTML = kpiCards + progressHtml + `
            <div class="dashboard-content">
                ${reqTableHtml}
                ${sidebarHtml}
            </div>
        `;

        // Animate progress bar
        setTimeout(() => {
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.width = percentage + '%';
            }
        }, 100);

        // Animate donut chart
        this.animateDonutChart(percentage);

        // Attach event listeners
        document.querySelectorAll('.requirements-table tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                const reqId = row.dataset.reqId;
                window.location.hash = '#/requirement/' + reqId;
            });
        });
    },

    /**
     * Render a single requirement row
     */
    renderRequirementRow(req) {
        const percentage = req.percentage || 0;
        const reqNum = parseInt(req.id);
        const badgeColor = this.reqColors[reqNum] || '#94a3b8';

        let statusLabel = 'In Progress';
        let statusColor = '#ef4444';
        let statusDotColor = '#ef4444';

        if (percentage === 100) {
            statusLabel = 'Complete';
            statusColor = '#10b981';
            statusDotColor = '#10b981';
        } else if (percentage >= 85) {
            statusLabel = 'Near Complete';
            statusColor = '#f59e0b';
            statusDotColor = '#f59e0b';
        }

        const filled = req.filled || 0;
        const total = req.total || 0;

        return `
            <tr data-req-id="${req.id}">
                <td class="req-name">
                    <div class="req-badge" style="background: ${badgeColor};">${reqNum}</div>
                    ${req.name}
                </td>
                <td>
                    <div class="progress-mini">
                        <div class="progress-mini-bar">
                            <div class="progress-mini-fill" style="width: ${percentage}%;"></div>
                        </div>
                    </div>
                </td>
                <td class="percentage-bold" style="color: ${statusColor};">${Math.round(percentage)}%</td>
                <td>${filled}/${total}</td>
                <td>
                    <div class="status-badge">
                        <div class="status-dot" style="background: ${statusDotColor};"></div>
                        <span>${statusLabel}</span>
                    </div>
                </td>
            </tr>
        `;
    },

    /**
     * Render donut chart card
     */
    renderDonutCard() {
        const { stats } = this.data;
        const total = stats.total || 1;
        const filled = stats.filled || 0;
        const percentage = Math.round((filled / total) * 100);

        return `
            <div class="sidebar-card">
                <div class="section-header">Completion Status</div>
                <div class="donut-container">
                    <div style="position: relative; width: 140px; height: 140px;">
                        <svg class="donut-svg" viewBox="0 0 120 120">
                            ${this.generateDonutSvg(percentage)}
                        </svg>
                        <div class="donut-center" style="position: absolute; left: 0; top: 0;">
                            <div class="donut-percentage">${percentage}%</div>
                            <div class="donut-label">Complete</div>
                        </div>
                    </div>
                    <div class="donut-legend">
                        <div class="donut-legend-item">
                            <div class="donut-legend-dot" style="background: #10b981;"></div>
                            <span>Completed (${filled})</span>
                        </div>
                        <div class="donut-legend-item">
                            <div class="donut-legend-dot" style="background: #2a3550;"></div>
                            <span>Remaining (${total - filled})</span>
                        </div>
                        <div class="donut-legend-item">
                            <div class="donut-legend-dot" style="background: #10b981;"></div>
                            <span>Docs Created (267)</span>
                        </div>
                        <div class="donut-legend-item">
                            <div class="donut-legend-dot" style="background: #06b6d4;"></div>
                            <span>Other Files</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Generate donut SVG path
     */
    generateDonutSvg(percentage) {
        const radius = 50;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        return `
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#2a3550" stroke-width="14" />
            <circle
                cx="60"
                cy="60"
                r="${radius}"
                fill="none"
                stroke="url(#donutGradient)"
                stroke-width="14"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"
                stroke-linecap="round"
                transform="rotate(-90 60 60)"
            />
            <defs>
                <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color: #10b981; stop-opacity: 1;" />
                    <stop offset="100%" style="stop-color: #06b6d4; stop-opacity: 1;" />
                </linearGradient>
            </defs>
        `;
    },

    /**
     * Animate donut chart
     */
    animateDonutChart(targetPercentage) {
        let currentPercentage = 0;
        const step = targetPercentage / 30;
        const interval = setInterval(() => {
            currentPercentage += step;
            if (currentPercentage >= targetPercentage) {
                currentPercentage = targetPercentage;
                clearInterval(interval);
            }
            // Animation handled by CSS transition
        }, 20);
    },

    /**
     * Calculate pending items by owner
     */
    calculateOwnersPending(requirements) {
        const pending = {};

        for (const [name, info] of Object.entries(this.owners)) {
            pending[name] = 0;
            info.reqs.forEach(reqNum => {
                const req = requirements.find(r => parseInt(r.id) === reqNum);
                if (req) {
                    pending[name] += req.empty || 0;
                }
            });
        }

        return pending;
    },

    /**
     * Render owners card
     */
    renderOwnersCard(ownersPending) {
        return `
            <div class="sidebar-card">
                <div class="section-header">Evidence Owners</div>
                <div class="owners-grid">
                    ${Object.entries(this.owners).map(([name, info]) => `
                        <div class="owner-card">
                            <div class="owner-avatar" style="background: linear-gradient(135deg, ${info.color} 0%, ${this.lighten(info.color, 0.2)} 100%);">
                                ${info.avatar}
                            </div>
                            <div class="owner-info">
                                <div class="owner-name">${name}</div>
                                <div class="owner-role">${info.role}</div>
                                <div class="owner-pending">${ownersPending[name] || 0} pending items</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render sprint timeline card
     */
    renderSprintCard() {
        const today = new Date('2026-04-04');
        const sprintStart = new Date('2026-03-31');

        const timeline = [
            { date: '2026-03-31', day: 'Day 1', text: 'Sprint Start', status: 'done' },
            { date: '2026-04-01', day: 'Day 2', text: 'Apr 1', status: 'done' },
            { date: '2026-04-02', day: 'Day 3', text: 'Apr 2', status: 'done' },
            { date: '2026-04-03', day: 'Day 4', text: 'Apr 3', status: 'done' },
            { date: '2026-04-04', day: 'Day 5', text: 'Current Day', status: 'current' },
            { date: '2026-04-05', day: 'Apr 5-7', text: 'iExperts Review', status: 'future' },
            { date: '2026-04-08', day: 'Apr 8+', text: 'PCI QSA Review', status: 'future' }
        ];

        return `
            <div class="sidebar-card">
                <div class="section-header">Sprint Timeline</div>
                <div class="timeline">
                    ${timeline.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-dot ${item.status}"></div>
                            <div class="timeline-content">
                                <div class="timeline-date">${item.day}</div>
                                <div class="timeline-text">${item.text}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Lighten a hex color
     */
    lighten(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
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
        }, 30000);
    },

    /**
     * Clean up on navigation away
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
};
