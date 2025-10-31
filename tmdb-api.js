import axios from "axios";
import dotenv from "dotenv";
import movieCache, { 
  cacheSearchResults, 
  getSearchResultsFromCache, 
  cacheMovieBanners, 
  getMovieBannersFromCache
} from './cache.js';

dotenv.config();

// --- TMDB API Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

// Boyut filtresi presetleri (IMDb ile aynı)
const SIZE_PRESETS = {
  'default': { minWidth: 1920, maxWidth: 2400, minHeight: 700, maxHeight: 1400 },
  '1920x1080': { minWidth: 1800, maxWidth: 2000, minHeight: 1000, maxHeight: 1180 },
  '2560x1440': { minWidth: 2400, maxWidth: 2700, minHeight: 1300, maxHeight: 1580 },
  '3840x2160': { minWidth: 3600, maxWidth: 4100, minHeight: 2000, maxHeight: 2300 },
  '1280x720': { minWidth: 1200, maxWidth: 1400, minHeight: 650, maxHeight: 800 },
  'custom': { minWidth: 0, maxWidth: 100000, minHeight: 0, maxHeight: 100000 }
};

// Boyut filtresini parse et
function parseSizeFilter(sizeFilter) {
  console.log(`📐 TMDB - Boyut filtresi: "${sizeFilter}"`);
  
  if (!sizeFilter || sizeFilter === 'default') {
    return SIZE_PRESETS.default;
  }
  
  if (SIZE_PRESETS[sizeFilter]) {
    return SIZE_PRESETS[sizeFilter];
  }
  
  return SIZE_PRESETS.default;
}

// --- TMDB API ile film arama ---
export async function searchMoviesTMDB(query) {
  console.log(`\n🔍 TMDB - "${query}" aranıyor...\n`);
  
  // Önce cache'i kontrol et
  const cacheKey = `tmdb_${query}`;
  const cachedResults = getSearchResultsFromCache(cacheKey);
  if (cachedResults) {
    console.log(`💾 Cache'den ${cachedResults.length} sonuç bulundu\n`);
    return {
      query,
      results: cachedResults,
      fromCache: true
    };
  }

  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY .env dosyasında tanımlanmamış!');
  }

  try {
    // Hem film hem de dizi ara (multi search)
    const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        language: 'en-US',
        page: 1,
        include_adult: false
      },
      timeout: 15000
    });

    // Film ve dizileri filtrele
    const allResults = response.data.results
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .map(item => {
        const isMovie = item.media_type === 'movie';
        
        return {
          movieId: item.id.toString(),
          movieTitle: isMovie ? item.title : item.name,
          year: isMovie 
            ? (item.release_date ? item.release_date.split('-')[0] : '')
            : (item.first_air_date ? item.first_air_date.split('-')[0] : ''),
          type: isMovie ? 'Movie' : 'TV Series',
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
          overview: item.overview || '',
          voteAverage: item.vote_average || 0,
          popularity: item.popularity || 0,
          mediaType: item.media_type // 'movie' veya 'tv'
        };
      });

    // Popülerliğe göre sırala ve maksimum 8 sonuç al
    const results = allResults
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 8);

    console.log(`✅ TMDB - ${results.length} sonuç bulundu (${results.filter(r => r.type === 'Movie').length} film, ${results.filter(r => r.type === 'TV Series').length} dizi)\n`);

    // Cache'e kaydet
    if (results.length > 0) {
      cacheSearchResults(cacheKey, results);
    }

    return {
      query,
      results,
      fromCache: false
    };

  } catch (error) {
    console.error('❌ TMDB API hatası:', error.message);
    throw error;
  }
}

// --- TMDB API ile film/dizi görsellerini çek ---
export async function getMovieImagesTMDB(movieId, movieTitle, sizeFilter = 'default', mediaType = 'movie') {
  console.log(`\n🎬 TMDB - "${movieTitle}" (${movieId}) için görseller çekiliyor...\n`);
  console.log(`📐 Boyut filtresi: ${sizeFilter}`);
  console.log(`📺 Medya tipi: ${mediaType === 'tv' ? 'TV Series' : 'Movie'}\n`);

  // Önce cache'i kontrol et
  const cacheKey = `tmdb_${movieId}_${movieTitle}`;
  const cachedBanners = getMovieBannersFromCache(cacheKey, movieTitle);
  
  if (cachedBanners) {
    console.log(`💾 Cache'den veri bulundu\n`);
    
    return {
      totalImages: cachedBanners.images.length,
      images: cachedBanners.images,
      movies: cachedBanners.movies,
      fromCache: true
    };
  }

  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY .env dosyasında tanımlanmamış!');
  }

  try {
    // Film veya TV dizisi endpoint'ini kullan
    const endpoint = mediaType === 'tv' 
      ? `${TMDB_BASE_URL}/tv/${movieId}/images`
      : `${TMDB_BASE_URL}/movie/${movieId}/images`;
    
    const response = await axios.get(endpoint, {
      params: {
        api_key: TMDB_API_KEY
        // include_image_language parametresini kaldırdık - TÜM dillerdeki görseller gelsin
      },
      timeout: 15000
    });

    console.log(`📸 TMDB API'den ${response.data.backdrops.length} backdrop bulundu`);
    
    // İlk 5 backdrop'un boyutlarını göster (debug)
    console.log(`\n🔍 İlk 5 backdrop boyutları:`);
    response.data.backdrops.slice(0, 5).forEach((b, i) => {
      const ratio = (b.width / b.height).toFixed(2);
      console.log(`   ${i+1}. ${b.width}x${b.height} (${ratio}:1) - Vote: ${b.vote_average || 0}`);
    });
    console.log();

    // TMDB için boyut filtresi UYGULANMIYOR - tüm backdrops alınıyor
    console.log(`   ℹ️ TMDB: Tüm backdrop boyutları kabul ediliyor (filtre yok)\n`);
    
    const images = [];
    const siteStats = { 'tmdb.org': 0 };

    // Backdrops (yatay görseller) - TÜM BOYUTLAR
    for (const backdrop of response.data.backdrops) {
      const width = backdrop.width;
      const height = backdrop.height;
      const aspectRatio = width / height;
      
      // TMDB için boyut kontrolü YOK - tüm görseller alınıyor
      const imageUrl = `${TMDB_IMAGE_BASE_URL}${backdrop.file_path}`;
      
      images.push({
        url: imageUrl,
        width: width,
        height: height,
        film: movieTitle,
        domain: 'tmdb.org',
        filename: `${movieTitle.replace(/\s+/g, "_")}_${width}x${height}_tmdb.jpg`,
        contentType: 'image/jpeg',
        voteAverage: backdrop.vote_average || 0,
        voteCount: backdrop.vote_count || 0,
        aspectRatio: aspectRatio.toFixed(2)
      });
      
      siteStats['tmdb.org']++;
      console.log(`   ✅ ${width}x${height} (${aspectRatio.toFixed(2)}:1)`);
    }

    console.log(`\n📊 Toplam backdrop: ${response.data.backdrops.length}`);
    console.log(`🎉 ${images.length} adet banner alındı (tümü)`);
    console.log(`📊 TMDB: ${images.length} görsel\n`);

    const result = {
      totalImages: images.length,
      images: images,
      movies: [{
        name: movieTitle,
        foundCount: images.length,
        siteStats: siteStats,
        images: images
      }],
      fromCache: false
    };

    // Ham sonuçları cache'e kaydet (sizeFilter olmadan)
    if (images.length > 0) {
      cacheMovieBanners(cacheKey, movieTitle, result);
    }

    return result;

  } catch (error) {
    console.error('❌ TMDB API hatası:', error.message);
    throw error;
  }
}

