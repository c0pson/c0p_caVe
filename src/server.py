import requests #type: ignore
from requests.exceptions import ConnectTimeout #type: ignore

from src.secrets import get_secret
from src.constants import SECRET_TYPE

PI_BASE = get_secret(SECRET_TYPE.PI_SERVER)["url"]

class PiServer:
    @classmethod
    def get_status(self) -> int:
        try:
            response = requests.get(
                url=f"{PI_BASE}/status"
            )
            return response.status_code
        except ConnectTimeout as e:
            return 500
