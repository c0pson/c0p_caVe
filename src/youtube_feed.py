import feedparser
from dataclasses import dataclass
import time
import json

from typing import Self

from src.secrets import get_secret
from src.constants import SECRET_TYPE

@dataclass
class THUMBNAIL:
    url: str
    width: str
    height: str

class BetterParser():
    def __init__(self) -> None:
        self.channel: str
        self.title: str
        self.url: str
        self.published: str
        self.thumbnail: THUMBNAIL

    def parse(self, entry: feedparser.FeedParserDict, channel: str) -> Self:
        media_thumbnail = entry.media_thumbnail[0]
        self.channel = channel
        self.title = entry.title
        self.url = entry.links[0].href
        self.published = entry.published
        self.thumbnail = THUMBNAIL(media_thumbnail["url"], media_thumbnail["width"], media_thumbnail["height"])
        return self

    def to_json(self):
        return json.dumps(
            self,
            default=lambda o: o.__dict__, 
            sort_keys=True,
            indent=4,
            ensure_ascii=False
        )

class YouTube:
    def __init__(self) -> None:
        self.channels: dict[str, str] = self.create_rss_links()
        self.last_created = 0
        self.create_feed()

    def create_feed(self) -> bool:
        current_time = time.time()
        if current_time - self.last_created < 3600:
            return False
        self.feed: list[BetterParser] = []
        for id in self.channels.values():
            try:
                d = feedparser.parse(id)
                channel = d.feed.title
                for entry in d.entries:
                    url: str = entry.links[0].href
                    if url.startswith("https://www.youtube.com/shorts"):
                        continue
                    self.feed.append(BetterParser().parse(entry, channel).to_json())
            except Exception as e:
                print(f"Error while parsing the content: {e}\n\n{d}")
        return True

    def get_feed(self) -> tuple[list[BetterParser], bool]:
        update = self.create_feed()
        return self.feed, update

    @staticmethod
    def create_rss_links() -> dict[str, str]:
        channels: dict[str, str] = get_secret(SECRET_TYPE.YOUTUBE)
        channels_urls: dict[str, str] = {}
        for channel, id in channels.items():
            channels_urls[channel] = f"https://www.youtube.com/feeds/videos.xml?channel_id={id}"
        return channels_urls
