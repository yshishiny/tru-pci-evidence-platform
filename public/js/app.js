/**
 * Main Application Router and Initialization
 * Hash-based SPA router with authentication checks
 */

window.App = {
    currentUser: null,
    currentRoute: null,

    /**
     * Initialize application
     */
    async init() {
        // Check if user is authenticated
        const token = window.API.token;

        if (!token) {
            // Not logged in, show login page
            window.AuthView.render();
        } else {
            // Token exists, validate it
            try {
                const user = await window.API.getCurrentUser();
                this.currentUser = user;

                // Valid token, route to current URL or dashboard
                const hash = window.location.hash.slice(1) || 'dashboard';
                this.navigate(hash);
            } catch (error) {
                // Invalid token
                window.API.clearToken();
                window.AuthView.render();
            }
        }

        // Setup hash change listener
        window.addEventListener('hashchange', () => {
            this.handleRoute();
        });
    },

    /**
     * Navigate to a route
     */
    navigate(route) {
        window.location.hash = '#/' + route.replace(/^\//, '');
    },

    /**
     * Handle route changes
     */
    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/dashboard';
        const path = hash.slice(1); // Remove leading slash
        const parts = path.split('/');
        const route = parts[0];
        const param = parts[1];

        // Check authentication
        if (route !== 'login' && !window.API.token) {
            window.AuthView.render();
            return;
        }

        // Route to appropriate view
        switch (route) {
            case 'login':
                window.AuthView.render();
                break;

            case 'dashboard':
                window.DashboardView.render();
                break;

            case 'requirement':
                if (param) {
                    window.RequirementView.render(param);
                } else {
                    this.navigate('dashboard');
                }
                break;

            case 'admin':
                // Check if user is admin
                try {
                    const user = await window.API.getCurrentUser();
                    if (user.role !== 'admin') {
                        this.navigate('dashboard');
                        window.App.toast('Access denied', 'error');
                        return;
                    }
                } catch (error) {
                    this.navigate('login');
                    return;
                }
                window.AdminView.render();
                break;

            case 'reports':
                window.ReportsView.render();
                break;

            case 'review':
                // Check if user is admin
                try {
                    const user = await window.API.getCurrentUser();
                    if (user.role !== 'admin') {
                        this.navigate('dashboard');
                        window.App.toast('Access denied', 'error');
                        return;
                    }
                } catch (error) {
                    this.navigate('login');
                    return;
                }
                window.ReviewView.render();
                break;

            case 'alerts':
                // Check if user is admin
                try {
                    const user = await window.API.getCurrentUser();
                    if (user.role !== 'admin') {
                        this.navigate('dashboard');
                        window.App.toast('Access denied', 'error');
                        return;
                    }
                } catch (error) {
                    this.navigate('login');
                    return;
                }
                window.AlertsView.render();
                break;

            default:
                this.navigate('dashboard');
        }

        this.currentRoute = route;
    },

    /**
     * Logout
     */
    async logout() {
        try {
            await window.API.logout();
            window.API.clearToken();
            this.currentUser = null;
            this.navigate('login');
            window.App.toast('Logged out successfully', 'info');
        } catch (error) {
            console.error('Logout error:', error);
        }
    },

    /**
     * Show toast notification
     */
    toast(message, type = 'info') {
        // Create container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            info: 'ⓘ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || '•'}</div>
            <div>${message}</div>
        `;

        // Add to container
        container.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'toastSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.App.init();
    });
} else {
    window.App.init();
}
