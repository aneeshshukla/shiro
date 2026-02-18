const input = document.getElementById("anime-search");
const dropdown = document.getElementById("search-results");
const mobileBtn = document.getElementById("mobile-menu-btn");
const sidebarNav = document.getElementById("sidebar-nav");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const topbar = document.getElementById("topbar");

// HTML escape helper to prevent XSS
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Mobile sidebar toggle
if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
        sidebarNav.classList.toggle('open');
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebarNav.classList.remove('open');
    });
}

// Topbar scroll effect
if (topbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            topbar.classList.add('scrolled');
        } else {
            topbar.classList.remove('scrolled');
        }
    });
}

// Search autocomplete
let controller;

function showSearchSkeletons() {
    dropdown.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const div = document.createElement("div");
        div.className = "search-item";
        div.innerHTML = `
            <div class="skeleton" style="width: 60px; height: 60px; border-radius: 6px; flex-shrink: 0;"></div>
            <div class="search-info" style="flex: 1;">
                <div class="skeleton" style="height: 15px; width: 70%; margin-bottom: 8px; border-radius: 4px;"></div>
                <div style="display: flex; gap: 6px;">
                    <div class="skeleton" style="height: 20px; width: 50px; border-radius: 6px;"></div>
                    <div class="skeleton" style="height: 20px; width: 40px; border-radius: 6px;"></div>
                    <div class="skeleton" style="height: 20px; width: 45px; border-radius: 6px;"></div>
                </div>
            </div>
        `;
        dropdown.appendChild(div);
    }
    dropdown.style.display = "block";
}

if (input) {
input.addEventListener("input", async () => {
    const q = input.value.trim();
    dropdown.innerHTML = "";
    dropdown.style.display = "none";

    if (q.length < 2) return;

    if (controller) controller.abort();
    controller = new AbortController();

    showSearchSkeletons();

    try {
        const res = await fetch(
            `/api/suggestions?q=${encodeURIComponent(q)}`,
            { signal: controller.signal }
        );

        const data = await res.json();
        dropdown.innerHTML = "";

        if (!Array.isArray(data) || !data.length) {
            dropdown.style.display = "none";
            return;
        }

        dropdown.style.display = "block";

        data.forEach(anime => {
            const div = document.createElement("div");
            div.className = "search-item";

            const safeTitle = escapeHtml(anime.title);
            const safeImage = escapeHtml(anime.image);
            const safeId = escapeHtml(anime.id);

            div.innerHTML = `
                <div class="poster-wrapper skeleton" style="width: 60px; height: 60px; padding-top: 0; flex-shrink: 0; border-radius: 6px;">
                    <img class="search-poster" src="${safeImage}" loading="lazy"
                         onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton');">
                </div>
                <div class="search-info">
                    <div class="search-title">${safeTitle}</div>
                    <div class="search-meta">
                        ${anime.sub ? `<span class="badge badge-cc">CC ${escapeHtml(String(anime.sub))}</span>` : ""}
                        ${anime.episodes ? `<span class="badge badge-ep">${escapeHtml(String(anime.episodes))}</span>` : ""}
                        ${anime.releaseDate ? `<span class="badge badge-year">${escapeHtml(String(anime.releaseDate))}</span>` : ""}
                        ${anime.type ? `<span class="badge badge-type">${escapeHtml(String(anime.type))}</span>` : ""}
                    </div>
                </div>
            `;

            div.onclick = () => {
                window.location.href = `/anime/${safeId}`;
            };

            dropdown.appendChild(div);
        });

        const div = document.createElement("div");
        div.className = "search-item";
        div.innerHTML = `<center><p>View all results -></p></center>`;
        div.onclick = () => {
            window.location.href = `/search?q=${encodeURIComponent(q)}`;
        };
        dropdown.appendChild(div);

    } catch (e) {
        if (e.name !== "AbortError") console.error(e);
    }
});
}


document.addEventListener("click", e => {
    if (dropdown && !e.target.closest(".search-wrapper")) {
        dropdown.style.display = "none";
    }
});

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-nav');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
    
    // Mobile overlay logic
    const overlay = document.getElementById('sidebar-overlay');
    
    if (window.innerWidth <= 850 && sidebar) {
        sidebar.classList.toggle('active');
        if (overlay) {
            overlay.classList.toggle('active');
            // Ensure overlay closes sidebar on click
            overlay.onclick = () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            };
        }
    }
}