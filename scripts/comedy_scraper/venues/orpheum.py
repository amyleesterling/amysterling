"""Orpheum Theatre — downtown Boston (Crossroads / Live Nation listings)."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "Orpheum Theatre"
CITY = "Boston"
SOURCE = "crossroadspresents.com"
URLS = [
    "https://www.crossroadspresents.com/orpheum-theatre",
    "https://www.crossroadspresents.com/shows?venue=orpheum-theatre",
]


def scrape() -> list[Show]:
    shows: list[Show] = []
    for url in URLS:
        shows.extend(
            extract_shows(
                url, venue=VENUE, city=CITY, source=SOURCE,
                require_comedy_keyword=True,
            )
        )
    return shows
