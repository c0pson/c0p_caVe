from flask import (
    Flask,
    render_template,
    jsonify,
    request,
    Response,
    stream_with_context,
    send_from_directory
)

import requests # type: ignore
import os

from src.constants import SECRET_TYPE, SECRET_DIR, NEWS
from src.tailscale import get_all_devices
from src.secrets import get_secret
from src.moon import MoonPhaseCalculator
from src.youtube_feed import YouTube
from src.news_feed import NewsFeed
from src.weather import Weather

app = Flask(__name__)

weather = Weather()
youtube_feed = YouTube()
moon = MoonPhaseCalculator()
news_feeds: dict[str, NewsFeed] = {}

for source in NEWS:
    try:
        news_feeds[source] = NewsFeed(source)
    except Exception as e:
        print(f"Failed to init news feed {source}: {e}")

PI_BASE = get_secret(SECRET_TYPE.PI_SERVER)["url"]

# =================== ROUTES ==================== #
# Template rendering
# =============================================== #

@app.route("/")
def index() -> str:
    logo_path: str = os.path.join("static", "assets", "batman_logo.png")
    return render_template("index.html", logo_path=logo_path)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route("/youtube")
def youtube():
    return render_template("youtube.html")

@app.route("/drive/", defaults={"subpath": ""})
@app.route("/drive/<path:subpath>")
def drive(subpath):
    return render_template("drive.html")

@app.route("/camera")
def camera():
    return render_template("camera.html")

@app.route("/library")
def library():
    return render_template("library.html")

@app.route("/break-time")
def break_time():
    return render_template("break_time.html")

@app.route("/news")
def news() -> str:
    return render_template("news.html")

# ===================== API ===================== #
# Connection layer between the PI server and 
# end device. Traffic is internal in tailscale
# network.
# =============================================== #

# ==================== DRIVE ==================== #

