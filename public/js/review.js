/**
 * Review View - Pre-Sync Evidence Inspector
 * Organize, inspect, and review all evidence before cloud sync
 */

window.ReviewView = {
  data: null,
  filters: {
    requirement: 'all',
    status: 'all',
    assignee: 'all'
  },
  selectedItems: new Set(),

  /**
   * Render review section
   */
  async render() {
    const app = document.getElementById('app');

    const styles = `
      <style>
        .review-container {
          background: #0a0e1a;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
          padding: 2rem;
          min-height: 100vh;
        }

        .review-header {
          margin-bottom: 2rem;
        }

        .review-header h2 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 1rem 0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .summary-card {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 8px;
          padding: 1rem;
        }

        .summary-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #94a3b8;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .summary-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f1f5f9;
        }

        .summary-card.ready {
          border-top: 3px solid #10b981;
        }

        .summary-card.attention {
          border-top: 3px solid #f59e0b;
        }

        .summary-card.blocked {
          border-top: 3px solid #ef4444;
        }

        .controls-section {
          background: #1a2236;
          border: 1px solid #2a3550;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
        }

        .filter-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }

        .filter-select {
          background: #0f1419;
          border: 1px solid #2a3550;
          color: #f1f5f9;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .bulk-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.75rem 1.5rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: #2563eb;
        }

        .action-btn:disabled {
          background: #64748b;
          cursor: not-allowed;
        }

        .action-btn.secondary {
          background: transparent;
          border: 1px solid #2a3550;
          color: #3b82f6;
        }

        .action-btn.secondary:hover {
          background: #2a3550;
        }

        .accordion-section {
          margin-bottom: 1rem;
        }

        .accordion-header {
          background: #1a2236;
          border: 1px solid #2a3550;
          padding: 1rem 1.5rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 8px;
          user-select: none;
          transition: all 0.2s;
        }

        .accordion-header:hover {
          background: #232e45;
          border-color: #3b82f6;
        }

        .accordion-header.open {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom-color: #3b82f6;
        }

        .accordion-req-name {
          font-weight: 600;
          color: #f1f5f9;
        }

        .accordion-req-count {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-left: 1rem;
        }

        .accordion-toggle {
          color: #3b82f6;
          transition: transform 0.2s;
        }

        .accordion-header.open .accordion-toggle {
          transform: rotate(180deg);
        }

        .accordion-content {
          display: none;
          background: #0f1419;
          border: 1px solid #2a3550;
          border-top: none;
          border-radius: 0 0 8px 8px;
        }

        .accordion-content.open {
          display: block;
        }

        .evidence-item {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #1a2236;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.2s;
        }

        .evidence-item:hover {
          background: #1a2236;
        }

        .evidence-item:last-child {
          border-bottom: none;
        }

        .evidence-info {
          flex: 1;
        }

        .evidence-checkbox {
          margin-right: 1rem;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .evidence-folder {
          font-weight: 600;
          color: #f1f5f9;
          margin-bottom: 0.25rem;
        }

        .evidence-meta {
          font-size: 0.85rem;
          color: #94a3b8;
        }

        .status-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 0.5rem;
        }

        .status-green {
          background: #10b981;
        }

        .status-yellow {
          background: #f59e0b;
        }

        .status-red {
          background: #ef4444;
        }

        .file-list {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 0.5rem;
          max-height: 60px;
          overflow-y: auto;
        }

        .file-item {
          padding: 0.25rem 0;
        }

        .no-evidence {
          padding: 2rem;
          text-align: center;
          color: #94a3b8;
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
            <li><a href="#/review" style="color: #3b82f6; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem; border-bottom: 2px solid #3b82f6;">Review</a></li>
            <li><a href="#/alerts" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Alerts</a></li>
            <li><a href="#/admin" style="color: #94a3b8; text-decoration: none; padding: 0.5rem 1rem; display: block; font-weight: 600; font-size: 0.95rem;">Admin</a></li>
          </ul>
        </div>
        <button id="logoutBtn" style="background: transparent; border: 1px solid #2a3550; color: #3b82f6; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Logout</button>
      </div>
      <div class="review-container">
        <div class="review-header">
          <h2>Evidence Review</h2>
          <p style="color: #94a3b8; margin: 0.5rem 0 0 0;">Inspect and review all evidence before syncing to cloud</p>
        </div>

        <div class="summary-grid" id="summaryGrid">
          <div class="loading">Loading summary...</div>
        </div>

        <div class="controls-section">
          <div class="filters">
            <div class="filter-group">
              <label class="filter-label">Requirement</label>
              <select id="requirementFilter" class="filter-select">
                <option value="all">All Requirements</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Status</label>
              <select id="statusFilter" class="filter-select">
                <option value="all">All Status</option>
                <option value="empty">Empty / Missing</option>
                <option value="filled">Has Files</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>
            <div class="filter-group">
              <label class="filter-label">Assignee</label>
              <select id="assigneeFilter" class="filter-select">
                <option value="all">All Assignees</option>
              </select>
            </div>
          </div>

          <div class="bulk-actions">
            <button class="action-btn secondary" id="selectAllBtn">Select All Visible</button>
            <button class="action-btn secondary" id="clearSelectionBtn">Clear Selection</button>
            <button class="action-btn" id="markReviewedBtn" disabled>Mark as Reviewed</button>
            <button class="action-btn" id="flagAttentionBtn" disabled>Flag for Attention</button>
          </div>
        </div>

        <div id="accordionContainer"></div>
      </div>
    `;

    // Load data
    await this.loadData();

    // Setup logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      window.App.logout();
    });

    // Setup filter listeners
    document.getElementById('requirementFilter').addEventListener('change', (e) => {
      this.filters.requirement = e.target.value;
      this.renderAccordions();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.renderAccordions();
    });

    document.getElementById('assigneeFilter').addEventListener('change', (e) => {
      this.filters.assignee = e.target.value;
      this.renderAccordions();
    });

    document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAll());
    document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearSelection());
    document.getElementById('markReviewedBtn').addEventListener('click', () => this.markReviewed());
    document.getElementById('flagAttentionBtn').addEventListener('click', () => this.flagAttention());
  },

  /**
   * Load review data
   */
  async loadData() {
    try {
      const response = await fetch('/api/review/evidence', {
        headers: {
          'Authorization': `Bearer ${window.API.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load review data');

      this.data = await response.json();
      this.renderSummary();
      this.populateFilters();
      this.renderAccordions();
    } catch (err) {
      console.error('Load review data error:', err);
      document.getElementById('summaryGrid').innerHTML = `
        <div class="no-evidence" style="grid-column: 1 / -1;">
          Failed to load review data: ${err.message}
        </div>
      `;
    }
  },

  /**
   * Render summary cards
   */
  renderSummary() {
    const summary = this.data.summary;
    const readyPct = summary.total_items > 0 ? Math.round((summary.ready_to_sync / summary.total_items) * 100) : 0;

    document.getElementById('summaryGrid').innerHTML = `
      <div class="summary-card ready">
        <div class="summary-label">Ready to Sync</div>
        <div class="summary-value">${summary.ready_to_sync}/${summary.total_items}</div>
        <div style="font-size: 0.8rem; color: #10b981; margin-top: 0.25rem;">${readyPct}% complete</div>
      </div>
      <div class="summary-card attention">
        <div class="summary-label">Needs Review</div>
        <div class="summary-value">${summary.needs_review}</div>
      </div>
      <div class="summary-card blocked">
        <div class="summary-label">Empty / Missing</div>
        <div class="summary-value">${summary.empty}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Total Items</div>
        <div class="summary-value">${summary.total_items}</div>
      </div>
    `;
  },

  /**
   * Populate filter dropdowns
   */
  populateFilters() {
    // Populate requirements
    const reqSelect = document.getElementById('requirementFilter');
    this.data.requirements.forEach(req => {
      const option = document.createElement('option');
      option.value = req.id;
      option.textContent = `Req ${req.id}: ${req.name.substring(0, 30)}...`;
      reqSelect.appendChild(option);
    });

    // Populate assignees
    const assignees = new Set();
    Object.values(this.data.grouped).forEach(group => {
      group.evidence_points.forEach(ep => {
        if (ep.assigned_owner) {
          assignees.add(ep.assigned_owner);
        }
      });
    });

    const assignSelect = document.getElementById('assigneeFilter');
    assignees.forEach(assignee => {
      const option = document.createElement('option');
      option.value = assignee;
      option.textContent = assignee;
      assignSelect.appendChild(option);
    });
  },

  /**
   * Render accordions for each requirement
   */
  renderAccordions() {
    const container = document.getElementById('accordionContainer');

    let html = '';

    Object.values(this.data.grouped).forEach(group => {
      // Apply filters
      let filtered = group.evidence_points;

      if (this.filters.requirement !== 'all') {
        filtered = filtered.filter(ep => ep.requirement_id === parseInt(this.filters.requirement));
      }

      if (this.filters.status === 'empty') {
        filtered = filtered.filter(ep => ep.color_code === 'red');
      } else if (this.filters.status === 'filled') {
        filtered = filtered.filter(ep => ep.color_code !== 'red');
      } else if (this.filters.status === 'reviewed') {
        filtered = filtered.filter(ep => ep.color_code === 'green');
      }

      if (this.filters.assignee !== 'all') {
        filtered = filtered.filter(ep => ep.assigned_owner === this.filters.assignee);
      }

      if (filtered.length === 0) return;

      html += `
        <div class="accordion-section" data-req="${group.requirement_id}">
          <div class="accordion-header" data-req="${group.requirement_id}">
            <div>
              <div class="accordion-req-name">Requirement ${group.requirement_id}: ${group.requirement_name}</div>
              <div class="accordion-req-count">${filtered.length} items</div>
            </div>
            <div class="accordion-toggle">⬇</div>
          </div>
          <div class="accordion-content" data-req="${group.requirement_id}">
            ${filtered.map(ep => `
              <div class="evidence-item">
                <input type="checkbox" class="evidence-checkbox" data-id="${ep.id}" data-status="${ep.color_code}">
                <div class="evidence-info">
                  <div class="evidence-folder">
                    <span class="status-indicator status-${ep.color_code}"></span>${ep.folder_name}
                  </div>
                  <div class="evidence-meta">
                    Files: ${ep.file_count} | Status: ${ep.status}
                    ${ep.assigned_owner ? ` | Owner: ${ep.assigned_owner}` : ''}
                  </div>
                  ${ep.file_count > 0 ? `
                    <div class="file-list">
                      ${ep.file_names.map(name => `<div class="file-item">📄 ${name}</div>`).join('')}
                      ${ep.file_names.length < ep.file_count ? `<div class="file-item">... and ${ep.file_count - ep.file_names.length} more</div>` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    if (html === '') {
      html = '<div class="no-evidence">No evidence items match the selected filters</div>';
    }

    container.innerHTML = html;

    // Setup accordion toggles
    container.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const req = header.dataset.req;
        const content = container.querySelector(`.accordion-content[data-req="${req}"]`);
        header.classList.toggle('open');
        content.classList.toggle('open');
      });
    });

    // Setup checkboxes
    container.querySelectorAll('.evidence-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.selectedItems.add(parseInt(e.target.dataset.id));
        } else {
          this.selectedItems.delete(parseInt(e.target.dataset.id));
        }
        this.updateBulkButtonStates();
      });
    });
  },

  /**
   * Select all visible items
   */
  selectAll() {
    document.querySelectorAll('.evidence-checkbox').forEach(checkbox => {
      if (checkbox.offsetParent !== null) { // visible
        checkbox.checked = true;
        this.selectedItems.add(parseInt(checkbox.dataset.id));
      }
    });
    this.updateBulkButtonStates();
  },

  /**
   * Clear selection
   */
  clearSelection() {
    document.querySelectorAll('.evidence-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    this.selectedItems.clear();
    this.updateBulkButtonStates();
  },

  /**
   * Update bulk action button states
   */
  updateBulkButtonStates() {
    const hasSelection = this.selectedItems.size > 0;
    document.getElementById('markReviewedBtn').disabled = !hasSelection;
    document.getElementById('flagAttentionBtn').disabled = !hasSelection;
  },

  /**
   * Mark selected as reviewed
   */
  async markReviewed() {
    if (this.selectedItems.size === 0) return;

    try {
      const response = await fetch('/api/review/bulk-status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.API.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evidence_ids: Array.from(this.selectedItems),
          action: 'mark_reviewed'
        })
      });

      if (!response.ok) throw new Error('Failed to update status');

      window.App.toast(`Marked ${this.selectedItems.size} items as reviewed`, 'success');
      this.clearSelection();
      await this.loadData();
    } catch (err) {
      window.App.toast(`Error: ${err.message}`, 'error');
    }
  },

  /**
   * Flag selected for attention
   */
  async flagAttention() {
    if (this.selectedItems.size === 0) return;

    try {
      const response = await fetch('/api/review/bulk-status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.API.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evidence_ids: Array.from(this.selectedItems),
          action: 'flag_attention'
        })
      });

      if (!response.ok) throw new Error('Failed to flag items');

      window.App.toast(`Flagged ${this.selectedItems.size} items for attention`, 'success');
      this.clearSelection();
      await this.loadData();
    } catch (err) {
      window.App.toast(`Error: ${err.message}`, 'error');
    }
  }
};
