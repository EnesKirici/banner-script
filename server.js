import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { searchMoviesAPI, downloadBannersByMovieId, loadMoreImages } from './banner-downloader-api.js';
import { searchMoviesTMDB, getMovieImagesTMDB, loadMoreImagesTMDB, getPopularMoviesTMDB, getPopularTVTMDB } from './tmdb-api.js';
import { getCacheStats, clearCache } from './cache.js';
import authRoutes from './auth/auth-routes.js';
import { securityHeaders, corsMiddleware, rateLimiter, requireAuth } from './auth/auth-middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(securityHeaders);

// Auth routes with rate limiting - PUBLIC ACCESS (login için gerekli)
app.use('/auth', corsMiddleware);
app.use('/auth/login', rateLimiter.middleware(5, 15 * 60 * 1000));
app.use('/auth', authRoutes);

// Static files - SADECE auth klasörü public erişim için (login sayfası)
app.use('/auth', express.static(path.join(__dirname, 'auth')));

// TÜM DİĞER ROUTE'LAR İÇİN AUTHENTİCATİON GEREKLİ
// Static files - AUTH GEREKTİRİR
app.use('/resources', requireAuth, express.static('resources'));
app.use('/banners', requireAuth, express.static(path.join(__dirname, 'banners')));

// Ana sayfa - AUTH GEREKTİRİR
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'resources/css/index.html'));
});

// Cache yönetim sayfası - AUTH GEREKTİRİR
app.get('/clear-cache', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'clear-cache.html'));
});

// Health check endpoint - AUTH GEREKTİRİR
app.get('/api/health', requireAuth, (req, res) => {
    res.json({ status: 'ok' });
});

// Cache istatistikleri endpoint - AUTH GEREKTİRİR
app.get('/api/cache/stats', requireAuth, (req, res) => {
    const stats = getCacheStats();
    res.json({
        success: true,
        cache: stats
    });
});

// Cache temizleme endpoint - AUTH GEREKTİRİR
app.post('/api/cache/clear', requireAuth, (req, res) => {
    clearCache();
    res.json({
        success: true,
        message: 'Cache başarıyla temizlendi'
    });
});

// Search movies endpoint - AUTH GEREKTİRİR
app.post('/api/search-movies', requireAuth, async (req, res) => {
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Film adı gerekli' });
    }

    console.log(`\n🔍 Arama isteği alındı: ${query}\n`);

    try {
        const result = await searchMoviesAPI(query);

        console.log(`\n✅ ${result.results.length} adet sonuç bulundu${result.fromCache ? ' (Cache\'den)' : ''}\n`);

        res.json({
            success: true,
            query: result.query,
            count: result.results.length,
            results: result.results,
            fromCache: result.fromCache || false
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Arama sırasında bir hata oluştu',
            details: error.message 
        });
    }
});

// Download banners by movie ID endpoint - AUTH GEREKTİRİR
app.post('/api/download-by-id', requireAuth, async (req, res) => {
    const { movieId, movieTitle, sizeFilter } = req.body;
    
    if (!movieId || !movieTitle) {
        return res.status(400).json({ error: 'Film ID ve başlığı gerekli' });
    }

    console.log(`\n🎬 ID ile istek alındı: ${movieTitle} (${movieId})`);
    console.log(`📐 Boyut filtresi: ${sizeFilter || 'default'}\n`);

    try {
        const result = await downloadBannersByMovieId(movieId, movieTitle, sizeFilter);

        console.log(`\n✅ API Response: ${result.totalImages} görsel bulundu${result.fromCache ? ' (Cache\'den)' : ''}\n`);

        const images = result.images.map((img, index) => ({
            id: index,
            name: img.filename,
            url: img.url,
            width: img.width,
            height: img.height,
            movie: img.film,
            domain: img.domain
        }));

        res.json({
            success: true,
            totalImages: result.totalImages,
            images,
            message: `${result.totalImages} adet banner bulundu${result.fromCache ? ' (Cache\'den)' : ''}`,
            movies: result.movies,
            fromCache: result.fromCache || false
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Bir hata oluştu',
            details: error.message 
        });
    }
});

// Load more images endpoint - AUTH GEREKTİRİR
app.post('/api/load-more-images', requireAuth, async (req, res) => {
    const { movieId, movieTitle, sizeFilter } = req.body;
    
    if (!movieId || !movieTitle) {
        return res.status(400).json({ error: 'Film ID ve başlığı gerekli' });
    }

    console.log(`\n📄 Daha fazla yükle isteği: ${movieTitle} (${movieId})`);
    console.log(`📐 Boyut filtresi: ${sizeFilter || 'default'}\n`);

    try {
        const result = await loadMoreImages(movieId, movieTitle, sizeFilter);

        console.log(`\n✅ ${result.totalImages} görsel bulundu\n`);

        const images = result.images.map((img, index) => ({
            id: index,
            name: img.filename,
            url: img.url,
            width: img.width,
            height: img.height,
            movie: img.film,
            domain: img.domain
        }));

        res.json({
            success: true,
            totalImages: result.totalImages,
            images,
            message: result.totalImages > 0 
                ? `✨ ${result.totalImages} adet yeni banner bulundu`
                : `ℹ️ Yeni banner bulunamadı`
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Daha fazla görsel yüklenirken bir hata oluştu',
            details: error.message 
        });
    }
});

