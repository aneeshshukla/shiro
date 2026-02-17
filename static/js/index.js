document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch for all sections
    fetchHero();
    fetchRecentUpdates();
    fetchTripleList('new-releases', 'new-releases');
    fetchTripleList('upcoming', 'upcoming');
    fetchTripleList('completed', 'completed');
    fetchTrending();
    fetchSchedule();
});

/* --- Data Fetching & Rendering --- */

async function fetchHero() {
    try {
        const response = await fetch('/api/home/spotlight');
        const data = await response.json();
        const results = data.results || data; // Handle pagination or list
        if (results && results.length > 0) {
            renderHero(results);
            initSlider(); // Re-init slider after DOM update
        }
    } catch (error) {
        console.error('Error fetching spotlight:', error);
    }
}

async function fetchRecentUpdates() {
    try {
        const response = await fetch('/api/home/recent-episodes');
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderGrid(results.slice(0, 12), 'recent-updates');
        }
    } catch (error) {
        console.error('Error fetching recent updates:', error);
    }
}

async function fetchTripleList(endpointKey, containerId) {
    try {
        const response = await fetch(`/api/home/${endpointKey}`);
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderVerticalList(results.slice(0, 6), containerId);
        }
    } catch (error) {
        console.error(`Error fetching ${endpointKey}:`, error);
    }
}

async function fetchTrending() {
    try {
        // Reusing new-releases for trending as per original template logic
        const response = await fetch('/api/home/new-releases');
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderTrending(results.slice(0, 9), 'top-trending');
        }
    } catch (error) {
        console.error('Error fetching trending:', error);
    }
}

async function fetchSchedule() {
    try {
        const response = await fetch('/api/home/schedule');
        const data = await response.json();
        const results = data.results || data;
        if (results) {
            renderSchedule(results.slice(0, 9), 'schedule-list');
        }
    } catch (error) {
        console.error('Error fetching schedule:', error);
    }
}

/* --- Render Helpers --- */

function renderHero(animes) {
    const slider = document.getElementById('hero-slider');
    let html = '';
    
    animes.forEach((anime, index) => {
        const activeClass = index === 0 ? 'active' : '';
        const banner = anime.banner || anime.image;
        const sub = anime.sub || '?';
        const dub = (anime.dub && anime.dub !== 0) ? `<span class="meta-badge dub"><i class="fa-solid fa-microphone"></i> ${anime.dub}</span>` : '';
        const type = anime.type || 'TV';
        const date = anime.releaseDate || '';
        
        html += `
        <div class="hero-slide ${activeClass}" data-index="${index}">
            <div class="poster-wrapper hero-skeleton skeleton">
                <img src="${banner}" alt="${anime.title}" class="hero-background" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="hero-gradient"></div>
            <div class="hero-content">
                <h1 class="hero-title">${anime.title}</h1>
                <div class="hero-meta">
                    <span class="meta-badge quality">HD</span>
                    <span class="meta-badge sub"><i class="fa-solid fa-closed-captioning"></i> ${sub}</span>
                    ${dub}
                    <span style="color: #fff; font-weight: 600;">${type}</span>
                    <span style="color: #ccc;">${date}</span>
                </div>
                <p class="hero-description">${anime.description || ''}</p>
                <div class="hero-buttons">
                    <a href="/watch/${anime.id}" class="hero-btn hero-btn-primary">WATCH NOW</a>
                    <a href="/anime/${anime.id}" class="hero-btn hero-btn-secondary"><i class="fa-solid fa-info"></i></a>
                </div>
            </div>
        </div>
        
        <!-- Controls inside loop? Original template had it. Better to keep consistent structure -->
        <div class="slide-controls ${activeClass}" data-index="${index}" style="position: absolute; bottom: 50px; right: 50px; color: white; font-weight: 700; z-index: 10;">
            <i onclick="prevSlide()" class="fa-solid fa-chevron-left" style="margin-right: 15px; cursor: pointer;"></i>
            ${index + 1} / ${animes.length}
            <i onclick="nextSlide()" class="fa-solid fa-chevron-right" style="margin-left: 15px; cursor: pointer;"></i>
        </div>
        `;
    });
    
    slider.innerHTML = html;
}

