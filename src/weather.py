import requests # type: ignore
from requests.exceptions import ConnectTimeout # type: ignore

from typing import Any
import time

from src.secrets import get_secret
from src.constants import SECRET_TYPE

class Weather:
    def __init__(self) -> None:
        self.weather_info: dict = {}
        self.last_fetch: float = 0

    def update_info(self, lat, lon) -> dict:
        current_time = time.time()
        if current_time - self.last_fetch < 3600:
            self.weather_info.update({"cashed": True})
            return self.weather_info
        try:
            response = requests.get(
                url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={get_secret(SECRET_TYPE.OPEN_WEATHER)['api']}&units=metric",
                timeout=5
            )
            if response.status_code == 200:
                data = response.json()
                self.weather_info = data
                self.last_fetch = current_time
                return data
            else:
                return {"Error": response.status_code}
        except ConnectTimeout as e:
            return {"ConnectTimeout": e}