// --- TMDB API ile daha fazla görsel yükle ---
export async function loadMoreImagesTMDB(movieId, movieTitle, sizeFilter = 'default', mediaType = 'movie') {
  console.log(`\n📄 TMDB - "${movieTitle}" (${movieId}, ${mediaType}) için daha fazla görsel yükleniyor...\n`);
  
  // TMDB'de scroll kavramı yok, tüm görseller bir seferde geliyor
  // Bu fonksiyon aynı sonuçları döndürecek (API limitasyonu)
  console.log(`⚠️ TMDB API'sinde tüm görseller tek seferde gelir, daha fazla yüklenemez\n`);
  
  return {
    totalImages: 0,
    images: [],
    message: 'TMDB API tüm görselleri ilk yüklemede getiriyor'
  };
}

// --- TMDB: En popüler filmler ve diziler (cache'li, 1 saat) ---
// Trending endpoint kullanıyor - güncel en çok konuşulan içerikler
export async function getPopularMoviesTMDB(limit = 8) {
  const cacheKey = 'tmdb_popular_movies';
  const cached = movieCache.get(cacheKey);
  if (cached) {
    console.log('💾 TMDB trending movies cache kullanılıyor');
    return cached;
  }

  try {
    // trending/movie/week - Haftalık en çok konuşulan filmler
    const resp = await axios.get(`${TMDB_BASE_URL}/trending/movie/week`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US'
      },
      timeout: 15000
    });

    const items = (resp.data.results || [])
      .map(item => ({
        movieId: item.id.toString(),
        movieTitle: item.title || item.name || '',
        year: item.release_date ? item.release_date.split('-')[0] : '',
        type: 'Movie',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
        overview: item.overview || '',
        voteAverage: item.vote_average || 0,
        popularity: item.popularity || 0,
        mediaType: 'movie'
      }))
      .slice(0, limit); // Zaten popülerlik sırasına göre geliyor

    movieCache.set(cacheKey, items);
    console.log(`✅ TMDB trending movies: ${items.length} film alındı`);
    return items;
  } catch (err) {
    console.error('TMDB trending movies error:', err.message);
    throw err;
  }
}

export async function getPopularTVTMDB(limit = 8) {
  const cacheKey = 'tmdb_popular_tv';
  const cached = movieCache.get(cacheKey);
  if (cached) {
    console.log('💾 TMDB trending tv cache kullanılıyor');
    return cached;
  }

  try {
    // trending/tv/week - Haftalık en çok konuşulan diziler
    const resp = await axios.get(`${TMDB_BASE_URL}/trending/tv/week`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US'
      },
      timeout: 15000
    });

    const items = (resp.data.results || [])
      .map(item => ({
        movieId: item.id.toString(),
        movieTitle: item.name || item.title || '',
        year: item.first_air_date ? item.first_air_date.split('-')[0] : '',
        type: 'TV Series',
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
        overview: item.overview || '',
        voteAverage: item.vote_average || 0,
        popularity: item.popularity || 0,
        mediaType: 'tv'
      }))
      .slice(0, limit); // Zaten popülerlik sırasına göre geliyor

    movieCache.set(cacheKey, items);
    console.log(`✅ TMDB trending tv: ${items.length} dizi alındı`);
    return items;
  } catch (err) {
    console.error('TMDB trending tv error:', err.message);
    throw err;
  }
}

// API key kontrolü
if (!TMDB_API_KEY) {
  console.warn('\n⚠️  UYARI: TMDB_API_KEY .env dosyasında tanımlanmamış!');
  console.warn('🔑 TMDB özelliklerini kullanmak için .env dosyasına TMDB_API_KEY ekleyin\n');
}
