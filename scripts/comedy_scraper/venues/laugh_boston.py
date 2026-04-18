"""Laugh Boston — Seaport comedy club."""
from __future__ import annotations

import logging
import re

from ..http import fetch
from ..models import Show
from ._jsonld import extract_shows
from .base import clean_name, parse_date, soup, within_window

log = logging.getLogger(__name__)

VENUE = "Laugh Boston"
CITY = "Boston"
SOURCE = "laughboston.com"
URL = "https://laughboston.com/"


def scrape() -> list[Show]:
    shows = extract_shows(URL, venue=VENUE, city=CITY, source=SOURCE)
    if shows:
        return shows
    html = fetch(URL) or ""
    s = soup(html)
    seen: set[tuple[str, str]] = set()
    out: list[Show] = []
    for card in s.select(".event, .show, .event-card, article, li"):
        title_el = card.find(["h2", "h3", "h4"]) or card.find("a")
        if not title_el:
            continue
        title = title_el.get_text(" ", strip=True)
        comedian = clean_name(title)
        if not comedian:
            continue
        date_text = ""
        date_el = card.find(class_=re.compile(r"date", re.I)) or card.find("time")
        if date_el:
            date_text = date_el.get_text(" ", strip=True)
        when = parse_date(date_text or title)
        if not when or not within_window(when, days=110):
            continue
        link = card.find("a", href=True)
        href = link["href"] if link else URL
        if href.startswith("/"):
            href = "https://laughboston.com" + href
        key = (comedian.lower(), when.date().isoformat())
        if key in seen:
            continue
        seen.add(key)
        out.append(
            Show(
                comedian=comedian, venue=VENUE, venue_city=CITY, date=when,
                url=href, source=SOURCE,
            )
        )
    return out
