// ============================================
// Modern Login System - Frontend Logic
// ============================================

class LoginSystem {
    constructor() {
        this.apiBase = '/auth';
        this.sessionKey = 'auth_session';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupParticles();
        this.updateTimestamp();
        this.checkExistingSession();
        
        // Update timestamp every second
        setInterval(() => this.updateTimestamp(), 1000);
    }

    // ===== Event Listeners =====
    setupEventListeners() {
        const loginForm = document.getElementById('login-form');
        const togglePassword = document.getElementById('toggle-password');
        
        loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        togglePassword.addEventListener('click', () => this.togglePasswordVisibility());
        
        // Input validation on blur
        document.getElementById('username').addEventListener('blur', (e) => {
            this.validateField(e.target, 'Kullanıcı adı gereklidir');
        });
        
        document.getElementById('password').addEventListener('blur', (e) => {
            this.validateField(e.target, 'Şifre gereklidir');
        });
        
        // Clear errors on input
        document.getElementById('username').addEventListener('input', (e) => {
            this.clearError('username-error');
        });
        
        document.getElementById('password').addEventListener('input', (e) => {
            this.clearError('password-error');
        });
    }

    // ===== Particle Animation =====
    setupParticles() {
        const canvas = document.getElementById('particles');
        const ctx = canvas.getContext('2d');
        
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles = [];
        const particleCount = 100;
        
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.radius = Math.random() * 2 + 1;
                this.opacity = Math.random() * 0.5 + 0.2;
            }
            
            update() {
                this.x += this.vx;
                this.y += this.vy;
                
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(139, 92, 246, ${this.opacity})`;
                ctx.fill();
            }
        }
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });
            
            // Draw connections
            particles.forEach((p1, i) => {
                particles.slice(i + 1).forEach(p2 => {
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 100) {
                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 * (1 - distance / 100)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                });
            });
            
            requestAnimationFrame(animate);
        }
        
        animate();
        
        // Resize handler
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }

    // ===== Timestamp =====
    updateTimestamp() {
        const now = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        const timestamp = now.toLocaleDateString('tr-TR', options);
        const timestampElement = document.getElementById('timestamp');
        if (timestampElement) {
            timestampElement.textContent = timestamp;
        }
    }

    // ===== Form Validation =====
    validateField(field, errorMessage) {
        const errorElement = document.getElementById(`${field.id}-error`);
        
        if (!field.value.trim()) {
            errorElement.textContent = errorMessage;
            errorElement.classList.add('show');
            field.style.borderColor = '#ef4444';
            return false;
        } else {
            this.clearError(`${field.id}-error`);
            field.style.borderColor = '';
            return true;
        }
    }

    clearError(errorId) {
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.classList.remove('show');
            errorElement.textContent = '';
        }
    }

    // ===== Password Visibility =====
    togglePasswordVisibility() {
        const passwordField = document.getElementById('password');
        const toggleBtn = document.getElementById('toggle-password');
        const icon = toggleBtn.querySelector('i');
        
        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordField.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // ===== Login Handler =====
    async handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Validate
        const usernameValid = this.validateField(
            document.getElementById('username'),
            'Kullanıcı adı gereklidir'
        );
        const passwordValid = this.validateField(
            document.getElementById('password'),
            'Şifre gereklidir'
        );
        
        if (!usernameValid || !passwordValid) {
            this.showToast('Lütfen tüm alanları doldurun', 'error');
            return;
        }
        
        // Show loading
        this.setLoading(true);
        
        try {
            const response = await fetch(`${this.apiBase}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();

            if (data.success) {
                // Save session to localStorage AND cookie
                localStorage.setItem(this.sessionKey, data.data.sessionToken);
                
                // Set cookie for server-side auth
                document.cookie = `sessionToken=${data.data.sessionToken}; path=/; max-age=86400; SameSite=Lax`;
                
                // Show success
                this.showAlert('Giriş başarılı! Yönlendiriliyorsunuz...', 'success');
                this.showToast(`Hoş geldiniz, ${data.data.user.username}!`, 'success');
                
                // Redirect after 1 second
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                this.showAlert(data.message || 'Giriş başarısız', 'error');
                this.showToast(data.message || 'Giriş başarısız', 'error');
                this.setLoading(false);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
            this.showToast('Sunucuya bağlanılamadı', 'error');
            this.setLoading(false);
        }
    }

    // ===== Session Check =====
    async checkExistingSession() {
        const sessionToken = localStorage.getItem(this.sessionKey);

        if (!sessionToken) return;

        try {
            const response = await fetch(`${this.apiBase}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken })
            });

            const data = await response.json();

            if (data.success) {
                if (data.data.sessionToken) localStorage.setItem(this.sessionKey, data.data.sessionToken);
                this.showToast('Oturum aktif, yönlendiriliyorsunuz...', 'success');
                setTimeout(() => { window.location.href = '/'; }, 1000);
            } else {
                localStorage.removeItem(this.sessionKey);
            }

        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    // ===== UI Helpers =====
    setLoading(loading) {
        const loginBtn = document.getElementById('login-btn');
        const progressBar = document.querySelector('.login-progress');
        
        if (loading) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
            progressBar.classList.add('active');
            
            // Animate progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 30;
                if (progress > 90) progress = 90;
                document.getElementById('progress-bar').style.width = `${progress}%`;
            }, 200);
            
            loginBtn.dataset.progressInterval = interval;
        } else {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
            progressBar.classList.remove('active');
            document.getElementById('progress-bar').style.width = '0%';
            
            if (loginBtn.dataset.progressInterval) {
                clearInterval(loginBtn.dataset.progressInterval);
            }
        }
    }

    showAlert(message, type) {
        const alertContainer = document.getElementById('alert-container');
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        alertContainer.innerHTML = '';
        alertContainer.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    }

    showToast(message, type) {
        const toastContainer = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===== Public Methods =====
    static logout() {
        const sessionToken = localStorage.getItem('auth_session');
        
        fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionToken })
        }).then(() => {
            localStorage.removeItem('auth_session');
            // Clear cookie
            document.cookie = 'sessionToken=; path=/; max-age=0';
            window.location.href = '/auth/login.html';
        });
    }

    static getSession() {
        return localStorage.getItem('auth_session');
    }

    static isAuthenticated() {
        return !!localStorage.getItem('auth_session') || !!localStorage.getItem('auth_remember');
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LoginSystem();
    });
} else {
    new LoginSystem();
}

// Export for use in other scripts
window.LoginSystem = LoginSystem;
