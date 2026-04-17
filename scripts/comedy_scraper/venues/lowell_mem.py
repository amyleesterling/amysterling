"""Lowell Memorial Auditorium — Lowell (north/west edge of metro)."""
from __future__ import annotations

from ..models import Show
from ._jsonld import extract_shows

VENUE = "Lowell Memorial Auditorium"
CITY = "Lowell"
SOURCE = "lowellauditorium.com"
URL = "https://lowellauditorium.com/events/"


def scrape() -> list[Show]:
    return extract_shows(
        URL, venue=VENUE, city=CITY, source=SOURCE, require_comedy_keyword=True,
    )
