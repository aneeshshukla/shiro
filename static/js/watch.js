/**
 * Watch Page Controller
 * Handles dynamic server/category updates without full page reloads.
 */
class WatchController {
    constructor(config) {
        this.animeId = config.animeId;
        this.episode = config.episode;
        this.server = config.server || 'hd-1';
        this.type = config.type || 'sub';
        this.streamServers = config.streamServers; // The full JSON object from JS API
        
        this.iframe = document.getElementById('player-iframe');
        this.loader = document.getElementById('video-loader');
        
        // Custom Dropdown Elements
        this.dropdown = document.getElementById('server-dropdown');
        this.optionsContainer = document.getElementById('server-options');
        this.currentServerName = document.getElementById('current-server-name');
        
        this.init();
    }

    init() {
        console.log(`[WatchController] Initialized for Anime: ${this.animeId}, Ep: ${this.episode}`);
        this.populateServerDropdown();
        this.bindEvents();
    }

    bindEvents() {
        // Handle control buttons (Focus, etc.)
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', () => btn.classList.toggle('active'));
        });

        // Episode search filter
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                document.querySelectorAll('.ep-item').forEach(item => {
                    const text = item.textContent.toLowerCase();
                    item.style.display = text.includes(term) ? 'flex' : 'none';
                });
            });
        }

        // Prev/Next Navigation
        document.querySelector('.nav-btn.prev')?.addEventListener('click', () => this.navigateEpisode(-1));
        document.querySelector('.nav-btn.next')?.addEventListener('click', () => this.navigateEpisode(1));

        // Custom Dropdown Toggle
        this.dropdown?.querySelector('.select-trigger')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dropdown.classList.toggle('active');
        });

        // Click outside to close dropdown
        document.addEventListener('click', () => {
            this.dropdown?.classList.remove('active');
        });
    }

    navigateEpisode(direction) {
        const episodes = Array.from(document.querySelectorAll('.ep-item'));
        const currentIndex = episodes.findIndex(el => el.getAttribute('data-number') == this.episode);
        const targetIndex = currentIndex + direction;

        if (targetIndex >= 0 && targetIndex < episodes.length) {
            const targetEp = episodes[targetIndex].getAttribute('data-number');
            this.updateSettings({ episode: targetEp });
        }
    }

    /**
     * Updates the player settings and fetches a new stream link
     * @param {Object} newConfig - { server?, type?, episode? }
     */
    async updateSettings(newConfig) {
        let needsFetch = false;

        if (newConfig.type && newConfig.type !== this.type) {
            this.type = newConfig.type;
            const available = this.getServersForType(this.type);
            if (available.length > 0) {
                const sameServer = available.find(s => s.name === this.server.toUpperCase());
                this.server = sameServer ? sameServer.name.toLowerCase() : available[0].name.toLowerCase();
            }
            needsFetch = true;
        }

        if (newConfig.server && newConfig.server !== this.server) {
            this.server = newConfig.server;
            needsFetch = true;
        }

        if (newConfig.episode && newConfig.episode !== this.episode) {
            this.episode = newConfig.episode;
            needsFetch = true;
        }

        if (!needsFetch) return;

        console.log(`[WatchController] Updating to: Ep ${this.episode}, Type ${this.type}, Server ${this.server}`);
        
        this.showLoader();
        this.updateURL();

        try {
            const url = `/api/watch/${this.animeId}?ep=${this.episode}&server=${this.server}&dub=${this.type === 'dub'}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.ok && data.streams && data.streams.sources.length > 0) {
                this.iframe.src = data.streams.sources[0].url;
                if (data.stream_servers) {
                    this.streamServers = data.stream_servers;
                }
                this.updateUI();
            } else {
                console.error("[WatchController] Failed to fetch stream link");
                this.showError();
            }
        } catch (err) {
            console.error("[WatchController] Error updating stream:", err);
            this.showError();
        }
    }

    getServersForType(type) {
        if (!this.streamServers || !this.streamServers.data) return [];
        return this.streamServers.data[type] || [];
    }

    populateServerDropdown() {
        if (!this.optionsContainer) return;
        
        const available = this.getServersForType(this.type);
        this.optionsContainer.innerHTML = '';
        
        available.forEach(s => {
            const serverId = s.name.toLowerCase();
            const option = document.createElement('div');
            option.className = `select-option ${serverId === this.server ? 'active' : ''}`;
            option.textContent = s.name;
            option.onclick = (e) => {
                e.stopPropagation();
                this.updateSettings({ server: serverId });
                this.dropdown.classList.remove('active');
            };
            this.optionsContainer.appendChild(option);

            if (serverId === this.server && this.currentServerName) {
                this.currentServerName.textContent = s.name;
            }
        });

        // Fallback if current server not found in new list
        if (!available.find(s => s.name.toLowerCase() === this.server) && available.length > 0) {
           this.updateSettings({ server: available[0].name.toLowerCase() });
        }
    }

    updateUI() {
        // Populate dropdown with correct servers for current type
        this.populateServerDropdown();

        // Update SUB/DUB Buttons
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            const btnType = btn.getAttribute('data-type');
            if (btnType) {
                btn.classList.toggle('active', btnType === this.type);
            }
        });

        // Update Sidebar Episodes
        document.querySelectorAll('.ep-item').forEach(item => {
            const epNum = item.getAttribute('data-number');
            const isActive = epNum == this.episode;
            item.classList.toggle('active', isActive);
            
            // Manage now-playing-icon
            let icon = item.querySelector('.now-playing-icon');
            if (isActive && !icon) {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'now-playing-icon';
                iconDiv.innerHTML = '<i class="fa-solid fa-play"></i>';
                item.appendChild(iconDiv);
            } else if (!isActive && icon) {
                icon.remove();
            }
        });

        // Update headers
        const epHeader = document.querySelector('.watch-info p:not(.description)');
        if (epHeader) epHeader.textContent = `Episode ${this.episode}`;
        
        const activeBreadcrumb = document.querySelector('.breadcrumb .active');
        if (activeBreadcrumb) activeBreadcrumb.textContent = `Episode ${this.episode}`;

        // Update document title
        const animeTitle = document.querySelector('h1')?.textContent || 'Anime';
        document.title = `Watch ${animeTitle} - Episode ${this.episode}`;
    }

    updateURL() {
        const url = new URL(window.location);
        url.searchParams.set('ep', this.episode);
        url.searchParams.set('server', this.server);
        url.searchParams.set('dub', this.type === 'dub' ? 'true' : 'false');
        window.history.pushState({}, '', url);
    }

    showLoader() {
        if (this.loader) this.loader.classList.remove('hidden');
    }

    hideLoader() {
        if (this.loader) this.loader.classList.add('hidden');
    }

    showError() {
        this.hideLoader();
        // Optionally update UI to show error message overlay
    }
}

// Global instance
let watchCtrl;

function initWatchPage() {
    const el = document.getElementById('watch-data');
    if (!el) return;
    
    const config = {
        animeId: el.dataset.animeId,
        episode: el.dataset.episode,
        server: el.dataset.server,
        type: el.dataset.type,
        streamServers: JSON.parse(el.dataset.streamServers || '{}')
    };
    
    watchCtrl = new WatchController(config);
}

function changeSetting(config) {
    if (watchCtrl) {
        watchCtrl.updateSettings(config);
    }
}