@app.route("/api/drive-list/", defaults={"subpath": ""})
@app.route("/api/drive-list/<path:subpath>")
def drive_list(subpath):
    try:
        resp = requests.get(f"{PI_BASE}/get-dirs/{subpath}", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/create-dir/", defaults={"subpath": ""}, methods=["POST"])
@app.route("/api/create-dir/<path:subpath>", methods=["POST"])
def create_dir(subpath):
    try:
        resp = requests.get(f"{PI_BASE}/create-dir/{subpath}", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/remove-file/", defaults={"subpath": ""}, methods=["DELETE"])
@app.route("/api/remove-file/<path:subpath>", methods=["DELETE"])
def remove_file(subpath):
    try:
        resp = requests.get(f"{PI_BASE}/remove-file/{subpath}", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/remove-dir/", defaults={"subpath": ""}, methods=["DELETE"])
@app.route("/api/remove-dir/<path:subpath>", methods=["DELETE"])
def remove_dir(subpath):
    try:
        resp = requests.get(f"{PI_BASE}/remove-dir/{subpath}", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/download/<path:filepath>")
def download_file(filepath):
    try:
        pi_resp = requests.get(
            f"{PI_BASE}/download/{filepath}",
            stream=True,
            timeout=30,
        )
        pi_resp.raise_for_status()

        filename = filepath.split("/")[-1]
        content_type = pi_resp.headers.get("Content-Type", "application/octet-stream")

        def generate():
            for chunk in pi_resp.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": content_type,
        }
        if "Content-Length" in pi_resp.headers:
            headers["Content-Length"] = pi_resp.headers["Content-Length"]

        return Response(
            stream_with_context(generate()),
            status=pi_resp.status_code,
            headers=headers,
        )
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/proxy-upload", methods=["POST"])
def proxy_upload():
    files = request.files.getlist("files")
    multi = [("files", (f.filename, f.stream, f.mimetype)) for f in files]
    upload_path = request.form.get("path", "")
    upload_url = f"{PI_BASE}/upload-file"
    params = {}
    if upload_path:
        params["path"] = upload_path
    resp = requests.post(upload_url, files=multi, params=params)
    return jsonify(resp.json()), resp.status_code

# ================== PI SERVER ================== #

@app.route("/api/get-pi-status")
def get_pi_status():
    resp = requests.get(PI_BASE)
    return jsonify(resp.json(), resp.status_code)

# =================== WEATHER =================== #

@app.route("/weather-info", methods=["POST"])
def weather_info():
    data = request.get_json()
    lat = data["lat"]
    lon = data["lon"]
    weather_data = weather.update_info(lat, lon)
    return jsonify(weather_data)

# ===================== MOON ==================== #

@app.route("/api/moon-phase")
def moon_phase():
    return jsonify({
        "moon_phase_name"  : moon.moon_phase().name,
        "moon_phase_ascii" : moon.moon_phase().value
    })

# =================== YOUTUBE =================== #

@app.route("/api/youtube")
def api_youtube():
    feed, updated = youtube_feed.get_feed()
    print(youtube_feed)
    return jsonify({"feed": feed, "updated": updated})

# ==================== NEWS ===================== #

@app.route("/api/news")
def api_news():
    force = request.args.get("force") == "1"
    combined_feed = []
    any_updated = False
    for feed_obj in news_feeds.values():
        if force:
            feed_obj.last_created = 0
        feed, updated = feed_obj.get_feed()
        combined_feed.extend(feed)
        if updated:
            any_updated = True
    return jsonify({"feed": combined_feed, "updated": any_updated})

# ==================== TASKS ==================== #

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    try:
        resp = requests.get(f"{PI_BASE}/api/tasks", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/tasks", methods=["POST"])
def create_task():
    try:
        data = request.get_json()
        resp = requests.post(f"{PI_BASE}/api/tasks", json=data, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    try:
        data = request.get_json()
        resp = requests.put(f"{PI_BASE}/api/tasks/{task_id}", json=data, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    try:
        resp = requests.delete(f"{PI_BASE}/api/tasks/{task_id}", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/tasks/<int:task_id>/toggle", methods=["POST"])
def toggle_task(task_id):
    try:
        resp = requests.post(f"{PI_BASE}/api/tasks/{task_id}/toggle", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

# =================== LIBRARY =================== #

@app.route("/api/library", methods=["GET"])
def get_library():
    try:
        resp = requests.get(f"{PI_BASE}/api/library", params=request.args, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/library/tags", methods=["GET"])
def get_library_tags():
    try:
        resp = requests.get(f"{PI_BASE}/api/library/tags", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/library", methods=["POST"])
def create_bookmark():
    try:
        data = request.get_json()
        resp = requests.post(f"{PI_BASE}/api/library", json=data, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/library/<int:bookmark_id>", methods=["PUT"])
def update_bookmark(bookmark_id):
    try:
        data = request.get_json()
        resp = requests.put(f"{PI_BASE}/api/library/{bookmark_id}", json=data, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/library/<int:bookmark_id>", methods=["DELETE"])
def delete_bookmark(bookmark_id):
    try:
        resp = requests.delete(f"{PI_BASE}/api/library/{bookmark_id}", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

# ================== TAILSCALE ================== #

@app.route("/api/get-all-tailscale-devices")
def get_all_tailscale_devices():
    return jsonify(get_all_devices())

# =================== YOUTUBE =================== #

@app.route("/api/youtube/watched", methods=["GET"])
def get_watched():
    try:
        resp = requests.get(f"{PI_BASE}/api/youtube/watched", timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/youtube/watched", methods=["POST"])
def mark_watched():
    try:
        data = request.get_json()
        resp = requests.post(f"{PI_BASE}/api/youtube/watched", json=data, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

@app.route("/api/youtube/watched", methods=["DELETE"])
def unmark_watched():
    try:
        data = request.get_json()
        resp = requests.delete(f"{PI_BASE}/api/youtube/watched", json=data, timeout=10)
        resp.raise_for_status()
        return jsonify(resp.json()), resp.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

# ===================== SW ====================== #

@app.route('/sw.js')
def sw():
    return app.send_static_file('sw.js'), 200, {'Content-Type': 'application/javascript'}

# ==================== MAIN ==================== #

if __name__ == "__main__":
    app.run(
        host=get_secret(SECRET_TYPE.PI_SERVER)["host"],
        port=get_secret(SECRET_TYPE.PI_SERVER)["port"],
        ssl_context=(
            os.path.join(SECRET_DIR, get_secret(SECRET_TYPE.PI_SERVER)["crt"]),
            os.path.join(SECRET_DIR, get_secret(SECRET_TYPE.PI_SERVER)["key"])
        )
    )
