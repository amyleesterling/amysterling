"""The Wilbur Theatre — Boston's marquee comedy club."""
from __future__ import annotations

import logging
import re
from typing import Iterable

from ..http import fetch
from ..models import Show
from ._jsonld import extract_shows
from .base import clean_name, looks_like_comedy, parse_date, soup, within_window

log = logging.getLogger(__name__)

VENUE = "The Wilbur"
CITY = "Boston"
SOURCE = "thewilbur.com"
URLS = [
    "https://thewilbur.com/events/",
    "https://thewilbur.com/shows/",
    "https://thewilbur.com/",
]


def scrape() -> list[Show]:
    shows: list[Show] = []
    for url in URLS:
        shows.extend(extract_shows(url, venue=VENUE, city=CITY, source=SOURCE))
    if shows:
        return shows
    # Fallback: parse event cards heuristically.
    html = fetch(URLS[0]) or ""
    s = soup(html)
    seen: set[tuple[str, str]] = set()
    for card in s.select("article, .event, .show, .event-card, li.show"):
        title_el = card.find(["h2", "h3", "h4", "a"])
        date_el = card.find(class_=re.compile(r"date", re.I)) or card.find("time")
        if not title_el:
            continue
        title = title_el.get_text(" ", strip=True)
        comedian = clean_name(title)
        if not comedian:
            continue
        when = parse_date((date_el.get_text(" ", strip=True) if date_el else "") or title)
        if not when or not within_window(when, days=60):
            continue
        link = card.find("a", href=True)
        href = link["href"] if link else URLS[0]
        if href.startswith("/"):
            href = "https://thewilbur.com" + href
        key = (comedian.lower(), when.date().isoformat())
        if key in seen:
            continue
        seen.add(key)
        shows.append(
            Show(
                comedian=comedian, venue=VENUE, venue_city=CITY, date=when,
                url=href, source=SOURCE,
            )
        )
    return shows
