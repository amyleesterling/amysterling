"""Wikipedia-backed profile photo lookup.

Uses the REST summary API (no key, no auth). Returns a ~320px thumbnail URL
on hit; `None` on miss or on pages that clearly aren't about a performer.
"""
from __future__ import annotations

import logging
import urllib.parse
from typing import Optional

from .http import session

log = logging.getLogger(__name__)

SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"

# Descriptions we'll reject to avoid photo collisions with non-performers.
DISQUALIFIERS = (
    "politician", "footballer", "basketball player", "baseball player",
    "physicist", "economist", "mathematician", "governor",
)


def find_profile(name: str) -> Optional[str]:
    title = urllib.parse.quote(name.replace(" ", "_"))
    try:
        r = session().get(SUMMARY.format(title=title), timeout=15)
    except Exception as e:
        log.warning("profile fetch failed for %s: %s", name, e)
        return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except ValueError:
        return None
    desc = (data.get("description") or "").lower()
    if any(d in desc for d in DISQUALIFIERS):
        return None
    thumb = (data.get("thumbnail") or {}).get("source")
    return thumb or None
