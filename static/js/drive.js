/* ============================================================
   drive.js — file explorer · navigation · upload · delete
   ============================================================ */

/* ── state ── */
let currentPath = "";
let currentView = "list";
let dirData     = { dirs: [], files: [] };

/* read initial path from URL */
const _urlPath = window.location.pathname.replace(/^\/drive\/?/, "");
if (_urlPath) currentPath = _urlPath;

/* ── navigation ── */
function navigateTo(path, pushHistory = true) {
    if (pushHistory && currentPath !== path) {
        history.pushState({ path }, "", "/drive/" + path);
    }
    currentPath = path;
    loadDirectory(path);
    renderBreadcrumbs(path);
}

window.addEventListener("popstate", (e) => {
    const path = e.state?.path ?? "";
    currentPath = path;
    loadDirectory(path);
    renderBreadcrumbs(path);
});

/* ── breadcrumbs ── */
function renderBreadcrumbs(path) {
    const container = document.getElementById("breadcrumbs");
    const parts = path ? path.split("/").filter(Boolean) : [];
    let html = `<span class="crumb" onclick="navigateTo('')">~root</span>`;
    let acc  = "";

    parts.forEach((part, i) => {
        acc += (acc ? "/" : "") + part;
        const snap = acc;
        html += `<span class="crumb-sep">/</span>`;
        html += (i === parts.length - 1)
            ? `<span class="crumb-current">${part}</span>`
            : `<span class="crumb" onclick="navigateTo('${snap}')">${part}</span>`;
    });

    container.innerHTML = html;
}

