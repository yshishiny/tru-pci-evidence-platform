/**
 * API Client Module
 * Handles all HTTP requests to the backend API
 */

window.API = {
    token: localStorage.getItem('token') || null,

    /**
     * Set and persist authentication token
     */
    setToken(t) {
        this.token = t;
        localStorage.setItem('token', t);
    },

    /**
     * Clear authentication token
     */
    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    },

    /**
     * Make HTTP request to API
     * @param {string} method HTTP method (GET, POST, PATCH, DELETE, etc.)
     * @param {string} url API endpoint path (e.g., '/auth/login')
     * @param {object|FormData} body Request body
     * @param {boolean} isFormData Whether body is FormData (for file uploads)
     * @returns {Promise<object>} Response data
     */
    async request(method, url, body, isFormData = false) {
        const headers = {};

        // Add authorization header if token exists
        if (this.token) {
            headers['Authorization'] = 'Bearer ' + this.token;
        }

        // Add content-type header for JSON
        if (body && !isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const opts = {
            method,
            headers
        };

        // Add request body
        if (body) {
            opts.body = isFormData ? body : JSON.stringify(body);
        }

        // Make request
        const res = await fetch('/api' + url, opts);

        // Handle unauthorized - clear token and redirect to login
        if (res.status === 401) {
            this.clearToken();
            if (window.App) {
                window.App.navigate('login');
            }
            return null;
        }

        // Parse response
        let data;
        try {
            data = await res.json();
        } catch {
            data = {};
        }

        // Handle error responses
        if (!res.ok) {
            throw new Error(data.error || data.message || 'Request failed');
        }

        return data;
    },

    /**
     * GET request
     */
    get(url) {
        return this.request('GET', url);
    },

    /**
     * POST request
     */
    post(url, body) {
        return this.request('POST', url, body);
    },

    /**
     * PATCH request
     */
    patch(url, body) {
        return this.request('PATCH', url, body);
    },

    /**
     * DELETE request
     */
    delete(url) {
        return this.request('DELETE', url);
    },

    /**
     * Upload files (multipart/form-data)
     */
    upload(url, formData) {
        return this.request('POST', url, formData, true);
    },

    /**
     * Auth endpoints
     */
    login(username, password) {
        return this.post('/auth/login', { username, password });
    },

    getCurrentUser() {
        return this.get('/auth/me');
    },

    logout() {
        this.clearToken();
        return Promise.resolve();
    },

    /**
     * Dashboard endpoints
     */
    getDashboardStats() {
        return this.get('/dashboard/stats');
    },

    getDashboardRequirements() {
        return this.get('/dashboard/requirements');
    },

    /**
     * Requirement endpoints
     */
    getRequirement(reqId) {
        return this.get(`/requirements/${reqId}`);
    },

    getEvidencePoints(reqId, filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.get(`/requirements/${reqId}/evidence?${query}`);
    },

    /**
     * Evidence endpoints
     */
    getEvidence(evidenceId) {
        return this.get(`/evidence/${evidenceId}`);
    },

    uploadEvidence(evidenceId, formData) {
        return this.upload(`/evidence/${evidenceId}/upload`, formData);
    },

    updateEvidenceStatus(evidenceId, status) {
        return this.patch(`/evidence/${evidenceId}`, { status });
    },

    addComment(evidenceId, text) {
        return this.post(`/evidence/${evidenceId}/comments`, { text });
    },

    getComments(evidenceId) {
        return this.get(`/evidence/${evidenceId}/comments`);
    },

    /**
     * Admin endpoints
     */
    getUsers() {
        return this.get('/admin/users');
    },

    updateUser(userId, data) {
        return this.patch(`/admin/users/${userId}`, data);
    },

    toggleUserActive(userId, active) {
        return this.patch(`/admin/users/${userId}`, { active });
    },

    triggerFolderScan() {
        return this.post('/admin/scan', {});
    },

    getAuditLog(limit = 50, offset = 0) {
        return this.get(`/admin/audit?limit=${limit}&offset=${offset}`);
    }
};
