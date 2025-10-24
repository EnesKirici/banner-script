import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { downloadBanners, searchMoviesAPI, downloadBannersByMovieId, loadMoreImages } from './banner-downloader-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('resources/css'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Search movies endpoint - birden fazla sonuç döndür
app.post('/api/search-movies', async (req, res) => {
    const { query } = req.body;
    
    if (!query) {
        return res.status(400).json({ error: 'Film adı gerekli' });
    }

    console.log(`\n🔍 Arama isteği alındı: ${query}\n`);

    try {
        const result = await searchMoviesAPI(query);

        console.log(`\n✅ ${result.results.length} adet sonuç bulundu\n`);

        res.json({
            success: true,
            query: result.query,
            count: result.results.length,
            results: result.results
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Arama sırasında bir hata oluştu',
            details: error.message 
        });
    }
});

// Download banners by movie ID endpoint
app.post('/api/download-by-id', async (req, res) => {
    const { movieId, movieTitle } = req.body;
    
    if (!movieId || !movieTitle) {
        return res.status(400).json({ error: 'Film ID ve başlığı gerekli' });
    }

    console.log(`\n🎬 ID ile istek alındı: ${movieTitle} (${movieId})\n`);

    try {
        const result = await downloadBannersByMovieId(movieId, movieTitle);

        console.log(`\n✅ API Response: ${result.totalImages} görsel bulundu\n`);

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
            message: `${result.totalImages} adet banner bulundu`,
            movies: result.movies
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Bir hata oluştu',
            details: error.message 
        });
    }
});

// Download banners endpoint
app.post('/api/download', async (req, res) => {
    const { movies } = req.body;
    
    if (!movies) {
        return res.status(400).json({ error: 'Film adı gerekli' });
    }

    console.log(`\n🎬 İstek alındı: ${movies}\n`);

    try {
        // Direkt olarak download fonksiyonunu çağır
        const result = await downloadBanners(movies);

        console.log(`\n✅ API Response: ${result.totalImages} görsel bulundu\n`);

        // Görsel bilgilerini frontend'e gönder
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
            message: `${result.totalImages} adet banner bulundu`,
            movies: result.movies
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Bir hata oluştu',
            details: error.message 
        });
    }
});

// Load more images endpoint - sayfalama için
app.post('/api/load-more-images', async (req, res) => {
    const { movieId, movieTitle, page } = req.body;
    
    if (!movieId || !movieTitle || !page) {
        return res.status(400).json({ error: 'Film ID, başlığı ve sayfa numarası gerekli' });
    }

    console.log(`\n📄 Daha fazla yükle isteği: ${movieTitle} (${movieId}) - Sayfa ${page}\n`);

    try {
        const result = await loadMoreImages(movieId, movieTitle, page);

        console.log(`\n✅ Sayfa ${page}: ${result.totalImages} görsel bulundu\n`);

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
            page: result.page,
            message: result.totalImages > 0 
                ? `Sayfa ${page}: ${result.totalImages} adet yeni banner bulundu`
                : `Sayfa ${page}'de yeni banner bulunamadı`
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: 'Daha fazla görsel yüklenirken bir hata oluştu',
            details: error.message 
        });
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
