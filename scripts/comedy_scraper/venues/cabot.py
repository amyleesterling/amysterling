"""The Cabot — Beverly (north shore)."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "The Cabot"
CITY = "Beverly"
SOURCE = "thecabot.org"
URL = "https://thecabot.org/events/"


def scrape() -> list[Show]:
    return extract_shows(
        URL, venue=VENUE, city=CITY, source=SOURCE, require_comedy_keyword=True,
    )
