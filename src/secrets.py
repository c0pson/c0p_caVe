import tomllib

from src.constants import SECRETS_FILE, SECRET_TYPE

def get_secret(secret_type: SECRET_TYPE):
    with open(SECRETS_FILE, "r") as file:
        f = tomllib.loads(file.read())
        secret = f.get(secret_type, None)
        return secret
