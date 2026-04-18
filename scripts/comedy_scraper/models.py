from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class Show:
    comedian: str
    venue: str
    venue_city: str
    date: datetime
    url: str
    source: str

    def to_dict(self) -> dict:
        d = asdict(self)
        d["date"] = self.date.isoformat()
        return d


@dataclass
class VideoClip:
    title: str
    video_id: str
    thumbnail: str
    views: int = 0
    duration: int = 0  # seconds

    @property
    def watch_url(self) -> str:
        return f"https://www.youtube.com/watch?v={self.video_id}"

    @property
    def shorts_url(self) -> str:
        return f"https://www.youtube.com/shorts/{self.video_id}"


@dataclass
class Comedian:
    name: str
    shows: list[Show] = field(default_factory=list)
    clips: list[VideoClip] = field(default_factory=list)
    photo: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "photo": self.photo,
            "shows": [s.to_dict() for s in sorted(self.shows, key=lambda s: s.date)],
            "clips": [
                {
                    "title": c.title,
                    "video_id": c.video_id,
                    "thumbnail": c.thumbnail,
                    "views": c.views,
                    "duration": c.duration,
                }
                for c in self.clips
            ],
        }
