let _toastTimer;
function showToast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ── snapshot function ── */
async function takeSnapshot(cameraId, imgElement) {
    try {
        // Create a canvas element to capture the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match the image
        canvas.width = imgElement.naturalWidth || imgElement.width || 640;
        canvas.height = imgElement.naturalHeight || imgElement.height || 480;
        
        // Draw the image onto the canvas
        ctx.drawImage(imgElement, 0, 0);
        
        // Convert canvas to blob and download
        console.log("test")
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            a.href = url;
            console.log(url)
            a.download = `camera_${cameraId}_${timestamp}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast(`✓ SNAPSHOT SAVED: camera_${cameraId}_${timestamp}.png`);
        }, 'image/png');
    } catch (err) {
        showToast(`✗ SNAPSHOT FAILED: ${err.message}`);
    }
}
