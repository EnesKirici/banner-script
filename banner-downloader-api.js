import axios from "axios";
import fs from "fs";
import sizeOf from "image-size";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { 
  cacheSearchResults, 
  getSearchResultsFromCache, 
  cacheMovieBanners, 
  getMovieBannersFromCache 
} from './cache.js';

dotenv.config();

// --- Performans ve Güvenlik Ayarları ---
const PERFORMANCE_CONFIG = {
  CONCURRENT_CHECKS: 15,      // Aynı anda kaç görsel kontrol edilsin (3'ten 15'e çıkardık)
  BATCH_DELAY: 50,            // Batch'ler arası bekleme (ms) - 200'den 50'ye
  REQUEST_TIMEOUT: 8000,      // İstek timeout süresi (ms)
  SMART_FILTERING: true       // Akıllı filtreleme (URL'den boyut tahmini)
};

// User Agent havuzu (IMDb'nin bot dedection'ını atlatmak için)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

// Rastgele User Agent seç
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// --- Ayarlar ---
const DELAY_MS = 1500;    // Filmler arası bekleme

// Boyut filtresi presetleri
const SIZE_PRESETS = {
  'default': { minWidth: 1920, maxWidth: 2400, minHeight: 700, maxHeight: 1400 },
  '1920x1080': { minWidth: 1800, maxWidth: 2000, minHeight: 1000, maxHeight: 1180 }, // Tolerans ile
  '2560x1440': { minWidth: 2400, maxWidth: 2700, minHeight: 1300, maxHeight: 1580 },
  '3840x2160': { minWidth: 3600, maxWidth: 4100, minHeight: 2000, maxHeight: 2300 },
  '1280x720': { minWidth: 1200, maxWidth: 1400, minHeight: 650, maxHeight: 800 },
  'custom': { minWidth: 0, maxWidth: 100000, minHeight: 0, maxHeight: 100000 } // Tüm boyutlar
};

// Boyut filtresini parse et
function parseSizeFilter(sizeFilter) {
  console.log(`📐 Boyut filtresi: "${sizeFilter}"`);
  
  if (!sizeFilter || sizeFilter === 'default') {
    return SIZE_PRESETS.default;
  }
  
  if (SIZE_PRESETS[sizeFilter]) {
    return SIZE_PRESETS[sizeFilter];
  }
  
  return SIZE_PRESETS.default;
}

// --- Akıllı URL Filtreleme (indirmeden boyut tahmini) ---
function smartFilterUrl(url, sizeFilter = 'default') {
  if (!PERFORMANCE_CONFIG.SMART_FILTERING) return true;
  
  // URL'den boyut bilgisi çıkar (örn: UX2000, UY1080)
  const sizeMatch = url.match(/U[XY](\d+)/g);
  if (!sizeMatch) return true; // Boyut bilgisi yoksa kontrol et
  
  const { minWidth, maxWidth, minHeight, maxHeight } = parseSizeFilter(sizeFilter);
  
  // URL'deki boyutları çıkar
  let urlWidth = 0, urlHeight = 0;
  sizeMatch.forEach(match => {
    const value = parseInt(match.substring(2));
    if (match.startsWith('UX')) urlWidth = value;
    if (match.startsWith('UY')) urlHeight = value;
  });
  
  // Eğer URL'de boyut bilgisi varsa, hızlı filtrele (20% tolerans ile)
  if (urlWidth > 0 && urlHeight > 0) {
    const isValid = urlWidth >= minWidth * 0.8 && urlWidth <= maxWidth * 1.2 &&
                    urlHeight >= minHeight * 0.8 && urlHeight <= maxHeight * 1.2;
    
    if (!isValid) {
      console.log(`   ⚡ Akıllı filtre: ${urlWidth}x${urlHeight} → Atlandı (hedef: ${minWidth}-${maxWidth}x${minHeight}-${maxHeight})`);
      return false;
    }
  }
  
  return true;
}

// --- sources.json okuma ---
function getSources() {
  const json = JSON.parse(fs.readFileSync("sources.json", "utf-8"));
  return json.sources;
}

