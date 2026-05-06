/* ============================================================
   notes.js — keep-style notes with bullets, images
   ============================================================ */

/* ── state ── */
let allNotes    = [];
let currentView = "grid";
let activeColor = "";
let searchQuery = "";
let editingNote = null;   // note object being edited
let pendingImages = [];   // { file, dataUrl } for new uploads
let removedImageIds = []; // image IDs to delete on save

/* ── DOM refs ── */
const notesArea     = document.getElementById("notes-area");
const pinnedGrid    = document.getElementById("pinned-grid");
const pinnedLabel   = document.getElementById("pinned-label");
const othersLabel   = document.getElementById("others-label");
const itemCount     = document.getElementById("item-count");
const searchInput   = document.getElementById("search-input");
const colorFilter   = document.getElementById("color-filter");
const modal         = document.getElementById("note-modal");
const modalContent  = document.getElementById("modal-content");
const modalTitle    = document.getElementById("modal-title");
const modalBody     = document.getElementById("modal-body");
const modalImages   = document.getElementById("modal-images");
const gridBtn       = document.getElementById("grid-btn");
const listBtn       = document.getElementById("list-btn");

/* ── helpers ── */
function esc(s) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return (s || "").replace(/[&<>"']/g, m => map[m]);
}

function relDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + (iso.includes("Z") || iso.includes("+") ? "" : "Z"));
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString();
}

function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || "";
}

/* ── toast ── */
let _toastTimer;
function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ══════════════════════════════════════════════════════════
   API CALLS
   ══════════════════════════════════════════════════════════ */

async function loadNotes() {
    try {
        const res = await fetch("/api/notes");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allNotes = await res.json();
        render();
    } catch (err) {
        notesArea.innerHTML = `<div class="state-msg"><span>ERROR: ${err.message}</span></div>`;
    }
}

async function saveNote() {
    const title   = modalTitle.value.trim();
    const content = modalBody.innerHTML;
    const color   = modalContent.dataset.color || "default";
    const pinned  = document.getElementById("tool-pin").classList.contains("active") ? 1 : 0;

    if (!title && !stripHtml(content) && pendingImages.length === 0) {
        // empty note — if editing, delete it
        if (editingNote) await deleteNote(editingNote.id, true);
        return;
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("content", content);
    fd.append("color", color);
    fd.append("pinned", pinned);

    // attach new images
    pendingImages.forEach(pi => fd.append("images", pi.file));

    // removed images
    if (removedImageIds.length) {
        fd.append("removed_images", JSON.stringify(removedImageIds));
    }

    try {
        let res;
        if (editingNote) {
            res = await fetch(`/api/notes/${editingNote.id}`, { method: "PUT", body: fd });
        } else {
            res = await fetch("/api/notes", { method: "POST", body: fd });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadNotes();
    } catch (err) {
        showToast("✗ SAVE FAILED: " + err.message);
    }
}

async function deleteNote(id, silent = false) {
    try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!silent) showToast("✓ NOTE DELETED");
        await loadNotes();
    } catch (err) {
        showToast("✗ DELETE FAILED");
    }
}

/* ══════════════════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════════════════ */

function filteredNotes() {
    return allNotes.filter(n => {
        if (activeColor && n.color !== activeColor) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const inTitle   = (n.title || "").toLowerCase().includes(q);
            const inContent = stripHtml(n.content || "").toLowerCase().includes(q);
            if (!inTitle && !inContent) return false;
        }
        return true;
    });
}

function buildCard(note) {
    const div = document.createElement("div");
    div.className = "note-card";
    div.dataset.color = note.color || "default";
    div.onclick = () => openEditor(note);

    let html = "";

    // images
    if (note.images && note.images.length) {
        html += `<div class="note-card__images">`;
        html += `<img src="/api/notes/image/${note.images[0].id}" alt="" loading="lazy">`;
        html += `</div>`;
    }

    // pin icon
    if (note.pinned) {
        html += `<span class="note-card__pin">📌</span>`;
    }

    html += `<div class="note-card__body">`;
    if (note.title) {
        html += `<div class="note-card__title">${esc(note.title)}</div>`;
    }
    if (note.content) {
        html += `<div class="note-card__text">${note.content}</div>`;
    }
    html += `</div>`;
    html += `<div class="note-card__meta">${relDate(note.updated_at || note.created_at)}</div>`;

    div.innerHTML = html;
    return div;
}

function render() {
    const notes  = filteredNotes();
    const pinned = notes.filter(n => n.pinned);
    const others = notes.filter(n => !n.pinned);

    // pinned section
    pinnedGrid.innerHTML = "";
    if (pinned.length) {
        pinnedLabel.style.display = "";
        pinnedGrid.className = currentView === "grid" ? "notes-grid" : "notes-grid notes-list";
        pinned.forEach(n => pinnedGrid.appendChild(buildCard(n)));
    } else {
        pinnedLabel.style.display = "none";
    }

    // others section
    othersLabel.style.display = pinned.length && others.length ? "" : "none";

    notesArea.innerHTML = "";
    if (others.length) {
        const grid = document.createElement("div");
        grid.className = currentView === "grid" ? "notes-grid" : "notes-grid notes-list";
        others.forEach(n => grid.appendChild(buildCard(n)));
        notesArea.appendChild(grid);
    } else if (!pinned.length) {
        notesArea.innerHTML = `<div class="state-msg"><span>NO NOTES YET</span></div>`;
    }

    itemCount.textContent = `${notes.length} note${notes.length !== 1 ? "s" : ""}`;
}

