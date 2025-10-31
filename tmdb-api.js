import axios from "axios";
import dotenv from "dotenv";
import { 
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
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        language: 'en-US',
        page: 1,
        include_adult: false
      },
      timeout: 15000
    });

    const results = response.data.results.slice(0, 10).map(movie => ({
      movieId: movie.id.toString(),
      movieTitle: movie.title,
      year: movie.release_date ? movie.release_date.split('-')[0] : '',
      type: 'Movie',
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : '',
      overview: movie.overview || '',
      voteAverage: movie.vote_average || 0
    }));

    console.log(`✅ TMDB - ${results.length} sonuç bulundu\n`);

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

// --- TMDB API ile film görsellerini çek ---
export async function getMovieImagesTMDB(movieId, movieTitle, sizeFilter = 'default') {
  console.log(`\n🎬 TMDB - "${movieTitle}" (${movieId}) için görseller çekiliyor...\n`);
  console.log(`📐 Boyut filtresi: ${sizeFilter}\n`);

  // Önce cache'i kontrol et
  const cacheKey = `tmdb_${movieId}_${movieTitle}`;
  const cachedBanners = getMovieBannersFromCache(cacheKey, movieTitle);
  
  if (cachedBanners) {
    console.log(`💾 Cache'den veri bulundu, boyut filtresine göre filtreleniyor...`);
    
    const { minWidth, maxWidth, minHeight, maxHeight } = parseSizeFilter(sizeFilter);
    console.log(`   📏 Filtreleme aralığı: ${minWidth}-${maxWidth}px x ${minHeight}-${maxHeight}px`);
    
    const filteredImages = cachedBanners.images.filter(img => 
      img.width >= minWidth && img.width <= maxWidth && 
      img.height >= minHeight && img.height <= maxHeight
    );
    
    console.log(`   ✅ ${filteredImages.length} / ${cachedBanners.images.length} görsel filtreleme geçti\n`);
    
    return {
      totalImages: filteredImages.length,
      images: filteredImages,
      movies: cachedBanners.movies,
      fromCache: true
    };
  }

  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY .env dosyasında tanımlanmamış!');
  }

  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}/images`, {
      params: {
        api_key: TMDB_API_KEY,
        include_image_language: 'en,null' // İngilizce ve dil-bağımsız görseller
      },
      timeout: 15000
    });

    console.log(`📸 TMDB API'den ${response.data.backdrops.length} backdrop bulundu`);

    // Boyut filtresini uygula
    const { minWidth, maxWidth, minHeight, maxHeight } = parseSizeFilter(sizeFilter);
    
    const images = [];
    const siteStats = { 'tmdb.org': 0 };

    // Backdrops (yatay görseller) - banner formatı
    for (const backdrop of response.data.backdrops) {
      const width = backdrop.width;
      const height = backdrop.height;
      
      // Boyut kontrolü
      if (width >= minWidth && width <= maxWidth && height >= minHeight && height <= maxHeight) {
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
          voteCount: backdrop.vote_count || 0
        });
        
        siteStats['tmdb.org']++;
        console.log(`   ✅ ${width}x${height} - Uygun!`);
      } else {
        console.log(`   ❌ ${width}x${height} - Boyut aralık dışı`);
      }
    }

    console.log(`\n🎉 ${images.length} adet uygun banner bulundu`);
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
export async function loadMoreImagesTMDB(movieId, movieTitle, sizeFilter = 'default') {
  console.log(`\n📄 TMDB - "${movieTitle}" (${movieId}) için daha fazla görsel yükleniyor...\n`);
  
  // TMDB'de scroll kavramı yok, tüm görseller bir seferde geliyor
  // Bu fonksiyon aynı sonuçları döndürecek (API limitasyonu)
  console.log(`⚠️ TMDB API'sinde tüm görseller tek seferde gelir, daha fazla yüklenemez\n`);
  
  return {
    totalImages: 0,
    images: [],
    message: 'TMDB API tüm görselleri ilk yüklemede getiriyor'
  };
}

// API key kontrolü
if (!TMDB_API_KEY) {
  console.warn('\n⚠️  UYARI: TMDB_API_KEY .env dosyasında tanımlanmamış!');
  console.warn('🔑 TMDB özelliklerini kullanmak için .env dosyasına TMDB_API_KEY ekleyin\n');
}
