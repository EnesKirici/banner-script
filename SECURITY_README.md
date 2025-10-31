# 🔐 Güvenlik Sistemi - Genel Bakış

## ✅ Yapılan Değişiklikler

Tüm uygulama artık **tam güvenlik koruması** altındadır. Kullanıcı login yapmadan **hiçbir** sayfaya veya API endpoint'ine erişemez.

---

## 🛡️ Korunan Alanlar

### 1. **Ana Sayfa ve Statik Dosyalar**
- ✅ Ana sayfa (`/`) - `requireAuth` middleware ile korunuyor
- ✅ Resources klasörü (`/resources/*`) - Login gerektiriyor
- ✅ Banners klasörü (`/banners/*`) - Login gerektiriyor
- ✅ Cache yönetim sayfası (`/clear-cache`) - Login gerektiriyor

### 2. **API Endpoint'leri**
Tüm API endpoint'leri `requireAuth` middleware ile korumalı:

- ✅ `/api/health` - Health check
- ✅ `/api/cache/stats` - Cache istatistikleri
- ✅ `/api/cache/clear` - Cache temizleme
- ✅ `/api/search-movies` - IMDb film arama
- ✅ `/api/download-by-id` - IMDb banner indirme
- ✅ `/api/load-more-images` - IMDb daha fazla görsel
- ✅ `/api/tmdb-search` - TMDB film arama
- ✅ `/api/tmdb-download-by-id` - TMDB banner indirme
- ✅ `/api/tmdb-load-more` - TMDB daha fazla görsel
- ✅ `/api/tmdb-popular` - TMDB popüler listesi

### 3. **Public Erişim (Sadece Login için)**
- ✅ `/auth/*` - Login sayfası ve auth işlemleri herkese açık
- ✅ `/auth/login.html` - Login sayfası
- ✅ `/auth/login.css` - Login stilleri
- ✅ `/auth/login.js` - Login JavaScript

---

## 🔒 Güvenlik Katmanları

### **1. Server-Side Kontrolü (Backend)**
```javascript
// Server.js içinde tüm route'lar korunuyor
app.get('/', requireAuth, (req, res) => { ... });
app.post('/api/search-movies', requireAuth, async (req, res) => { ... });
```

`requireAuth` middleware:
- Cookie'deki session token'ı kontrol eder
- Token yoksa veya geçersizse:
  - HTML sayfaları için → `/auth/login.html` redirect
  - API endpoint'leri için → 401 JSON response
- Token geçerliyse → İsteği işlemeye devam eder

### **2. Client-Side Kontrolü (Frontend)**
```javascript
// app.js içinde sayfa yüklendiğinde
async function checkAuthSession() {
    const sessionToken = localStorage.getItem('auth_session');
    
    if (!sessionToken) {
        window.location.href = '/auth/login.html';
        return false;
    }
    
    // Token'ı server'da doğrula
    const response = await fetch('/auth/verify', { ... });
    
    if (!response.ok) {
        window.location.href = '/auth/login.html';
        return false;
    }
}
```

### **3. API İsteklerinde Token Gönderimi**
Tüm API istekleri Authorization header ile token gönderiyor:

```javascript
fetch('/api/search-movies', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}` // ✅ Token eklendi
    },
    body: JSON.stringify({ query: movieName })
})
```

---

## 🚀 Nasıl Çalışır?

### **Login Olmadan:**
1. Kullanıcı `http://localhost:3000` adresini açar
2. Server `requireAuth` middleware'ini çalıştırır
3. Session token yoksa → `/auth/login.html` sayfasına yönlendirir
4. Kullanıcı login sayfasını görür

### **Login Olduktan Sonra:**
1. Kullanıcı login sayfasında kullanıcı adı ve şifre girer
2. Server credentials'ı doğrular
3. Geçerliyse → Session token oluşturur
4. Token → LocalStorage ve Cookie'ye kaydedilir
5. Kullanıcı → Ana sayfaya yönlendirilir
6. Ana sayfa yüklenirken `checkAuthSession()` çalışır
7. Token doğrulanır → Sayfa içeriği gösterilir
8. Tüm API istekleri token ile yapılır

