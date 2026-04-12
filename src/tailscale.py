from dataclasses import dataclass
import requests # type: ignore

from src.secrets import get_secret
from src.constants import SECRET_TYPE

@dataclass
class DeviceInfo():
    ip_address: str
    hostname: str
    device_os: str
    connected: bool

def get_access_token():
    """OAuth2 for access token"""
    config = get_secret(SECRET_TYPE.TAILSCALE)
    response = requests.post(
        config["token_url"],
        data={"grant_type": "client_credentials"},
        auth=(config["client_id"], config["client_secret"]),
    )
    return response.json()["access_token"]

def get_all_devices() -> list[DeviceInfo]:
    """All tailscale-network devices"""
    access_token = get_access_token()
    response = requests.get(
        "https://api.tailscale.com/api/v2/tailnet/-/devices",
        auth=(access_token, "")
    )
    if response.status_code != 200:
        return []
    data = response.json()
    devices_info = []
    for device in data["devices"]:
        ip_address = device["addresses"][0]
        hostname = device["name"].split(".")[0]
        device_os = device["os"]
        connected = device["connectedToControl"]
        devices_info.append(DeviceInfo(
            ip_address,
            hostname,
            device_os,
            connected
        ))
    return devices_info
