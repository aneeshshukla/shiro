// Store all schedule data, filter client-side by day
let allScheduleItems = [];

// HTML escape helper to prevent XSS
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().getDay(); // JS: 0=Sun
    const dayBtns = document.querySelectorAll('.day-btn');
    const now = new Date();
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    
    dayBtns.forEach(btn => {
        const dayIndex = parseInt(btn.dataset.day);
        if (dayIndex === today) {
            btn.classList.add('active');
            const dateEl = document.createElement('div');
            dateEl.className = 'day-date';
            dateEl.textContent = `${now.getDate()}${getOrdinalSuffix(now.getDate())} ${months[now.getMonth()]}`;
            btn.appendChild(dateEl);
        }
        
        btn.addEventListener('click', () => {
            dayBtns.forEach(b => {
                b.classList.remove('active');
                const d = b.querySelector('.day-date');
                if (d) d.remove();
            });
            btn.classList.add('active');
            const diff = dayIndex - today;
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + diff);
            const dateEl = document.createElement('div');
            dateEl.className = 'day-date';
            dateEl.textContent = `${targetDate.getDate()}${getOrdinalSuffix(targetDate.getDate())} ${months[targetDate.getMonth()]}`;
            btn.appendChild(dateEl);
            
            // Filter already-fetched data by selected day
            filterAndRender(dayIndex);
        });
    });
    
    // Initial fetch
    fetchSchedule(today);
    fetchRecentlyAired();
});

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'TH';
    switch (day % 10) {
        case 1: return 'ST';
        case 2: return 'ND';
        case 3: return 'RD';
        default: return 'TH';
    }
}

function filterAndRender(jsDayIndex) {
    // Filter items whose airingAt falls on the selected JS day (0=Sun...6=Sat)
    const filtered = allScheduleItems.filter(item => {
        if (!item.airingAt) return false;
        const d = new Date(item.airingAt * 1000);
        return d.getDay() === jsDayIndex;
    });
    
    const timeline = document.getElementById('schedule-timeline');
    if (filtered.length > 0) {
        renderTimeline(filtered);
    } else {
        timeline.innerHTML = '<p style="color:#555;text-align:center;padding:60px 0;font-size:0.95rem;">No scheduled anime for this day.</p>';
    }
}

async function fetchRecentlyAired() {
    try {
        const res = await fetch('/api/home/recent-episodes');
        if (!res.ok) return;
        const data = await res.json();
        const results = data.results || data;
        if (results && results.length > 0) {
            renderRecentlyAired(Array.isArray(results) ? results.slice(0, 8) : []);
        }
    } catch (e) {
        console.error('Error fetching recently aired:', e);
    }
}

async function fetchSchedule(todayJsDay) {
    const timeline = document.getElementById('schedule-timeline');
    
    // Skeleton
    timeline.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        timeline.innerHTML += `
            <div class="timeline-group">
                <div class="timeline-marker">
                    <span class="timeline-dot"></span>
                    <span class="timeline-chevron"><i class="fa-solid fa-chevron-right"></i></span>
                    <div class="skeleton" style="height:22px;width:60px;border-radius:4px;"></div>
                </div>
                <div class="timeline-cards">
                    <div class="schedule-card"><div class="skeleton" style="width:100%;height:70px;border-radius:8px;"></div></div>
                </div>
            </div>`;
    }
    
    try {
        const res = await fetch('/api/home/schedule');
        if (!res.ok) throw new Error(`Schedule API returned ${res.status}`);
        const data = await res.json();
        
        if (data && data.results) {
            allScheduleItems = data.results;
        } else if (Array.isArray(data)) {
            allScheduleItems = data;
        } else {
            allScheduleItems = [];
        }
        
        // Filter for today
        filterAndRender(todayJsDay);
    } catch (e) {
        console.error('Error fetching schedule:', e);
        timeline.innerHTML = '<p style="color:#555;text-align:center;padding:60px 0;">Failed to load schedule.</p>';
    }
}