// --- HTTP HEAD ile boyut kontrolü (indirmeden önce) ---
async function checkImageSize(url) {
  try {
    const headRes = await axios.head(url, { 
      timeout: PERFORMANCE_CONFIG.REQUEST_TIMEOUT,
      headers: { 'User-Agent': getRandomUserAgent() }
    });
    const contentType = headRes.headers['content-type'];
    const contentLength = parseInt(headRes.headers['content-length'] || '0');
    
    // Çok küçük veya çok büyük dosyaları filtrele
    if (contentLength < 50000 || contentLength > 10000000) {
      return { skip: true, reason: 'size' };
    }
    
    return { skip: false, contentType };
  } catch (err) {
    // HEAD başarısız olursa yine de indirmeyi dene
    return { skip: false, contentType: null };
  }
}

// --- Görselleri kontrol et ve metadata döndür (kaydetmeden) ---
async function checkImage(url, film, domain, sizeFilter = 'default') {
  try {
    // 1. Akıllı URL filtreleme (en hızlı - indirme yok!)
    if (!smartFilterUrl(url, sizeFilter)) {
      return null;
    }
    
    console.log(`   🔄 İndiriliyor: ${url.substring(0, 80)}...`);
    
    // Boyut filtresini parse et
    const { minWidth, maxWidth, minHeight, maxHeight } = parseSizeFilter(sizeFilter);
    
    // 2. HEAD ile hızlı kontrol
    const { skip, contentType } = await checkImageSize(url);
    if (skip) {
      console.log(`   ⏭️ Atlandı (dosya boyutu uygun değil)`);
      return null;
    }
    
    // 3. Tam indirme ve boyut kontrolü
    const imgRes = await axios.get(url, { 
      responseType: "arraybuffer", 
      timeout: PERFORMANCE_CONFIG.REQUEST_TIMEOUT,
      headers: { 'User-Agent': getRandomUserAgent() }
    });
    const buffer = Buffer.from(imgRes.data);
    const { width, height } = sizeOf(buffer);

    console.log(`   📏 ${width}x${height}`);

    // Boyut kontrolü
    if (width >= minWidth && width <= maxWidth && height >= minHeight && height <= maxHeight) {
      console.log(`   ✅ Uygun!`);
      
      return {
        url,
        width,
        height,
        film,
        domain,
        filename: `${film.replace(/\s+/g, "_")}_${width}x${height}.jpg`,
        contentType: contentType || 'image/jpeg'
      };
    } else {
      console.log(`   ❌ Boyut aralık dışı`);
    }
  } catch (err) {
    if (err.code !== 'ETIMEDOUT') {
      console.log(`   ⚠️ Hata: ${err.message}`);
    }
  }
  return null;
}

// --- IMDb'de filmi ara ve birden fazla sonuç döndür ---
async function searchMovies(film, siteUrl) {
  const query = encodeURIComponent(film);
  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  console.log(`   🔍 "${film}" aranıyor...`);
  
  const searchUrl = `${siteUrl}/find?q=${query}&s=tt`;
  
  try {
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.imdb.com/',
    };
    
    const res = await axios.get(searchUrl, { timeout: 15000, headers });
    const $ = cheerio.load(res.data);
    
    const results = [];
    const seen = new Set();
    
    // Tüm film/dizi sonuçlarını topla
    $('li.find-result-item, li.ipc-metadata-list-summary-item').each((index, element) => {
      if (results.length >= 10) return false; // Maksimum 10 sonuç
      
      const $el = $(element);
      const link = $el.find('a[href*="/title/tt"]').first();
      const moviePath = link.attr('href');
      
      if (!moviePath) return;
      
      const movieId = moviePath.match(/\/title\/(tt\d+)/)?.[1];
      if (!movieId || seen.has(movieId)) return;
      
      seen.add(movieId);
      
      // Başlık ve yıl bilgisi
      let movieTitle = link.text().trim();
      let year = '';
      let type = '';
      let poster = '';
      
      // Yıl bilgisini bul
      const yearMatch = $el.text().match(/\((\d{4})\)/);
      if (yearMatch) {
        year = yearMatch[1];
      }
      
      // Tür bilgisi (TV Series, Movie, etc.)
      const typeText = $el.find('.ipc-metadata-list-summary-item__li, .result_meta').text();
      if (typeText.toLowerCase().includes('tv') || typeText.toLowerCase().includes('series')) {
        type = 'TV Series';
      } else if (typeText.toLowerCase().includes('video game')) {
        type = 'Video Game';
      } else {
        type = 'Movie';
      }
      
      // Poster görseli
      const img = $el.find('img').first();
      if (img.length) {
        poster = img.attr('src') || img.attr('data-src') || '';
        // Küçük görseli orta boyuta çevir
        if (poster.includes('._V1_')) {
          poster = poster.split('._V1_')[0] + '._V1_UX300_.jpg';
        }
      }
      
      results.push({
        movieId,
        movieTitle: movieTitle || 'Unknown',
        year,
        type,
        poster,
        movieUrl: `${siteUrl}/title/${movieId}/`
      });
    });
    
    console.log(`   ✅ ${results.length} adet sonuç bulundu`);
    
    return results;
    
  } catch (err) {
    console.log(`   ❌ Arama hatası: ${err.message}`);
    return [];
  }
}

