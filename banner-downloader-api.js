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

// --- Ayarlar ---
const MIN_WIDTH = 1920;   // Minimum genişlik
const MAX_WIDTH = 2400;   // Maksimum genişlik  
const MIN_HEIGHT = 700;   // Minimum yükseklik
const MAX_HEIGHT = 1400;  // Maksimum yükseklik 
const DELAY_MS = 1500;    // Filmler arası bekleme

// --- sources.json okuma ---
function getSources() {
  const json = JSON.parse(fs.readFileSync("sources.json", "utf-8"));
  return json.sources;
}

// --- HTTP HEAD ile boyut kontrolü (indirmeden önce) ---
async function checkImageSize(url) {
  try {
    const headRes = await axios.head(url, { timeout: 5000 });
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
async function checkImage(url, film, domain) {
  try {
    console.log(`   🔄 Kontrol ediliyor: ${url}`);
    
    // Önce HEAD ile kontrol et
    const { skip, contentType } = await checkImageSize(url);
    if (skip) {
      console.log(`   ⏭️ Atlandı (dosya boyutu uygun değil)`);
      return null;
    }
    
    const imgRes = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
    const buffer = Buffer.from(imgRes.data);
    const { width, height } = sizeOf(buffer);

    console.log(`   📏 Boyut: ${width}x${height} (kabul edilen: ${MIN_WIDTH}-${MAX_WIDTH}px genişlik, ${MIN_HEIGHT}-${MAX_HEIGHT}px yükseklik)`);

    // Katı boyut kontrolü - sadece belirtilen aralıktaki görseller
    if (width >= MIN_WIDTH && width <= MAX_WIDTH && height >= MIN_HEIGHT && height <= MAX_HEIGHT) {
      console.log(`✅ Uygun görsel bulundu - Boyut: ${width}x${height}`);
      
      // Base64'e çevir (küçük boyutlar için) veya URL'i döndür
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
      console.log(`   ❌ Boyut aralık dışı - atlandı: ${width}x${height}`);
    }
  } catch (err) {
    console.log(`⚠️ ${url} kontrol edilemedi (${domain}): ${err.message}`);
  }
  return null;
}

// --- IMDb'de filmi ara ve birden fazla sonuç döndür ---
async function searchMovies(film, siteUrl) {
  const query = encodeURIComponent(film);
  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  console.log(`   🔍 "${film}" için IMDb'de arama yapılıyor...`);
  
  const searchUrl = `${siteUrl}/find?q=${query}&s=tt`;
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.imdb.com/',
    };
    
    console.log(`   📡 Aranıyor: ${searchUrl}`);
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
  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  console.log(`   🔍 "${film}" için IMDb'de arama yapılıyor...`);
  
  const searchUrl = `${siteUrl}/find?q=${query}&s=tt&ttype=ft`;
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.imdb.com/',
    };
    
    console.log(`   📡 Aranıyor: ${searchUrl}`);
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
async function getMovieImages(movieInfo, siteUrl) {
  if (!movieInfo) return [];
  
  const { movieUrl, movieId, movieTitle } = movieInfo;
  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  console.log(`   🖼️ "${movieTitle}" için görseller çekiliyor...`);
  
  // IMDb medya sayfası URL'i
  const mediaUrl = `${siteUrl}/title/${movieId}/mediaindex`;
  
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
    
    // User agent ayarla
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Viewport ayarla
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log(`   📡 Medya sayfası yükleniyor: ${mediaUrl}`);
    
    // Sayfayı yükle
    await page.goto(mediaUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log(`   🔍 Görseller toplanıyor...`);
    
    // Sayfadaki tüm görselleri topla
    const imageUrls = await page.evaluate(() => {
      const imgs = [];
      
      // Tüm media-amazon.com görsellerini bul
      document.querySelectorAll('img[src*="media-amazon.com"]').forEach(img => {
        const src = img.src;
        if (src && src.includes('._V1_')) {
          // Yüksek çözünürlüklü versiyonu al
          const fullSizeUrl = src.split('._V1_')[0] + '._V1_FMjpg_UX2000_.jpg';
          imgs.push(fullSizeUrl);
        }
      });
      
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

      // Filmin tüm görsellerini çek
      const imgs = await getMovieImages(movieInfo, site);
      
      if (imgs.length === 0) {
        console.log(`   ⚠️ Görsel bulunamadı`);
        continue;
      }

      // Görselleri paralel kontrol et (dosyaya kaydetmeden)
      const CONCURRENT_CHECKS = 3;
      for (let i = 0; i < imgs.length; i += CONCURRENT_CHECKS) {
        const batch = imgs.slice(i, i + CONCURRENT_CHECKS);
        const batchResults = await Promise.allSettled(
          batch.map(img => checkImage(img, film, domain))
        );
        
        // Başarılı olanları topla
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value) {
            movieImages.push(result.value);
            foundCount++;
            siteStats[domain] = (siteStats[domain] || 0) + 1;
          }
        });
        
        // Batch'ler arası kısa bekleme
        if (i + CONCURRENT_CHECKS < imgs.length) {
          await new Promise(r => setTimeout(r, 200));
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
export async function downloadBannersByMovieId(movieId, movieTitle) {
  // Önce cache'i kontrol et
  const cachedBanners = getMovieBannersFromCache(movieId, movieTitle);
  if (cachedBanners) {
    return {
      ...cachedBanners,
      fromCache: true
    };
  }
  
  const sources = getSources();
  
  console.log(`\n🔍 "${movieTitle}" (${movieId}) için banner aranacak...\n`);

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

    // Filmin tüm görsellerini çek
    const imgs = await getMovieImages(movieInfo, site);
    
    if (imgs.length === 0) {
      console.log(`   ⚠️ Görsel bulunamadı`);
      continue;
    }

    // Görselleri paralel kontrol et
    const CONCURRENT_CHECKS = 3;
    for (let i = 0; i < imgs.length; i += CONCURRENT_CHECKS) {
      const batch = imgs.slice(i, i + CONCURRENT_CHECKS);
      const batchResults = await Promise.allSettled(
        batch.map(img => checkImage(img, movieTitle, domain))
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          movieImages.push(result.value);
          foundCount++;
          siteStats[domain] = (siteStats[domain] || 0) + 1;
        }
      });
      
      if (i + CONCURRENT_CHECKS < imgs.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
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
  
  // Sonuçları cache'e kaydet
  if (results.totalImages > 0) {
    cacheMovieBanners(movieId, movieTitle, results);
  }
  
  return {
    ...results,
    fromCache: false
  };
}

// --- Daha fazla görsel yükle ---
export async function loadMoreImages(movieId, movieTitle) {
  const sources = getSources();
  
  console.log(`\n📄 "${movieTitle}" (${movieId}) için daha fazla görsel yükleniyor...\n`);

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

    // Görselleri çek
    const imgs = await getMovieImages(movieInfo, site);
    
    if (imgs.length === 0) {
      console.log(`   ⚠️ Görsel bulunamadı`);
      continue;
    }

    // Görselleri paralel kontrol et
    const CONCURRENT_CHECKS = 3;
    for (let i = 0; i < imgs.length; i += CONCURRENT_CHECKS) {
      const batch = imgs.slice(i, i + CONCURRENT_CHECKS);
      const batchResults = await Promise.allSettled(
        batch.map(img => checkImage(img, movieTitle, domain))
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          movieImages.push(result.value);
          foundCount++;
          siteStats[domain] = (siteStats[domain] || 0) + 1;
        }
      });
      
      if (i + CONCURRENT_CHECKS < imgs.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
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
