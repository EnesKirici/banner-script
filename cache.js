import NodeCache from 'node-cache';

// Cache yapılandırması
// stdTTL: Standart Time To Live (saniye cinsinden) - 1 saat = 3600 saniye
// checkperiod: Cache'in otomatik olarak kontrol edilme süresi (saniye) - 2 dakika = 120 saniye
// useClones: Cache'e konulan objelerin klonlanıp klonlanmayacağı (performans için false)
const movieCache = new NodeCache({ 
  stdTTL: 3600,      // 1 saat
  checkperiod: 120,  // 2 dakika
  useClones: false 
});

// Cache istatistikleri
export function getCacheStats() {
  const stats = movieCache.getStats();
  return {
    keys: movieCache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    ksize: stats.ksize,
    vsize: stats.vsize
  };
}

// Cache'i tamamen temizle
export function clearCache() {
  movieCache.flushAll();
  console.log('🗑️ Cache tamamen temizlendi');
}

// Arama sonuçlarını cache'e al
export function cacheSearchResults(query, results) {
  const key = `search:${query.toLowerCase().trim()}`;
  movieCache.set(key, results);
  console.log(`💾 Cache'e kaydedildi: "${query}" (${results.length} sonuç)`);
}

// Cache'den arama sonuçlarını al
export function getSearchResultsFromCache(query) {
  const key = `search:${query.toLowerCase().trim()}`;
  const cached = movieCache.get(key);
  
  if (cached) {
    console.log(`✅ Cache'den alındı: "${query}" (${cached.length} sonuç)`);
    return cached;
  }
  
  console.log(`❌ Cache'de bulunamadı: "${query}"`);
  return null;
}

// Film banner'larını cache'e al
export function cacheMovieBanners(movieId, movieTitle, banners) {
  const key = `banners:${movieId}`;
  const data = {
    movieId,
    movieTitle,
    banners,
    cachedAt: new Date().toISOString()
  };
  movieCache.set(key, data);
  console.log(`💾 Cache'e kaydedildi: "${movieTitle}" (${movieId}) - ${banners.totalImages} banner`);
}

// Cache'den film banner'larını al
export function getMovieBannersFromCache(movieId, movieTitle) {
  const key = `banners:${movieId}`;
  const cached = movieCache.get(key);
  
  if (cached) {
    console.log(`✅ Cache'den alındı: "${movieTitle}" (${movieId}) - ${cached.banners.totalImages} banner`);
    return cached.banners;
  }
  
  console.log(`❌ Cache'de bulunamadı: "${movieTitle}" (${movieId})`);
  return null;
}

// Belirli bir key'i cache'den sil
export function removeCacheKey(key) {
  const deleted = movieCache.del(key);
  if (deleted) {
    console.log(`🗑️ Cache'den silindi: ${key}`);
  }
  return deleted;
}

// Tüm cache key'lerini listele
export function listCacheKeys() {
  return movieCache.keys();
}

// Cache event listener'ları
movieCache.on('expired', (key, value) => {
  console.log(`⏰ Cache süresi doldu: ${key}`);
});

movieCache.on('flush', () => {
  console.log('🗑️ Cache temizlendi');
});

export default movieCache;