// --- IMDb'de filmi ara ve detay sayfasına git (tek sonuç) ---
async function findMovieUrl(film, siteUrl) {
  const query = encodeURIComponent(film);
  
  const searchUrl = `${siteUrl}/find?q=${query}&s=tt&ttype=ft`;
  
  try {
    const headers = {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.imdb.com/',
    };
    
    const res = await axios.get(searchUrl, { timeout: 15000, headers });
    const $ = cheerio.load(res.data);
    
    // İlk film sonucunu bul
    const firstResult = $('a[href*="/title/tt"]').first();
    const moviePath = firstResult.attr('href');
    
    if (!moviePath) {
      console.log(`   ❌ "${film}" için film bulunamadı`);
      return null;
    }
    
    // Film ID'sini çıkar (örn: /title/tt1234567/ -> tt1234567)
    const movieId = moviePath.match(/\/title\/(tt\d+)/)?.[1];
    
    if (!movieId) {
      console.log(`   ❌ Film ID'si çıkarılamadı`);
      return null;
    }
    
    const movieUrl = `${siteUrl}/title/${movieId}/`;
    const movieTitle = firstResult.text().trim();
    
    console.log(`   ✅ Film bulundu: "${movieTitle}" - ${movieUrl}`);
    
    return { movieUrl, movieId, movieTitle };
    
  } catch (err) {
    console.log(`   ❌ Arama hatası: ${err.message}`);
    return null;
  }
}

// --- Film detay sayfasından tüm görselleri çek (Puppeteer ile) ---
async function getMovieImages(movieInfo, siteUrl, sizeFilter = 'default', enableScroll = false) {
  if (!movieInfo) return [];
  
  const { movieUrl, movieId, movieTitle } = movieInfo;
  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  console.log(`   🖼️ "${movieTitle}" için görseller çekiliyor...${enableScroll ? ' (scroll ile)' : ''}`);
  
  // IMDb medya sayfası URL'i - Boyut filtresine göre URL'i ayarla
  let mediaUrl = `${siteUrl}/title/${movieId}/mediaindex`;
  
  // Boyut filtresine göre kategorileri seç
  const filterParams = getSizeFilterParams(sizeFilter);
  if (filterParams) {
    mediaUrl += `?${filterParams}`;
    console.log(`   📐 Filtre parametreleri eklendi: ${filterParams}`);
  }
  
  let browser;
  try {
    console.log(`   🌐 Tarayıcı başlatılıyor...`);
    
    // Puppeteer ile tarayıcı başlat
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // User agent ayarla (rastgele)
    await page.setUserAgent(getRandomUserAgent());
    
    // Viewport ayarla
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log(`   📡 Medya sayfası yükleniyor: ${mediaUrl}`);
    
    // Sayfayı yükle
    await page.goto(mediaUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Sadece enableScroll true ise kaydır
    if (enableScroll) {
      console.log(`   🔄 Sayfa kaydırılıyor...`);
      
      // Sayfayı 1 kez kaydır (lazy loading için)
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Kaydırmadan sonra bekle (görsellerin yüklenmesi için)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`   ✅ Kaydırma tamamlandı`);
    } else {
      console.log(`   ⏭️ Scroll atlanıyor (ilk yükleme)`);
      // İlk yükleme için kısa bekleme
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`   🔍 Görseller toplanıyor...`);
    
    // Sayfadaki tüm görselleri topla (sadece ana grid içindeki görseller)
    const imageUrls = await page.evaluate(() => {
      const imgs = [];
      
      // Ana medya grid'ini bul (More to explore bölümünü dışla)
      const mediaGrid = document.querySelector('.media_index_thumb_list, [class*="MediaIndex"], .media-viewer');
      
      if (mediaGrid) {
        // Sadece ana grid içindeki görselleri al
        mediaGrid.querySelectorAll('img[src*="media-amazon.com"]').forEach(img => {
          const src = img.src;
          if (src && src.includes('._V1_')) {
            // "More to explore" bölümünü filtrele (parent kontrolü)
            const isInMoreToExplore = img.closest('[class*="MoreToExplore"], [class*="more-to-explore"], aside, [data-testid*="more"]');
            
            if (!isInMoreToExplore) {
              // Yüksek çözünürlüklü versiyonu al
              const fullSizeUrl = src.split('._V1_')[0] + '._V1_FMjpg_UX2000_.jpg';
              imgs.push(fullSizeUrl);
            }
          }
        });
      } else {
        // Fallback: Tüm görselleri al ama "More to explore" hariç
        document.querySelectorAll('img[src*="media-amazon.com"]').forEach(img => {
          const src = img.src;
          if (src && src.includes('._V1_')) {
            // "More to explore" bölümünü filtrele
            const isInMoreToExplore = img.closest('[class*="MoreToExplore"], [class*="more-to-explore"], aside, [data-testid*="more"]');
            
            if (!isInMoreToExplore) {
              const fullSizeUrl = src.split('._V1_')[0] + '._V1_FMjpg_UX2000_.jpg';
              imgs.push(fullSizeUrl);
            }
          }
        });
      }
      
      return imgs;
    });
    
    // Tekrar edenleri kaldır
    const uniqueImgs = [...new Set(imageUrls)];
    
    console.log(`   🖼️ ${uniqueImgs.length} adet görsel bulundu`);
    
    await browser.close();
    return uniqueImgs;
    
  } catch (err) {
    console.log(`   ❌ Medya sayfası yüklenemedi: ${err.message}`);
    if (browser) {
      await browser.close();
    }
    return [];
  }
}

