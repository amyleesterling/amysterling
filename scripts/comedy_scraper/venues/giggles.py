"""Giggles Comedy Club — Prince Pizzeria, Saugus (north suburbs)."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "Giggles Comedy Club"
CITY = "Saugus"
SOURCE = "gigglescomedyclub.com"
URL = "https://gigglescomedyclub.com/"


def scrape() -> list[Show]:
    return extract_shows(URL, venue=VENUE, city=CITY, source=SOURCE)