// ==================== TMDB API ENDPOINTS ====================

// TMDB - Film arama endpoint - AUTH GEREKTİRİR
app.post('/api/tmdb-search', requireAuth, async (req, res) => {
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Film adı gerekli' });
    }

    console.log(`\n🔍 TMDB Arama isteği alındı: ${query}\n`);

    try {
        const result = await searchMoviesTMDB(query);

        console.log(`\n✅ ${result.results.length} adet sonuç bulundu${result.fromCache ? ' (Cache\'den)' : ''}\n`);

        res.json({
            success: true,
            query: result.query,
            count: result.results.length,
            results: result.results,
            fromCache: result.fromCache || false,
            source: 'tmdb'
        });

    } catch (error) {
        console.error('❌ TMDB Error:', error);
        res.status(500).json({ 
            error: 'TMDB arama sırasında bir hata oluştu',
            details: error.message 
        });
    }
});

// TMDB - Movie ID ile görsel indirme endpoint - AUTH GEREKTİRİR
app.post('/api/tmdb-download-by-id', requireAuth, async (req, res) => {
    const { movieId, movieTitle, sizeFilter, mediaType } = req.body;
    
    if (!movieId || !movieTitle) {
        return res.status(400).json({ error: 'Film ID ve başlığı gerekli' });
    }

    console.log(`\n🎬 TMDB - ID ile istek alındı: ${movieTitle} (${movieId})`);
    console.log(`📐 Boyut filtresi: ${sizeFilter || 'default'}`);
    console.log(`📺 Medya tipi: ${mediaType || 'movie'}\n`);

    try {
        const result = await getMovieImagesTMDB(movieId, movieTitle, sizeFilter, mediaType || 'movie');

        console.log(`\n✅ TMDB API Response: ${result.totalImages} görsel bulundu${result.fromCache ? ' (Cache\'den)' : ''}\n`);

        const images = result.images.map((img, index) => ({
            id: index,
            name: img.filename,
            url: img.url,
            width: img.width,
            height: img.height,
            movie: img.film,
            domain: img.domain
        }));

        res.json({
            success: true,
            totalImages: result.totalImages,
            images,
            message: `${result.totalImages} adet banner bulundu${result.fromCache ? ' (Cache\'den)' : ''}`,
            movies: result.movies,
            fromCache: result.fromCache || false,
            source: 'tmdb'
        });

    } catch (error) {
        console.error('❌ TMDB Error:', error);
        res.status(500).json({ 
            error: 'TMDB görsel indirme sırasında bir hata oluştu',
            details: error.message 
        });
    }
});

// TMDB - Daha fazla görsel yükle (TMDB'de geçerli değil ama API uyumluluğu için) - AUTH GEREKTİRİR
app.post('/api/tmdb-load-more', requireAuth, async (req, res) => {
    const { movieId, movieTitle, sizeFilter, mediaType } = req.body;
    
    console.log(`\n📄 TMDB - Daha fazla yükle isteği (geçerli değil): ${movieTitle} (${mediaType || 'movie'})\n`);

    try {
        const result = await loadMoreImagesTMDB(movieId, movieTitle, sizeFilter, mediaType || 'movie');

        res.json({
            success: true,
            totalImages: result.totalImages,
            images: result.images,
            message: result.message,
            source: 'tmdb'
        });

    } catch (error) {
        console.error('❌ TMDB Error:', error);
        res.status(500).json({ 
            error: 'TMDB daha fazla görsel yükleme hatası',
            details: error.message 
        });
    }
});

// TMDB - Popüler Filmler ve Diziler (cache'li, frontend sol bar için) - AUTH GEREKTİRİR
app.get('/api/tmdb-popular', requireAuth, async (req, res) => {
    try {
        const movies = await getPopularMoviesTMDB(8);
        const tv = await getPopularTVTMDB(8);

        res.json({
            success: true,
            movies,
            tv
        });
    } catch (error) {
        console.error('❌ TMDB popular fetch error:', error.message);
        res.status(500).json({ error: 'TMDB popüler verisi alınamadı', details: error.message });
    }
});

// Serve banner images
app.use('/banners', express.static(path.join(__dirname, 'banners')));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server başlatıldı: http://localhost:${PORT}`);
    console.log(`📂 Banners klasörü: ${path.join(__dirname, 'banners')}`);
    console.log('\n✨ Tarayıcınızda http://localhost:3000 adresini açın\n');
});
