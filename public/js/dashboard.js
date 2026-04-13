/**
 * Dashboard View â Matching TRU_PCI_DSS_Evidence_Dashboard.html style
 * Dark theme, gradient topbar, KPI cards, donut chart, requirement table with progress bars
 */

window.DashboardView = {
    refreshInterval: null,
    data: {},

    reqColors: {
        1: '#3b82f6', 2: '#10b981', 3: '#f59e0b', 4: '#06b6d4',
        5: '#f97316', 6: '#8b5cf6', 7: '#10b981', 8: '#ef4444',
        9: '#06b6d4', 10: '#ef4444', 11: '#f97316', 12: '#10b981'
    },

    owners: {
        'Amr Abdelnasr': { role: 'IT Infrastructure', reqs: [1, 2, 4, 5], avatar: 'AA', color: '#3b82f6' },
        'Tamer Sherif': { role: 'App Development', reqs: [3, 6, 8], avatar: 'TS', color: '#8b5cf6' },
        'Ahmad Sayed': { role: 'Cyber Force', reqs: [9, 10, 11], avatar: 'AS', color: '#10b981' }
    },

    async render() {
        const app = document.getElementById('app');

        app.innerHTML = `
          <style>${window.Nav.getStyles()}${this.getStyles()}</style>
          ${window.Nav.render('dashboard')}
          <div class="db-main">
            <div class="db-alert animate-in">
              <div class="db-alert-icon">â ï¸</div>
              <div class="db-alert-text"><strong>Phase Transition Complete:</strong> All 120+ policy/procedure documents deployed. Remaining evidence points require live system screenshots, scan reports, and config exports from TRU IT team.</div>
            </div>
            <div id="dashboardContent">
              <div style="text-align:center;padding:3rem;color:#94a3b8;">Loading dashboard...</div>
            </div>
          </div>
        `;

        try {
            await this.fetchData();
            this.renderContent();
            this.startAutoRefresh();
        } catch (error) {
            console.error('Dashboard error:', error);
            document.getElementById('dashboardContent').innerHTML = '<div style="padding:2rem;color:#f97316;">Error loading dashboard. Please refresh.</div>';
        }
    },

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

    renderContent() {
        const { stats, requirements } = this.data;
        const container = document.getElementById('dashboardContent');
        const total = stats.total || 0;
        const filled = stats.filled || 0;
        const remaining = total - filled;
        const percentage = stats.percentage || 0;
        const reqsAt100 = requirements.filter(r => r.percentage === 100).length;
        const ownersPending = this.calculateOwnersPending(requirements);

        // Sprint day
        const sprintStart = new Date('2026-03-31');
        const today = new Date();
        const sprintDay = Math.max(1, Math.floor((today - sprintStart) / 86400000) + 1);

        container.innerHTML = `
          <!-- KPI GRID -->
          <div class="db-kpi-grid animate-in delay-1">
            <div class="db-kpi blue">
              <div class="db-kpi-label">Total Evidence Points</div>
              <div class="db-kpi-value cyan">${total}</div>
              <div class="db-kpi-detail">Across 12 PCI DSS requirements</div>
            </div>
            <div class="db-kpi green">
              <div class="db-kpi-label">Folders Populated</div>
              <div class="db-kpi-value green">${filled}</div>
              <div class="db-kpi-detail">With documents or evidence</div>
            </div>
            <div class="db-kpi yellow">
              <div class="db-kpi-label">Remaining Items</div>
              <div class="db-kpi-value yellow">${remaining}</div>
              <div class="db-kpi-detail">All require IT team action</div>
            </div>
            <div class="db-kpi green">
              <div class="db-kpi-label">Documents Created</div>
              <div class="db-kpi-value green">267</div>
              <div class="db-kpi-detail">.docx policies &amp; procedures</div>
            </div>
            <div class="db-kpi purple">
              <div class="db-kpi-label">Reqs at 100%</div>
              <div class="db-kpi-value purple">${reqsAt100}</div>
              <div class="db-kpi-detail">${reqsAt100 > 0 ? 'Fully addressed' : 'None yet'}</div>
            </div>
            <div class="db-kpi blue">
              <div class="db-kpi-label">Sprint Day</div>
              <div class="db-kpi-value blue">${sprintDay}</div>
              <div class="db-kpi-detail">Started March 31, 2026</div>
            </div>
          </div>

          <!-- OVERALL PROGRESS -->
          <div class="db-progress animate-in delay-2">
            <h3>Overall Completion Progress</h3>
            <div class="db-prog-bar-wrap">
              <div class="db-prog-fill ${percentage >= 70 ? 'high' : 'mid'}" id="overallBar" style="width:0%">
                <span>${Math.round(percentage)}%</span>
              </div>
            </div>
            <div class="db-prog-segments">
              <div class="db-prog-seg"><div class="db-prog-dot docs"></div> Policy/Procedure Documents (267)</div>
              <div class="db-prog-seg"><div class="db-prog-dot evidence"></div> Other Evidence Files</div>
              <div class="db-prog-seg"><div class="db-prog-dot empty"></div> Awaiting IT Evidence (${remaining})</div>
            </div>
          </div>

          <!-- TWO-COL: TABLE + SIDEBAR -->
          <div class="db-grid-main animate-in delay-3">
            <div class="db-card">
              <div class="db-card-header">
                <h3>Requirement Breakdown</h3>
                <div class="db-badge">12 Requirements &bull; PCI DSS v4.0</div>
              </div>
              <div class="db-card-body">
                <table class="db-table">
                  <thead><tr>
                    <th>Requirement</th><th>Progress</th><th style="width:60px">%</th><th style="width:80px">Folders</th><th style="width:90px">Status</th>
                  </tr></thead>
                  <tbody>
                    ${requirements.map(req => this.renderReqRow(req)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="db-sidebar-stack">
              ${this.renderDonutCard()}
              ${this.renderOwnersCard(ownersPending)}
              ${this.renderSprintCard()}
            </div>
          </div>
        `;

        // Animate progress bar
        setTimeout(() => {
            const bar = document.getElementById('overallBar');
            if (bar) bar.style.width = percentage + '%';
        }, 100);

        // Click handlers for requirement rows
        document.querySelectorAll('.db-table tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                window.location.hash = '#/requirement/' + row.dataset.reqId;
            });
        });
    },

    renderReqRow(req) {
        const pct = req.percentage || 0;
        const num = parseInt(req.id);
        const color = this.reqColors[num] || '#94a3b8';
        let statusLabel, statusColor;
        if (pct === 100) { statusLabel = 'Complete'; statusColor = '#10b981'; }
        else if (pct >= 85) { statusLabel = 'Near Complete'; statusColor = '#f59e0b'; }
        else { statusLabel = 'In Progress'; statusColor = '#ef4444'; }

        return `
          <tr data-req-id="${req.id}">
            <td><div class="db-req-cell"><div class="db-req-badge" style="background:${color}">${num}</div><span class="db-req-name">${req.name}</span></div></td>
            <td><div class="db-mini-bar"><div class="db-mini-fill" style="width:${pct}%;background:linear-gradient(90deg,${color},${this.lighten(color,30)})"></div></div></td>
            <td class="db-pct" style="color:${statusColor}">${Math.round(pct)}%</td>
            <td class="db-count">${req.filled||0}/${req.total||0}</td>
            <td><div class="db-status"><div class="db-status-dot" style="background:${statusColor};box-shadow:0 0 6px ${statusColor}"></div><span style="color:${statusColor}">${statusLabel}</span></div></td>
          </tr>
        `;
    },

    renderDonutCard() {
        const { stats } = this.data;
        const total = stats.total || 1;
        const filled = stats.filled || 0;
        const pct = Math.round((filled / total) * 100);
        const r = 50, c = 2 * Math.PI * r, offset = c - (pct / 100) * c;

        return `
          <div class="db-sidebar-card">
            <div class="db-section-hdr">Completion Status</div>
            <div class="db-donut-wrap">
              <div class="db-donut">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="${r}" fill="none" stroke="#2a3550" stroke-width="14"/>
                  <circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#dg)" stroke-width="14"
                    stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 60 60)"/>
                  <defs><linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#10b981"/><stop offset="100%" style="stop-color:#06b6d4"/>
                  </linearGradient></defs>
                </svg>
                <div class="db-donut-center">
                  <div class="db-donut-pct">${pct}%</div>
                  <div class="db-donut-lbl">COMPLETE</div>
                </div>
              </div>
              <div class="db-donut-legend">
                <div class="db-legend-item"><div class="db-legend-dot" style="background:#10b981"></div> Completed (${filled})</div>
                <div class="db-legend-item"><div class="db-legend-dot" style="background:#2a3550"></div> Remaining (${total - filled})</div>
                <div class="db-legend-item"><div class="db-legend-dot" style="background:#06b6d4"></div> Docs Created (267)</div>
              </div>
            </div>
          </div>
        `;
    },

    renderOwnersCard(ownersPending) {
        return `
          <div class="db-sidebar-card">
            <div class="db-section-hdr">Evidence Owners</div>
            ${Object.entries(this.owners).map(([name, info]) => `
              <div class="db-owner-card">
                <div class="db-owner-avatar" style="background:linear-gradient(135deg,${info.color},${this.lighten(info.color,30)})">${info.avatar}</div>
                <div class="db-owner-info">
                  <div class="db-owner-name">${name}</div>
                  <div class="db-owner-role">${info.role}</div>
                </div>
                <div class="db-owner-stat">
                  <div class="db-owner-stat-val">${ownersPending[name] || 0}</div>
                  <div class="db-owner-stat-lbl">PENDING</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
    },

    renderSprintCard() {
        const sprintDays = [
            { date: '2026-03-31', label: 'Sprint Start â Mar 31' },
            { date: '2026-04-01', label: 'Apr 1' },
            { date: '2026-04-02', label: 'Apr 2' },
            { date: '2026-04-03', label: 'Apr 3' },
            { date: '2026-04-04', label: 'Apr 4' },
            { date: '2026-04-05', label: 'Apr 5' },
            { date: '2026-04-06', label: 'Apr 6' },
            { date: '2026-04-07', label: 'Apr 7' }
        ];
        const todayStr = new Date().toISOString().slice(0, 10);
        const timeline = sprintDays.map((d, i) => {
            let status = 'future';
            if (d.date < todayStr) status = 'done';
            else if (d.date === todayStr) status = 'current';
            return { day: 'Day ' + (i + 1), text: (status === 'current' ? 'Current â ' : '') + d.label, status };
        });
        timeline.push({ day: 'Apr 8-10', text: 'iExperts Review', status: 'future' });
        timeline.push({ day: 'Apr 11+', text: 'PCI QSA Review', status: 'future' });
        return `
          <div class="db-sidebar-card">
            <div class="db-section-hdr">Sprint Timeline</div>
            <div class="db-timeline">
              ${timeline.map(t => `
                <div class="db-tl-item">
                  <div class="db-tl-dot ${t.status}"></div>
                  <div><div class="db-tl-date">${t.day}</div><div class="db-tl-text">${t.text}</div></div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
    },

    calculateOwnersPending(requirements) {
        const pending = {};
        for (const [name, info] of Object.entries(this.owners)) {
            pending[name] = 0;
            info.reqs.forEach(reqNum => {
                const req = requirements.find(r => parseInt(r.id) === reqNum);
                if (req) pending[name] += req.empty || 0;
            });
        }
        return pending;
    },

    lighten(color, amount) {
        const num = parseInt(color.replace('#', ''), 16);
        const R = Math.min(255, (num >> 16) + amount);
        const G = Math.min(255, ((num >> 8) & 0xFF) + amount);
        const B = Math.min(255, (num & 0xFF) + amount);
        return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
    },

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(async () => {
            try { await this.fetchData(); this.renderContent(); } catch (e) {}
        }, 30000);
    },

    destroy() {
        if (this.refreshInterval) { clearInterval(this.refreshInterval); this.refreshInterval = null; }
    },

    getStyles() {
        return `
/* ===== DASHBOARD STYLES ===== */
.db-main { padding:20px 28px 48px; max-width:1600px; margin:0 auto; background:#0a0e1a; min-height:calc(100vh - 60px); }

.db-alert { background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.03)); border:1px solid rgba(245,158,11,.25); border-radius:12px; padding:14px 20px; margin-bottom:24px; display:flex; align-items:center; gap:14px; }
.db-alert-icon { font-size:20px; flex-shrink:0; }
.db-alert-text { font-size:13px; color:#94a3b8; line-height:1.5; }
.db-alert-text strong { color:#fbbf24; }

/* KPI Grid */
.db-kpi-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; margin-bottom:24px; }
.db-kpi { background:#1a2236; border:1px solid #2a3550; border-radius:14px; padding:20px; position:relative; overflow:hidden; transition:all .25s; }
.db-kpi:hover { border-color:#3b82f6; transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.3); }
.db-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:14px 14px 0 0; }
.db-kpi.blue::before { background:linear-gradient(90deg,#3b82f6,#06b6d4); }
.db-kpi.green::before { background:linear-gradient(90deg,#10b981,#34d399); }
.db-kpi.yellow::before { background:linear-gradient(90deg,#f59e0b,#f97316); }
.db-kpi.red::before { background:linear-gradient(90deg,#ef4444,#f97316); }
.db-kpi.purple::before { background:linear-gradient(90deg,#8b5cf6,#3b82f6); }
.db-kpi-label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:600; margin-bottom:8px; }
.db-kpi-value { font-size:32px; font-weight:800; letter-spacing:-1px; line-height:1; }
.db-kpi-value.cyan { color:#06b6d4; }
.db-kpi-value.green { color:#10b981; }
.db-kpi-value.yellow { color:#f59e0b; }
.db-kpi-value.red { color:#ef4444; }
.db-kpi-value.purple { color:#8b5cf6; }
.db-kpi-value.blue { color:#3b82f6; }
.db-kpi-detail { font-size:11px; color:#64748b; margin-top:6px; }

/* Overall Progress */
.db-progress { background:#1a2236; border:1px solid #2a3550; border-radius:14px; padding:20px 24px; margin-bottom:24px; }
.db-progress h3 { font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#64748b; font-weight:600; margin-bottom:12px; }
.db-prog-bar-wrap { position:relative; height:40px; background:#111827; border-radius:20px; overflow:hidden; border:1px solid #2a3550; }
.db-prog-fill { height:100%; border-radius:20px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:15px; color:#fff; transition:width 1.2s ease; }
.db-prog-fill.high { background:linear-gradient(90deg,#059669,#10b981,#34d399); }
.db-prog-fill.mid { background:linear-gradient(90deg,#d97706,#f59e0b,#fbbf24); }
.db-prog-segments { display:flex; align-items:center; gap:24px; margin-top:12px; }
.db-prog-seg { display:flex; align-items:center; gap:8px; font-size:12px; color:#94a3b8; }
.db-prog-dot { width:10px; height:10px; border-radius:3px; }
.db-prog-dot.docs { background:#10b981; }
.db-prog-dot.evidence { background:#3b82f6; }
.db-prog-dot.empty { background:#2a3550; }

/* Two-column grid */
.db-grid-main { display:grid; grid-template-columns:1fr 380px; gap:20px; margin-bottom:24px; }

/* Card */
.db-card { background:#1a2236; border:1px solid #2a3550; border-radius:14px; overflow:hidden; }
.db-card-header { padding:16px 20px; border-bottom:1px solid #2a3550; display:flex; align-items:center; justify-content:space-between; }
.db-card-header h3 { font-size:13px; font-weight:700; }
.db-badge { font-size:10px; background:#111827; border:1px solid #2a3550; padding:4px 10px; border-radius:6px; color:#64748b; font-weight:600; }

/* Requirements Table */
.db-table { width:100%; border-collapse:collapse; }
.db-table thead th { text-align:left; padding:10px 16px; font-size:10px; text-transform:uppercase; letter-spacing:.8px; color:#64748b; font-weight:600; background:rgba(0,0,0,.15); border-bottom:1px solid #2a3550; }
.db-table tbody td { padding:12px 16px; font-size:13px; border-bottom:1px solid rgba(42,53,80,.5); vertical-align:middle; }
.db-table tbody tr { transition:background .15s; cursor:pointer; }
.db-table tbody tr:hover { background:#1f2942; }
.db-table tbody tr:last-child td { border-bottom:none; }
.db-req-cell { display:flex; align-items:center; gap:10px; }
.db-req-badge { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; color:#fff; flex-shrink:0; }
.db-req-name { font-weight:500; font-size:12px; color:#94a3b8; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.db-mini-bar { height:8px; background:#111827; border-radius:4px; overflow:hidden; width:120px; }
.db-mini-fill { height:100%; border-radius:4px; transition:width .6s; }
.db-pct { font-weight:700; font-size:14px; text-align:right; }
.db-count { font-size:12px; color:#64748b; white-space:nowrap; }
.db-status { display:flex; align-items:center; gap:6px; }
.db-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

/* Sidebar */
.db-sidebar-stack { display:flex; flex-direction:column; gap:20px; }
.db-sidebar-card { background:#1a2236; border:1px solid #2a3550; border-radius:14px; padding:16px 20px; }
.db-section-hdr { font-size:13px; font-weight:700; margin-bottom:14px; color:#f1f5f9; }

/* Donut */
.db-donut-wrap { display:flex; align-items:center; gap:24px; }
.db-donut { width:140px; height:140px; position:relative; flex-shrink:0; }
.db-donut svg { width:100%; height:100%; }
.db-donut-center { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; }
.db-donut-pct { font-size:28px; font-weight:800; color:#10b981; line-height:1; }
.db-donut-lbl { font-size:9px; text-transform:uppercase; color:#64748b; letter-spacing:.5px; margin-top:2px; }
.db-donut-legend { display:flex; flex-direction:column; gap:8px; }
.db-legend-item { display:flex; align-items:center; gap:8px; font-size:12px; color:#94a3b8; }
.db-legend-dot { width:10px; height:10px; border-radius:3px; flex-shrink:0; }

/* Owner Cards */
.db-owner-card { display:flex; align-items:center; gap:12px; padding:12px; background:#111827; border:1px solid #2a3550; border-radius:10px; margin-bottom:8px; transition:all .2s; }
.db-owner-card:hover { border-color:#3b82f6; background:#1f2942; }
.db-owner-card:last-child { margin-bottom:0; }
.db-owner-avatar { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; color:#fff; flex-shrink:0; }
.db-owner-info { flex:1; }
.db-owner-name { font-weight:600; font-size:13px; }
.db-owner-role { font-size:11px; color:#64748b; margin-top:2px; }
.db-owner-stat { text-align:center; }
.db-owner-stat-val { font-size:22px; font-weight:800; color:#ef4444; line-height:1; }
.db-owner-stat-lbl { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-top:2px; }

/* Timeline */
.db-timeline { padding:0; }
.db-tl-item { display:flex; gap:14px; padding-bottom:14px; position:relative; }
.db-tl-item:not(:last-child)::after { content:''; position:absolute; left:5px; top:18px; bottom:0; width:2px; background:#2a3550; }
.db-tl-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; margin-top:3px; position:relative; z-index:1; }
.db-tl-dot.done { background:#10b981; }
.db-tl-dot.current { background:#f59e0b; box-shadow:0 0 10px #f59e0b; animation:db-pulse 1.5s infinite; }
.db-tl-dot.future { background:#2a3550; border:2px solid #64748b; }
@keyframes db-pulse { 0%,100%{box-shadow:0 0 6px #f59e0b} 50%{box-shadow:0 0 16px #f59e0b} }
.db-tl-date { font-size:10px; color:#64748b; font-weight:500; }
.db-tl-text { font-size:13px; color:#94a3b8; margin-top:2px; line-height:1.4; }

/* Animations */
@keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
.animate-in { animation:fadeInUp .5s ease both; }
.delay-1 { animation-delay:.1s; }
.delay-2 { animation-delay:.2s; }
.delay-3 { animation-delay:.3s; }

/* Responsive */
@media(max-width:1200px) { .db-grid-main{grid-template-columns:1fr} .db-kpi-grid{grid-template-columns:repeat(3,1fr)} }
@media(max-width:768px) { .db-kpi-grid{grid-template-columns:repeat(2,1fr)} .db-main{padding:16px} }
        `;
    }
};
