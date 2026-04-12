const BAD_STATUS = [
    "SYSTEM COMPROMISED",
    "FAILSAFE INITIATED",
    "LOCKDOWN ENGAGED",
    "SELF-DIAGNOSTICS RUNNING",
    "REBOOT REQUIRED",
];

const STATUS_LINE_WIDTH = 33;

function padWithEights(msg) {
    const inner = ` ${msg} `;
    if (inner.length >= STATUS_LINE_WIDTH) return inner.slice(0, STATUS_LINE_WIDTH);
    const remaining = STATUS_LINE_WIDTH - inner.length;
    return "8".repeat(Math.floor(remaining / 2)) + inner + "8".repeat(Math.ceil(remaining / 2));
}

function setStatusLine(msg) {
    const el = document.getElementById("bat-status");
    if (el) el.textContent = padWithEights(msg);
}

function setStatusLineEmpty() {
    const el = document.getElementById("bat-status");
    if (el) el.textContent = "888888888888888888888888888888888";
}

async function fetchPiStatus() {
    try {
        const res = await fetch("/api/get-pi-status", { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStatusLine(data[0].status ?? "SYSTEM ONLINE");
    } catch (err) {
        console.error("PI status fetch error:", err);
        setStatusLine(BAD_STATUS[Math.floor(Math.random() * BAD_STATUS.length)]);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(setStatusLineEmpty, 450);
    setTimeout(fetchPiStatus, 520);
    setInterval(fetchPiStatus, 60_000);
});
