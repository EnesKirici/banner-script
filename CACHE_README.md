# 🚀 Cache Sistemi - Kullanım Kılavuzu

## 📝 Genel Bakış

Projenize başarıyla bir cache sistemi kuruldu! Bu sistem, film aramalarını ve banner sonuçlarını bellekte tutar, böylece aynı film tekrar aratıldığında veya seçildiğinde sonuçlar anında cache'den gelir.

## 🎯 Cache'lenen Veriler

### 1. **Film Arama Sonuçları**
- Bir film ismi aratıldığında tüm sonuçlar cache'e kaydedilir
- Aynı film ismi tekrar aratıldığında sonuçlar hemen cache'den gelir
- **Cache Süresi:** 1 saat (3600 saniye)

### 2. **Film Banner'ları**
- Bir film seçilip banner'ları yüklendiğinde tüm banner'lar cache'e kaydedilir
- Aynı film tekrar seçilirse banner'lar anında cache'den gelir
- **Cache Süresi:** 1 saat (3600 saniye)

## 🔧 Nasıl Çalışır?

### Film Arama
```
1. Kullanıcı "Inception" filmi için arama yapar
   ➡️ İlk aramada: IMDb'den sonuçlar çekilir (~2-3 saniye)
   ➡️ Sonuçlar cache'e kaydedilir

2. Kullanıcı tekrar "Inception" arar
   ➡️ Sonuçlar cache'den gelir (~50ms)
   ➡️ API'ye istek atılmaz
```

### Film Banner'ları
```
1. Kullanıcı "Inception (2010)" filmini seçer
   ➡️ İlk seçimde: Puppeteer ile görseller toplanır (~10-15 saniye)
   ➡️ Banner'lar cache'e kaydedilir

2. Kullanıcı tekrar aynı filmi seçer
   ➡️ Banner'lar cache'den gelir (~50ms)
   ➡️ Yeni görseller çekilmez
```

## 📊 Cache Yönetimi API'leri

### 1. Cache İstatistiklerini Görüntüleme
```bash
GET http://localhost:3000/api/cache/stats
```

**Response:**
```json
{
  "success": true,
  "cache": {
    "keys": 5,           // Cache'de kaç anahtar var
    "hits": 12,          // Kaç kez cache'den veri alındı
    "misses": 3,         // Kaç kez cache'de veri bulunamadı
    "ksize": 1024,       // Anahtar boyutu
    "vsize": 50000       // Değer boyutu
  }
}
```

### 2. Cache'i Temizleme
```bash
POST http://localhost:3000/api/cache/clear
```

**Response:**
```json
{
  "success": true,
  "message": "Cache başarıyla temizlendi"
}
```

## 🎨 Frontend'de Cache Durumunu Gösterme

API response'larında artık `fromCache` alanı var:

### Film Arama Response
```json
{
  "success": true,
  "query": "Inception",
  "count": 10,
  "results": [...],
  "fromCache": true  // ✅ Bu veriler cache'den geldi
}
```

### Banner Response
```json
{
  "success": true,
  "totalImages": 15,
  "images": [...],
  "message": "15 adet banner bulundu (Cache'den)",
  "fromCache": true  // ✅ Bu veriler cache'den geldi
}
```

## ⚙️ Cache Yapılandırması

`cache.js` dosyasında yapılandırma:

```javascript
const movieCache = new NodeCache({ 
  stdTTL: 3600,      // 1 saat (değiştirilebilir)
  checkperiod: 120,  // 2 dakikada bir kontrol
  useClones: false   // Performans için
});
```

### TTL (Time To Live) Değiştirme

Cache süresini değiştirmek için `cache.js` dosyasındaki `stdTTL` değerini değiştirin:

- **30 dakika:** `stdTTL: 1800`
- **2 saat:** `stdTTL: 7200`
- **24 saat:** `stdTTL: 86400`

## 🔍 Console Logları

Cache sistemi detaylı loglar üretir:

```bash
# İlk arama (Cache MISS)
❌ Cache'de bulunamadı: "inception"
🔍 "inception" için arama yapılıyor...
✅ 10 adet sonuç bulundu
💾 Cache'e kaydedildi: "inception" (10 sonuç)

# Tekrar arama (Cache HIT)
✅ Cache'den alındı: "inception" (10 sonuç)

# İlk banner yükleme (Cache MISS)
❌ Cache'de bulunamadı: "Inception" (tt1375666)
🌐 www.imdb.com taranıyor...
🎉 15 adet uygun banner bulundu
💾 Cache'e kaydedildi: "Inception" (tt1375666) - 15 banner

# Tekrar banner yükleme (Cache HIT)
✅ Cache'den alındı: "Inception" (tt1375666) - 15 banner
```

