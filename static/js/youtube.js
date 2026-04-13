/* ─── youtube.js ────────────────────────────────────────────── */

const feedArea       = document.getElementById("feed-area");
const itemCount      = document.getElementById("item-count");
const refreshBtn     = document.getElementById("refresh-btn");
const toastEl        = document.getElementById("toast");
const sortDateBtn    = document.getElementById("sort-date-btn");
const sortChannelBtn = document.getElementById("sort-channel-btn");
const sortControls   = document.getElementById("sort-controls");
const historyBtn     = document.getElementById("history-btn");
const watchedCount   = document.getElementById("watched-count");
const videoModal     = document.getElementById("video-modal");
const modalIframe    = document.getElementById("modal-iframe");
const modalClose     = document.getElementById("modal-close");
const modalBackdrop  = document.getElementById("modal-backdrop");

let toastTimer   = null;
let cachedFeed   = [];           // normalized objects, never mutated
let watchedUrls  = new Set();    // set of watched video_url strings
let watchedItems = [];           // full watched rows from DB (for history view)
let sortKey      = "date";       // "date" | "channel"
let dateAsc      = false;        // newest first by default
let channelAsc   = true;         // A→Z by default
let viewMode     = "feed";       // "feed" | "history"

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
    modalIframe.src = "";
    document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ── date helpers ── */
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

/* ── update watched count badge ── */
function updateWatchedBadge() {
    watchedCount.textContent = watchedUrls.size > 0 ? `[${watchedUrls.size}]` : "";
}

/* ── watched API ── */
async function loadWatched() {
    try {
        const res = await fetch("/api/youtube/watched");
        if (!res.ok) return;
        watchedItems = await res.json();
        watchedUrls  = new Set(watchedItems.map(v => v.video_url));
        updateWatchedBadge();
    } catch { /* non-fatal */ }
}

async function markWatched(item) {
    try {
        const res = await fetch("/api/youtube/watched", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                video_url:     item.url,
                title:         item.title,
                channel:       item.channel,
                thumbnail_url: item.thumbnail.url,
                published:     item.published
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const row = await res.json();
        watchedUrls.add(item.url);
        // keep watchedItems in sync
        watchedItems = watchedItems.filter(v => v.video_url !== item.url);
        watchedItems.unshift(row);
        updateWatchedBadge();
    } catch (err) {
        showToast(`ERROR: ${err.message}`, 4000);
    }
}

async function unmarkWatched(videoUrl) {
    try {
        const res = await fetch("/api/youtube/watched", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_url: videoUrl })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        watchedUrls.delete(videoUrl);
        watchedItems = watchedItems.filter(v => v.video_url !== videoUrl);
        updateWatchedBadge();
    } catch (err) {
        showToast(`ERROR: ${err.message}`, 4000);
    }
}

/* ── tick button ── */
function buildTickBtn(url, isWatched, onToggle) {
    const btn = document.createElement("button");
    btn.className = "video-tick" + (isWatched ? " video-tick--watched" : "");
    btn.title = isWatched ? "Remove from watched" : "Mark as watched";
    btn.textContent = "✓";
    btn.addEventListener("click", async e => {
        e.preventDefault();
        e.stopPropagation();
        await onToggle();
        const nowWatched = watchedUrls.has(url);
        btn.classList.toggle("video-tick--watched", nowWatched);
        btn.title = nowWatched ? "Remove from watched" : "Mark as watched";
        // if in history view, remove card on unwatch
        if (viewMode === "history" && !nowWatched) {
            const card = btn.closest(".video-card");
            if (card) card.remove();
            const grid = feedArea.querySelector(".feed-grid");
            if (grid && grid.children.length === 0) {
                feedArea.innerHTML = `<div class="state-msg"><span>NO WATCHED VIDEOS</span></div>`;
                itemCount.textContent = "";
            } else if (grid) {
                itemCount.textContent = `${grid.children.length} video${grid.children.length !== 1 ? "s" : ""}`;
            }
        }
    });
    return btn;
}

