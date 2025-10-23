import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { downloadBanners } from './banner-downloader-api.js';

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

// Serve banner images
app.use('/banners', express.static(path.join(__dirname, 'banners')));

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server başlatıldı: http://localhost:${PORT}`);
    console.log(`📂 Banners klasörü: ${path.join(__dirname, 'banners')}`);
    console.log('\n✨ Tarayıcınızda http://localhost:3000 adresini açın\n');
});
