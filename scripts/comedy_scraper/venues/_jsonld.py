"""Generic JSON-LD Event scraper.

Most venue sites embed schema.org Event JSON-LD in their event list pages.
This is a pragmatic first pass — if a venue ships well-formed LD+JSON, we
get reliable data with no site-specific parsing.
"""
from __future__ import annotations

import json
import logging
from typing import Iterable, Iterator

from ..http import fetch
from ..models import Show
from .base import clean_name, looks_like_comedy, parse_date, soup, within_window

log = logging.getLogger(__name__)


def iter_events(html: str) -> Iterator[dict]:
    if not html:
        return
    s = soup(html)
    for tag in s.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (ValueError, TypeError):
            continue
        for obj in _flatten(data):
            t = obj.get("@type")
            if isinstance(t, list):
                if any("Event" in x for x in t):
                    yield obj
            elif isinstance(t, str) and "Event" in t:
                yield obj


def _flatten(data) -> Iterator[dict]:
    if isinstance(data, dict):
        if "@graph" in data and isinstance(data["@graph"], list):
            yield from _flatten(data["@graph"])
        else:
            yield data
    elif isinstance(data, list):
        for item in data:
            yield from _flatten(item)


def extract_shows(
    url: str,
    *,
    venue: str,
    city: str,
    source: str,
    html: str | None = None,
    require_comedy_keyword: bool = False,
) -> list[Show]:
    html = html if html is not None else fetch(url)
    if not html:
        return []
    out: list[Show] = []
    seen: set[tuple[str, str]] = set()
    for evt in iter_events(html):
        name = evt.get("name") or ""
        start = evt.get("startDate") or ""
        ev_url = evt.get("url") or url
        if require_comedy_keyword and not looks_like_comedy(name):
            continue
        comedian = clean_name(name)
        if not comedian:
            continue
        when = parse_date(start)
        if not when or not within_window(when, days=60):
            continue
        key = (comedian.lower(), when.date().isoformat())
        if key in seen:
            continue
        seen.add(key)
        out.append(
            Show(
                comedian=comedian,
                venue=venue,
                venue_city=city,
                date=when,
                url=ev_url,
                source=source,
            )
        )
    return out
