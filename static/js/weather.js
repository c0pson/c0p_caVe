/* ============================================================
   weather.js — clock · geolocation · weather fetch · sidebar
   ============================================================ */

let cachedLocation = { lat: null, lon: null };

/* ── clock ── */
function updateClock() {
    const el = document.getElementById("time");
    if (el) el.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });
}

/* ── geolocation ── */
function getLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        ({ coords: { latitude: lat, longitude: lon } }) => {
            cachedLocation = { lat, lon };
            fetchWeather(lat, lon);
        },
        (err) => {
            console.warn("Geolocation error:", err.message);
            if (cachedLocation.lat) fetchWeather(cachedLocation.lat, cachedLocation.lon);
        },
        { timeout: 5000, maximumAge: 300000 }
    );
}

/* ── weather fetch ── */
async function fetchWeather(lat, lon) {
    try {
        const res  = await fetch("/weather-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lon }),
        });
        const data = await res.json();
        const vals = document.querySelectorAll(".weather-value");
        if (!vals.length) return;

        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
        vals[0].textContent = `${data.main.temp} °C`;
        vals[1].textContent = cap(data.weather[0].description);
        vals[2].textContent = `${data.wind.speed} m/s`;
        vals[3].textContent = `${data.main.humidity} %`;
        vals[4].textContent = `${data.main.pressure} hPa`;
        vals[5].textContent = `${data.clouds.all} %`;
    } catch (err) {
        console.error("Weather fetch error:", err);
    }
}

/* ── sidebar toggles ── */
function toggleLeftSidebar() {
    const panel = document.querySelector(".left-panel");
    const btn   = document.querySelector(".sidebar-btn.left");
    if (!panel) return;
    panel.classList.toggle("hidden");
    const isHidden = panel.classList.contains("hidden");
    if (btn) btn.textContent = isHidden ? ">" : "<";
    // Prevent body scroll when panel open on mobile
    if (window.innerWidth <= 1024) {
        document.body.style.overflow = isHidden ? "" : "hidden";
    }
}

function toggleRightSidebar() {
    const panel = document.querySelector(".right-panel");
    const btn   = document.querySelector(".sidebar-btn.right");
    if (!panel) return;
    panel.classList.toggle("hidden");
    const isHidden = panel.classList.contains("hidden");
    if (btn) btn.textContent = isHidden ? "<" : ">";
    // Prevent body scroll when panel open on mobile
    if (window.innerWidth <= 1024) {
        document.body.style.overflow = isHidden ? "" : "hidden";
    }
}

/* ── mobile panel init ── */
function initMobilePanels() {
    if (window.innerWidth <= 1024) {
        document.querySelector(".left-panel")?.classList.add("hidden");
        document.querySelector(".right-panel")?.classList.add("hidden");
        const leftBtn  = document.querySelector(".sidebar-btn.left");
        const rightBtn = document.querySelector(".sidebar-btn.right");
        if (leftBtn)  leftBtn.textContent  = ">";
        if (rightBtn) rightBtn.textContent = "<";
    }
}

/* ── handle resize: restore panels on desktop ── */
let _resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        if (window.innerWidth > 1024) {
            document.querySelector(".left-panel")?.classList.remove("hidden");
            document.querySelector(".right-panel")?.classList.remove("hidden");
            document.body.style.overflow = "";
        } else {
            initMobilePanels();
        }
    }, 150);
});

/* ── init ── */
document.addEventListener("DOMContentLoaded", () => {
    initMobilePanels();

    updateClock();
    setInterval(updateClock, 1000);

    getLocation();
    setInterval(() => {
        if (cachedLocation.lat) fetchWeather(cachedLocation.lat, cachedLocation.lon);
        else getLocation();
    }, 600_000);

    if (typeof loadTasks === "function") loadTasks();
});
