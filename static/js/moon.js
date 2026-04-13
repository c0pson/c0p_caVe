async function loadMoonPhase() {
    const container = document.querySelector(".moon-display");
    if (!container) return;

    try {
        const res  = await fetch("/api/moon-phase");
        const data = await res.json();

        container.innerHTML = `
            <div class="moon-body">
                <pre class="moon-ascii">${data.moon_phase_ascii}</pre>
                <div class="moon-name">${data.moon_phase_name.replace(/_/g, " ")}</div>
            </div>`;
    } catch {
        container.innerHTML = `<div class="moon-empty">[ UNAVAILABLE ]</div>`;
    }
}

loadMoonPhase();
