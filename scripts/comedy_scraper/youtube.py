"""Find 2–3 short YouTube stand-up clips for a given comedian.

Uses YouTube Data API v3 if ``YOUTUBE_API_KEY`` is set, with a search-page
scrape fallback that needs no credentials.
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

SEARCH_URL = "https://www.youtube.com/results?search_query={q}&sp=EgIYAQ%253D%253D"
# sp=EgIYAQ%3D%3D filters to videos under 4 minutes.

API_SEARCH = "https://www.googleapis.com/youtube/v3/search"
API_VIDEOS = "https://www.googleapis.com/youtube/v3/videos"

DURATION_RE = re.compile(r"PT(?:(\d+)M)?(?:(\d+)S)?")


def find_clips(name: str, *, limit: int = 3) -> list[VideoClip]:
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


def _via_api(name: str, *, api_key: str, limit: int) -> list[VideoClip]:
    s = session()
    params = {
        "key": api_key,
        "part": "snippet",
        "q": f"{name} stand up",
        "type": "video",
        "videoDuration": "short",   # < 4 min
        "maxResults": 10,
        "safeSearch": "moderate",
    }
    r = s.get(API_SEARCH, params=params, timeout=15)
    if r.status_code != 200:
        raise RuntimeError(f"search {r.status_code}: {r.text[:200]}")
    ids = [item["id"]["videoId"] for item in r.json().get("items", [])]
    if not ids:
        return []
    d = s.get(
        API_VIDEOS,
        params={"key": api_key, "part": "snippet,contentDetails", "id": ",".join(ids)},
        timeout=15,
    ).json()
    out: list[VideoClip] = []
    for item in d.get("items", []):
        dur = _parse_iso_duration(item["contentDetails"]["duration"])
        if not (60 <= dur <= 240):   # 1–4 min
            continue
        vid = item["id"]
        snippet = item["snippet"]
        out.append(
            VideoClip(
                title=snippet["title"],
                video_id=vid,
                thumbnail=snippet["thumbnails"].get("high", {}).get("url", _thumb(vid)),
            )
        )
        if len(out) >= limit:
            break
    return out


def _parse_iso_duration(iso: str) -> int:
    m = DURATION_RE.fullmatch(iso)
    if not m:
        return 0
    mm = int(m.group(1) or 0)
    ss = int(m.group(2) or 0)
    return mm * 60 + ss


def _via_scrape(name: str, *, limit: int) -> list[VideoClip]:
    q = urllib.parse.quote_plus(f"{name} stand up")
    html = fetch(SEARCH_URL.format(q=q))
    if not html:
        return []
    # Pull ytInitialData out of the page and walk the search result list.
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html)
    if not m:
        m = re.search(r"ytInitialData\s*=\s*(\{.*?\})\s*;", html)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except ValueError:
        return []
    clips: list[VideoClip] = []
    seen: set[str] = set()
    for vid, title, dur_s in _iter_search_videos(data):
        if vid in seen:
            continue
        if not (45 <= dur_s <= 240):
            continue
        seen.add(vid)
        clips.append(VideoClip(title=title, video_id=vid, thumbnail=_thumb(vid)))
        if len(clips) >= limit:
            break
    return clips


def _iter_search_videos(data) -> Iterable[tuple[str, str, int]]:
    """Yield (videoId, title, duration_seconds) from ytInitialData."""
    stack = [data]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if "videoRenderer" in node:
                v = node["videoRenderer"]
                vid = v.get("videoId")
                title = _runs_text(v.get("title"))
                dur = _duration_seconds(v.get("lengthText"))
                if vid and title:
                    yield vid, title, dur
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
