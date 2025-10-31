# 🎬 Banner Downloader - IMDb & TMDB Integration

Film bannerlarını IMDb ve TMDB'den indiren modern bir web uygulaması.

## ✨ Özellikler

### 🎞️ IMDb (Web Scraping)
- Puppeteer ile dinamik web scraping
- Scroll ile daha fazla görsel yükleme
- "More to explore" bölümü filtreleme
- Banner kategorisi filtreleme

### 🎥 TMDB (API)
- Official TMDB API entegrasyonu
- Hızlı ve güvenilir veri
- Tüm görseller tek seferde yüklenir
- API limitasyonları yok

### 🎨 Ortak Özellikler
- Boyut filtreleme (Default, Full HD, 2K, 4K, HD, Custom)
- Cache sistemi (hızlı yeniden yükleme)
- Çoklu film arama
- Film seçim ekranı
- Modern UI/UX tasarım
- Responsive tasarım
- Kar efekti animasyonu

## 📦 Kurulum

1. **Bağımlılıkları yükleyin:**
```bash
npm install
```

2. **TMDB API Key alın:**
   - https://www.themoviedb.org/settings/api adresine gidin
   - API key oluşturun
   - `.env` dosyasına ekleyin:

```env
TMDB_API_KEY=your_api_key_here
```

3. **Servisi başlatın:**
```bash
npm start
```

4. **Tarayıcıda açın:**
```
http://localhost:3000
```

## 🔧 Yapılandırma

### Boyut Filtreleri
```javascript
'default': { minWidth: 1920, maxWidth: 2400, minHeight: 700, maxHeight: 1400 }
'1920x1080': { minWidth: 1800, maxWidth: 2000, minHeight: 1000, maxHeight: 1180 }
'2560x1440': { minWidth: 2400, maxWidth: 2700, minHeight: 1300, maxHeight: 1580 }
'3840x2160': { minWidth: 3600, maxWidth: 4100, minHeight: 2000, maxHeight: 2300 }
'1280x720': { minWidth: 1200, maxWidth: 1400, minHeight: 650, maxHeight: 800 }
'custom': Tüm boyutlar
```

### Cache Ayarları
- Cache süresi: 24 saat
- Cache klasörü: `./cache`
- Temizleme: http://localhost:3000/clear-cache

## 📁 Proje Yapısı

```
banner-script/
├── banner-downloader-api.js   # IMDb scraping modülü
├── tmdb-api.js                # TMDB API modülü
├── server.js                  # Express server
├── cache.js                   # Cache yönetimi
├── sources.json               # IMDb kaynakları
├── .env                       # Environment variables
├── resources/
│   └── css/
│       ├── index.html         # Ana sayfa
│       ├── app.js             # Frontend JavaScript
│       └── index.css          # Stil dosyası
└── banners/                   # İndirilen görseller
```

## 🚀 Kullanım

### IMDb Kullanımı
1. "IMDb" butonuna tıklayın
2. Film adını yazın
3. Filmi seçin
4. Görseller listelenir
5. "Daha Fazla Yükle" ile daha fazla görsel

### TMDB Kullanımı
1. "TMDB" butonuna tıklayın
2. Film adını yazın
3. Filmi seçin
4. Tüm görseller otomatik yüklenir

### Boyut Filtresi
- Dropdown'dan istediğiniz boyutu seçin
- Arama yapmadan önce seçim yapın
- Cache'deki sonuçlar otomatik filtrelenir

## 🎯 API Endpoints

### IMDb Endpoints
- `POST /api/search-movies` - Film ara
- `POST /api/download-by-id` - Film görsellerini indir
- `POST /api/load-more-images` - Daha fazla görsel yükle

### TMDB Endpoints
- `POST /api/tmdb-search` - Film ara
- `POST /api/tmdb-download-by-id` - Film görsellerini indir
- `POST /api/tmdb-load-more` - (Desteklenmiyor)

### Cache Endpoints
- `GET /api/cache/stats` - Cache istatistikleri
- `POST /api/cache/clear` - Cache'i temizle

## ⚙️ Performans Optimizasyonları

### IMDb
- Akıllı URL filtreleme (indirmeden boyut tahmini)
- Paralel görsel kontrolü (15 eş zamanlı)
- HEAD request ile boyut kontrolü
- Cache sistemi

### TMDB
- API hız limiti yok
- Tüm görseller tek request
- Cache sistemi
- Hazır boyut bilgisi

## 🐛 Sorun Giderme

### TMDB API Hatası
```
⚠️ UYARI: TMDB_API_KEY .env dosyasında tanımlanmamış!
```
**Çözüm:** `.env` dosyasına `TMDB_API_KEY` ekleyin

### Puppeteer Hatası
```
Error: Failed to launch the browser
```
**Çözüm:** Chrome/Chromium yükleyin veya sistem bağımlılıklarını kontrol edin

### Port Hatası
```
Error: listen EADDRINUSE :::3000
```
**Çözüm:** Port değiştirin veya çalışan process'i durdurun

## 📝 Notlar

- **IMDb:** Web scraping kullanır, robot detection riski var
- **TMDB:** Official API, güvenli ve hızlı
- **Cache:** 24 saat sonra otomatik temizlenir
- **Görseller:** `banners/` klasörüne kaydedilmez (sadece URL)

## 🔐 Güvenlik

- API keyleri `.env` dosyasında saklanır
- `.env` dosyası `.gitignore`'da olmalı
- CORS ayarları production için güncellenmeli
- Rate limiting eklenmeli (production)

## 📄 Lisans

MIT

## 👨‍💻 Geliştirici

Banner Downloader Team

---

**Not:** IMDb web scraping kullanır, kullanım şartlarına uygun kullanın. TMDB için official API kullanılır.
