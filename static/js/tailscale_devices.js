/* ============================================================
   TAILSCALE DEVICES — fetch & render network device list
   ============================================================ */

const DEVICE_REFRESH_MS = 30_000;

function renderDevices(devices) {
    const container = document.getElementById("device-list");
    if (!container) return;

    if (!devices || devices.length === 0) {
        container.innerHTML = `<div class="device-empty">[ NO DEVICES FOUND ]</div>`;
        return;
    }

    // Sort: online first, then alphabetically by hostname
    const sorted = [...devices].sort((a, b) => {
        if (a.connected !== b.connected) return b.connected - a.connected;
        return a.hostname.localeCompare(b.hostname);
    });

    container.innerHTML = sorted.map((device, i) => `
        <div class="device-entry ${device.connected ? "online" : "offline"}">
            <div class="device-entry-header">
                <span class="device-index">${String(i + 1).padStart(2, "0")}</span>
                <span class="device-hostname">${escapeHtml(device.hostname)}</span>
                <span class="device-badge ${device.connected ? "badge-online" : "badge-offline"}">
                    ${device.connected ? "● ONLINE" : "○ OFFLINE"}
                </span>
            </div>
            <div class="device-entry-meta">
                <span class="device-meta-item">
                    <span class="device-meta-label">IP</span>
                    <a class="device-meta-value device-ip-link" 
                        href="http://${escapeHtml(device.ip_address)}" 
                        target="_blank" 
                        rel="noopener">${escapeHtml(device.ip_address)}</a>
                </span>
                <span class="device-meta-item">
                    <span class="device-meta-label">OS</span>
                    <span class="device-meta-value">${escapeHtml(device.device_os)}</span>
                </span>
            </div>
        </div>
    `).join("");
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

async function fetchDevices() {
    const container = document.getElementById("device-list");
    if (!container) return;

    try {
        const res = await fetch("/api/get-all-tailscale-devices");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const devices = await res.json();
        renderDevices(devices);
    } catch (err) {
        console.error("Device fetch failed:", err);
        if (container) {
            container.innerHTML = `<div class="device-empty">[ FETCH ERROR ]</div>`;
        }
    }
}

// Initial load + polling
fetchDevices();
setInterval(fetchDevices, DEVICE_REFRESH_MS);