### **Token Geçersizse:**
- Frontend veya backend token kontrolü başarısız olursa
- Kullanıcı otomatik olarak login sayfasına yönlendirilir
- LocalStorage ve Cookie temizlenir

---

## 🔑 Login Bilgileri

**Varsayılan Kullanıcı:**
- **Kullanıcı Adı:** `elw`
- **Şifre:** `Enye1824/`

---

## 📝 Session Yönetimi

- **Session Süresi:** 24 saat (86400 saniye)
- **Token Saklama:** LocalStorage + Cookie (çift güvenlik)
- **Otomatik Temizleme:** Süresi dolmuş tokenler otomatik temizlenir
- **Logout:** Logout butonuyla manuel çıkış yapılabilir

---

## 🧪 Test Senaryoları

### **Test 1: Login Olmadan Erişim Denemesi**
1. Tarayıcıyı incognito/private modda aç
2. `http://localhost:3000` adresine git
3. ✅ Otomatik olarak `/auth/login.html` sayfasına yönlendirilmelisin
4. ✅ Ana sayfa içeriği gösterilmemeli

### **Test 2: API'ye Direkt Erişim Denemesi**
1. Postman veya curl ile `/api/search-movies` endpoint'ine token olmadan istek at
2. ✅ 401 Unauthorized yanıtı almalısın
3. ✅ `requiresAuth: true` mesajı dönmeli

### **Test 3: Login Sonrası Erişim**
1. Login sayfasından giriş yap
2. ✅ Ana sayfaya yönlendirilmelisin
3. ✅ Tüm özellikler çalışmalı
4. ✅ API istekleri başarılı olmalı

### **Test 4: Token Süresi Dolması**
1. Login ol
2. Database'den token'ı manuel olarak sil veya süresi dolsun
3. Sayfayı yenile
4. ✅ Otomatik olarak login sayfasına yönlendirilmelisin

### **Test 5: Logout İşlemi**
1. Login ol
2. Sağ üst köşedeki "Çıkış" butonuna tıkla
3. ✅ Login sayfasına yönlendirilmelisin
4. ✅ LocalStorage ve Cookie temizlenmeli
5. ✅ Geri butonuyla ana sayfaya dönememelisin

---

## 📂 Değiştirilen Dosyalar

### **1. `server.js`**
- Tüm route'lara `requireAuth` middleware eklendi
- Static dosya servisleri korundu
- API endpoint'leri korundu

### **2. `auth/auth-middleware.js`**
- `requireAuth` fonksiyonu geliştirildi
- API ve HTML sayfalar için farklı yanıtlar eklendi
- JSON error response desteği eklendi

### **3. `resources/css/app.js`**
- `checkAuthSession()` fonksiyonu eklendi
- Sayfa yüklendiğinde auth kontrolü yapılıyor
- Tüm API isteklerine Authorization header eklendi
- Auth hataları yakalanıyor ve login sayfasına yönlendiriliyor

### **4. `resources/css/index.html`**
- CSS ve JS dosya yolları düzeltildi (`/resources/css/...`)

---

## ⚠️ Önemli Notlar

1. **Login sayfası hariç hiçbir yere erişilemez**
2. **API endpoint'lerine direkt erişim engellenmiştir**
3. **Token olmadan hiçbir işlem yapılamaz**
4. **Session süresi 24 saattir**
5. **Logout yapınca token geçersiz olur**

---

## 🎯 Sonuç

✅ **Tam güvenlik sağlandı!**  
✅ **Login olmadan hiçbir içeriğe erişim yok**  
✅ **Server ve Client tarafında çift kontrol mevcut**  
✅ **API endpoint'leri tamamen korumalı**  
✅ **Gerçek bir web sitesi gibi çalışıyor**

---

## 🔗 Faydalı Linkler

- Login Sayfası: http://localhost:3000/auth/login.html
- Ana Sayfa: http://localhost:3000
- Health Check: http://localhost:3000/api/health (login gerekli)

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 31 Ekim 2025
