import os

from enum import StrEnum

WORKING_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SECRET_DIR = os.path.join(WORKING_DIR, ".secrets")
SECRETS_FILE = os.path.join(SECRET_DIR, "tokens.toml")

class SECRET_TYPE(StrEnum):
    TAILSCALE = "tailscale"
    OPEN_WEATHER = "open-weather"
    PI_SERVER = "pi-server"
    YOUTUBE = "youtube"
