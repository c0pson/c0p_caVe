/* ─── news.js ───────────────────────────────────────────────── */

const feedArea       = document.getElementById("feed-area");
const itemCount      = document.getElementById("item-count");
const refreshBtn     = document.getElementById("refresh-btn");
const toastEl        = document.getElementById("toast");
const sortDateBtn    = document.getElementById("sort-date-btn");
const sortChannelBtn = document.getElementById("sort-channel-btn");
const videoModal     = document.getElementById("video-modal");
const modalIframe    = document.getElementById("modal-iframe");
const modalClose     = document.getElementById("modal-close");
const modalBackdrop  = document.getElementById("modal-backdrop");

let toastTimer  = null;
let cachedFeed  = [];           // normalised objects, never mutated
let sortKey     = "date";       // "date" | "channel"
let dateAsc     = false;        // newest first by default
let channelAsc  = true;         // A→Z by default

/* ── toast ── */
function showToast(msg, duration = 2800) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

/* ── embed URL helper ── */
function toEmbedUrl(url) {
    try {
        const u = new URL(url);
        let id = u.searchParams.get("v");
        if (!id) id = u.pathname.split("/").filter(Boolean).pop();
        return id ? `https://www.youtube.com/embed/${id}?rel=0&autoplay=1` : null;
    } catch { return null; }
}

/* ── modal ── */
function openModal(url) {
    const embedUrl = toEmbedUrl(url);
    if (!embedUrl) { window.open(url, "_blank", "noopener"); return; }
    modalIframe.src = embedUrl;
    videoModal.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    videoModal.classList.remove("open");
    modalIframe.src = "";                  // stops playback immediately
    document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });


function relativeDate(raw) {
    try {
        const diff = Date.now() - new Date(raw).getTime();
        const d = Math.floor(diff / 86400000);
        if (d === 0) return "today";
        if (d === 1) return "yesterday";
        if (d < 7)   return `${d}d ago`;
        if (d < 30)  return `${Math.floor(d / 7)}w ago`;
        return new Date(raw).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return raw; }
}

/* ── sort ── */
function sortedFeed() {
    const copy = [...cachedFeed];
    if (sortKey === "date") {
        copy.sort((a, b) => {
            const diff = new Date(a.published) - new Date(b.published);
            return dateAsc ? diff : -diff;
        });
    } else {
        copy.sort((a, b) => {
            const diff = a.channel.localeCompare(b.channel);
            return channelAsc ? diff : -diff;
        });
    }
    return copy;
}

/* ── update sort button labels ── */
function updateSortButtons() {
    sortDateBtn.classList.toggle("active", sortKey === "date");
    sortChannelBtn.classList.toggle("active", sortKey === "channel");
    sortDateBtn.textContent    = `DATE ${sortKey === "date"    ? (dateAsc    ? "↑" : "↓") : ""}`.trim();
    sortChannelBtn.textContent = `CHANNEL ${sortKey === "channel" ? (channelAsc ? "↑" : "↓") : ""}`.trim();
}

/* ── build a single card ── */
function buildCard(item) {
    const { title, url, channel, published, thumbnail } = item;

    const a = document.createElement("a");
    a.className = "video-card";
    a.href = url;                          // fallback for middle-click / open in tab
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.addEventListener("click", e => {
        e.preventDefault();
        openModal(url);
    });

    const thumbDiv = document.createElement("div");
    thumbDiv.className = "video-thumb";

    const img = document.createElement("img");
    img.src = thumbnail.url;
    img.alt = title;
    img.loading = "lazy";
    img.width  = thumbnail.width  || 480;
    img.height = thumbnail.height || 270;

    const tag = document.createElement("span");
    tag.className = "video-channel-tag";
    tag.textContent = channel;

    thumbDiv.append(img, tag);

    const body = document.createElement("div");
    body.className = "video-body";

    const titleEl = document.createElement("span");
    titleEl.className = "video-title";
    titleEl.textContent = title;

    const meta = document.createElement("div");
    meta.className = "video-meta";

    const channelEl = document.createElement("span");
    channelEl.className = "video-channel";
    channelEl.textContent = channel;

    const dateEl = document.createElement("span");
    dateEl.className = "video-date";
    dateEl.textContent = relativeDate(published);

    meta.append(channelEl, dateEl);
    body.append(titleEl, meta);
    a.append(thumbDiv, body);
    return a;
}

/* ── render current sort into the grid ── */
function renderGrid() {
    feedArea.innerHTML = "";

    if (cachedFeed.length === 0) {
        feedArea.innerHTML = `<div class="state-msg"><span>NO VIDEOS FOUND</span></div>`;
        itemCount.textContent = "";
        return;
    }

    const grid = document.createElement("div");
    grid.className = "feed-grid";
    sortedFeed().forEach(item => grid.appendChild(buildCard(item)));
    feedArea.appendChild(grid);

    itemCount.textContent = `${cachedFeed.length} video${cachedFeed.length !== 1 ? "s" : ""}`;
    updateSortButtons();
}

/* ── fetch ── */
async function loadFeed(force = false) {
    refreshBtn.disabled = true;

    if (force) {
        feedArea.innerHTML = `<div class="state-msg"><div class="spinner"></div><span>LOADING...</span></div>`;
        itemCount.textContent = "";
    }

    try {
        const res = await fetch(`/api/youtube${force ? "?force=1" : ""}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { feed, updated } = await res.json();

        cachedFeed = (feed || []).map(raw => typeof raw === "string" ? JSON.parse(raw) : raw);
        renderGrid();
        if (updated || force) showToast("FEED REFRESHED");
    } catch (err) {
        feedArea.innerHTML = `<div class="state-msg"><span>ERROR: ${err.message}</span></div>`;
        itemCount.textContent = "";
        showToast(`ERROR: ${err.message}`, 4000);
    } finally {
        refreshBtn.disabled = false;
    }
}

/* ── sort button handlers ── */
sortDateBtn.addEventListener("click", () => {
    if (sortKey === "date") {
        dateAsc = !dateAsc;
    } else {
        sortKey = "date";
    }
    renderGrid();
});

sortChannelBtn.addEventListener("click", () => {
    if (sortKey === "channel") {
        channelAsc = !channelAsc;
    } else {
        sortKey = "channel";
    }
    renderGrid();
});

/* ── init ── */
refreshBtn.addEventListener("click", () => loadFeed(true));
updateSortButtons();
loadFeed();
