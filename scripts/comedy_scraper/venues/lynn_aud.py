"""Lynn Auditorium — Lynn (north shore)."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "Lynn Auditorium"
CITY = "Lynn"
SOURCE = "lynnauditorium.com"
URL = "https://lynnauditorium.com/events/"


def scrape() -> list[Show]:
    return extract_shows(
        URL, venue=VENUE, city=CITY, source=SOURCE, require_comedy_keyword=True,
    )
