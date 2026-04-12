/* ============================================================
   library.js — bookmark library frontend logic
   ============================================================ */

let allBookmarks = [];
let activeTag    = "";
let searchQuery  = "";
let lastAddedId  = null;

// ── fetch ───────────────────────────────────────────────────

async function loadBookmarks() {
    try {
        const res = await fetch("/api/library", { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allBookmarks = await res.json();
        console.log(allBookmarks);
    } catch (err) {
        console.error("Library fetch error:", err);
        document.getElementById("lib-list").innerHTML =
            `<div class="lib-empty">[ FETCH ERROR ]</div>`;
    }
}

async function loadTags() {
    try {
        const res = await fetch("/api/library/tags", { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const tags = await res.json();
        renderTagBar(tags);
        console.log(tags);
    } catch (err) {
        console.error("Tags fetch error:", err);
    }
}

// ── render ──────────────────────────────────────────────────

function renderTagBar(tags) {
    const bar = document.getElementById("lib-tag-bar");
    const allPill = bar.querySelector('[data-tag=""]');
    bar.innerHTML = "";
    bar.appendChild(allPill);
    tags.forEach(tag => {
        const pill = document.createElement("button");
        pill.className = "lib-tag-pill" + (tag === activeTag ? " active" : "");
        pill.dataset.tag = tag;
        pill.textContent = tag.toUpperCase();
        pill.onclick = () => setTagFilter(tag);
        bar.appendChild(pill);
    });
}

function renderList() {
    requestAnimationFrame(() => {
        const list = document.getElementById("lib-list");
        let items = allBookmarks;

        if (activeTag) {
            items = items.filter(b => b.tag === activeTag);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            items = items.filter(b =>
                b.shortname.toLowerCase().includes(q) ||
                b.url.toLowerCase().includes(q) ||
                (b.description || "").toLowerCase().includes(q) ||
                (b.tag || "").toLowerCase().includes(q)
            );
        }

        if (items.length === 0) {
            list.innerHTML = `<div class="lib-empty">[ NO BOOKMARKS FOUND ]</div>`;
            lastAddedId = null;
            return;
        }

        list.innerHTML = items.map((b, i) => `
            <div class="lib-entry ${b.id === lastAddedId ? "lib-entry--new" : ""}" data-id="${b.id}">
                <span class="lib-idx">${String(i + 1).padStart(2, "0")}</span>

                <span class="lib-name" title="${esc(b.shortname)}">${esc(b.shortname)}</span>

                <div class="lib-url-cell">
                    <a class="lib-url" href="${esc(b.url)}" target="_blank" rel="noopener"
                       title="${esc(b.url)}">${esc(b.url)}</a>
                    ${b.description
                        ? `<span class="lib-notes" title="${esc(b.description)}">${esc(b.description)}</span>`
                        : ""}
                </div>

                <span class="lib-tag ${b.tag ? "" : "empty"}"
                      data-tag="${esc(b.tag || "")}"
                      title="${esc(b.tag || "—")}">
                    ${b.tag ? esc(b.tag.toUpperCase()) : "—"}
                </span>

                <span class="lib-date">${formatDate(b.created_at)}</span>

                <div class="lib-actions">
                    <button class="lib-btn lib-btn-open" data-url="${esc(b.url)}">OPEN</button>
                    <button class="lib-btn lib-btn-del"  data-id="${b.id}">DELETE</button>
                </div>
            </div>
        `).join("");

        lastAddedId = null;
    });
}

// ── add ─────────────────────────────────────────────────────

function toggleAddForm() {
    const form = document.getElementById("lib-add-form");
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) {
        document.getElementById("f-url").focus();
    }
}

async function submitBookmark() {
    const url  = document.getElementById("f-url").value.trim();
    const name = document.getElementById("f-shortname").value.trim();

    if (!url || !name) {
        showFormMsg("URL AND SHORTNAME REQUIRED", "err");
        return;
    }

    const payload = {
        url,
        shortname:   name,
        tag:         document.getElementById("f-tag").value.trim(),
        description: document.getElementById("f-description").value.trim(),
    };

    try {
        const res = await fetch("/api/library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created = await res.json();
        lastAddedId = created.id;
        allBookmarks.unshift(created);
        clearForm();
        toggleAddForm();
        await loadTags();
        renderList();
    } catch (err) {
        console.error("Add bookmark error:", err);
        showFormMsg("SAVE FAILED", "err");
    }
}

function clearForm() {
    ["f-url", "f-shortname", "f-tag", "f-description"]
        .forEach(id => { document.getElementById(id).value = ""; });
}

function showFormMsg(text, type) {
    const el = document.getElementById("lib-form-msg");
    el.textContent = text;
    el.className = `lib-form-msg ${type}`;
    setTimeout(() => { el.textContent = ""; el.className = "lib-form-msg"; }, 3000);
}

// ── delete ───────────────────────────────────────────────────

async function deleteBookmark(id) {
    try {
        const res = await fetch(`/api/library/${id}`, {
            method: "DELETE",
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allBookmarks = allBookmarks.filter(b => b.id !== id);
        await loadTags();
        renderList();
    } catch (err) {
        console.error("Delete error:", err);
    }
}

// ── event delegation ─────────────────────────────────────────

document.getElementById("lib-list").addEventListener("click", e => {
    const openBtn = e.target.closest(".lib-btn-open");
    const delBtn  = e.target.closest(".lib-btn-del");
    const tagEl   = e.target.closest(".lib-tag:not(.empty)");

    if (openBtn) window.open(openBtn.dataset.url, "_blank");
    if (delBtn)  deleteBookmark(Number(delBtn.dataset.id));
    if (tagEl)   setTagFilter(tagEl.dataset.tag);
});

// ── filters ──────────────────────────────────────────────────

function setTagFilter(tag) {
    activeTag = activeTag === tag ? "" : tag;
    document.querySelectorAll(".lib-tag-pill").forEach(pill => {
        pill.classList.toggle("active", pill.dataset.tag === activeTag);
    });
    renderList();
}

document.getElementById("lib-search").addEventListener("input", e => {
    searchQuery = e.target.value.trim();
    renderList();
});

document.getElementById("lib-search").addEventListener("keydown", e => {
    if (e.key === "Escape") {
        e.target.value = "";
        searchQuery = "";
        renderList();
    }
});

// ── enter to submit form ─────────────────────────────────────

document.addEventListener("keydown", e => {
    const form = document.getElementById("lib-add-form");
    if (e.key === "Enter" && !form.classList.contains("hidden")) {
        submitBookmark();
    }
});

// ── utils ────────────────────────────────────────────────────

function esc(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(iso) {
    if (!iso) return "—";
    return String(iso).slice(0, 10);
}

// ── init ─────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([loadTags(), loadBookmarks()]);
    setTagFilter("");
});
