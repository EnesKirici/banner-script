# 🔐 Modern SQLite Authentication System

Profesyonel, güvenli ve modern bir kullanıcı giriş sistemi. SQLite veritabanı ile güçlendirilmiş, tam özellikli authentication çözümü.

## ✨ Özellikler

### 🔒 Güvenlik
- **PBKDF2-SHA512** şifre hashleme (100,000 iterasyon)
- **Salt** ile her kullanıcı için benzersiz hash
- **Session-based** authentication
- **Remember Me** token sistemi (30 gün)
- **Rate Limiting** - Brute force saldırı koruması
- **Security Headers** - XSS, Clickjacking koruması
- **CORS** yapılandırması
- **SQL Injection** koruması (Prepared Statements)

### 💾 Veritabanı
- **SQLite** - Hafif ve hızlı
- **4 Tablo Yapısı:**
  - `users` - Kullanıcı bilgileri
  - `sessions` - Aktif oturumlar
  - `remember_tokens` - "Beni Hatırla" token'ları
  - `login_history` - Giriş geçmişi

### 🎨 Modern UI/UX
- **Glassmorphism** tasarım
- **Gradient** efektler
- **Particle** animasyonu
- **Responsive** tasarım (mobil uyumlu)
- **Toast** bildirimleri
- **Loading** animasyonları
- **Form validasyonu** (gerçek zamanlı)

### 📱 Frontend Özellikleri
- **Remember Me** checkbox
- **Show/Hide Password** toggle
- **Real-time Validation**
- **Error Messages**
- **Loading States**
- **Progress Bar**
- **Auto Session Check**

## 📁 Dosya Yapısı

```
auth/
├── database.js          # SQLite veritabanı yönetimi
├── auth-routes.js       # API endpoints (login, logout, verify)
├── auth-middleware.js   # Authentication middleware & security
├── login.html          # Modern login sayfası
├── login.css           # Stil dosyası (glassmorphism, animations)
├── login.js            # Frontend logic (validation, API calls)
├── dashboard.html      # Protected dashboard örneği
└── auth.db            # SQLite veritabanı (otomatik oluşturulur)

auth-server.js          # Express server (auth entegrasyonu ile)
```

## 🚀 Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

Yeni eklenen paketler:
- `better-sqlite3` - SQLite veritabanı
- `cookie-parser` - Cookie yönetimi
- `express-session` - Session desteği

### 2. Sunucuyu Başlatın

```bash
node auth-server.js
```

### 3. Tarayıcıda Açın

```
http://localhost:3001/auth/login.html
```

## 🔑 Varsayılan Kullanıcı

```
Kullanıcı Adı: elw
Şifre: Enye1824/
```

## 📖 API Endpoints

### POST `/auth/login`
Kullanıcı girişi yapar.

**Request:**
```json
{
  "username": "elw",
  "password": "Enye1824/",
  "rememberMe": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Giriş başarılı",
  "data": {
    "user": {
      "id": 1,
      "username": "elw",
      "loginCount": 5
    },
    "sessionToken": "...",
    "rememberToken": "...",
    "expiresAt": "2025-11-01T..."
  }
}
```

### POST `/auth/verify`
Session veya remember token'ı doğrular.

**Request:**
```json
{
  "sessionToken": "...",
  "rememberToken": "..."
}
```

### POST `/auth/logout`
Oturumu sonlandırır.

**Request:**
```json
{
  "sessionToken": "...",
  "rememberToken": "..."
}
```

### GET `/auth/user`
Kullanıcı bilgilerini getirir (Bearer token gerekli).

**Headers:**
```
Authorization: Bearer {sessionToken}
```

## 🛡️ Middleware Kullanımı

### Protected Route (API)
```javascript
const { authMiddleware } = require('./auth/auth-middleware');

app.get('/api/protected', authMiddleware, (req, res) => {
    // req.user.id
    // req.user.username
    res.json({ message: 'Protected data', user: req.user });
});
```

### Protected Page (HTML)
```javascript
const { requireAuth } = require('./auth/auth-middleware');

app.get('/dashboard', requireAuth, (req, res) => {
    res.sendFile('dashboard.html');
});
```

### Rate Limiting
```javascript
const { rateLimiter } = require('./auth/auth-middleware');

// 5 deneme / 15 dakika
app.post('/auth/login', 
    rateLimiter.middleware(5, 15 * 60 * 1000), 
    (req, res) => {
        // Login logic
    }
);
```

## 🎯 Frontend Kullanımı

