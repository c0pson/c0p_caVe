/* ============================================================
   news.js — news feed · source filter · sort · views
   ============================================================ */

const feedArea      = document.getElementById("feed-area");
const itemCount     = document.getElementById("item-count");
const refreshBtn    = document.getElementById("refresh-btn");
const toastEl       = document.getElementById("toast");
const sortDateBtn   = document.getElementById("sort-date-btn");
const sortSourceBtn = document.getElementById("sort-source-btn");
const listBtn       = document.getElementById("list-btn");
const gridBtn       = document.getElementById("grid-btn");
const sourceBar     = document.getElementById("source-bar");

let toastTimer   = null;
let cachedFeed   = [];
let sortKey      = "date";
let dateAsc      = false;
let sourceAsc    = true;
let activeSource = "";
let currentView  = "grid";

/* ── toast ── */
function showToast(msg, duration = 2800) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

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

/* ── strip HTML from descriptions ── */
function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

/* ── escape HTML ── */
function esc(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* ── get filtered items ── */
function filteredFeed() {
    if (!activeSource) return cachedFeed;
    return cachedFeed.filter(item => item.channel === activeSource);
}

/* ── sort ── */
function sortedFeed() {
    const copy = [...filteredFeed()];
    if (sortKey === "date") {
        copy.sort((a, b) => {
            const diff = new Date(a.published) - new Date(b.published);
            return dateAsc ? diff : -diff;
        });
    } else {
        copy.sort((a, b) => {
            const diff = (a.channel || "").localeCompare(b.channel || "");
            return sourceAsc ? diff : -diff;
        });
    }
    return copy;
}

/* ── update sort buttons ── */
function updateSortButtons() {
    sortDateBtn.classList.toggle("active", sortKey === "date");
    sortSourceBtn.classList.toggle("active", sortKey === "source");
    sortDateBtn.textContent    = `DATE ${sortKey === "date"   ? (dateAsc   ? "↑" : "↓") : ""}`.trim();
    sortSourceBtn.textContent  = `SOURCE ${sortKey === "source" ? (sourceAsc ? "↑" : "↓") : ""}`.trim();
}

/* ── extract unique sources ── */
function getSources() {
    const sources = new Set();
    cachedFeed.forEach(item => {
        if (item.channel) sources.add(item.channel);
    });
    return [...sources].sort();
}

/* ── render source filter bar ── */
function renderSourceBar() {
    sourceBar.innerHTML = "";
    const allPill = document.createElement("button");
    allPill.className = "source-pill" + (!activeSource ? " active" : "");
    allPill.textContent = "ALL";
    allPill.onclick = () => setSourceFilter("");
    sourceBar.appendChild(allPill);

    getSources().forEach(source => {
        const pill = document.createElement("button");
        pill.className = "source-pill" + (source === activeSource ? " active" : "");
        pill.textContent = source.toUpperCase();
        pill.onclick = () => setSourceFilter(source);
        sourceBar.appendChild(pill);
    });
}

function setSourceFilter(source) {
    activeSource = activeSource === source ? "" : source;
    renderSourceBar();
    render();
}

/* ── build grid card ── */
function buildGridCard(item) {
    const a = document.createElement("a");
    a.className = "news-card";
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const thumbDiv = document.createElement("div");
    thumbDiv.className = "news-thumb";

    if (item.thumbnail) {
        const img = document.createElement("img");
        img.src = item.thumbnail;
        img.alt = item.title;
        img.loading = "lazy";
        img.onerror = function() {
            this.style.display = "none";
            const ph = document.createElement("div");
            ph.className = "news-thumb-placeholder";
            ph.textContent = "▪";
            this.parentNode.appendChild(ph);
        };
        thumbDiv.appendChild(img);
    } else {
        const ph = document.createElement("div");
        ph.className = "news-thumb-placeholder";
        ph.textContent = "▪";
        thumbDiv.appendChild(ph);
    }

    const tag = document.createElement("span");
    tag.className = "news-source-tag";
    tag.textContent = item.channel || "—";
    thumbDiv.appendChild(tag);

    const body = document.createElement("div");
    body.className = "news-body";

    const titleEl = document.createElement("span");
    titleEl.className = "news-title";
    titleEl.textContent = item.title;

    const descEl = document.createElement("span");
    descEl.className = "news-desc";
    descEl.textContent = stripHtml(item.description || "");

    const meta = document.createElement("div");
    meta.className = "news-meta";

    const channelEl = document.createElement("span");
    channelEl.className = "news-channel";
    channelEl.textContent = item.channel || "";

    const dateEl = document.createElement("span");
    dateEl.className = "news-date";
    dateEl.textContent = relativeDate(item.published);

    meta.append(channelEl, dateEl);
    body.append(titleEl, descEl, meta);
    a.append(thumbDiv, body);
    return a;
}

/* ── build list row ── */
function buildListRow(item) {
    const a = document.createElement("a");
    a.className = "news-list-item";
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    if (item.thumbnail) {
        const img = document.createElement("img");
        img.className = "news-list-thumb";
        img.src = item.thumbnail;
        img.alt = item.title;
        img.loading = "lazy";
        img.onerror = function() { this.style.visibility = "hidden"; };
        a.appendChild(img);
    } else {
        const ph = document.createElement("div");
        ph.className = "news-list-thumb";
        ph.style.display = "flex";
        ph.style.alignItems = "center";
        ph.style.justifyContent = "center";
        ph.style.color = "var(--text-muted)";
        ph.textContent = "▪";
        a.appendChild(ph);
    }

    const body = document.createElement("div");
    body.className = "news-list-body";

    const titleEl = document.createElement("div");
    titleEl.className = "news-list-title";
    titleEl.textContent = item.title;

    const sourceEl = document.createElement("div");
    sourceEl.className = "news-list-source";
    sourceEl.textContent = item.channel || "";

    body.append(titleEl, sourceEl);

    const dateEl = document.createElement("span");
    dateEl.className = "news-list-date";
    dateEl.textContent = relativeDate(item.published);

    a.append(body, dateEl);
    return a;
}

/* ── render ── */
function render() {
    feedArea.innerHTML = "";
    const items = sortedFeed();

    if (items.length === 0) {
        feedArea.innerHTML = `<div class="state-msg"><span>NO ARTICLES FOUND</span></div>`;
        itemCount.textContent = "";
        return;
    }

    if (currentView === "grid") {
        const grid = document.createElement("div");
        grid.className = "news-grid";
        items.forEach(item => grid.appendChild(buildGridCard(item)));
        feedArea.appendChild(grid);
    } else {
        const list = document.createElement("div");
        list.className = "news-list";
        items.forEach(item => list.appendChild(buildListRow(item)));
        feedArea.appendChild(list);
    }

    const total = filteredFeed().length;
    itemCount.textContent = `${total} article${total !== 1 ? "s" : ""}`;
    updateSortButtons();
}

/* ── view toggle ── */
function setView(v) {
    currentView = v;
    listBtn.classList.toggle("active", v === "list");
    gridBtn.classList.toggle("active", v === "grid");
    render();
}

/* ── fetch feed ── */
async function loadFeed(force = false) {
    refreshBtn.disabled = true;

    if (force || cachedFeed.length === 0) {
        feedArea.innerHTML = `<div class="state-msg"><div class="spinner"></div><span>LOADING...</span></div>`;
        itemCount.textContent = "";
    }

    try {
        const res = await fetch(`/api/news${force ? "?force=1" : ""}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { feed, updated } = await res.json();

        cachedFeed = (feed || []).map(raw => {
            const item = typeof raw === "string" ? JSON.parse(raw) : raw;
            // normalize: the feed uses "cannel" (typo) for channel
            if (!item.channel && item.cannel) item.channel = item.cannel;
            return item;
        });

        renderSourceBar();
        render();
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
    if (sortKey === "date") { dateAsc = !dateAsc; } else { sortKey = "date"; }
    render();
});

sortSourceBtn.addEventListener("click", () => {
    if (sortKey === "source") { sourceAsc = !sourceAsc; } else { sortKey = "source"; }
    render();
});

/* ── init ── */
refreshBtn.addEventListener("click", () => loadFeed(true));
listBtn.addEventListener("click", () => setView("list"));
gridBtn.addEventListener("click", () => setView("grid"));
updateSortButtons();
loadFeed();
