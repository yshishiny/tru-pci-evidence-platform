/**
 * Authentication View
 * Renders login form and handles authentication
 */

window.AuthView = {
    /**
     * Render login page
     */
    render() {
        const app = document.getElementById('app');

        app.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-logo">TRU</div>
                    <div class="login-subtitle">PCI DSS Evidence Platform</div>

                    <form id="loginForm">
                        <div class="form-group">
                            <label class="form-label">Username</label>
                            <input
                                type="text"
                                id="username"
                                class="form-input"
                                placeholder="Enter your username"
                                required
                            >
                        </div>

                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input
                                type="password"
                                id="password"
                                class="form-input"
                                placeholder="Enter your password"
                                required
                            >
                        </div>

                        <div id="errorMessage" class="form-error"></div>

                        <button type="submit" class="login-button" id="loginBtn">
                            Sign In
                        </button>
                    </form>
                </div>
            </div>
        `;

        // Attach event listeners
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            this.handleLogin(e);
        });
    },

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');
        const loginBtn = document.getElementById('loginBtn');

        // Clear previous errors
        errorDiv.textContent = '';

        // Disable button during request
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        try {
            // Make login request
            const response = await window.API.login(username, password);

            if (!response) {
                throw new Error('Login failed');
            }

            // Store token
            if (response.token) {
                window.API.setToken(response.token);
            }

            // Show success message
            window.App.toast('Login successful', 'success');

            // Navigate to dashboard
            setTimeout(() => {
                window.App.navigate('dashboard');
            }, 300);

        } catch (error) {
            errorDiv.textContent = error.message || 'Login failed. Please try again.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
            window.App.toast(error.message || 'Login failed', 'error');
        }
    }
};
