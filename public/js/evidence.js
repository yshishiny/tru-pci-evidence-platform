/**
 * Evidence Detail Panel
 * Slide-out panel for viewing and managing evidence
 */

window.EvidenceView = {
    currentEvidenceId: null,
    currentEvidence: null,
    currentUser: null,

    /**
     * Open evidence panel
     */
    async open(evidenceId) {
        this.currentEvidenceId = evidenceId;

        // Create panel if it doesn't exist
        let panelOverlay = document.querySelector('.evidence-panel-overlay');
        let panel = document.querySelector('.evidence-panel');

        if (!panelOverlay) {
            panelOverlay = document.createElement('div');
            panelOverlay.className = 'evidence-panel-overlay';
            document.body.appendChild(panelOverlay);

            panelOverlay.addEventListener('click', (e) => {
                if (e.target === panelOverlay) {
                    this.close();
                }
            });
        }

        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'evidence-panel';
            document.body.appendChild(panel);
        }

        // Show overlay and panel
        panelOverlay.classList.add('open');
        panel.classList.add('open');

        // Load user info for role checking
        try {
            this.currentUser = await window.API.getCurrentUser();
        } catch (error) {
            console.error('Failed to load user:', error);
        }

        // Load and render evidence
        try {
            this.currentEvidence = await window.API.getEvidence(evidenceId);
            this.renderPanel();
        } catch (error) {
            window.App.toast('Failed to load evidence: ' + error.message, 'error');
            this.close();
        }
    },

    /**
     * Close panel
     */
    close() {
        const panelOverlay = document.querySelector('.evidence-panel-overlay');
        const panel = document.querySelector('.evidence-panel');

        if (panelOverlay) panelOverlay.classList.remove('open');
        if (panel) panel.classList.remove('open');

        // Remove after animation
        setTimeout(() => {
            if (panelOverlay) panelOverlay.remove();
            if (panel) panel.remove();
        }, 300);
    },

    /**
     * Render panel content
     */
    renderPanel() {
        const panel = document.querySelector('.evidence-panel');
        const evidence = this.currentEvidence;

        panel.innerHTML = `
            <div class="panel-header">
                <button class="panel-close" id="closeBtn">×</button>
                <div class="panel-title">${evidence.name}</div>
                <div class="panel-meta">
                    <span>${evidence.sub_requirement || 'N/A'}</span>
                    <span>•</span>
                    <span class="type-badge" style="display: inline-block;">${evidence.type || 'Evidence'}</span>
                </div>
            </div>
            <div class="panel-content">
                <!-- File Section -->
                <div class="panel-section">
                    <div class="panel-section-title">Document</div>
                    <div class="file-section">
                        <div class="file-preview" id="filePreview">
                            ${this.renderFilePreview()}
                        </div>
                        <div class="file-actions">
                            ${evidence.file_url ? `
                                <a href="${evidence.file_url}" download class="btn btn-secondary btn-sm">
                                    Download
                                </a>
                            ` : ''}
                        </div>
                        ${this.canUpload() ? `
                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
                                <div class="upload-area" id="uploadArea">
                                    <div class="upload-icon">📤</div>
                                    <div class="upload-text">Drop file here or click to upload</div>
                                </div>
                                <input type="file" id="fileInput" style="display: none;">
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Status Workflow -->
                <div class="panel-section">
                    <div class="panel-section-title">Status Workflow</div>
                    <div class="workflow-bar" id="workflowBar">
                        ${this.renderWorkflow()}
                    </div>
                </div>

                <!-- Review Section -->
                <div class="panel-section">
                    <div class="panel-section-title">Status</div>
                    <div class="review-section">
                        <div class="review-status">
                            <div class="status-label">Current Status</div>
                            <div class="status-badge status-${evidence.status || 'empty'}" style="display: block; margin-bottom: 1rem; padding: 0.75rem;">
                                ${(evidence.status || 'empty').replace(/_/g, ' ')}
                            </div>
                        </div>
                        ${this.canChangeStatus() ? `
                            <div>
                                <div class="status-label">Change Status</div>
                                <select class="status-dropdown" id="statusSelect">
                                    ${this.renderStatusOptions()}
                                </select>
                                <button class="btn btn-primary review-button" id="submitStatusBtn">
                                    Update Status
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Comments Section -->
                <div class="panel-section">
                    <div class="panel-section-title">Comments</div>
                    <div class="comments-section">
                        <div class="comments-list" id="commentsList">
                            ${this.renderComments()}
                        </div>
                        <div class="comment-input">
                            <textarea
                                class="comment-textarea"
                                id="commentInput"
                                placeholder="Add a comment..."
                            ></textarea>
                            <button class="btn btn-primary comment-submit" id="submitCommentBtn">
                                Post Comment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        document.getElementById('closeBtn').addEventListener('click', () => this.close());

        if (this.canUpload()) {
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');

            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        if (this.canChangeStatus()) {
            document.getElementById('submitStatusBtn').addEventListener('click', () => {
                this.updateStatus();
            });
        }

        document.getElementById('submitCommentBtn').addEventListener('click', () => {
            this.postComment();
        });

        document.getElementById('commentInput').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.postComment();
            }
        });
    },

    /**
     * Render file preview
     */
    renderFilePreview() {
        const evidence = this.currentEvidence;

        if (!evidence.file_url) {
            return '<div class="file-empty">No file uploaded</div>';
        }

        const fileType = this.getFileType(evidence.file_url);

        if (fileType === 'image') {
            return `<img src="${evidence.file_url}" alt="Evidence file">`;
        } else if (fileType === 'pdf') {
            return `<iframe src="${evidence.file_url}" type="application/pdf"></iframe>`;
        } else if (fileType === 'docx') {
            const filename = evidence.file_url.split('/').pop();
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 1rem;">
                    <div style="font-size: 3rem;">📄</div>
                    <div style="color: var(--color-text-secondary); text-align: center;">
                        <div>${filename}</div>
                        <div style="font-size: 0.85rem; margin-top: 0.5rem;">Click download to view</div>
                    </div>
                </div>
            `;
        } else {
            const filename = evidence.file_url.split('/').pop();
            return `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 1rem;">
                    <div style="font-size: 3rem;">📁</div>
                    <div style="color: var(--color-text-secondary); text-align: center;">
                        ${filename}
                    </div>
                </div>
            `;
        }
    },

    /**
     * Get file type from URL
     */
    getFileType(url) {
        const ext = url.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
        if (ext === 'pdf') return 'pdf';
        if (ext === 'docx') return 'docx';
        return 'file';
    },

    /**
     * Render workflow visualization
     */
    renderWorkflow() {
        const statuses = [
            'empty',
            'uploaded',
            'under_review',
            'pm_approved',
            'grc_approved',
            'admin_approved',
            'assessor_approved'
        ];

        const currentIndex = statuses.indexOf(this.currentEvidence.status || 'empty');

        return statuses.map((status, index) => {
            const classes = ['workflow-step'];
            if (index <= currentIndex) classes.push('completed');
            if (index === currentIndex) classes.push('active');

            return `<div class="${classes.join(' ')}" title="${status.replace(/_/g, ' ')}"></div>`;
        }).join('');
    },

    /**
     * Render comments
     */
    renderComments() {
        const comments = this.currentEvidence.comments || [];

        if (comments.length === 0) {
            return '<div style="color: var(--color-text-muted); text-align: center; padding: 1rem;">No comments yet</div>';
        }

        return comments.map(comment => {
            const initials = (comment.display_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
            return `
                <div class="comment">
                    <div class="comment-avatar">${initials}</div>
                    <div class="comment-body">
                        <div class="comment-header">
                            <span class="comment-name">${comment.display_name || 'User'}</span>
                            <span class="comment-role">${comment.role || 'User'}</span>
                            <span class="comment-time">${this.formatTime(comment.created_at)}</span>
                        </div>
                        <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render status options dropdown
     */
    renderStatusOptions() {
        const allowedStatuses = this.getAllowedStatuses();
        const current = this.currentEvidence.status || 'empty';

        return allowedStatuses.map(status => {
            return `<option value="${status}" ${status === current ? 'selected' : ''}>${status.replace(/_/g, ' ')}</option>`;
        }).join('');
    },

    /**
     * Check if current user can upload
     */
    canUpload() {
        if (!this.currentUser) return false;

        const allowedRoles = ['tru_team', 'iexpert_grc', 'admin'];
        return allowedRoles.includes(this.currentUser.role);
    },

    /**
     * Check if current user can change status
     */
    canChangeStatus() {
        if (!this.currentUser) return false;

        const allowedRoles = ['tru_team', 'iexpert_pm', 'iexpert_grc', 'admin'];
        return allowedRoles.includes(this.currentUser.role);
    },

    /**
     * Get allowed status transitions for current user
     */
    getAllowedStatuses() {
        const role = this.currentUser?.role || 'viewer';
        const current = this.currentEvidence.status || 'empty';

        const transitions = {
            tru_team: ['empty', 'uploaded'],
            iexpert_pm: ['uploaded', 'pm_approved', 'pm_revision'],
            iexpert_grc: ['uploaded', 'grc_approved', 'grc_revision'],
            admin: ['uploaded', 'pm_approved', 'grc_approved', 'admin_approved'],
            assessor: ['admin_approved', 'assessor_approved', 'assessor_rejected']
        };

        return transitions[role] || [current];
    },

    /**
     * Handle file upload
     */
    async handleFileUpload(file) {
        if (file.size > 100 * 1024 * 1024) {
            window.App.toast('File too large (max 100MB)', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadArea = document.getElementById('uploadArea');
            if (uploadArea) uploadArea.style.opacity = '0.5';

            await window.API.uploadEvidence(this.currentEvidenceId, formData);

            window.App.toast('File uploaded successfully', 'success');

            // Reload evidence
            this.currentEvidence = await window.API.getEvidence(this.currentEvidenceId);
            this.renderPanel();
        } catch (error) {
            window.App.toast('Upload failed: ' + error.message, 'error');
        }
    },

    /**
     * Update status
     */
    async updateStatus() {
        const statusSelect = document.getElementById('statusSelect');
        const newStatus = statusSelect.value;

        if (newStatus === this.currentEvidence.status) {
            window.App.toast('Status unchanged', 'info');
            return;
        }

        try {
            await window.API.updateEvidenceStatus(this.currentEvidenceId, newStatus);
            window.App.toast('Status updated successfully', 'success');

            // Reload evidence
            this.currentEvidence = await window.API.getEvidence(this.currentEvidenceId);
            this.renderPanel();
        } catch (error) {
            window.App.toast('Failed to update status: ' + error.message, 'error');
        }
    },

    /**
     * Post comment
     */
    async postComment() {
        const textarea = document.getElementById('commentInput');
        const text = textarea.value.trim();

        if (!text) {
            window.App.toast('Comment cannot be empty', 'error');
            return;
        }

        try {
            const submitBtn = document.getElementById('submitCommentBtn');
            submitBtn.disabled = true;

            await window.API.addComment(this.currentEvidenceId, text);
            window.App.toast('Comment posted', 'success');

            textarea.value = '';

            // Reload evidence
            this.currentEvidence = await window.API.getEvidence(this.currentEvidenceId);
            this.renderPanel();
        } catch (error) {
            window.App.toast('Failed to post comment: ' + error.message, 'error');
        }
    },

    /**
     * Format time
     */
    formatTime(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
