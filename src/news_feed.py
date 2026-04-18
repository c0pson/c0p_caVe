from bs4 import BeautifulSoup
import feedparser

from typing import Self
import time
import json

from src.secrets import get_secret
from src.constants import SECRET_TYPE, NEWS

class BetterParser:
    def __init__(self) -> None:
        self.channel: str
        self.title: str
        self.description: str
        self.link: str
        self.published: str
        self.thumbnail: str | None = None

    def extract_thumbnail(self, entry):
        if entry.get("media_content"):
            return entry.media_content[0]["url"]
        content = entry.get("content", [])
        if content:
            soup = BeautifulSoup(content[0]["value"], "html.parser")
            img = soup.find("img")
            if img and img.get("src"):
                return img["src"]
        return None

    def parse(self, entry: feedparser.FeedParserDict, channel: str) -> Self:
        self.cannel = channel
        self.title = entry.title
        self.description = entry.description
        self.link = entry.link
        self.published = entry.published
        self.thumbnail = self.extract_thumbnail(entry)
        return self

    def to_json(self):
        return json.dumps(
            self,
            default=lambda o: o.__dict__, 
            sort_keys=True,
            indent=4,
            ensure_ascii=False
        )

class NewsFeed:
    def __init__(self, source: NEWS) -> None:
        self.last_created: int = 0
        self.links: dict[str, str] = get_secret(SECRET_TYPE.NEWS)[source]
        self.create_feed()

    def create_feed(self) -> bool:
        current_time = time.time()
        if current_time - self.last_created < 3600:
            return False
        self.feed: list[BetterParser] = []
        for url in self.links.values():
            try:
                d = feedparser.parse(url)
                channel = d.feed.title
                for entry in d.entries:
                    self.feed.append(BetterParser().parse(entry, channel).to_json())
            except Exception as e:
                print(f"Error while parsing the content: {e}\n")
        return True

    def get_feed(self):
        update = self.create_feed()
        return self.feed, update
