// DOM Elements
const movieInput = document.getElementById('movieInput');
const searchBtn = document.getElementById('searchBtn');
const sizeFilter = document.getElementById('sizeFilter');
const statusSection = document.getElementById('statusSection');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const progressFill = document.getElementById('progressFill');
const resultsSection = document.getElementById('resultsSection');
const resultsGrid = document.getElementById('resultsGrid');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');
const movieSelectionSection = document.getElementById('movieSelectionSection');
const movieSelectionGrid = document.getElementById('movieSelectionGrid');

// State
let isProcessing = false;
let downloadedImages = [];
let movieSearchResults = [];
let selectedMovieId = null;
let currentMovieTitle = null;
let currentScrollCount = 1; // Her yüklemede kaç kez kaydırma yapılacak
let loadedImageUrls = new Set(); // Yüklenen görsel URL'lerini takip et (tekrar önleme)

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

    // Her zaman arama yap ve sonuçları göster
    await searchAndShowResults(movieNames);
}

// Film arama ve sonuçları gösterme
async function searchAndShowResults(movieName) {
    isProcessing = true;
    searchBtn.disabled = true;
    hideMovieSelection();
    hideEmptyState();
    
    showStatus('loading', 'Arama Yapılıyor...', `"${movieName}" için sonuçlar getiriliyor...`);
    
    try {
        const response = await fetch('/api/search-movies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: movieName })
        });

        if (!response.ok) {
            throw new Error('Arama başarısız oldu');
        }

        const result = await response.json();
        
        hideStatus();
        
        if (result.results && result.results.length > 1) {
            // Birden fazla sonuç varsa seçim ekranını göster
            showMovieSelection(result.results, movieName);
        } else if (result.results && result.results.length === 1) {
            // Tek sonuç varsa direkt indir
            const movieId = result.results[0].movieId;
            await downloadBannersForMovie(movieId, movieName);
        } else {
            showNotification('Film bulunamadı', 'error');
        }

    } catch (error) {
        console.error('Error:', error);
        hideStatus();
        showNotification('Arama sırasında bir hata oluştu', 'error');
    } finally {
        isProcessing = false;
        searchBtn.disabled = false;
    }
}

