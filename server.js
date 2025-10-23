import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

    console.log(`🎬 İstek alındı: ${movies}`);

    try {
        // Run the banner downloader script
        const child = spawn('node', ['banner-downloader.js'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Send movie names to the script
        child.stdin.write(movies + '\n');
        child.stdin.end();

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log(text);
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            console.log(`Process exited with code ${code}`);

            if (code !== 0) {
                return res.status(500).json({ 
                    error: 'Banner indirme işlemi başarısız oldu',
                    details: errorOutput 
                });
            }

            // Scan banners folder and return image info
            const movieList = movies.split(',').map(m => m.trim());
            const images = [];
            let totalImages = 0;

            movieList.forEach(movie => {
                const folderName = movie.replace(/\s+/g, '_');
                const bannerPath = path.join(__dirname, 'banners', folderName);

                if (fs.existsSync(bannerPath)) {
                    const files = fs.readdirSync(bannerPath);
                    
                    files.forEach(file => {
                        if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')) {
                            // Extract dimensions from filename (e.g., movie_1920x1080_1.jpg)
                            const match = file.match(/(\d+)x(\d+)/);
                            const width = match ? parseInt(match[1]) : 1920;
                            const height = match ? parseInt(match[2]) : 1080;

                            images.push({
                                name: file.replace(/\.\w+$/, '').replace(/_/g, ' '),
                                path: `/banners/${folderName}/${file}`,
                                width,
                                height,
                                movie
                            });
                            totalImages++;
                        }
                    });
                }
            });

            res.json({
                success: true,
                totalImages,
                images,
                message: `${totalImages} adet banner başarıyla indirildi`
            });
        });

    } catch (error) {
        console.error('Error:', error);
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
