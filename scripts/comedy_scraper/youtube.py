"""Find 2 short vertical stand-up clips per comedian, ranked by view count.

Uses YouTube Data API v3 if ``YOUTUBE_API_KEY`` is set, otherwise falls back
to scraping the YouTube search page. Either way we filter to ≤ 70s (which
almost exclusively selects Shorts / vertical clips) and sort by views.
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.parse
from typing import Iterable

from .http import fetch, session
from .models import VideoClip

log = logging.getLogger(__name__)

MAX_DURATION = 70           # seconds — keeps us in Shorts territory
MIN_DURATION = 15
CANDIDATE_POOL = 25         # how many candidates to inspect before ranking

API_SEARCH = "https://www.googleapis.com/youtube/v3/search"
API_VIDEOS = "https://www.googleapis.com/youtube/v3/videos"
# Search filter: sp=EgIYAQ%253D%253D restricts to videos under 4 minutes.
SEARCH_URL = "https://www.youtube.com/results?search_query={q}&sp=EgIYAQ%253D%253D"

DURATION_RE = re.compile(r"PT(?:(\d+)M)?(?:(\d+)S)?")


def find_clips(name: str, *, limit: int = 2) -> list[VideoClip]:
    api_key = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if api_key:
        try:
            clips = _via_api(name, api_key=api_key, limit=limit)
            if clips:
                return clips
        except Exception as e:
            log.warning("YT API search failed for %s: %s", name, e)
    try:
        return _via_scrape(name, limit=limit)
    except Exception as e:
        log.warning("YT scrape failed for %s: %s", name, e)
        return []


def _thumb(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


# --------------------------------------------------------------------------- #
# API path (cleanest, requires YOUTUBE_API_KEY)                               #
# --------------------------------------------------------------------------- #

def _via_api(name: str, *, api_key: str, limit: int) -> list[VideoClip]:
    s = session()
    ids: list[str] = []
    for query in (f"{name} stand up shorts", f"{name} comedy shorts", f"{name} stand up"):
        r = s.get(
            API_SEARCH,
            params={
                "key": api_key, "part": "snippet", "q": query, "type": "video",
                "videoDuration": "short", "order": "viewCount",
                "maxResults": CANDIDATE_POOL, "safeSearch": "moderate",
            },
            timeout=15,
        )
        if r.status_code != 200:
            continue
        ids.extend(item["id"]["videoId"] for item in r.json().get("items", []))
        if len(ids) >= CANDIDATE_POOL:
            break
    ids = list(dict.fromkeys(ids))[:CANDIDATE_POOL]
    if not ids:
        return []

    d = s.get(
        API_VIDEOS,
        params={"key": api_key, "part": "snippet,contentDetails,statistics", "id": ",".join(ids)},
        timeout=15,
    ).json()
    candidates: list[VideoClip] = []
    for item in d.get("items", []):
        dur = _parse_iso_duration(item["contentDetails"]["duration"])
        if not (MIN_DURATION <= dur <= MAX_DURATION):
            continue
        vid = item["id"]
        snippet = item["snippet"]
        views = int(item.get("statistics", {}).get("viewCount", 0) or 0)
        candidates.append(
            VideoClip(
                title=snippet["title"],
                video_id=vid,
                thumbnail=snippet["thumbnails"].get("high", {}).get("url", _thumb(vid)),
                views=views,
                duration=dur,
            )
        )
    candidates.sort(key=lambda c: c.views, reverse=True)
    return candidates[:limit]


def _parse_iso_duration(iso: str) -> int:
    m = DURATION_RE.fullmatch(iso)
    if not m:
        return 0
    return int(m.group(1) or 0) * 60 + int(m.group(2) or 0)


# --------------------------------------------------------------------------- #
# Scrape path (no key required)                                               #
# --------------------------------------------------------------------------- #

def _via_scrape(name: str, *, limit: int) -> list[VideoClip]:
    candidates: dict[str, VideoClip] = {}
    for query in (f"{name} stand up shorts", f"{name} stand up"):
        q = urllib.parse.quote_plus(query)
        html = fetch(SEARCH_URL.format(q=q))
        if not html:
            continue
        m = re.search(r"var ytInitialData = (\{.*?\});</script>", html) \
            or re.search(r"ytInitialData\s*=\s*(\{.*?\})\s*;", html)
        if not m:
            continue
        try:
            data = json.loads(m.group(1))
        except ValueError:
            continue
        for vid, title, dur, views in _iter_search_videos(data):
            if vid in candidates:
                continue
            if not (MIN_DURATION <= dur <= MAX_DURATION):
                continue
            candidates[vid] = VideoClip(
                title=title, video_id=vid, thumbnail=_thumb(vid),
                views=views, duration=dur,
            )
        if len(candidates) >= CANDIDATE_POOL:
            break
    ranked = sorted(candidates.values(), key=lambda c: c.views, reverse=True)
    return ranked[:limit]


def _iter_search_videos(data) -> Iterable[tuple[str, str, int, int]]:
    """Yield (videoId, title, duration_seconds, view_count) from ytInitialData."""
    stack = [data]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if "videoRenderer" in node:
                v = node["videoRenderer"]
                vid = v.get("videoId")
                title = _runs_text(v.get("title"))
                dur = _duration_seconds(v.get("lengthText"))
                views = _view_count(v.get("viewCountText"))
                if vid and title:
                    yield vid, title, dur, views
                continue
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)


def _runs_text(obj) -> str:
    if not obj:
        return ""
    if isinstance(obj, dict):
        if "simpleText" in obj:
            return obj["simpleText"]
        if "runs" in obj:
            return "".join(r.get("text", "") for r in obj["runs"])
    return ""


def _duration_seconds(obj) -> int:
    text = _runs_text(obj)
    if not text:
        return 0
    parts = text.split(":")
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return 0
    if len(nums) == 2:
        return nums[0] * 60 + nums[1]
    if len(nums) == 3:
        return nums[0] * 3600 + nums[1] * 60 + nums[2]
    return 0


_VIEW_RE = re.compile(r"([\d,.]+)\s*([KMB]?)")


def _view_count(obj) -> int:
    text = _runs_text(obj)
    if not text:
        return 0
    m = _VIEW_RE.search(text)
    if not m:
        return 0
    try:
        n = float(m.group(1).replace(",", ""))
    except ValueError:
        return 0
    suffix = m.group(2)
    if suffix == "K":
        n *= 1_000
    elif suffix == "M":
        n *= 1_000_000
    elif suffix == "B":
        n *= 1_000_000_000
    return int(n)