/* ── build a single card ── */
function buildCard(item, opts = {}) {
    const { url, title, channel, published, thumbnail } = item;
    const { dateLabel, isWatched, onTickToggle } = opts;

    const a = document.createElement("a");
    a.className = "video-card" + (isWatched ? " video-card--watched" : "");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.addEventListener("click", e => {
        e.preventDefault();
        openModal(url);
    });

    const thumbDiv = document.createElement("div");
    thumbDiv.className = "video-thumb";

    const img = document.createElement("img");
    img.src = thumbnail.url || thumbnail;
    img.alt = title;
    img.loading = "lazy";
    img.width  = thumbnail.width  || 480;
    img.height = thumbnail.height || 270;

    const tag = document.createElement("span");
    tag.className = "video-channel-tag";
    tag.textContent = channel;

    const tick = buildTickBtn(url, isWatched, onTickToggle);

    thumbDiv.append(img, tag, tick);

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
    dateEl.textContent = dateLabel || relativeDate(published);

    meta.append(channelEl, dateEl);
    body.append(titleEl, meta);
    a.append(thumbDiv, body);
    return a;
}

/* ── render feed grid ── */
function renderGrid() {
    feedArea.innerHTML = "";

    if (cachedFeed.length === 0) {
        feedArea.innerHTML = `<div class="state-msg"><span>NO VIDEOS FOUND</span></div>`;
        itemCount.textContent = "";
        return;
    }

    const grid = document.createElement("div");
    grid.className = "feed-grid";
    sortedFeed().forEach(item => {
        const isWatched = watchedUrls.has(item.url);
        grid.appendChild(buildCard(item, {
            isWatched,
            onTickToggle: async () => {
                if (isWatched) {
                    await unmarkWatched(item.url);
                } else {
                    await markWatched(item);
                }
                // re-render card's tick state without full re-render
            }
        }));
    });
    feedArea.appendChild(grid);

    itemCount.textContent = `${cachedFeed.length} video${cachedFeed.length !== 1 ? "s" : ""}`;
    updateSortButtons();
}

/* ── render history grid ── */
function renderHistory() {
    feedArea.innerHTML = "";

    if (watchedItems.length === 0) {
        feedArea.innerHTML = `<div class="state-msg"><span>NO WATCHED VIDEOS</span></div>`;
        itemCount.textContent = "";
        return;
    }

    const grid = document.createElement("div");
    grid.className = "feed-grid";

    watchedItems.forEach(row => {
        const item = {
            url:       row.video_url,
            title:     row.title,
            channel:   row.channel,
            published: row.published,
            thumbnail: { url: row.thumbnail_url, width: 480, height: 270 }
        };
        grid.appendChild(buildCard(item, {
            dateLabel: `watched ${relativeDate(row.watched_at)}`,
            isWatched: true,
            onTickToggle: async () => {
                await unmarkWatched(row.video_url);
            }
        }));
    });

    feedArea.appendChild(grid);
    itemCount.textContent = `${watchedItems.length} video${watchedItems.length !== 1 ? "s" : ""}`;
}

/* ── view mode toggle ── */
function setViewMode(mode) {
    viewMode = mode;
    const inHistory = mode === "history";

    historyBtn.classList.toggle("active", inHistory);
    sortControls.style.display = inHistory ? "none" : "";
    refreshBtn.disabled = inHistory;

    if (inHistory) {
        renderHistory();
    } else {
        renderGrid();
    }
}

historyBtn.addEventListener("click", () => {
    setViewMode(viewMode === "history" ? "feed" : "history");
});

/* ── fetch feed ── */
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
        if (viewMode === "feed") renderGrid();
        if (updated || force) showToast("FEED REFRESHED");
    } catch (err) {
        if (viewMode === "feed") {
            feedArea.innerHTML = `<div class="state-msg"><span>ERROR: ${err.message}</span></div>`;
            itemCount.textContent = "";
        }
        showToast(`ERROR: ${err.message}`, 4000);
    } finally {
        refreshBtn.disabled = viewMode === "history";
    }
}

/* ── sort button handlers ── */
sortDateBtn.addEventListener("click", () => {
    if (sortKey === "date") { dateAsc = !dateAsc; } else { sortKey = "date"; }
    renderGrid();
});

sortChannelBtn.addEventListener("click", () => {
    if (sortKey === "channel") { channelAsc = !channelAsc; } else { sortKey = "channel"; }
    renderGrid();
});

/* ── init ── */
refreshBtn.addEventListener("click", () => loadFeed(true));
updateSortButtons();
loadWatched().then(() => loadFeed());
