"""The Comedy Studio — Somerville."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "The Comedy Studio"
CITY = "Somerville"
SOURCE = "thecomedystudio.com"
URL = "https://thecomedystudio.com/shows/"


def scrape() -> list[Show]:
    # Studio books rotating lineups; we accept any Event the site lists, then
    # let name heuristics filter non-performers.
    return extract_shows(URL, venue=VENUE, city=CITY, source=SOURCE)