function renderGrid(animes, containerId) {
    const container = document.getElementById(containerId);
    let html = '';
    
    animes.forEach(anime => {
        const sub = anime.sub || '?';
        const dub = (anime.dub && anime.dub !== 0) ? `<span class="badge-sm badge-mic"><i class="fa-solid fa-microphone"></i> ${anime.dub}</span>` : '';
        const mov = anime.type === 'Movie' ? '<span class="badge-sm badge-mic">MOV</span>' : '';
        
        html += `
        <a href="/watch/${anime.id}" class="anime-card-link" style="text-decoration: none;">
            <div class="anime-card">
                <div class="poster-wrapper skeleton">
                    <img src="${anime.image}" alt="${anime.title}" loading="lazy" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
                </div>
                <div class="card-badges">
                    <span class="badge-sm badge-cc">CC ${sub}</span>
                    ${dub}
                    ${mov}
                </div>
                <div class="play-icon"><i class="fa-solid fa-play"></i></div>
            </div>
            <div class="anime-card-info">
                <div class="card-title">${anime.title}</div>
                <div class="card-meta">${anime.type || 'TV'}</div>
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
        const sub = anime.sub || '?';
        const dub = (anime.dub && anime.dub !== 0) ? `<span class="badge-outline"><i class="fa-solid fa-microphone"></i> ${anime.dub}</span>` : '';
        const metaTag = containerId === 'upcoming' ? '<span class="badge-outline">Preview</span>' : `<span class="badge-outline">CC ${sub}</span> ${dub}`;
        
        html += `
        <a href="/anime/${anime.id}" class="v-item">
            <div class="poster-wrapper skeleton" style="width: 50px; height: 70px; padding-top: 0; flex-shrink: 0;">
                <img src="${anime.image}" alt="${anime.title}" loading="lazy" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="v-info">
                <h4 class="v-title">${anime.title}</h4>
                <div class="v-meta">
                    ${metaTag}
                    <span class="v-type">${anime.type || 'TV'}</span>
                </div>
            </div>
        </a>
        `;
    });
    container.innerHTML = html;
}

function renderTrending(animes, containerId) {
    const container = document.getElementById(containerId);
    let html = '';
    
    animes.forEach((anime, index) => {
        const sub = anime.sub || '?';
        const dub = (anime.dub && anime.dub !== 0) ? `<span class="badge-sm badge-mic"><i class="fa-solid fa-microphone"></i> ${anime.dub}</span>` : '';
        
        html += `
        <a href="/anime/${anime.id}" class="release-item" style="align-items: center; background: transparent; padding: 10px 0; border-bottom: 1px solid #222;">
            <div style="font-size: 1.2rem; font-weight: 700; color: #444; width: 30px; text-align: center;">${index + 1}</div>
            <div class="poster-wrapper skeleton" style="width: 50px; height: 70px; margin: 0 15px; padding-top: 0; flex-shrink: 0;">
                <img src="${anime.image}" alt="${anime.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="release-info">
                <div class="release-title" style="font-size: 0.9rem; margin-bottom: 5px;">${anime.title}</div>
                <div class="release-meta" style="font-size: 0.8rem;">
                    <span class="badge-sm badge-cc">CC ${sub}</span>
                    ${dub}
                    <span style="color: #666; margin-left: 5px;">${anime.type || 'TV'}</span>
                </div>
            </div>
        </a>
        `;
    });
    container.innerHTML = html;
}

function renderSchedule(items, containerId) {
    const container = document.getElementById(containerId);
    let html = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No schedule data available.</p>';
        return;
    }
    
    items.forEach(item => {
        html += `
        <div class="sched-item">
            <div class="sched-time">${item.airingTime}</div>
            <div class="sched-info">
                <div class="sched-title">${item.title}</div>
                <div class="sched-ep">EP ${item.airingEpisode}</div>
            </div>
        </div>
        `;
    });
    container.innerHTML = html;
}

/* --- Slider Logic (Restored) --- */

let currentSlide = 0;
let slideInterval;
const intervalTime = 6000;

function initSlider() {
    // Clear any existing interval
    if (slideInterval) clearInterval(slideInterval);
    
    const slides = document.querySelectorAll('.hero-slide');
    const controls = document.querySelectorAll('.slide-controls');
    const totalSlides = slides.length;
    
    if (totalSlides === 0) return;

    // Reset state
    currentSlide = 0;
    
    // Auto Advance
    slideInterval = setInterval(() => nextSlide(), intervalTime);

    // Pause on hover
    const heroSection = document.getElementById('hero-section');
    if (heroSection) {
        heroSection.addEventListener('mouseenter', () => clearInterval(slideInterval));
        heroSection.addEventListener('mouseleave', () => slideInterval = setInterval(() => nextSlide(), intervalTime));
    }
}

function showSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const controls = document.querySelectorAll('.slide-controls');
    
    slides.forEach(slide => slide.classList.remove('active'));
    controls.forEach(control => control.classList.remove('active'));

    if (slides[index]) slides[index].classList.add('active');
    if (controls[index]) controls[index].classList.add('active');
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