"""Chevalier Theatre — Medford (north suburbs)."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "Chevalier Theatre"
CITY = "Medford"
SOURCE = "chevaliertheatre.com"
URL = "https://chevaliertheatre.com/events/"


def scrape() -> list[Show]:
    # Chevalier hosts mixed programming; filter by comedy keyword.
    return extract_shows(
        URL, venue=VENUE, city=CITY, source=SOURCE, require_comedy_keyword=True,
    )