## 🎯 Performans Artışı

### Arama İşlemi
- **Cache'siz:** ~2-3 saniye
- **Cache ile:** ~50 milisaniye
- **Hız Artışı:** ~50x daha hızlı ⚡

### Banner Yükleme
- **Cache'siz:** ~10-15 saniye (Puppeteer + scraping)
- **Cache ile:** ~50 milisaniye
- **Hız Artışı:** ~200x daha hızlı ⚡⚡⚡

## 📱 Kullanım Senaryoları

### Senaryo 1: Kullanıcı Aynı Filmi Ararsa
```
1. "Matrix" ara → IMDb'den çek (2 saniye)
2. "Matrix" ara → Cache'den al (50ms) ⚡
3. "Matrix" ara → Cache'den al (50ms) ⚡
```

### Senaryo 2: Kullanıcı Aynı Film Banner'larını Yüklemek İsterse
```
1. "The Matrix (1999)" seç → Puppeteer ile çek (15 saniye)
2. "The Matrix (1999)" seç → Cache'den al (50ms) ⚡⚡⚡
3. "The Matrix (1999)" seç → Cache'den al (50ms) ⚡⚡⚡
```

### Senaryo 3: Cache Süresi Dolunca
```
1. "Avatar" ara → Cache'e kaydet
... 1 saat sonra ...
2. "Avatar" ara → Cache süresi doldu, yeniden IMDb'den çek
3. Yeni sonuçlar tekrar cache'e kaydedilir
```

## 🛠️ Geliştirme İpuçları

### Frontend'de Cache Göstergesi Ekle
```javascript
if (response.fromCache) {
  // Kullanıcıya cache'den geldiğini göster
  showNotification("⚡ Sonuçlar cache'den hızlıca yüklendi!");
}
```

### Cache Temizleme Butonu Ekle
```javascript
async function clearCache() {
  const response = await fetch('/api/cache/clear', {
    method: 'POST'
  });
  const data = await response.json();
  alert(data.message);
}
```

### Cache İstatistiklerini Göster
```javascript
async function showCacheStats() {
  const response = await fetch('/api/cache/stats');
  const data = await response.json();
  console.log('Cache Stats:', data.cache);
}
```

## 📈 Avantajları

✅ **Hız:** Aynı sorguları 50-200x daha hızlı yanıtlar  
✅ **Bant Genişliği:** IMDb'ye gereksiz istekleri önler  
✅ **Kullanıcı Deneyimi:** Anlık yanıt süreleri  
✅ **Sunucu Yükü:** Puppeteer işlemlerini azaltır  
✅ **Maliyet:** API rate limit'lerine takılma riski düşer  

## 🎓 Teknik Detaylar

### Cache Anahtarları

**Arama Sonuçları:**
```
Key Format: "search:<film_ismi_lowercase>"
Örnek: "search:inception"
```

**Banner'lar:**
```
Key Format: "banners:<movie_id>"
Örnek: "banners:tt1375666"
```

### Event Listener'lar

Cache modülü otomatik olarak şu eventleri dinler:

```javascript
// Cache süresi dolduğunda
movieCache.on('expired', (key, value) => {
  console.log(`⏰ Cache süresi doldu: ${key}`);
});

// Cache temizlendiğinde
movieCache.on('flush', () => {
  console.log('🗑️ Cache temizlendi');
});
```

## 🚨 Önemli Notlar

1. **Bellek Kullanımı:** Cache RAM'de tutulur, çok fazla veri cachelerseniz bellek kullanımı artar
2. **Sunucu Yeniden Başlatma:** Sunucu yeniden başlatılırsa cache temizlenir
3. **Persistent Cache:** Kalıcı cache için Redis kullanılabilir (gelecek geliştirme)

## 🔄 Güncellemeler

- ✅ v1.0: Temel cache sistemi (node-cache)
- ✅ v1.0: Arama sonuçları cache
- ✅ v1.0: Banner sonuçları cache
- ✅ v1.0: Cache yönetim API'leri
- ⏳ v2.0: Redis entegrasyonu (planlanıyor)
- ⏳ v2.0: Persistent cache (planlanıyor)

---

**Hazırlayan:** GitHub Copilot  
**Tarih:** 24 Ekim 2025  
**Versiyon:** 1.0.0
