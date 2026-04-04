/**
 * API Client Module
 * Handles all HTTP requests to the backend API
 */

window.API = {
    token: localStorage.getItem('token') || null,

    setToken(t) {
        this.token = t;
        localStorage.setItem('token', t);
    },

    clearToken() {
        this.token = null;
        localStorage.removeItem('token');
    },

    async request(method, url, body, isFormData = false) {
        const headers = {};
        if (this.token) {
            headers['Authorization'] = 'Bearer ' + this.token;
        }
        if (body && !isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        const opts = { method, headers };
        if (body) {
            opts.body = isFormData ? body : JSON.stringify(body);
        }
        const res = await fetch('/api' + url, opts);
        if (res.status === 401) {
            this.clearToken();
            if (window.App) window.App.navigate('login');
            return null;
        }
        let data;
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
        return data;
    },

    get(url) { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); },
    patch(url, body) { return this.request('PATCH', url, body); },
    delete(url) { return this.request('DELETE', url); },
    upload(url, formData) { return this.request('POST', url, formData, true); },

    // Auth
    login(username, password) { return this.post('/auth/login', { username, password }); },
    getCurrentUser() { return this.get('/auth/me'); },
    logout() { this.clearToken(); return Promise.resolve(); },

    // Dashboard
    getDashboardStats() { return this.get('/dashboard/stats'); },
    getDashboardRequirements() { return this.get('/dashboard/requirements'); },

    // Requirements & Evidence
    getRequirement(reqId) { return this.get('/requirements/' + reqId); },
    getEvidencePoints(reqId, filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.get('/requirements/' + reqId + '/evidence?' + query);
    },
    getEvidence(evidenceId) { return this.get('/evidence/' + evidenceId); },
    uploadEvidence(evidenceId, formData) { return this.upload('/evidence/' + evidenceId + '/upload', formData); },
    updateEvidenceStatus(evidenceId, status) { return this.patch('/evidence/' + evidenceId, { status }); },
    addComment(evidenceId, text) { return this.post('/evidence/' + evidenceId + '/comments', { text }); },
    getComments(evidenceId) { return this.get('/evidence/' + evidenceId + '/comments'); },

    // Admin
    getUsers() { return this.get('/admin/users'); },
    updateUser(userId, data) { return this.patch('/admin/users/' + userId, data); },
    toggleUserActive(userId, active) { return this.patch('/admin/users/' + userId, { active }); },
    triggerFolderScan() { return this.post('/admin/scan', {}); },
    getAuditLog(limit = 50, offset = 0) {
        return this.get('/admin/audit-log?limit=' + limit + '&offset=' + offset);
    }
};
