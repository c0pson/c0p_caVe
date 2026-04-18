import os

from enum import StrEnum

# SECRETS

WORKING_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SECRET_DIR = os.path.join(WORKING_DIR, ".secrets")
SECRETS_FILE = os.path.join(SECRET_DIR, "tokens.toml")

class SECRET_TYPE(StrEnum):
    TAILSCALE = "tailscale"
    OPEN_WEATHER = "open-weather"
    PI_SERVER = "pi-server"
    YOUTUBE = "youtube"
    NEWS = "news"

class NEWS(StrEnum):
    WSJ = "wsj"
    LEGO = "lego"

# MOON PHASES

"""5 September 2013 - new moon from my birthday"""
LAST_KNOWN_NEW_MOON = (2013, 9, 5) #yyyy/mm/dd

class MOON(StrEnum):
    FULL_MOON="""    _..._
  .:::::::.
 :::::::::::
 :::::::::::
 `:::::::::'
   `':::''"""
    WAXING_GIBBOUS="""    _..._
  .' .::::.
 :  ::::::::
 :  ::::::::
 `. '::::::'
   `-.::''"""
    LAST_QUARTER="""    _..._
  .::::  `.
 ::::::    :
 ::::::    :
 `:::::   .'
   `'::.-'"""
    WANING_CRESCENT="""    _..._
  .::'   `.
 :::       :
 :::       :
 `::.     .'
   `':..-'"""
    NEW_MOON="""    _..._
  .'     `.
 :         :
 :         :
 `.       .'
   `-...-'"""
    WANING_GIBBOUS="""
   _..._
  .::::. `.
 :::::::.  :
 ::::::::  :
 `::::::' .'
   `'::'-'"""
    FIRST_QUARTER="""    _..._
  .'  ::::.
 :    ::::::
 :    ::::::
 `.   :::::'
   `-.::''"""
    WAXING_CRESCENT="""
    _..._
  .'   `::.
 :       :::
 :       :::
 `.     .::'
   `-..:''"""