// Boyut filtresine göre IMDb URL parametreleri oluştur
function getSizeFilterParams(sizeFilter) {
  // IMDb'de banner/poster kategorilerine göre filtrele
  switch(sizeFilter) {
    case 'default':
      // Banner ve event görselleri (geniş formatlar)
      return 'refine=event,publicity';
    case '1920x1080':
    case '2560x1440':
    case '3840x2160':
      // Yüksek çözünürlüklü bannerlar
      return 'refine=event,publicity';
    case '1280x720':
      // HD bannerlar
      return 'refine=event,publicity';
    case 'custom':
      // Tüm kategoriler (filtre yok)
      return null;
    default:
      return 'refine=event,publicity';
  }
}

// --- Ana fonksiyon - dışarıdan çağrılabilir ---
export async function downloadBanners(filmInput) {
  const films = filmInput.split(",").map(f => f.trim()).filter(Boolean);
  const sources = getSources();

  console.log(`\n🔍 ${films.length} film icin banner aranacak...\n`);

  const results = {
    totalImages: 0,
    images: [],
    movies: []
  };

  for (const film of films) {
    console.log(`🎞️ [${film}] basliyor...\n`);
    const siteStats = {};
    let foundCount = 0;
    const movieImages = [];

    for (const site of sources) {
      const domain = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
      console.log(`🌐 ${domain} taranıyor...`);

      // Önce filmi bul
      const movieInfo = await findMovieUrl(film, site);
      if (!movieInfo) {
        console.log(`   ⚠️ Film bulunamadı, bir sonraki kaynağa geçiliyor...`);
        continue;
      }

      // Filmin tüm görsellerini çek (scroll OLMADAN)
      const imgs = await getMovieImages(movieInfo, site, 'default', false);
      
      if (imgs.length === 0) {
        console.log(`   ⚠️ Görsel bulunamadı`);
        continue;
      }

      // Görselleri paralel kontrol et (dosyaya kaydetmeden)
      for (let i = 0; i < imgs.length; i += PERFORMANCE_CONFIG.CONCURRENT_CHECKS) {
        const batch = imgs.slice(i, i + PERFORMANCE_CONFIG.CONCURRENT_CHECKS);
        const batchResults = await Promise.allSettled(
          batch.map(img => checkImage(img, film, domain, 'default'))
        );        // Başarılı olanları topla
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            movieImages.push(result.value);
            foundCount++;
            siteStats[domain] = (siteStats[domain] || 0) + 1;
          }
        });
        
        // Batch'ler arası kısa bekleme
        if (i + PERFORMANCE_CONFIG.CONCURRENT_CHECKS < imgs.length) {
          await new Promise(r => setTimeout(r, PERFORMANCE_CONFIG.BATCH_DELAY));
        }
      }
      
      await new Promise(r => setTimeout(r, 500)); // siteyi yorma
    }

    if (foundCount === 0) {
      console.log("⚠️ Uygun formatta banner bulunamadi.");
    } else {
      console.log(`🎉 ${foundCount} adet uygun banner bulundu.`);
      console.log("📊 Kaynaklara göre dagilim:");
      Object.entries(siteStats).forEach(([site, count]) => console.log(`   ${site}: ${count} görsel`));
    }

    results.movies.push({
      name: film,
      foundCount,
      siteStats,
      images: movieImages
    });
    results.images.push(...movieImages);
    results.totalImages += foundCount;

    console.log(`\n⏱️ Siradaki filme gecmeden ${DELAY_MS / 1000} saniye bekleniyor...\n`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log("\n🏁 Tum islemler tamamlandi!\n");
  return results;
}

