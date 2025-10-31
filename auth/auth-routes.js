import express from 'express';
import AuthDatabase from './database.js';

const router = express.Router();
const authDb = new AuthDatabase();

// Cleanup expired tokens every hour
setInterval(() => {
    authDb.cleanupExpiredTokens();
}, 60 * 60 * 1000);

// Login endpoint
router.post('/login', async (req, res) => {
    try {
    const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Kullanıcı adı ve şifre gereklidir'
            });
        }

        // Verify user credentials
        const user = authDb.verifyUser(username, password);
        
        if (!user) {
            // Log failed attempt
            const tempUser = authDb.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
            if (tempUser) {
                authDb.logLoginAttempt(
                    tempUser.id,
                    req.ip,
                    req.get('user-agent'),
                    false
                );
            }
            
            return res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı'
            });
        }

        // Log successful attempt
        authDb.logLoginAttempt(
            user.id,
            req.ip,
            req.get('user-agent'),
            true
        );

        // Create session
        const session = authDb.createSession(
            user.id,
            req.ip,
            req.get('user-agent')
        );

        res.json({
            success: true,
            message: 'Giriş başarılı',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    loginCount: user.login_count
                },
                sessionToken: session.token,
                expiresAt: session.expiresAt
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

// Verify session endpoint
router.post('/verify', (req, res) => {
    try {
        const { sessionToken, rememberToken } = req.body;

        let session = null;

        // First try session token
        if (sessionToken) {
            session = authDb.verifySession(sessionToken);
        }

        // If no session, try remember token
        if (!session && rememberToken) {
            const rememberedToken = authDb.verifyRememberToken(rememberToken);
            
            if (rememberedToken) {
                // Create new session from remember token
                const newSession = authDb.createSession(
                    rememberedToken.user_id,
                    req.ip,
                    req.get('user-agent')
                );
                
                return res.json({
                    success: true,
                    data: {
                        user: {
                            id: rememberedToken.user_id,
                            username: rememberedToken.username
                        },
                        sessionToken: newSession.token,
                        rememberToken: rememberToken,
                        expiresAt: newSession.expiresAt
                    }
                });
            }
        }

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Oturum süresi dolmuş'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: session.user_id,
                    username: session.username
                },
                expiresAt: session.expires_at
            }
        });

    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    try {
        const { sessionToken, rememberToken } = req.body;

        if (sessionToken) {
            authDb.deleteSession(sessionToken);
        }

        if (rememberToken) {
            authDb.deleteRememberToken(rememberToken);
        }

        res.json({
            success: true,
            message: 'Çıkış yapıldı'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

// Get user info endpoint
router.get('/user', (req, res) => {
    try {
        const sessionToken = req.headers.authorization?.replace('Bearer ', '');

        if (!sessionToken) {
            return res.status(401).json({
                success: false,
                message: 'Yetkilendirme gerekli'
            });
        }

        const session = authDb.verifySession(sessionToken);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Geçersiz oturum'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: session.user_id,
                    username: session.username
                }
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Sunucu hatası'
        });
    }
});

export default router;
