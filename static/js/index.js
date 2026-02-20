document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch for all sections
    fetchHero();
    fetchRecentUpdates();
    fetchTabbedGrid('top-airing');
    fetchTrending();
    fetchUpcomingSidebar();
    initFilterTabs();
});
/* --- Data Fetching & Rendering --- */

/* Genre tab scroll */
window.scrollGenres = function(amount) {
    const tabs = document.getElementById('genre-tabs');
    if (tabs) tabs.scrollBy({ left: amount, behavior: 'smooth' });
};

// HTML escape helper to prevent XSS
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

async function fetchAniZipData(anilistId) {
    try {
        const response = await fetch(`https://api.ani.zip/mappings?anilist_id=${anilistId}`);
        if (!response.ok) return { fanart: null, clearlogo: null };
        const data = await response.json();
        const images = data.images || [];
        let fanart = null;
        let clearlogo = null;
        for (const img of images) {
            if (img.coverType === 'Fanart') fanart = img.url;
            if (img.coverType === 'Clearlogo') clearlogo = img.url;
        }
        return { fanart, clearlogo };
    } catch (error) {
        console.error('Error fetching ani.zip data for', anilistId, error);
        return { fanart: null, clearlogo: null };
    }
}

async function fetchHero() {
    try {
        const response = await fetch('/api/home/spotlight');
        if (!response.ok) throw new Error(`Spotlight API returned ${response.status}`);
        const data = await response.json();
        const results = data.results || data;
        if (results && results.length > 0) {
            // Fetch ani.zip data for each spotlight anime in parallel
            const aniZipPromises = results.map(anime => {
                const anilistId = anime.id || anime.anilistId;
                return fetchAniZipData(anilistId);
            });
            const aniZipResults = await Promise.all(aniZipPromises);
            // Attach fanart and clearlogo to each anime object
            results.forEach((anime, i) => {
                anime._fanart = aniZipResults[i].fanart;
                anime._clearlogo = aniZipResults[i].clearlogo;
            });
            renderHero(results);
            initSlider();
        }
    } catch (error) {
        console.error('Error fetching spotlight:', error);
    }
}

async function fetchRecentUpdates() {
    try {
        const response = await fetch('/api/home/recent-episodes');
        if (!response.ok) throw new Error(`Recent episodes API returned ${response.status}`);
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderGrid(results.slice(0, 12), 'recent-updates');
        }
    } catch (error) {
        console.error('Error fetching recent updates:', error);
    }
}

/* --- Tabbed Grid (Top Airing / Most Popular / Favourites) --- */
const tabbedCache = {};

const tabEndpoints = {
    'top-airing': '/api/home/spotlight',
    'most-popular': '/api/home/new-releases',
    'favourites': '/api/home/favourites'
};

async function fetchTabbedGrid(tab) {
    const container = document.getElementById('tabbed-grid');
    if (!container) return;
    
    // Use cache if available
    if (tabbedCache[tab]) {
        renderGrid(tabbedCache[tab], 'tabbed-grid');
        return;
    }
    
    try {
        const response = await fetch(tabEndpoints[tab]);
        if (!response.ok) throw new Error(`${tab} API returned ${response.status}`);
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            tabbedCache[tab] = results.slice(0, 10);
            renderGrid(tabbedCache[tab], 'tabbed-grid');
        }
    } catch (error) {
        console.error(`Error fetching ${tab}:`, error);
    }
}

function initFilterTabs() {
    document.querySelectorAll('.filter-tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab[data-tab]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            fetchTabbedGrid(tab.dataset.tab);
        });
    });
}

async function fetchTrending() {
    try {
        const response = await fetch('/api/home/new-releases');
        if (!response.ok) throw new Error(`Trending API returned ${response.status}`);
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderSidebarList(results.slice(0, 6), 'top-trending');
        }
    } catch (error) {
        console.error('Error fetching trending:', error);
    }
}

async function fetchUpcomingSidebar() {
    try {
        const response = await fetch('/api/home/upcoming');
        if (!response.ok) throw new Error(`Upcoming API returned ${response.status}`);
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderSidebarList(results.slice(0, 6), 'top-upcoming-sidebar');
        }
    } catch (error) {
        console.error('Error fetching upcoming sidebar:', error);
    }
}

/* --- Render Helpers --- */

