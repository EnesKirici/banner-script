const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./auth/auth-routes');
const { securityHeaders, corsMiddleware, rateLimiter, requireAuth } = require('./auth/auth-middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(securityHeaders);

// Static files
app.use(express.static('resources/css'));
app.use('/auth', express.static(path.join(__dirname, 'auth')));

// Auth routes with rate limiting
app.use('/auth', corsMiddleware);
app.use('/auth/login', rateLimiter.middleware(5, 15 * 60 * 1000)); // 5 attempts per 15 minutes
app.use('/auth', authRoutes);

// Protected route example - Ana sayfa artık auth gerektiriyor
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'resources/css/index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        auth: 'enabled'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint bulunamadı'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Sunucu hatası',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 AUTH SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`\n🚀 Server: http://localhost:${PORT}`);
    console.log(`🔑 Login: http://localhost:${PORT}/auth/login.html`);
    console.log('\n📋 Default Credentials:');
    console.log('   Username: elw');
    console.log('   Password: Enye1824/');
    console.log('\n' + '='.repeat(60) + '\n');
});

module.exports = app;
