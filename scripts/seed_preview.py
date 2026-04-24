"""Seed /comedy/ with a realistic preview spanning the next ~3 months.

This is only used when the page is first published / before the monthly cron
has run against live venue sites. The cron-produced output replaces anything
written here.

Each show's URL is a Ticketmaster search for ``"{comedian} {city}"`` so the
preview always lands on a working ticket-search page (no 404s) — and once
the live scraper runs, JSON-LD provides event-specific URLs that override
these placeholders.
"""
from __future__ import annotations

import logging
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

from scripts.comedy_scraper.aggregate import enrich
from scripts.comedy_scraper.build_site import render
from scripts.comedy_scraper.models import Comedian, Show

log = logging.getLogger("seed")


def tickets(name: str, city: str = "Boston") -> str:
    q = urllib.parse.quote_plus(f"{name} {city}")
    return f"https://www.ticketmaster.com/search?q={q}"


def _show(name: str, venue: str, city: str, offset_days: int, hour: int = 20, minute: int = 0) -> Show:
    when = datetime.now() + timedelta(days=offset_days)
    when = when.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return Show(
        comedian=name, venue=venue, venue_city=city, date=when,
        url=tickets(name, city), source="seed",
    )


def build() -> list[Comedian]:
    # 14 comedians spread across the next ~3.5 months. Real cron runs replace
    # this whole list with scraped, event-specific entries.
    rows = [
        ("Nate Bargatze",   "The Wilbur",          "Boston",     6,  19, 0),
        ("Mike Birbiglia",  "Chevalier Theatre",   "Medford",    12, 20, 0),
        ("Tig Notaro",      "Laugh Boston",        "Boston",     18, 19, 30),
        ("Jim Gaffigan",    "Orpheum Theatre",     "Boston",     22, 20, 0),
        ("Maria Bamford",   "The Comedy Studio",   "Somerville", 27, 20, 0),
        ("Bill Burr",       "Orpheum Theatre",     "Boston",     34, 20, 0),
        ("John Mulaney",    "The Wilbur",          "Boston",     42, 19, 0),
        ("Roy Wood Jr.",    "Laugh Boston",        "Boston",     48, 19, 30),
        ("Jo Koy",          "Orpheum Theatre",     "Boston",     55, 20, 0),
        ("Michelle Wolf",   "The Wilbur",          "Boston",     63, 20, 0),
        ("Bert Kreischer",  "The Cabot",           "Beverly",    72, 20, 0),
        ("Hasan Minhaj",    "Chevalier Theatre",   "Medford",    85, 20, 0),
        ("Sarah Silverman", "The Wilbur",          "Boston",     94, 19, 0),
        ("Ronny Chieng",    "Orpheum Theatre",     "Boston",    102, 20, 0),
    ]
    return [
        Comedian(name=name, shows=[_show(name, venue, city, off, h, m)])
        for name, venue, city, off, h, m in rows
    ]


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cs = build()
    try:
        enrich(cs)  # Fetch real clips + Wikipedia photos.
    except Exception:
        log.exception("Enrichment failed; rendering without media.")
    render(cs, out_dir=Path("comedy"))
    log.info("Seeded /comedy/ with %d comedians.", len(cs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