function renderHero(animes) {
    const slider = document.getElementById('hero-slider');
    let html = '';
    
    animes.forEach((anime, index) => {
        const activeClass = index === 0 ? 'active' : '';
        // Use Fanart from ani.zip as background, fallback to cover/image
        const banner = anime._fanart || anime.cover || anime.image;
        const title = typeof anime.title === 'object'
            ? (anime.title.english || anime.title.userPreferred || anime.title.romaji || 'Unknown')
            : (anime.title || 'Unknown');
        const safeTitle = escapeHtml(title);
        const type = escapeHtml(anime.type || 'TV');
        const releaseDate = escapeHtml(anime.releaseDate || '');
        const status = escapeHtml(anime.status || 'RELEASING');
        const episodes = anime.totalEpisodes || anime.episodes || '';
        const duration = anime.duration ? `${anime.duration}m` : '';
        const rating = anime.rating ? (anime.rating / 10).toFixed(1) : '';
        const season = escapeHtml(anime.season || '');
        
        // Clean description (strip HTML tags)
        let desc = anime.description || '';
        desc = desc.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\n/g, ' ');
        if (desc.length > 200) desc = desc.substring(0, 200) + '...';
        desc = escapeHtml(desc);
        
        // Episode badge info
        const epNum = anime.currentEpisode || anime.episodeNumber || '';
        const safeId = encodeURIComponent(anime.id);

        // Build title markup: Clearlogo image + subtitle, or fallback to text
        const titleMarkup = anime._clearlogo
            ? `<img src="${anime._clearlogo}" alt="${safeTitle}" class="hero-clearlogo"><p class="hero-subtitle">${safeTitle}</p>`
            : `<h1 class="hero-title">${safeTitle}</h1>`;
        
        html += `
        <div class="hero-slide ${activeClass}" data-index="${index}">
            <div class="poster-wrapper hero-skeleton skeleton">
                <img src="${banner}" alt="${safeTitle}" class="hero-background" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="hero-gradient"></div>
            ${epNum ? `
            <div class="hero-ep-badge">
                <span class="ep-dot"></span>
                EP ${escapeHtml(String(epNum))}
            </div>
            ` : ''}
            <div class="hero-content">
                <div class="hero-text">
                    <div class="hero-meta-top">
                        <span>${type}</span>
                        ${season || releaseDate ? `<span class="dot"></span><span><i class="fa-regular fa-calendar meta-icon"></i> ${season ? season + ' ' : ''}${releaseDate}</span>` : ''}
                        <span class="dot"></span>
                        <span>${status}</span>
                        ${episodes ? `<span class="dot"></span><span>${episodes} Episodes</span>` : ''}
                        ${duration ? `<span class="dot"></span><span>${duration}</span>` : ''}
                    </div>
                    ${titleMarkup}
                    <p class="hero-description">${desc}</p>
                </div>
                <div class="hero-buttons">
                    <a href="/watch/${safeId}" class="hero-btn hero-btn-primary"><i class="fa-solid fa-play"></i> Watch Now</a>
                    <a href="/anime/${safeId}" class="hero-btn hero-btn-secondary"><i class="fa-solid fa-circle-info"></i> Details</a>
                </div>
            </div>
        </div>`;
    });
    
    // Slide controls (rendered once, outside individual slides)
    html += `
    <div class="slide-controls">
        <i class="slide-arrow fa-solid fa-chevron-left" onclick="prevSlide()"></i>
        <div class="slide-counter"><span>1</span> / ${animes.length}</div>
        <i class="slide-arrow fa-solid fa-chevron-right" onclick="nextSlide()"></i>
    </div>`;
    
    slider.innerHTML = html;
}

/* --- Title Helper --- */
function getTitle(anime) {
    if (!anime.title) return 'Unknown';
    if (typeof anime.title === 'object') {
        return escapeHtml(anime.title.english || anime.title.userPreferred || anime.title.romaji || 'Unknown');
    }
    return escapeHtml(anime.title);
}

