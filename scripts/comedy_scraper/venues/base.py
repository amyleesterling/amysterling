from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Iterable, Optional

from bs4 import BeautifulSoup
from dateutil import parser as dateparser

from ..models import Show

log = logging.getLogger(__name__)

COMEDY_KEYWORDS = re.compile(
    r"\b(comedy|comedian|stand[- ]?up|live\s+at\s+the|laughs?|comic)\b", re.I
)

NAME_STOPWORDS = {
    "presents", "live", "with", "and", "feat", "featuring", "the", "a", "an",
    "tour", "show", "comedy", "night", "at", "residency", "special",
}


def looks_like_comedy(text: str) -> bool:
    return bool(COMEDY_KEYWORDS.search(text or ""))


def clean_name(raw: str) -> Optional[str]:
    """Extract a plausible comedian name from an event title.

    Handles patterns like:
      - "Nate Bargatze: The Big Dumb Tour"
      - "John Mulaney Live"
      - "An Evening with Mike Birbiglia"
      - "Comedy Night featuring Tig Notaro"
    """
    if not raw:
        return None
    s = raw.strip()
    # Split on colon/dash/pipe — name usually comes first.
    for sep in [":", " - ", " – ", " — ", " | ", " presents "]:
        if sep in s.lower():
            s = re.split(re.escape(sep), s, maxsplit=1, flags=re.I)[0]
            break
    # "An Evening with X" / "Comedy Night with X" → keep X
    m = re.search(r"(?:evening|night|special)s?\s+with\s+(.+)$", s, re.I)
    if m:
        s = m.group(1)
    m = re.search(r"\bfeat(?:\.|uring)?\s+(.+)$", s, re.I)
    if m:
        s = m.group(1)
    # Trim trailing tour/show words.
    s = re.sub(r"\s*\b(live|tour|residency|special|standup|stand[- ]up)\b.*$", "", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip(" -–—:|")
    if not s:
        return None
    # Must look like a person name: at least two words, mostly alphabetic.
    words = [w for w in s.split() if w]
    if len(words) < 2:
        return None
    alpha_ratio = sum(c.isalpha() or c.isspace() or c in "-.'’" for c in s) / max(len(s), 1)
    if alpha_ratio < 0.8:
        return None
    if any(w.lower() in {"tickets", "tba", "sold", "cancelled"} for w in words):
        return None
    return s


def parse_date(text: str, *, default_year: Optional[int] = None) -> Optional[datetime]:
    if not text:
        return None
    text = text.strip()
    try:
        d = dateparser.parse(
            text,
            fuzzy=True,
            default=datetime(default_year or datetime.now().year, 1, 1),
        )
        # Guard against weird far-past parses.
        if d.year < datetime.now().year - 1:
            d = d.replace(year=datetime.now().year)
        return d
    except (ValueError, OverflowError):
        return None


def within_window(d: datetime, *, days: int = 110) -> bool:
    """Default window is ~3.5 months — covers the current month plus the
    next three, matching the site's rolling three-month view."""
    now = datetime.now()
    return now - timedelta(days=1) <= d <= now + timedelta(days=days)


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


__all__ = [
    "Show",
    "BeautifulSoup",
    "clean_name",
    "looks_like_comedy",
    "parse_date",
    "soup",
    "within_window",
]
