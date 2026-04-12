import requests #type: ignore
from requests.exceptions import ConnectTimeout #type: ignore

class PiServer:
    @classmethod
    def get_status(self) -> int:
        try:
            response = requests.get(
                url="http://100.77.234.85/status"
            )
            return response.status_code
        except ConnectTimeout as e:
            return 500
