import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AuthDatabase {
    constructor(dbPath = path.join(__dirname, 'auth.db')) {
        console.log('🔐 Initializing Auth Database...');
        this.db = new Database(dbPath);
        console.log(`📂 Database path: ${dbPath}`);
        this.initializeTables();
        this.initializeDefaultUser();
        console.log('✅ Auth Database ready!');
    }

    initializeTables() {
        // Kullanıcı tablosu
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                login_count INTEGER DEFAULT 0
            )
        `);

        // Remember me token tablosu
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS remember_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Session tablosu
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Login history tablosu
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS login_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                success BOOLEAN NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    }

    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    }

    generateSalt() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateToken() {
        return crypto.randomBytes(64).toString('hex');
    }

    initializeDefaultUser() {
        const username = 'elw';
        const password = 'Enye1824/';
        
        const existingUser = this.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        
        if (!existingUser) {
            const salt = this.generateSalt();
            const passwordHash = this.hashPassword(password, salt);
            
            const stmt = this.db.prepare(`
                INSERT INTO users (username, password_hash, salt)
                VALUES (?, ?, ?)
            `);
            
            stmt.run(username, passwordHash, salt);
            console.log(`✓ Default user created: ${username}`);
        } else {
            console.log(`✓ Default user exists: ${username}`);
        }
    }

    verifyUser(username, password) {
        const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        
        if (!user) {
            return null;
        }

        const passwordHash = this.hashPassword(password, user.salt);
        
        if (passwordHash === user.password_hash) {
            // Update last login
            this.db.prepare(`
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP, 
                    login_count = login_count + 1
                WHERE id = ?
            `).run(user.id);
            
            return {
                id: user.id,
                username: user.username,
                last_login: user.last_login,
                login_count: user.login_count + 1
            };
        }
        
        return null;
    }

    createSession(userId, ipAddress, userAgent) {
        const token = this.generateToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat
        
        const stmt = this.db.prepare(`
            INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(userId, token, ipAddress, userAgent, expiresAt.toISOString());
        
        return {
            token,
            expiresAt
        };
    }

    createRememberToken(userId) {
        const token = this.generateToken();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
        
        const stmt = this.db.prepare(`
            INSERT INTO remember_tokens (user_id, token, expires_at)
            VALUES (?, ?, ?)
        `);
        
        stmt.run(userId, token, expiresAt.toISOString());
        
        return {
            token,
            expiresAt
        };
    }

    verifySession(sessionToken) {
        const session = this.db.prepare(`
            SELECT s.*, u.username
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.session_token = ? AND s.expires_at > datetime('now')
        `).get(sessionToken);
        
        return session;
    }

    verifyRememberToken(rememberToken) {
        const token = this.db.prepare(`
            SELECT rt.*, u.username
            FROM remember_tokens rt
            JOIN users u ON rt.user_id = u.id
            WHERE rt.token = ? AND rt.expires_at > datetime('now')
        `).get(rememberToken);
        
        return token;
    }

    deleteSession(sessionToken) {
        this.db.prepare('DELETE FROM sessions WHERE session_token = ?').run(sessionToken);
    }

    deleteRememberToken(rememberToken) {
        this.db.prepare('DELETE FROM remember_tokens WHERE token = ?').run(rememberToken);
    }

    deleteAllUserSessions(userId) {
        this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
        this.db.prepare('DELETE FROM remember_tokens WHERE user_id = ?').run(userId);
    }

    logLoginAttempt(userId, ipAddress, userAgent, success) {
        const stmt = this.db.prepare(`
            INSERT INTO login_history (user_id, ip_address, user_agent, success)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run(userId, ipAddress, userAgent, success ? 1 : 0);
    }

    cleanupExpiredTokens() {
        this.db.prepare('DELETE FROM sessions WHERE expires_at < datetime("now")').run();
        this.db.prepare('DELETE FROM remember_tokens WHERE expires_at < datetime("now")').run();
    }

    close() {
        this.db.close();
    }
}

export default AuthDatabase;
