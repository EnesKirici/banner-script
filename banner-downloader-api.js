import axios from "axios";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import sizeOf from "image-size";
import dotenv from "dotenv";
import * as cheerio from "cheerio";

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

// --- IMDb'de filmi ara ve detay sayfasına git ---
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

// --- Film detay sayfasından tüm görselleri çek ---
async function getMovieImages(movieInfo, siteUrl) {
  if (!movieInfo) return [];
  
  const { movieUrl, movieId, movieTitle } = movieInfo;
  const domain = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  
  console.log(`   🖼️ "${movieTitle}" için görseller çekiliyor...`);
  
  // IMDb medya sayfası URL'i
  const mediaUrl = `${siteUrl}/title/${movieId}/mediaindex`;
  
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': movieUrl,
    };
    
    console.log(`   📡 Medya sayfası yükleniyor: ${mediaUrl}`);
    const res = await axios.get(mediaUrl, { timeout: 15000, headers });
    const $ = cheerio.load(res.data);
    
    // IMDb'deki görselleri çek - yüksek çözünürlüklü versiyonları
    const imgs = [];
    
    // Thumbnail görsellerini bul ve yüksek çözünürlüklü linklerini çıkar
    $('img[src*="media-amazon.com"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('._V1_')) {
        // IMDb görselleri ._V1_UX... formatında, bunu kaldırarak tam boyutu alırız
        // Örnek: https://m.media-amazon.com/images/M/...._V1_UX182_CR0,0,182,268_AL_.jpg
        // Hedef: https://m.media-amazon.com/images/M/...._V1_FMjpg_UX2000_.jpg
        const fullSizeUrl = src.split('._V1_')[0] + '._V1_FMjpg_UX2000_.jpg';
        imgs.push(fullSizeUrl);
      }
    });
    
    // Link'lerden de görselleri çıkar
    $('a[href*="/title/' + movieId + '/mediaviewer/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const img = $(el).find('img').attr('src');
        if (img && img.includes('._V1_')) {
          const fullSizeUrl = img.split('._V1_')[0] + '._V1_FMjpg_UX2000_.jpg';
          imgs.push(fullSizeUrl);
        }
      }
    });
    
    // Tekrar edenleri kaldır
    const uniqueImgs = [...new Set(imgs)];
    
    console.log(`   🖼️ ${uniqueImgs.length} adet görsel bulundu`);
    
    if (uniqueImgs.length > 0) {
      console.log(`   ✅ İlk 3 görsel: ${uniqueImgs.slice(0, 3).join(", ")}`);
    }
    
    return uniqueImgs;
    
  } catch (err) {
    console.log(`   ❌ Medya sayfası yüklenemedi: ${err.message}`);
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

// Eğer doğrudan çalıştırılıyorsa (command line'dan)
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  import('readline-sync').then(module => {
    const readlineSync = module.default;
    const input = readlineSync.question("Film adlarini gir (virgulle ayir): ");
    downloadBanners(input);
  });
}
