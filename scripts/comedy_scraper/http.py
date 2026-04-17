from __future__ import annotations

import logging
import time
from typing import Optional

import requests

log = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36 amysterling-comedy-scraper/1.0"
)


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return s


def fetch(url: str, *, retries: int = 2, timeout: int = 20) -> Optional[str]:
    """Fetch a URL with retries. Returns body text or None on failure."""
    s = session()
    for attempt in range(retries + 1):
        try:
            r = s.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            log.warning("GET %s -> %s", url, r.status_code)
        except requests.RequestException as e:
            log.warning("GET %s failed (attempt %d): %s", url, attempt + 1, e)
        time.sleep(1.5 * (attempt + 1))
    return None