/* ── load directory ── */
async function loadDirectory(path) {
    const area = document.getElementById("file-area");
    area.innerHTML = `<div class="state-msg"><div class="spinner"></div><span>LOADING...</span></div>`;
    document.getElementById("item-count").textContent = "";

    try {
        const resp = await fetch(`/api/drive-list/${path}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        dirData = await resp.json();
        renderFiles();
    } catch (err) {
        area.innerHTML = `<div class="state-msg">
            <span>⚠ FAILED TO LOAD</span>
            <span style="color:var(--text-muted);font-size:11px">${err.message}</span>
        </div>`;
    }
}

/* ── render ── */
function renderFiles() {
    const { dirs = [], files = [] } = dirData;

    document.getElementById("item-count").textContent =
        `${dirs.length} dir${dirs.length !== 1 ? "s" : ""} · ${files.length} file${files.length !== 1 ? "s" : ""}`;

    const area = document.getElementById("file-area");

    if (!dirs.length && !files.length) {
        area.innerHTML = `<div class="state-msg"><span>— EMPTY DIRECTORY —</span></div>`;
        return;
    }

    if (currentView === "list") renderListView(dirs, files);
    else                        renderGridView(dirs, files);
}

/* ── helpers ── */
function fileIcon(name) {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
        pdf: "📄", txt: "📝", md: "📝",
        jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
        mp4: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬",
        mp3: "🎵", flac: "🎵", wav: "🎵", ogg: "🎵",
        zip: "📦", tar: "📦", gz: "📦", rar: "📦",
        py:  "🐍", js: "📜", html: "🌐", css: "🎨",
        json: "📋", csv: "📊", xlsx: "📊",
    };
    return map[ext] || "📄";
}

function fmtSize(bytes) {
    if (bytes == null)    return "";
    if (bytes < 1024)     return bytes + " B";
    if (bytes < 1048576)  return (bytes / 1024).toFixed(1)      + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1)   + " MB";
    return (bytes / 1073741824).toFixed(2) + " GB";
}

function itemPath(name) {
    return (currentPath ? currentPath + "/" : "") + name;
}

/* ── list view ── */
function renderListView(dirs, files) {
    const rows = [
        ...dirs.map(d  => ({ name: d?.name ?? d, isDir: true,  size: null,   modified: d?.modified })),
        ...files.map(f => ({ name: f?.name ?? f, isDir: false, size: f.size, modified: f?.modified })),
    ];

    const tbody = rows.map(item => {
        const icon      = item.isDir ? "📁" : fileIcon(item.name);
        const nameClass = item.isDir ? "file-name dir-name" : "file-name";
        const action    = item.isDir
            ? `onclick="navigateTo('${itemPath(item.name)}')"`
            : `onclick="downloadFile('${item.name}')"`;
        const actions   = !item.isDir
            ? `<button class="dl-btn"  onclick="event.stopPropagation();downloadFile('${item.name}')">DOWNLOAD</button>
               <button class="del-btn" onclick="event.stopPropagation();deleteFile('${item.name}')">REMOVE</button>`
            : `<button class="del-btn" onclick="event.stopPropagation();deleteDirectory('${item.name}')">REMOVE</button>`;

        return `<tr class="file-row" ${action}>
            <td class="icon-col"><span class="file-icon">${icon}</span></td>
            <td><span class="${nameClass}" title="${item.name}">${item.name}</span></td>
            <td class="file-size">${item.isDir ? "" : fmtSize(item.size)}</td>
            <td class="file-modified">${item.modified ?? ""}</td>
            <td class="action-col">${actions}</td>
        </tr>`;
    }).join("");

    document.getElementById("file-area").innerHTML = `
        <table class="file-table">
            <thead>
                <tr>
                    <th></th>
                    <th>NAME</th>
                    <th>SIZE</th>
                    <th>MODIFIED</th>
                    <th style="text-align:right">ACTIONS</th>
                </tr>
            </thead>
            <tbody>${tbody}</tbody>
        </table>`;
}

/* ── grid view ── */
function renderGridView(dirs, files) {
    const items = [
        ...dirs.map(d  => ({ name: d?.name ?? d, isDir: true  })),
        ...files.map(f => ({ name: f?.name ?? f, isDir: false })),
    ];

    const cards = items.map(item => {
        const icon      = item.isDir ? "📁" : fileIcon(item.name);
        const nameClass = item.isDir ? "grid-name is-dir" : "grid-name";
        const action    = item.isDir
            ? `onclick="navigateTo('${itemPath(item.name)}')"`
            : `onclick="downloadFile('${item.name}')"`;
        return `<div class="grid-item" ${action}>
            <span class="grid-icon">${icon}</span>
            <span class="${nameClass}" title="${item.name}">${item.name}</span>
        </div>`;
    }).join("");

    document.getElementById("file-area").innerHTML = `<div class="file-grid">${cards}</div>`;
}

/* ── view toggle ── */
function setView(v) {
    currentView = v;
    document.getElementById("list-btn").classList.toggle("active", v === "list");
    document.getElementById("grid-btn").classList.toggle("active", v === "grid");
    if (dirData) renderFiles();
}

/* ── download ── */
function downloadFile(filename) {
    const a  = document.createElement("a");
    a.href   = `/api/download/${itemPath(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("DOWNLOADING: " + filename);
}

/* ── delete ── */
async function deleteFile(filename) {
    try {
        const resp = await fetch(`/api/remove-file/${itemPath(filename)}`, { method: "DELETE" });
        const data = await resp.json();
        if (resp.ok) {
            showToast("✓ DELETED: " + filename);
            loadDirectory(currentPath);
        } else {
            throw new Error(data.error ?? "Delete failed");
        }
    } catch (err) {
        showToast("✗ " + err.message);
    }
}

async function deleteDirectory(dirname) {
    try {
        const resp = await fetch(`/api/remove-dir/${itemPath(dirname)}`, { method: "DELETE" });
        const data = await resp.json();
        if (resp.ok) {
            showToast("✓ DELETED: " + dirname);
            loadDirectory(currentPath);
        } else {
            throw new Error(data.error ?? "Delete failed");
        }
    } catch (err) {
        showToast("✗ " + err.message);
    }
}

/* ── create directory ── */
async function createNewDirectory() {
    const name = prompt("Enter directory name:");
    if (!name?.trim()) { showToast("⚠ NAME CANNOT BE EMPTY"); return; }
    const clean = name.trim();
    const path  = currentPath ? currentPath + "/" + clean : clean;

    try {
        const resp = await fetch(`/api/create-dir/${path}`, { method: "POST" });
        const data = await resp.json();
        if (resp.ok) {
            showToast("✓ CREATED: " + clean);
            loadDirectory(currentPath);
        } else {
            throw new Error(data.error ?? "Create failed");
        }
    } catch (err) {
        showToast("✗ " + err.message);
    }
}

/* ── shared upload logic ── */
async function performUpload(files) {
    if (!files.length) { showToast("⚠ NO FILES SELECTED"); return; }
    showToast("UPLOADING " + files.length + " FILE" + (files.length > 1 ? "S" : "") + "...");

    const fd = new FormData();
    Array.from(files).forEach(f => fd.append("files", f));
    fd.append("path", currentPath);

    try {
        const resp = await fetch("/proxy-upload", { method: "POST", body: fd });
        const data = await resp.json();
        if (resp.ok) {
            showToast("✓ " + files.length + " FILE" + (files.length > 1 ? "S" : "") + " UPLOADED");
            loadDirectory(currentPath);
        } else {
            throw new Error(data.error ?? "Upload failed");
        }
    } catch (err) {
        showToast("✗ " + err.message);
    }
}

/* ── desktop upload panel ── */
const dropZone    = document.getElementById("drop-zone");
const fileInput   = document.getElementById("file-input");
const pendingList = document.getElementById("pending-list");

if (dropZone && fileInput) {
    function updatePendingList(files) {
        if (pendingList) pendingList.innerHTML = Array.from(files).map(f => `<li>${f.name}</li>`).join("");
    }

    fileInput.addEventListener("change", () => updatePendingList(fileInput.files));
    dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", ()  => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        fileInput.files = e.dataTransfer.files;
        updatePendingList(fileInput.files);
    });
}

async function uploadFiles() {
    const btn    = document.getElementById("submit-btn");
    const status = document.getElementById("upload-status");
    if (!fileInput?.files.length) { showToast("⚠ NO FILES SELECTED"); return; }

    btn.disabled = true;
    status.className = "upload-status";
    status.textContent = "UPLOADING...";

    const fd = new FormData();
    Array.from(fileInput.files).forEach(f => fd.append("files", f));
    fd.append("path", currentPath);

    try {
        const resp = await fetch("/proxy-upload", { method: "POST", body: fd });
        const data = await resp.json();
        if (resp.ok) {
            status.className   = "upload-status ok";
            status.textContent = "✓ FILES UPLOADED";
            if (pendingList) pendingList.innerHTML = "";
            fileInput.value = "";
            loadDirectory(currentPath);
        } else {
            throw new Error(data.error ?? "Upload failed");
        }
    } catch (err) {
        status.className   = "upload-status err";
        status.textContent = "✗ " + err.message;
    } finally {
        btn.disabled = false;
    }
}

/* ── mobile FAB upload ── */
const fabInput = document.getElementById("fab-file-input");
if (fabInput) {
    fabInput.addEventListener("change", async () => {
        if (!fabInput.files.length) return;
        const files = Array.from(fabInput.files);
        await performUpload(files);
        fabInput.value = "";
    });
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

/* ── init ── */
renderBreadcrumbs(currentPath);
navigateTo(currentPath, false);