// Film seçim ekranını göster
function showMovieSelection(results, searchQuery) {
    movieSearchResults = results;
    movieSelectionGrid.innerHTML = '';
    
    // Film ve dizileri ayır
    const tvSeries = results.filter(r => r.type === 'TV Series');
    const movies = results.filter(r => r.type === 'Movie');
    const others = results.filter(r => r.type !== 'TV Series' && r.type !== 'Movie');
    
    let cardIndex = 0;
    
    // Dizileri ekle
    if (tvSeries.length > 0) {
        const tvHeader = document.createElement('div');
        tvHeader.className = 'category-header';
        tvHeader.innerHTML = `
            <h4>📺 Diziler</h4>
            <span class="category-count">${tvSeries.length} sonuç</span>
        `;
        movieSelectionGrid.appendChild(tvHeader);
        
        tvSeries.forEach((movie) => {
            const card = createMovieCard(movie, cardIndex++);
            movieSelectionGrid.appendChild(card);
        });
    }
    
    // Filmleri ekle
    if (movies.length > 0) {
        const movieHeader = document.createElement('div');
        movieHeader.className = 'category-header';
        movieHeader.innerHTML = `
            <h4>🎬 Filmler</h4>
            <span class="category-count">${movies.length} sonuç</span>
        `;
        movieSelectionGrid.appendChild(movieHeader);
        
        movies.forEach((movie) => {
            const card = createMovieCard(movie, cardIndex++);
            movieSelectionGrid.appendChild(card);
        });
    }
    
    // Diğerlerini ekle (eğer varsa)
    if (others.length > 0) {
        const otherHeader = document.createElement('div');
        otherHeader.className = 'category-header';
        otherHeader.innerHTML = `
            <h4>🎮 Diğer</h4>
            <span class="category-count">${others.length} sonuç</span>
        `;
        movieSelectionGrid.appendChild(otherHeader);
        
        others.forEach((movie) => {
            const card = createMovieCard(movie, cardIndex++);
            movieSelectionGrid.appendChild(card);
        });
    }
    
    movieSelectionSection.classList.remove('hidden');
    
    // Smooth scroll
    setTimeout(() => {
        movieSelectionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// Film kartı oluştur
function createMovieCard(movie, index) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.style.animationDelay = `${index * 0.05}s`;
    card.dataset.movieId = movie.movieId;
    
    const posterHtml = movie.poster 
        ? `<img src="${movie.poster}" alt="${movie.movieTitle}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'movie-poster-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'/><path d=\\'M3 9h18M9 21V9\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'/></svg></div>'">`
        : `<div class="movie-poster-placeholder">
            <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M3 9h18M9 21V9" stroke="currentColor" stroke-width="2"/>
            </svg>
           </div>`;
    
    card.innerHTML = `
        <div class="movie-poster">
            ${posterHtml}
        </div>
        <div class="movie-card-check">
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <div class="movie-info">
            <h4 class="movie-title">${movie.movieTitle}</h4>
            <div class="movie-meta">
                ${movie.year ? `<span class="movie-year">📅 ${movie.year}</span>` : ''}
                ${movie.type ? `<span class="movie-type">${movie.type}</span>` : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => handleMovieSelection(movie, card));
    
    return card;
}

// Film seçimi işle
async function handleMovieSelection(movie, cardElement) {
    // Önceki seçimi kaldır
    document.querySelectorAll('.movie-card').forEach(c => c.classList.remove('selected'));
    
    // Yeni seçimi ekle
    cardElement.classList.add('selected');
    selectedMovieId = movie.movieId;
    
    // Kısa bekleme sonrası banner indir
    setTimeout(() => {
        downloadBannersForMovie(movie.movieId, movie.movieTitle);
    }, 500);
}

// Seçilen film için banner indir
async function downloadBannersForMovie(movieId, movieTitle) {
    hideMovieSelection();
    isProcessing = true;
    searchBtn.disabled = true;
    
    // State'i güncelle ve sıfırla
    selectedMovieId = movieId;
    currentMovieTitle = movieTitle;
    currentScrollCount = 1; // İlk yüklemede 1 kez kaydır
    loadedImageUrls.clear(); // Önceki görselleri temizle
    
    // Seçilen boyut filtresini al
    const selectedSize = sizeFilter.value;
    console.log(`📐 Frontend - Seçilen boyut filtresi: "${selectedSize}"`);
    
    showStatus('loading', 'İşlem Başladı', `"${movieTitle}" için bannerlar indiriliyor... (Boyut: ${selectedSize})`);
    simulateProgress();

    try {
        // Yeni endpoint ile movieId kullanarak indir
        const response = await fetch('/api/download-by-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                movieId: movieId,
                movieTitle: movieTitle,
                sizeFilter: selectedSize
            })
        });

        console.log(`📡 API'ye gönderilen veri:`, { movieId, movieTitle, sizeFilter: selectedSize });

        if (!response.ok) {
            throw new Error('İndirme işlemi başarısız oldu');
        }

        const result = await response.json();
        
        progressFill.style.width = '100%';
        
        setTimeout(() => {
            showStatus('success', 'İşlem Tamamlandı! 🎉', 
                `${result.totalImages} adet banner bulundu`);
            
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

// Film seçim ekranını gizle
function hideMovieSelection() {
    movieSelectionSection.classList.add('hidden');
    movieSelectionGrid.innerHTML = '';
    movieSearchResults = [];
    selectedMovieId = null;
}

// Status gizle
function hideStatus() {
    statusSection.classList.add('hidden');
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
function loadDownloadedImages(images, append = false) {
    if (!images || images.length === 0) {
        if (!append) {
            // İlk yüklemede görsel yoksa boş durumu göster
            resultsSection.classList.add('hidden');
        }
        return;
    }

    if (!append) {
        // Yeni sonuç, grid'i temizle
        downloadedImages = images;
        resultsGrid.innerHTML = '';
        loadedImageUrls.clear();
        
        // Yüklenen URL'leri kaydet
        images.forEach(img => loadedImageUrls.add(img.url));
    } else {
        // Tekrar eden görselleri filtrele
        const newImages = images.filter(img => !loadedImageUrls.has(img.url));
        
        if (newImages.length === 0) {
            console.log('Tüm görseller zaten yüklü, yeni görsel yok');
            return;
        }
        
        // Yeni görselleri ekle
        newImages.forEach(img => loadedImageUrls.add(img.url));
        downloadedImages = [...downloadedImages, ...newImages];
        
        // Filtrelenmiş listeyi kullan
        images = newImages;
    }
    
    const startIndex = append ? downloadedImages.length - images.length : 0;
    
    images.forEach((image, index) => {
        const card = createImageCard(image, startIndex + index);
        resultsGrid.appendChild(card);
    });

    resultsCount.textContent = `${downloadedImages.length} görsel`;
    resultsSection.classList.remove('hidden');
    
    // "Daha Fazla Yükle" butonunu kontrol et / güncelle
    updateLoadMoreButton();
    
    // Scroll to results (sadece ilk yüklemede)
    if (!append) {
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }
}

// "Daha Fazla Yükle" butonu güncelleme
function updateLoadMoreButton() {
    let loadMoreBtn = document.getElementById('loadMoreBtn');
    
    // Buton yoksa oluştur
    if (!loadMoreBtn) {
        loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = 'load-more-btn';
        loadMoreBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5V19M12 19L19 12M12 19L5 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="btn-text">Daha Fazla Yükle</span>
            <span class="scroll-indicator">(Daha fazla kaydır)</span>
        `;
        loadMoreBtn.addEventListener('click', loadMoreImages);
        
        // Results section'ın sonuna ekle
        resultsSection.appendChild(loadMoreBtn);
    }
    
    // Bilgilendirme metnini güncelle
    const scrollIndicator = loadMoreBtn.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.textContent = `(+${currentScrollCount} kez kaydırma)`;
    }
    
    // Butonu göster (eğer selectedMovieId varsa)
    if (selectedMovieId) {
        loadMoreBtn.style.display = 'flex';
    }
}

// Daha fazla görsel yükle
async function loadMoreImages() {
    if (isProcessing || !selectedMovieId || !currentMovieTitle) {
        console.log('Load more cancelled:', { isProcessing, selectedMovieId, currentMovieTitle });
        return;
    }
    
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) {
        console.error('Load more button not found');
        return;
    }
    
    isProcessing = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.classList.add('loading');
    
    // Buton metnini değiştir
    const btnText = loadMoreBtn.querySelector('.btn-text');
    const originalText = btnText ? btnText.textContent : 'Daha Fazla Yükle';
    
    if (btnText) {
        btnText.textContent = 'Yükleniyor...';
    }
    
    // Her tıklamada kaydırma sayısını artır (daha fazla içerik yüklemek için)
    currentScrollCount += 1;
    console.log(`Loading more images with ${currentScrollCount} scrolls for ${currentMovieTitle} (${selectedMovieId})`);
    
    // Seçilen boyut filtresini al
    const selectedSize = sizeFilter.value;
    
    try {
        const response = await fetch('/api/load-more-images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                movieId: selectedMovieId,
                movieTitle: currentMovieTitle,
                scrollCount: currentScrollCount,
                sizeFilter: selectedSize
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error('Daha fazla görsel yüklenemedi');
        }

        const result = await response.json();
        console.log('Load more result:', result);
        
        if (result.totalImages > 0) {
            // Yeni görselleri mevcut listeye ekle (filtrele)
            const beforeCount = downloadedImages.length;
            loadDownloadedImages(result.images, true);
            const afterCount = downloadedImages.length;
            const newCount = afterCount - beforeCount;
            
            if (newCount > 0) {
                showNotification(`✨ ${newCount} adet yeni görsel eklendi!`, 'success');
                // Butonu güncelle
                updateLoadMoreButton();
            } else {
                showNotification('ℹ️ Tüm görseller zaten yüklü, yeni görsel bulunamadı', 'info');
            }
        } else {
            showNotification('ℹ️ Daha fazla görsel bulunamadı', 'info');
        }

    } catch (error) {
        console.error('Load more error:', error);
        showNotification('❌ Daha fazla görsel yüklenirken hata oluştu', 'error');
        currentScrollCount -= 1; // Geri al
    } finally {
        isProcessing = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.classList.remove('loading');
        
        if (btnText) {
            btnText.textContent = originalText;
        }
    }
}

// Create image card element
function createImageCard(image, index) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.style.animationDelay = `${index * 0.05}s`;
    
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'image-wrapper';
    
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.name;
    img.loading = 'lazy';
    img.crossOrigin = 'anonymous';
    
    // Add error handler
    img.onerror = () => {
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%231a1a1a" width="400" height="300"/%3E%3Ctext fill="%23707070" font-family="Arial" font-size="18" x="50%25" y="50%25" text-anchor="middle"%3EGörsel yüklenemedi%3C/text%3E%3C/svg%3E';
    };
    
    // Download button overlay
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3V16M12 16L16 12M12 16L8 12M3 21H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>İndir</span>
    `;
    downloadBtn.onclick = (e) => {
        e.stopPropagation();
        downloadImage(image);
    };
    
    imageWrapper.appendChild(img);
    imageWrapper.appendChild(downloadBtn);
    
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
    
    const source = document.createElement('div');
    source.className = 'image-source';
    source.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2"/>
            <path d="M2 12H22" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>${image.domain}</span>
    `;
    
    meta.appendChild(dimension);
    meta.appendChild(source);
    info.appendChild(title);
    info.appendChild(meta);
    
    card.appendChild(imageWrapper);
    card.appendChild(info);
    
    // Add click handler to preview image
    card.addEventListener('click', () => {
        previewImage(image);
    });
    
    return card;
}

// Download image function
async function downloadImage(image) {
    try {
        
        const response = await fetch(image.url);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = image.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification(`"${image.name}" başarıyla indirildi!`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification(`❌ İndirme hatası: ${error.message}`, 'error');
    }
}

// Preview image in modal
function previewImage(image) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <button class="modal-close">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
            <img src="${image.url}" alt="${image.name}" crossorigin="anonymous">
            <div class="modal-info">
                <h3>${image.name}</h3>
                <p>${image.width}×${image.height} • ${image.domain}</p>
                <button class="modal-download-btn" onclick="downloadImage(${JSON.stringify(image).replace(/"/g, '&quot;')})">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3V16M12 16L16 12M12 16L8 12M3 21H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    İndir
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    const closeBtn = modal.querySelector('.modal-close');
    const modalContent = modal.querySelector('.modal-content');
    const modalImage = modalContent.querySelector('img');
    const modalInfo = modalContent.querySelector('.modal-info');
    
    const closeModal = () => {
        modal.classList.add('closing');
        setTimeout(() => modal.remove(), 300);
        document.removeEventListener('keydown', handleEsc);
    };
    
    // Close button handler
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeModal();
    };
    
    // Click on modal content (the wrapper) should close
    modalContent.onclick = (e) => {
        // Check if click was directly on modalContent (not on image or info)
        if (e.target === modalContent) {
            closeModal();
        }
    };
    
    // Prevent image clicks from closing
    if (modalImage) {
        modalImage.onclick = (e) => {
            e.stopPropagation();
        };
    }
    
    // Prevent info section clicks from closing
    if (modalInfo) {
        modalInfo.onclick = (e) => {
            e.stopPropagation();
        };
    }
    
    // ESC key to close
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', handleEsc);
    
    // Animate in
    setTimeout(() => modal.classList.add('active'), 10);
}

// Hide empty state
function hideEmptyState() {
    emptyState.classList.add('hidden');
}

// Show notification (can be enhanced with a toast library)
function showNotification(message, type = 'info') {
    // Simple console notification for now
    console.log(`[${type.toUpperCase()}]: ${message}`);
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
    
    // Initialize snow effect
    initSnowEffect();
});

// ==================== SNOW EFFECT CODE ====================

// Snow Effect Configuration
const snowConfig = {
    enabled: true,
    maxSnowflakes: 10, // ⬅️ KAR MİKTARINI BURADAN AYARLAYIN (örn: 20-30 daha az kar için)
    snowflakeChars: ['❄', '❅', '❆', '✻', '✼', '❉', '✺'],
    glowTypes: ['cyan-glow', 'teal-glow', 'white-soft', ''],
    minSize: 0.5,
    maxSize: 1.8,
    minDuration: 8,
    maxDuration: 20,
    minDrift: -100,
    maxDrift: 100
};

// Snow State
let snowState = {
    snowflakes: [],
    isActive: true
};

// Initialize Snow Effect
function initSnowEffect() {
    const snowContainer = document.getElementById('snowContainer');
    const snowToggle = document.getElementById('snowToggle');
    
    if (!snowContainer || !snowToggle) {
        console.warn('Snow effect elements not found');
        return;
    }
    
    // Load saved state from localStorage
    const savedState = localStorage.getItem('snowEffectEnabled');
    if (savedState !== null) {
        snowState.isActive = savedState === 'true';
    }
    
    // Set initial state
    updateSnowToggleButton();
    
    if (snowState.isActive) {
        startSnowEffect();
    }
    
    // Toggle button click handler
    snowToggle.addEventListener('click', () => {
        snowState.isActive = !snowState.isActive;
        localStorage.setItem('snowEffectEnabled', snowState.isActive);
        updateSnowToggleButton();
        
        if (snowState.isActive) {
            startSnowEffect();
            showNotification('❄️ Kar efekti açıldı', 'info');
        } else {
            stopSnowEffect();
            showNotification('☃️ Kar efekti kapatıldı', 'info');
        }
    });
}

// Update toggle button appearance
function updateSnowToggleButton() {
    const snowToggle = document.getElementById('snowToggle');
    if (snowState.isActive) {
        snowToggle.classList.add('active');
        snowToggle.setAttribute('aria-label', 'Kar efektini kapat');
    } else {
        snowToggle.classList.remove('active');
        snowToggle.setAttribute('aria-label', 'Kar efektini aç');
    }
}

// Start snow effect
function startSnowEffect() {
    createSnowflakes();
}

// Stop snow effect
function stopSnowEffect() {
    // Clear all snowflakes
    const snowContainer = document.getElementById('snowContainer');
    if (snowContainer) {
        snowContainer.innerHTML = '';
    }
    snowState.snowflakes = [];
}

// Create snowflakes
function createSnowflakes() {
    const snowContainer = document.getElementById('snowContainer');
    if (!snowContainer) return;
    
    // Create initial batch
    for (let i = 0; i < snowConfig.maxSnowflakes; i++) {
        setTimeout(() => {
            if (snowState.isActive) {
                createSnowflake();
            }
        }, i * 200); // Stagger creation
    }
}

// Create a single snowflake
function createSnowflake() {
    const snowContainer = document.getElementById('snowContainer');
    if (!snowContainer || !snowState.isActive) return;
    
    const snowflake = document.createElement('div');
    snowflake.className = 'snowflake';
    
    // Random properties
    const char = snowConfig.snowflakeChars[Math.floor(Math.random() * snowConfig.snowflakeChars.length)];
    const glowType = snowConfig.glowTypes[Math.floor(Math.random() * snowConfig.glowTypes.length)];
    const size = snowConfig.minSize + Math.random() * (snowConfig.maxSize - snowConfig.minSize);
    const duration = snowConfig.minDuration + Math.random() * (snowConfig.maxDuration - snowConfig.minDuration);
    const startPos = Math.random() * 100;
    const drift = snowConfig.minDrift + Math.random() * (snowConfig.maxDrift - snowConfig.minDrift);
    const swayDistance = 10 + Math.random() * 30;
    const sparkleDelay = Math.random() * 3;
    
    // Apply properties
    snowflake.textContent = char;
    snowflake.classList.add(glowType);
    snowflake.style.left = `${startPos}%`;
    snowflake.style.fontSize = `${size}rem`;
    snowflake.style.animationDuration = `${duration}s`;
    snowflake.style.setProperty('--drift', `${drift}px`);
    snowflake.style.setProperty('--sway-distance', `${swayDistance}px`);
    snowflake.style.setProperty('--sparkle-delay', `${sparkleDelay}s`);
    
    // Add to container
    snowContainer.appendChild(snowflake);
    snowState.snowflakes.push(snowflake);
    
    // Remove after animation completes and create new one
    setTimeout(() => {
        if (snowflake.parentNode) {
            snowflake.remove();
        }
        const index = snowState.snowflakes.indexOf(snowflake);
        if (index > -1) {
            snowState.snowflakes.splice(index, 1);
        }
        
        // Create a new snowflake to maintain count
        if (snowState.isActive) {
            createSnowflake();
        }
    }, duration * 1000);
}

// Utility: Check if user prefers reduced motion
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Disable snow effect if user prefers reduced motion
if (prefersReducedMotion()) {
    snowState.isActive = false;
    localStorage.setItem('snowEffectEnabled', 'false');
}

// ==================== END SNOW EFFECT CODE ====================
