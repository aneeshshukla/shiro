const input = document.getElementById("anime-search");
const dropdown = document.getElementById("search-results");
const mobileBtn = document.getElementById("mobile-menu-btn");
const navLinks = document.getElementById("nav-links");

if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        // Toggle icon if desired, or assume 'bars' is sufficient
    });
}


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

input.addEventListener("input", async () => {
    const q = input.value.trim();
    dropdown.innerHTML = "";
    dropdown.style.display = "none";

    if (q.length < 2) return;

    if (controller) controller.abort();
    controller = new AbortController();

    // Show skeletons immediately
    showSearchSkeletons();

    try {
        const res = await fetch(
            `/api/search-suggestions/${encodeURIComponent(q)}`,
            { signal: controller.signal }
        );

        const data = await res.json();
        dropdown.innerHTML = "";

        if (!data.results?.length) {
            dropdown.style.display = "none";
            return;
        }

        dropdown.style.display = "block";

        data.results.forEach(anime => {
            const div = document.createElement("div");
            div.className = "search-item";

            div.innerHTML = `
                <div class="poster-wrapper skeleton" style="width: 60px; height: 60px; padding-top: 0; flex-shrink: 0; border-radius: 6px;">
                    <img class="search-poster" src="${anime.image}" loading="lazy"
                         onload="this.parentElement.classList.add('loaded'); this.parentElement.classList.remove('skeleton');">
                </div>
                <div class="search-info">
                    <div class="search-title">${anime.title}</div>
                    <div class="search-meta">
                        ${anime.sub ? `<span class="badge badge-cc">CC ${anime.sub}</span>` : ""}
                        ${anime.episodes ? `<span class="badge badge-ep">${anime.episodes}</span>` : ""}
                        ${anime.releaseDate ? `<span class="badge badge-year">${anime.releaseDate}</span>` : ""}
                        ${anime.type ? `<span class="badge badge-type">${anime.type}</span>` : ""}
                    </div>
                </div>
            `;

            div.onclick = () => {
                window.location.href = `/anime/${anime.id}`;
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

document.addEventListener("click", e => {
if (!e.target.closest(".search-wrapper")) {
    dropdown.style.display = "none";
}
});