/* ══════════════════════════════════════════════════════════
   EDITOR MODAL
   ══════════════════════════════════════════════════════════ */

function openEditor(note) {
    editingNote     = note || null;
    pendingImages   = [];
    removedImageIds = [];

    modalTitle.value   = note ? note.title || "" : "";
    modalBody.innerHTML = note ? note.content || "" : "";
    modalContent.dataset.color = note ? (note.color || "default") : "default";

    // pin state
    const pinBtn = document.getElementById("tool-pin");
    pinBtn.classList.toggle("active", note ? !!note.pinned : false);

    // delete button
    document.getElementById("tool-delete").style.display = note ? "" : "none";

    // color swatches
    document.querySelectorAll(".color-swatch").forEach(s => {
        s.classList.toggle("active", s.dataset.color === (note ? note.color || "default" : "default"));
    });

    // existing images
    renderModalImages(note ? note.images || [] : []);

    modal.classList.add("open");
    if (!note) modalTitle.focus();
}

function closeEditor() {
    saveNote();
    modal.classList.remove("open");
    editingNote = null;
}

function renderModalImages(existingImages) {
    modalImages.innerHTML = "";

    // existing images from server
    existingImages.forEach(img => {
        if (removedImageIds.includes(img.id)) return;
        const wrap = document.createElement("div");
        wrap.className = "note-img-preview";
        wrap.innerHTML = `
            <img src="/api/notes/image/${img.id}" alt="">
            <button class="img-remove" data-img-id="${img.id}">✕</button>`;
        wrap.querySelector(".img-remove").onclick = (e) => {
            e.stopPropagation();
            removedImageIds.push(img.id);
            wrap.remove();
        };
        modalImages.appendChild(wrap);
    });

    // pending new images
    pendingImages.forEach((pi, idx) => {
        const wrap = document.createElement("div");
        wrap.className = "note-img-preview";
        wrap.innerHTML = `
            <img src="${pi.dataUrl}" alt="">
            <button class="img-remove" data-pending="${idx}">✕</button>`;
        wrap.querySelector(".img-remove").onclick = (e) => {
            e.stopPropagation();
            pendingImages.splice(idx, 1);
            renderModalImages(editingNote ? editingNote.images || [] : []);
        };
        modalImages.appendChild(wrap);
    });
}

/* ── bullet list ── */
function toggleBulletList() {
    document.execCommand("insertUnorderedList");
    modalBody.focus();
}

/* ── image handling ── */
function handleImageUpload(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = e => {
            pendingImages.push({ file, dataUrl: e.target.result });
            renderModalImages(editingNote ? editingNote.images || [] : []);
        };
        reader.readAsDataURL(file);
    });
}

/* helper: get the closest element from a node (handles text nodes) */
function closestEl(node, selector) {
    if (!node) return null;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return el ? el.closest(selector) : null;
}

/* ── enter key in body for auto-bullets ── */
function handleBodyKeydown(e) {
    if (e.key === "Enter") {
        const sel = window.getSelection();
        const node = sel.anchorNode;
        const cbLine = closestEl(node, ".cb-line");
    }
}

/* ══════════════════════════════════════════════════════════
   EVENT WIRING
   ══════════════════════════════════════════════════════════ */

// new note
document.getElementById("new-note-btn").addEventListener("click", () => openEditor(null));

// close modal
document.getElementById("modal-backdrop").addEventListener("click", closeEditor);
document.getElementById("tool-close").addEventListener("click", closeEditor);

// delete
document.getElementById("tool-delete").addEventListener("click", () => {
    if (editingNote) {
        modal.classList.remove("open");
        deleteNote(editingNote.id);
        editingNote = null;
    }
});

// pin toggle
document.getElementById("tool-pin").addEventListener("click", () => {
    document.getElementById("tool-pin").classList.toggle("active");
});

// bullet list
document.getElementById("tool-bullet").addEventListener("click", toggleBulletList);

// image input
document.getElementById("image-input").addEventListener("change", (e) => {
    handleImageUpload(e.target.files);
    e.target.value = "";
});

// body keydown
modalBody.addEventListener("keydown", handleBodyKeydown);

// color picker
document.querySelectorAll(".color-swatch").forEach(s => {
    s.addEventListener("click", () => {
        document.querySelectorAll(".color-swatch").forEach(x => x.classList.remove("active"));
        s.classList.add("active");
        modalContent.dataset.color = s.dataset.color;
    });
});

// color filter
colorFilter.addEventListener("click", e => {
    const dot = e.target.closest(".color-dot");
    if (!dot) return;
    colorFilter.querySelectorAll(".color-dot").forEach(d => d.classList.remove("active"));
    dot.classList.add("active");
    activeColor = dot.dataset.color;
    render();
});

// view toggle
gridBtn.addEventListener("click", () => {
    currentView = "grid";
    gridBtn.classList.add("active");
    listBtn.classList.remove("active");
    render();
});
listBtn.addEventListener("click", () => {
    currentView = "list";
    listBtn.classList.add("active");
    gridBtn.classList.remove("active");
    render();
});

// search
searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();
    render();
});

// keyboard shortcut: Escape to close modal
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("open")) {
        closeEditor();
    }
});

// paste image support in modal
modalBody.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith("image/")) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) handleImageUpload([file]);
            return;
        }
    }
});

/* ── init ── */
loadNotes();