### Session Kontrolü
```javascript
// Otomatik session kontrolü (sayfa yüklendiğinde)
const loginSystem = new LoginSystem();

// Manuel kontrol
if (LoginSystem.isAuthenticated()) {
    console.log('User is logged in');
}
```

### Logout
```javascript
LoginSystem.logout();
```

### Session Token Alma
```javascript
const token = LoginSystem.getSession();

fetch('/api/protected', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

## 🔐 Güvenlik Özellikleri

### 1. Şifre Güvenliği
- **PBKDF2** algoritması
- **SHA-512** hash fonksiyonu
- **100,000** iterasyon
- **32 byte** rastgele salt
- Her kullanıcı için benzersiz hash

### 2. Session Güvenliği
- **24 saat** session süresi
- **30 gün** remember token süresi
- Otomatik token temizleme (her saat)
- IP ve User-Agent tracking

### 3. Rate Limiting
- **5 başarısız deneme** → 15 dakika bloke
- IP bazlı kontrol
- Otomatik temizleme

### 4. Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`
- `Referrer-Policy`

## 📊 Veritabanı Şeması

### users
```sql
id              INTEGER PRIMARY KEY
username        TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
salt            TEXT NOT NULL
created_at      DATETIME
last_login      DATETIME
login_count     INTEGER
```

### sessions
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER (FK)
session_token   TEXT UNIQUE NOT NULL
ip_address      TEXT
user_agent      TEXT
expires_at      DATETIME NOT NULL
created_at      DATETIME
```

### remember_tokens
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER (FK)
token           TEXT UNIQUE NOT NULL
expires_at      DATETIME NOT NULL
created_at      DATETIME
```

### login_history
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER (FK)
ip_address      TEXT
user_agent      TEXT
success         BOOLEAN NOT NULL
timestamp       DATETIME
```

## 🎨 Tasarım Özellikleri

### CSS Variables
- Özelleştirilebilir renkler
- Gradient tanımları
- Spacing sistemi
- Border radius değerleri

### Animasyonlar
- **Float** - Arka plan küreleri
- **Pulse** - Logo animasyonu
- **Slide** - Form element'leri
- **Fade** - Alert mesajları
- **Shake** - Hata mesajları

### Responsive Breakpoints
- **1024px** - Tablet
- **768px** - Mobile
- **480px** - Small mobile

## 🔧 Yapılandırma

### Port Değiştirme
```javascript
// auth-server.js
const PORT = process.env.PORT || 3001;
```

### Session Süresi
```javascript
// auth/database.js - createSession()
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat
```

### Remember Token Süresi
```javascript
// auth/database.js - createRememberToken()
const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
```

### Rate Limit Ayarları
```javascript
// auth-server.js
app.use('/auth/login', rateLimiter.middleware(5, 15 * 60 * 1000));
//                                            ↑   ↑
//                                   Max attempts  Window (ms)
```

## 📝 Yeni Kullanıcı Ekleme

```javascript
const AuthDatabase = require('./auth/database');
const authDb = new AuthDatabase();

const salt = authDb.generateSalt();
const passwordHash = authDb.hashPassword('newpassword', salt);

authDb.db.prepare(`
    INSERT INTO users (username, password_hash, salt)
    VALUES (?, ?, ?)
`).run('newuser', passwordHash, salt);
```

## 🐛 Debugging

### Console Logs
- Login denemesi başladığında
- Session doğrulama
- Token temizleme işlemleri
- Hata durumları

### Veritabanı İnceleme
```bash
sqlite3 auth/auth.db

.tables
SELECT * FROM users;
SELECT * FROM sessions;
SELECT * FROM login_history;
```

## 🚀 Production Önerileri

1. **HTTPS kullanın** - SSL sertifikası ekleyin
2. **Environment variables** - Hassas bilgileri .env'de saklayın
3. **Database backup** - Düzenli yedekleme yapın
4. **Logging** - Winston veya Bunyan ekleyin
5. **Monitoring** - Hata takibi (Sentry)
6. **Load balancing** - Yüksek trafik için
7. **CAPTCHA** - Ekstra bot koruması

## 📄 Lisans

MIT License - Özgürce kullanabilirsiniz!

## 🤝 Katkıda Bulunma

Pull request'ler kabul edilir. Büyük değişiklikler için önce issue açın.

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

---

**Made with ❤️ using Modern Web Technologies**

🔐 SQLite • 🎨 Glassmorphism • ⚡ Express.js • 🛡️ Secure by Design
