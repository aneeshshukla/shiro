document.getElementById('spacer').style.height = document.getElementById('navbar').scrollHeight + "px";

const input = document.getElementById("anime-search");
const dropdown = document.getElementById("search-results");

let controller;

input.addEventListener("input", async () => {
const q = input.value.trim();
dropdown.innerHTML = "";
dropdown.style.display = "none";

if (q.length < 2) return;

if (controller) controller.abort();
controller = new AbortController();

try {
    const res = await fetch(
    `/api/search-suggestions/${encodeURIComponent(q)}`,
    { signal: controller.signal }
    );

    const data = await res.json();
    if (!data.results?.length) return;
    console.log(data.results?.length)
    dropdown.style.display = "block";

    data.results.forEach(anime => {
    const div = document.createElement("div");
    div.className = "search-item";

    div.innerHTML = `
        <img class="search-poster" src="${anime.image}">
        <div class="search-info">
        <div class="search-title">${anime.title}</div>
        <div class="search-meta">
            ${anime.sub ? `<span class="badge badge-cc">CC ${anime.sub}</span>` : ""}
            ${anime.episodes ? `<span class="badge badge-ep">${anime.episodes}</span>` : ""}
            ${anime.releaseDate ? `<span class="badge badge-year">${anime.releaseDate}</span>` : ""}
            ${anime.type ? `<span class="badge badge-type">${anime.type}</span>` : ""}
            <!--span class="badge badge-rating">R </span-->
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
    div.innerHTML = `
    <center><p>View all results -></p></center>
`;

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