function renderGrid(animes, containerId) {
    const container = document.getElementById(containerId);
    let html = '';
    
    animes.forEach(anime => {
        const title = getTitle(anime);
        const sub = escapeHtml(String(anime.totalEpisodes || anime.sub || '?'));
        const dub = (anime.dub && anime.dub !== 0) ? `<span class="badge-sm badge-mic"><i class="fa-solid fa-microphone"></i> ${escapeHtml(String(anime.dub))}</span>` : '';
        const type = escapeHtml(anime.type || 'TV');
        const year = escapeHtml(anime.releaseDate || '');
        const safeId = encodeURIComponent(anime.id);
        
        html += `
        <a href="/anime/${safeId}" class="anime-card-link">
            <div class="anime-card">
                <div class="poster-wrapper skeleton">
                    <img src="${anime.image}" alt="${title}" loading="lazy" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
                </div>
                <div class="card-badges">
                    <span class="badge-sm badge-cc"><i class="fa-solid fa-closed-captioning"></i> ${sub}</span>
                    ${dub}
                </div>
                <div class="play-icon"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="anime-card-info">
                <div class="card-title">${title}</div>
                <div class="card-meta"><span>${type}</span>${year ? `<span>•</span><span>${year}</span>` : ''}</div>
            </div>
        </a>
        `;
    });
    container.innerHTML = html;
}

function renderVerticalList(animes, containerId) {
    const container = document.getElementById(containerId);
    let html = '';
    
    animes.forEach(anime => {
        const title = getTitle(anime);
        const type = escapeHtml(anime.type || 'TV');
        const year = escapeHtml(anime.releaseDate || '');
        const episodes = anime.totalEpisodes || anime.episodes || '';
        const safeId = encodeURIComponent(anime.id);
        
        html += `
        <a href="/anime/${safeId}" class="v-item">
            <div class="poster-wrapper skeleton" style="width: 50px; height: 70px; padding-top: 0; flex-shrink: 0;">
                <img src="${anime.image}" alt="${title}" loading="lazy" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="v-info">
                <h4 class="v-title">${title}</h4>
                <div class="v-meta">
                    <span class="v-type">${type}</span>
                    ${year ? `<span>•</span><span>${year}</span>` : ''}
                    ${episodes ? `<span>•</span><span>${episodes} Eps</span>` : ''}
                </div>
            </div>
        </a>
        `;
    });
    container.innerHTML = html;
}

function renderSidebarList(animes, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let html = '';
    
    animes.forEach(anime => {
        const title = getTitle(anime);
        const type = escapeHtml(anime.type || 'TV');
        const year = escapeHtml(anime.releaseDate || '');
        const episodes = anime.totalEpisodes || anime.episodes || '';
        const safeId = encodeURIComponent(anime.id);
        
        html += `
        <a href="/anime/${safeId}" class="release-item">
            <div class="poster-wrapper skeleton" style="width: 45px; height: 60px; padding-top: 0; flex-shrink: 0; border-radius: 4px;">
                <img src="${anime.image}" alt="${title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="release-info">
                <div class="release-title">${title}</div>
                <div class="release-meta">
                    <span>${year}</span>
                    <span>•</span>
                    <span>${type}</span>
                    ${episodes ? `<span>•</span><span>${episodes} Eps</span>` : ''}
                </div>
            </div>
        </a>
        `;
    });
    container.innerHTML = html;
}

/* --- Slider Logic --- */

let currentSlide = 0;
let slideInterval;
const intervalTime = 6000;

function initSlider() {
    if (slideInterval) clearInterval(slideInterval);
    
    const slides = document.querySelectorAll('.hero-slide');
    const totalSlides = slides.length;
    
    if (totalSlides === 0) return;

    currentSlide = 0;
    slideInterval = setInterval(() => nextSlide(), intervalTime);

    const heroSection = document.getElementById('hero-section');
    if (heroSection) {
        heroSection.addEventListener('mouseenter', () => clearInterval(slideInterval));
        heroSection.addEventListener('mouseleave', () => slideInterval = setInterval(() => nextSlide(), intervalTime));
    }
}

function showSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    
    slides.forEach(slide => slide.classList.remove('active'));
    if (slides[index]) slides[index].classList.add('active');
    
    // Update slide counter
    const counter = document.querySelector('.slide-counter span');
    if (counter) counter.textContent = index + 1;
}

window.nextSlide = function() {
    const slides = document.querySelectorAll('.hero-slide');
    const totalSlides = slides.length;
    if (totalSlides === 0) return;
    
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide(currentSlide);
}

window.prevSlide = function() {
    const slides = document.querySelectorAll('.hero-slide');
    const totalSlides = slides.length;
    if (totalSlides === 0) return;
    
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    showSlide(currentSlide);
}