"""Run every venue scraper, merge results into per-comedian rollups."""
from __future__ import annotations

import logging

from .models import Comedian, Show
from .profile import find_profile
from .venues import ALL_SCRAPERS
from .youtube import find_clips

log = logging.getLogger(__name__)


def collect_shows() -> list[Show]:
    shows: list[Show] = []
    for mod in ALL_SCRAPERS:
        venue_name = getattr(mod, "VENUE", mod.__name__)
        try:
            found = mod.scrape()
        except Exception as e:
            log.exception("Scraper failed for %s: %s", venue_name, e)
            found = []
        log.info("%-32s %d shows", venue_name, len(found))
        shows.extend(found)
    return shows


def group_by_comedian(shows: list[Show]) -> list[Comedian]:
    buckets: dict[str, Comedian] = {}
    for s in shows:
        key = s.comedian.strip().lower()
        if key not in buckets:
            buckets[key] = Comedian(name=s.comedian.strip(), shows=[])
        existing = {(x.venue, x.date.date()) for x in buckets[key].shows}
        if (s.venue, s.date.date()) not in existing:
            buckets[key].shows.append(s)
    comedians = list(buckets.values())
    comedians.sort(key=lambda c: min(s.date for s in c.shows))
    return comedians


def enrich(comedians: list[Comedian], *, clip_limit: int = 2) -> None:
    """Attach 2 vertical clips and a profile photo to each comedian."""
    for c in comedians:
        try:
            c.clips = find_clips(c.name, limit=clip_limit)
        except Exception as e:
            log.warning("clip lookup failed for %s: %s", c.name, e)
            c.clips = []
        try:
            c.photo = find_profile(c.name)
        except Exception as e:
            log.warning("photo lookup failed for %s: %s", c.name, e)
            c.photo = None
        log.info("%-32s %d clips · photo=%s", c.name, len(c.clips), bool(c.photo))


# Back-compat alias for the old function name.
enrich_with_clips = enrich
