// DOM Elements
const movieInput = document.getElementById('movieInput');
const searchBtn = document.getElementById('searchBtn');
const statusSection = document.getElementById('statusSection');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const progressFill = document.getElementById('progressFill');
const resultsSection = document.getElementById('resultsSection');
const resultsGrid = document.getElementById('resultsGrid');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');

// State
let isProcessing = false;
let downloadedImages = [];

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
movieInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isProcessing) {
        handleSearch();
    }
});

// Main search handler
async function handleSearch() {
    const movieNames = movieInput.value.trim();
    
    if (!movieNames) {
        showNotification('Lütfen bir film adı girin', 'error');
        return;
    }

    if (isProcessing) {
        return;
    }

    isProcessing = true;
    searchBtn.disabled = true;
    
    // Show status section
    showStatus('loading', 'İşlem Başladı', 'Filmler aranıyor ve bannerlar indiriliyor...');
    hideEmptyState();
    
    // Simulate progress (since we can't get real progress from the script)
    simulateProgress();

    try {
        // Call the banner downloader script
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ movies: movieNames })
        });

        if (!response.ok) {
            throw new Error('İndirme işlemi başarısız oldu');
        }

        const result = await response.json();
        
        // Show success
        progressFill.style.width = '100%';
        
        setTimeout(() => {
            showStatus('success', 'İşlem Tamamlandı! 🎉', 
                `${result.totalImages} adet banner başarıyla indirildi`);
            
            // Load and display images
            loadDownloadedImages(result.images);
        }, 500);

    } catch (error) {
        console.error('Error:', error);
        showStatus('error', 'Hata Oluştu', 
            'Banner indirme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
        isProcessing = false;
        searchBtn.disabled = false;
    }
}

// Simulate progress animation
function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 90) {
            progress = 90;
            clearInterval(interval);
        }
        progressFill.style.width = `${progress}%`;
    }, 800);
}

// Show status section
function showStatus(type, title, message) {
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    
    const statusIcon = document.querySelector('.status-icon');
    const spinner = document.querySelector('.spinner');
    
    if (type === 'loading') {
        statusIcon.className = 'status-icon loading';
        if (!spinner) {
            statusIcon.innerHTML = '<div class="spinner"></div>';
        }
    } else if (type === 'success') {
        statusIcon.className = 'status-icon success';
        statusIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
    
    statusSection.classList.remove('hidden');
}

// Load and display downloaded images
function loadDownloadedImages(images) {
    if (!images || images.length === 0) {
        return;
    }

    downloadedImages = images;
    resultsGrid.innerHTML = '';
    
    images.forEach((image, index) => {
        const card = createImageCard(image, index);
        resultsGrid.appendChild(card);
    });

    resultsCount.textContent = `${images.length} görsel`;
    resultsSection.classList.remove('hidden');
    
    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Create image card element
function createImageCard(image, index) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.style.animationDelay = `${index * 0.05}s`;
    
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'image-wrapper';
    
    const img = document.createElement('img');
    img.src = image.path;
    img.alt = image.name;
    img.loading = 'lazy';
    
    // Add error handler
    img.onerror = () => {
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%231a1a1a" width="400" height="300"/%3E%3Ctext fill="%23707070" font-family="Arial" font-size="18" x="50%25" y="50%25" text-anchor="middle"%3EGörsel yüklenemedi%3C/text%3E%3C/svg%3E';
    };
    
    imageWrapper.appendChild(img);
    
    const info = document.createElement('div');
    info.className = 'image-info';
    
    const title = document.createElement('div');
    title.className = 'image-title';
    title.textContent = image.name;
    
    const meta = document.createElement('div');
    meta.className = 'image-meta';
    
    const dimension = document.createElement('div');
    dimension.className = 'image-dimension';
    dimension.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 11L12 14L22 4M21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>${image.width}×${image.height}</span>
    `;
    
    meta.appendChild(dimension);
    info.appendChild(title);
    info.appendChild(meta);
    
    card.appendChild(imageWrapper);
    card.appendChild(info);
    
    // Add click handler to open image
    card.addEventListener('click', () => {
        window.open(image.path, '_blank');
    });
    
    return card;
}

// Hide empty state
function hideEmptyState() {
    emptyState.classList.add('hidden');
}

// Show notification (can be enhanced with a toast library)
function showNotification(message, type = 'info') {
    // Simple console notification for now
    console.log(`[${type.toUpperCase()}]: ${message}`);
    
    // You can implement a toast notification here
    // For example, using a library like Toastify or creating a custom toast
}

// Demo mode - for testing without backend
// This will load sample images from the banners folder
function initDemoMode() {
    // Check if we're in demo mode (no backend available)
    searchBtn.addEventListener('click', async () => {
        // Try to fetch real data first, if fails, use demo data
        try {
            await fetch('/api/health');
        } catch (error) {
            // Backend not available, use demo mode
            console.log('Running in demo mode');
            await handleDemoSearch();
        }
    });
}

async function handleDemoSearch() {
    const movieNames = movieInput.value.trim();
    
    if (!movieNames) {
        showNotification('Lütfen bir film adı girin', 'error');
        return;
    }

    if (isProcessing) {
        return;
    }

    isProcessing = true;
    searchBtn.disabled = true;
    
    showStatus('loading', 'İşlem Başladı', 'Filmler aranıyor ve bannerlar indiriliyor...');
    hideEmptyState();
    
    simulateProgress();

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create demo images
    const movies = movieNames.split(',').map(m => m.trim());
    const demoImages = [];
    
    movies.forEach(movie => {
        const folderName = movie.toLowerCase().replace(/\s+/g, '_');
        // Create 3-5 demo images per movie
        const count = Math.floor(Math.random() * 3) + 3;
        
        for (let i = 0; i < count; i++) {
            demoImages.push({
                name: `${movie} - Banner ${i + 1}`,
                path: `../../banners/${folderName}/${movie.replace(/\s+/g, '_')}_${1920 + i * 100}x${800 + i * 50}_${i + 1}.jpg`,
                width: 1920 + i * 100,
                height: 800 + i * 50
            });
        }
    });

    progressFill.style.width = '100%';
    
    setTimeout(() => {
        showStatus('success', 'İşlem Tamamlandı! 🎉', 
            `${demoImages.length} adet banner başarıyla indirildi`);
        
        loadDownloadedImages(demoImages);
        
        isProcessing = false;
        searchBtn.disabled = false;
    }, 500);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Focus on input
    movieInput.focus();
    
    // Add keyboard shortcut (Ctrl/Cmd + K to focus search)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            movieInput.focus();
            movieInput.select();
        }
    });
});