function renderRecentlyAired(animes) {
    const container = document.getElementById('recently-aired');
    let html = '';
    animes.forEach(anime => {
        const title = typeof anime.title === 'object'
            ? (anime.title.userPreferred || anime.title.romaji || anime.title.english || 'Unknown')
            : (anime.title || 'Unknown');
        const safeTitle = escapeHtml(title);
        const ep = escapeHtml(anime.episode || anime.episodes || anime.sub || '?');
        const banner = anime.cover || anime.banner || anime.image;
        const poster = anime.image;
        const id = encodeURIComponent(anime.id || '');
        
        html += `
        <a href="/anime/${id}" class="recent-card">
            <img src="${banner}" alt="" class="recent-card-bg" loading="lazy">
            <div class="recent-card-content">
                <img src="${poster}" alt="${safeTitle}" class="recent-poster" loading="lazy">
                <div class="recent-info">
                    <div class="recent-title">${safeTitle}</div>
                    <div class="recent-ep">EP ${ep}</div>
                </div>
            </div>
        </a>`;
    });
    container.innerHTML = html;
}

function renderTimeline(items) {
    const timeline = document.getElementById('schedule-timeline');
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    
    // Group by hour using airingAt timestamp
    const groups = {};
    items.forEach(item => {
        if (!item.airingAt) return;
        const d = new Date(item.airingAt * 1000);
        const h = String(d.getHours()).padStart(2, '0');
        const hour = `${h}:00`;
        item._time = `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
        item._h = d.getHours();
        item._m = d.getMinutes();
        if (!groups[hour]) groups[hour] = [];
        groups[hour].push(item);
    });
    
    const sortedHours = Object.keys(groups).sort();
    let html = '';
    
    sortedHours.forEach(hour => {
        const hourNum = parseInt(hour);
        const isLive = hourNum === currentHour;
        
        html += `
        <div class="timeline-group">
            <div class="timeline-marker">
                <span class="timeline-dot ${isLive ? 'live' : ''}"></span>
                <span class="timeline-chevron"><i class="fa-solid fa-chevron-right"></i></span>
                <span class="timeline-time">${hour}</span>
            </div>
            <div class="timeline-cards">`;
        
        groups[hour].forEach(item => {
            const title = typeof item.title === 'object'
                ? (item.title.userPreferred || item.title.romaji || item.title.english || 'Unknown')
                : (item.title || 'Unknown');
            const safeTitle = escapeHtml(title);
            const ep = escapeHtml(item.episode || '?');
            const poster = item.image || '';
            const cover = item.cover || item.image || '';
            const id = encodeURIComponent(item.id || '');
            const time = item._time || hour;
            
            const aH = item._h ?? 0;
            const aM = item._m ?? 0;
            let status = 'aired';
            let statusText = 'AIRED';
            if (aH > currentHour || (aH === currentHour && aM > currentMin)) {
                status = 'airing';
                statusText = 'AIRING';
            }
            
            html += `
            <a href="/anime/${id}" class="schedule-card">
                ${cover ? `<img src="${cover}" alt="" class="schedule-card-bg" loading="lazy">` : '<div class="schedule-card-bg" style="background:#111;"></div>'}
                <div class="schedule-card-content">
                    ${poster ? `<img src="${poster}" alt="${title}" class="schedule-poster" loading="lazy">` : ''}
                    <div class="schedule-info">
                        <div class="schedule-title">${title}</div>
                        <div class="schedule-ep">EP ${ep}</div>
                    </div>
                    <div class="schedule-time-badge">
                        <div class="schedule-airing-time">${time}</div>
                        <div class="schedule-status ${status}">${statusText}</div>
                    </div>
                </div>
            </a>`;
        });
        
        html += `</div></div>`;
    });
    
    timeline.innerHTML = html;
}
