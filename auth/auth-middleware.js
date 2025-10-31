import AuthDatabase from './database.js';

// Initialize database
const authDb = new AuthDatabase();

/**
 * Middleware to check if user is authenticated
 * Usage: app.get('/protected-route', authMiddleware, (req, res) => { ... })
 */
function authMiddleware(req, res, next) {
    try {
        // Get token from Authorization header or body
        const token = req.headers.authorization?.replace('Bearer ', '') 
                   || req.body.sessionToken 
                   || req.query.sessionToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Yetkilendirme gerekli',
                requiresAuth: true
            });
        }

        // Verify session
        const session = authDb.verifySession(token);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Geçersiz veya süresi dolmuş oturum',
                requiresAuth: true
            });
        }

        // Add user info to request
        req.user = {
            id: session.user_id,
            username: session.username
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
}

/**
 * Optional auth middleware - doesn't block if not authenticated
 * Usage: app.get('/route', optionalAuthMiddleware, (req, res) => { ... })
 */
function optionalAuthMiddleware(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') 
                   || req.body.sessionToken 
                   || req.query.sessionToken;

        if (token) {
            const session = authDb.verifySession(token);
            
            if (session) {
                req.user = {
                    id: session.user_id,
                    username: session.username
                };
            }
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
}

/**
 * Middleware to redirect to login if not authenticated (for HTML pages)
 * For API endpoints, returns JSON error
 */
function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.sessionToken || req.query.sessionToken;

        if (!token) {
            // API endpoint için JSON döndür, HTML için redirect
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    message: 'Yetkilendirme gerekli. Lütfen giriş yapın.',
                    requiresAuth: true
                });
            }
            return res.redirect('/auth/login.html');
        }

        const session = authDb.verifySession(token);

        if (!session) {
            // API endpoint için JSON döndür, HTML için redirect
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({
                    success: false,
                    message: 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.',
                    requiresAuth: true
                });
            }
            return res.redirect('/auth/login.html');
        }

        req.user = {
            id: session.user_id,
            username: session.username
        };

        next();
    } catch (error) {
        console.error('Require auth error:', error);
        // API endpoint için JSON döndür, HTML için redirect
        if (req.path.startsWith('/api/')) {
            return res.status(500).json({
                success: false,
                message: 'Sunucu hatası'
            });
        }
        res.redirect('/auth/login.html');
    }
}

/**
 * Rate limiting middleware to prevent brute force attacks
 */
class RateLimiter {
    constructor() {
        this.attempts = new Map();
        this.blockedIPs = new Map();
        
        // Clean up old attempts every 15 minutes
        setInterval(() => this.cleanup(), 15 * 60 * 1000);
    }

    middleware(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        return (req, res, next) => {
            const ip = req.ip;
            const now = Date.now();

            // Check if IP is blocked
            if (this.blockedIPs.has(ip)) {
                const blockedUntil = this.blockedIPs.get(ip);
                
                if (now < blockedUntil) {
                    const remainingTime = Math.ceil((blockedUntil - now) / 1000 / 60);
                    return res.status(429).json({
                        success: false,
                        message: `Çok fazla başarısız deneme. ${remainingTime} dakika sonra tekrar deneyin.`
                    });
                } else {
                    this.blockedIPs.delete(ip);
                    this.attempts.delete(ip);
                }
            }

            // Get attempt history
            let attempts = this.attempts.get(ip) || [];
            
            // Remove old attempts outside the window
            attempts = attempts.filter(timestamp => now - timestamp < windowMs);

            // Check if exceeded max attempts
            if (attempts.length >= maxAttempts) {
                // Block for 15 minutes
                this.blockedIPs.set(ip, now + windowMs);
                
                return res.status(429).json({
                    success: false,
                    message: 'Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.'
                });
            }

            // Add current attempt
            attempts.push(now);
            this.attempts.set(ip, attempts);

            // Add remaining attempts to response
            res.set('X-RateLimit-Limit', maxAttempts);
            res.set('X-RateLimit-Remaining', maxAttempts - attempts.length);

            next();
        };
    }

    cleanup() {
        const now = Date.now();
        
        // Clean up old attempts
        for (const [ip, attempts] of this.attempts.entries()) {
            const validAttempts = attempts.filter(timestamp => now - timestamp < 15 * 60 * 1000);
            
            if (validAttempts.length === 0) {
                this.attempts.delete(ip);
            } else {
                this.attempts.set(ip, validAttempts);
            }
        }

        // Clean up expired blocks
        for (const [ip, blockedUntil] of this.blockedIPs.entries()) {
            if (now >= blockedUntil) {
                this.blockedIPs.delete(ip);
            }
        }
    }

    reset(ip) {
        this.attempts.delete(ip);
        this.blockedIPs.delete(ip);
    }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter();

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "font-src 'self' https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self';"
    );
    
    next();
}

/**
 * CORS middleware for auth routes
 */
function corsMiddleware(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
}

export {
    authMiddleware,
    optionalAuthMiddleware,
    requireAuth,
    rateLimiter,
    securityHeaders,
    corsMiddleware
};