// --- Film ID'si ile banner indir ---
export async function downloadBannersByMovieId(movieId, movieTitle, sizeFilter = 'default') {
  console.log(`\n🔍 "${movieTitle}" (${movieId}) için banner aranacak...`);
  console.log(`📐 Boyut filtresi: ${sizeFilter}\n`);
  
  // Önce cache'i kontrol et
  const cachedBanners = getMovieBannersFromCache(movieId, movieTitle);
  if (cachedBanners) {
    console.log(`💾 Cache'den veri bulundu, boyut filtresine göre filtreleniyor...`);
    
    // Cache'den gelen sonuçları boyut filtresine göre filtrele
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
  
  const sources = getSources();

  const results = {
    totalImages: 0,
    images: [],
    movies: []
  };

  const siteStats = {};
  let foundCount = 0;
  const movieImages = [];

  for (const site of sources) {
    const domain = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
    console.log(`🌐 ${domain} taranıyor...`);

    // Movie ID'yi direkt kullan
    const movieInfo = {
      movieUrl: `${site}/title/${movieId}/`,
      movieId: movieId,
      movieTitle: movieTitle
    };

    // Filmin tüm görsellerini çek (boyut filtresi ile, scroll OLMADAN)
    const imgs = await getMovieImages(movieInfo, site, sizeFilter, false);
    
    if (imgs.length === 0) {
      console.log(`   ⚠️ Görsel bulunamadı`);
      continue;
    }

    // Görselleri paralel kontrol et (downloadBannersByMovieId)
    for (let i = 0; i < imgs.length; i += PERFORMANCE_CONFIG.CONCURRENT_CHECKS) {
      const batch = imgs.slice(i, i + PERFORMANCE_CONFIG.CONCURRENT_CHECKS);
      const batchResults = await Promise.allSettled(
        batch.map(img => checkImage(img, movieTitle, domain, sizeFilter))
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          movieImages.push(result.value);
          foundCount++;
          siteStats[domain] = (siteStats[domain] || 0) + 1;
        }
      });
      
      if (i + PERFORMANCE_CONFIG.CONCURRENT_CHECKS < imgs.length) {
        await new Promise(r => setTimeout(r, PERFORMANCE_CONFIG.BATCH_DELAY));
      }
    }
    
    await new Promise(r => setTimeout(r, 300));
  }

  if (foundCount === 0) {
    console.log("⚠️ Uygun formatta banner bulunamadi.");
  } else {
    console.log(`🎉 ${foundCount} adet uygun banner bulundu.`);
    console.log("📊 Kaynaklara göre dagilim:");
    Object.entries(siteStats).forEach(([site, count]) => console.log(`   ${site}: ${count} görsel`));
  }

  results.movies.push({
    name: movieTitle,
    foundCount,
    siteStats,
    images: movieImages
  });
  results.images.push(...movieImages);
  results.totalImages += foundCount;

  console.log("\n🏁 İşlem tamamlandı!\n");
  
  // Sonuçları cache'e kaydet (sizeFilter olmadan, ham veriyi kaydet)
  if (results.totalImages > 0) {
    cacheMovieBanners(movieId, movieTitle, results);
  }
  
  return {
    ...results,
    fromCache: false
  };
}

// --- Daha fazla görsel yükle ---
export async function loadMoreImages(movieId, movieTitle, sizeFilter = 'default') {
  const sources = getSources();
  
  console.log(`\n📄 "${movieTitle}" (${movieId}) için daha fazla görsel yükleniyor...`);
  console.log(`📐 Boyut filtresi: ${sizeFilter}\n`);

  const results = {
    totalImages: 0,
    images: []
  };

  const siteStats = {};
  let foundCount = 0;
  const movieImages = [];

  for (const site of sources) {
    const domain = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
    console.log(`🌐 ${domain} taranıyor...`);

    // Movie ID'yi direkt kullan
    const movieInfo = {
      movieUrl: `${site}/title/${movieId}/`,
      movieId: movieId,
      movieTitle: movieTitle
    };

    // Görselleri çek (boyut filtresi ile, SCROLL İLE)
    const imgs = await getMovieImages(movieInfo, site, sizeFilter, true);
    
    if (imgs.length === 0) {
      console.log(`   ⚠️ Görsel bulunamadı`);
      continue;
    }

    // Görselleri paralel kontrol et (loadMoreImages)
    for (let i = 0; i < imgs.length; i += PERFORMANCE_CONFIG.CONCURRENT_CHECKS) {
      const batch = imgs.slice(i, i + PERFORMANCE_CONFIG.CONCURRENT_CHECKS);
      const batchResults = await Promise.allSettled(
        batch.map(img => checkImage(img, movieTitle, domain, sizeFilter))
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          movieImages.push(result.value);
          foundCount++;
          siteStats[domain] = (siteStats[domain] || 0) + 1;
        }
      });
      
      if (i + PERFORMANCE_CONFIG.CONCURRENT_CHECKS < imgs.length) {
        await new Promise(r => setTimeout(r, PERFORMANCE_CONFIG.BATCH_DELAY));
      }
    }
    
    await new Promise(r => setTimeout(r, 300));
  }

  if (foundCount === 0) {
    console.log(`⚠️ Uygun banner bulunamadı.`);
  } else {
    console.log(`🎉 ${foundCount} adet uygun banner bulundu.`);
    console.log("📊 Kaynaklara göre dağılım:");
    Object.entries(siteStats).forEach(([site, count]) => console.log(`   ${site}: ${count} görsel`));
  }

  results.images = movieImages;
  results.totalImages = foundCount;

  console.log(`\n🏁 Yükleme tamamlandı!\n`);
  return results;
}

// --- Film arama fonksiyonu - birden fazla sonuç döndür ---
export async function searchMoviesAPI(filmName) {
  // Önce cache'i kontrol et
  const cachedResults = getSearchResultsFromCache(filmName);
  if (cachedResults) {
    return {
      query: filmName,
      results: cachedResults,
      fromCache: true
    };
  }
  
  const sources = getSources();
  
  // İlk kaynaktan ara (genelde ilk kaynak IMDb olur)
  const mainSource = sources[0];
  
  console.log(`\n🔍 "${filmName}" için arama yapılıyor...\n`);
  
  const results = await searchMovies(filmName, mainSource);
  
  // Popülerliğe göre sırala - ilk sonuçlar genelde daha popülerdir
  // Ama title match olanları öne çıkar
  results.sort((a, b) => {
    // Tam eşleşme kontrolü
    const aExactMatch = a.movieTitle.toLowerCase() === filmName.toLowerCase();
    const bExactMatch = b.movieTitle.toLowerCase() === filmName.toLowerCase();
    
    if (aExactMatch && !bExactMatch) return -1;
    if (!aExactMatch && bExactMatch) return 1;
    
    // Yıl kontrolü - yeni olanlar önce
    if (a.year && b.year) {
      return parseInt(b.year) - parseInt(a.year);
    }
    
    return 0;
  });
  
  // Sonuçları cache'e kaydet
  if (results.length > 0) {
    cacheSearchResults(filmName, results);
  }
  
  return {
    query: filmName,
    results,
    fromCache: false
  };
}

// Command-line kullanımı kaldırıldı - sadece web API üzerinden çalışır
