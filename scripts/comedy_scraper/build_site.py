"""Render the comedian list into a static, oddly-satisfying HTML page."""
from __future__ import annotations

import html
import json
import urllib.parse
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .models import Comedian, Show

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def render(comedians: list[Comedian], *, out_dir: Path, now: datetime | None = None) -> Path:
    now = now or datetime.now()
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "data.json").write_text(
        json.dumps(
            {
                "generated_at": now.isoformat(),
                "month": MONTHS[now.month - 1],
                "year": now.year,
                "comedians": [c.to_dict() for c in comedians],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    index_path = out_dir / "index.html"
    index_path.write_text(_render_html(comedians, now=now), encoding="utf-8")
    return index_path


def _render_html(comedians: list[Comedian], *, now: datetime) -> str:
    grouped = _group_by_month(comedians)
    # Months to display: current through current+3 (rolling 4 months).
    months = _upcoming_months(now, count=4)

    sections = []
    running_idx = 0
    for year, month in months:
        bucket = grouped.get((year, month), [])
        if not bucket:
            continue
        cards = "\n".join(
            _card(c, running_idx + i, focus_month=(year, month))
            for i, c in enumerate(bucket)
        )
        running_idx += len(bucket)
        sections.append(
            f"""
<section class="month-section" id="{MONTHS[month - 1].lower()}-{year}">
  <header class="month-head">
    <h2 class="month-word">{MONTHS[month - 1]}</h2>
    <span class="month-year">{year}</span>
    <span class="month-count">{len(bucket)} comedian{'s' if len(bucket) != 1 else ''}</span>
  </header>
  <div class="grid">{cards}</div>
</section>"""
        )
    body = "\n".join(sections)

    total_shows = sum(len(c.shows) for c in comedians)
    venues = sorted({s.venue for c in comedians for s in c.shows})
    venue_pills = " ".join(
        f'<span class="pill">{html.escape(v)}</span>' for v in venues
    )
    month_nav = " · ".join(
        f'<a href="#{MONTHS[m - 1].lower()}-{y}">{MONTHS[m - 1]}</a>'
        for y, m in months if grouped.get((y, m))
    )
    empty_block = "" if comedians else _empty_state()
    hero_word = MONTHS[now.month - 1].upper()
    sub = _hero_sub(months, grouped)
    return _PAGE.format(
        hero_word=hero_word,
        hero_sub=sub,
        year=now.year,
        comedian_count=len(comedians),
        show_count=total_shows,
        venue_count=len(venues),
        venue_pills=venue_pills,
        month_nav=month_nav,
        sections=body,
        empty=empty_block,
        updated=now.strftime("%B %-d, %Y"),
    )


def _group_by_month(comedians: list[Comedian]) -> dict[tuple[int, int], list[Comedian]]:
    """Bucket a comedian under every (year, month) in which they perform."""
    buckets: dict[tuple[int, int], list[Comedian]] = defaultdict(list)
    seen: dict[tuple[int, int], set[str]] = defaultdict(set)
    for c in comedians:
        for s in c.shows:
            key = (s.date.year, s.date.month)
            if c.name in seen[key]:
                continue
            seen[key].add(c.name)
            buckets[key].append(c)
    # Sort each bucket by earliest show date in that month.
    for key, bucket in buckets.items():
        bucket.sort(key=lambda c: min(
            (s.date for s in c.shows if (s.date.year, s.date.month) == key),
            default=datetime.max,
        ))
    return buckets


def _upcoming_months(now: datetime, *, count: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    y, m = now.year, now.month
    for _ in range(count):
        out.append((y, m))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def _hero_sub(months: list[tuple[int, int]], grouped) -> str:
    populated = [MONTHS[m - 1] for y, m in months if grouped.get((y, m))]
    if not populated:
        return "a quiet month — check back soon"
    if len(populated) == 1:
        return f"stand-up in {populated[0]} · greater Boston"
    return f"stand-up through {populated[-1]} · greater Boston"


def _card(c: Comedian, idx: int, *, focus_month: tuple[int, int]) -> str:
    focus_shows = [s for s in c.shows if (s.date.year, s.date.month) == focus_month]
    shows = sorted(focus_shows or c.shows, key=lambda s: s.date)
    show_rows = "\n".join(_show_row(s) for s in shows)
    clips_block = _clips_block(c)
    avatar = _avatar(c)
    hue = (idx * 23) % 360
    return f"""
<article class="card" style="--i:{idx}; --hue:{hue}">
  <header class="card-head">
    {avatar}
    <div class="head-text">
      <h3 class="name">{html.escape(c.name)}</h3>
      <span class="badge">{len(shows)} show{'s' if len(shows) != 1 else ''}</span>
    </div>
  </header>
  <ul class="shows">{show_rows}</ul>
  {clips_block}
</article>
""".strip()


def _show_row(s: Show) -> str:
    time_txt = s.date.strftime("%-I:%M %p") if (s.date.hour or s.date.minute) else ""
    return (
        '<li class="show">'
        f'<a href="{html.escape(s.url)}" target="_blank" rel="noopener">'
        f'<span class="show-date">{html.escape(s.date.strftime("%a %b %-d"))}</span>'
        f'<span class="show-time">{html.escape(time_txt)}</span>'
        f'<span class="show-venue">{html.escape(s.venue)}</span>'
        f'<span class="show-city">{html.escape(s.venue_city)}</span>'
        "</a></li>"
    )


def _avatar(c: Comedian) -> str:
    if c.photo:
        return (
            f'<img class="avatar" src="{html.escape(c.photo)}" '
            f'loading="lazy" alt="{html.escape(c.name)}" referrerpolicy="no-referrer">'
        )
    initials = "".join(w[0] for w in c.name.split()[:2]).upper()
    return f'<span class="avatar avatar-fallback" aria-hidden="true">{html.escape(initials)}</span>'


def _clips_block(c: Comedian) -> str:
    if not c.clips:
        q = urllib.parse.quote_plus(f"{c.name} stand up")
        return (
            f'<a class="clips-fallback" href="https://www.youtube.com/results?search_query={q}" '
            f'target="_blank" rel="noopener">Watch clips on YouTube →</a>'
        )
    tiles = []
    for clip in c.clips[:2]:
        views = _format_views(clip.views) if clip.views else ""
        views_el = f'<span class="views">{views}</span>' if views else ""
        tiles.append(
            f'<a class="clip" href="{html.escape(clip.shorts_url)}" '
            f'target="_blank" rel="noopener" title="{html.escape(clip.title)}">'
            f'<img loading="lazy" src="{html.escape(clip.thumbnail)}" alt="" referrerpolicy="no-referrer">'
            f'<span class="play" aria-hidden="true">▶</span>'
            f'{views_el}'
            "</a>"
        )
    return f'<div class="clips">{"".join(tiles)}</div>'


def _format_views(n: int) -> str:
    if n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.1f}B"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def _empty_state() -> str:
    return (
        '<section class="empty">'
        "<p>The calendar's a little quiet right now. "
        "Check back after the 1st — the scraper wakes up monthly.</p>"
        "</section>"
    )


# --------------------------------------------------------------------------- #
# Page template                                                               #
# --------------------------------------------------------------------------- #

_PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{hero_word} in Boston — Comedy Calendar</title>
<meta name="description" content="Stand-up comedians announced for the Boston area — with profile photos and high-view vertical clips.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {{
  --bg:#08080c;
  --surface:#101017;
  --surface-2:#16161f;
  --border:rgba(255,255,255,0.07);
  --text:#f5f2ea;
  --muted:#9a97a4;
  --accent:#ffb347;
  --accent-2:#b27cff;
  --radius:14px;
  --shadow:0 8px 30px rgba(0,0,0,0.35);
}}

* {{ box-sizing:border-box; }}

html, body {{
  margin:0; padding:0;
  background:var(--bg); color:var(--text);
  font-family:'Inter', system-ui, -apple-system, sans-serif;
  font-size:16px; line-height:1.5;
  -webkit-font-smoothing:antialiased;
}}

body::before {{
  content:""; position:fixed; inset:-20%;
  background:
    radial-gradient(600px 400px at 15% 10%, rgba(255,179,71,0.15), transparent 60%),
    radial-gradient(500px 500px at 85% 30%, rgba(178,124,255,0.12), transparent 60%),
    radial-gradient(800px 500px at 50% 110%, rgba(255,140,90,0.08), transparent 70%);
  z-index:-1; pointer-events:none;
  animation:drift 28s ease-in-out infinite alternate;
}}
@keyframes drift {{
  0%   {{ transform:translate(0,0) scale(1); }}
  100% {{ transform:translate(-3%, 2%) scale(1.05); }}
}}

a {{ color:inherit; text-decoration:none; }}

.wrap {{ max-width:1180px; margin:0 auto; padding:56px 22px 96px; }}

header.hero {{
  display:flex; flex-direction:column; gap:16px;
  padding:28px 0 44px;
  border-bottom:1px solid var(--border);
}}
.eyebrow {{
  text-transform:uppercase; letter-spacing:0.22em;
  font-size:12px; color:var(--muted);
}}
h1.month {{
  font-family:'Fraunces', Georgia, serif; font-weight:700;
  font-size:clamp(72px, 14vw, 180px);
  line-height:0.9; margin:0; letter-spacing:-0.02em;
  background:linear-gradient(135deg, #fff 0%, var(--accent) 55%, var(--accent-2) 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent;
  animation:fade-up 900ms cubic-bezier(.2,.7,.1,1) both;
}}
.month-sub {{
  font-family:'Fraunces', serif; font-style:italic; font-weight:500;
  font-size:clamp(18px, 2.5vw, 24px);
  color:var(--muted); margin-top:-6px;
  animation:fade-up 900ms 120ms cubic-bezier(.2,.7,.1,1) both;
}}
.stats {{
  display:flex; flex-wrap:wrap; gap:28px; margin-top:8px;
  animation:fade-up 900ms 220ms cubic-bezier(.2,.7,.1,1) both;
}}
.stat b {{
  display:block; font-family:'Fraunces', serif;
  font-size:34px; font-weight:700; line-height:1; color:var(--text);
}}
.stat span {{
  font-size:13px; color:var(--muted); letter-spacing:0.08em; text-transform:uppercase;
}}
.month-nav {{
  display:flex; flex-wrap:wrap; gap:10px; margin-top:14px;
  font-size:13px; color:var(--muted);
  animation:fade-up 900ms 300ms cubic-bezier(.2,.7,.1,1) both;
}}
.month-nav a {{
  color:var(--text); border-bottom:1px dashed rgba(255,255,255,0.15);
  padding-bottom:1px;
}}
.month-nav a:hover {{ border-bottom-color:var(--accent); }}

.venues {{
  display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;
  animation:fade-up 900ms 340ms cubic-bezier(.2,.7,.1,1) both;
}}
.pill {{
  border:1px solid var(--border); border-radius:999px;
  padding:5px 11px; font-size:12px; color:var(--muted);
  background:rgba(255,255,255,0.015);
}}

.month-section {{ margin-top:56px; }}
.month-head {{
  display:flex; align-items:baseline; gap:16px; flex-wrap:wrap;
  padding-bottom:14px; margin-bottom:20px;
  border-bottom:1px solid var(--border);
}}
.month-word {{
  font-family:'Fraunces', serif; font-weight:700;
  font-size:clamp(36px, 6vw, 64px);
  margin:0; line-height:1; letter-spacing:-0.01em;
  color:var(--text);
}}
.month-year {{ color:var(--muted); font-size:18px; font-family:'Fraunces', serif; }}
.month-count {{
  margin-left:auto; font-size:12px; color:var(--muted);
  letter-spacing:0.08em; text-transform:uppercase;
}}

.grid {{
  display:grid; gap:22px;
  grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));
}}

.card {{
  background:linear-gradient(180deg, var(--surface), var(--surface-2));
  border:1px solid var(--border); border-radius:var(--radius);
  padding:20px 20px 18px;
  box-shadow:var(--shadow);
  position:relative; overflow:hidden;
  transition:transform 340ms cubic-bezier(.2,.7,.1,1), border-color 340ms ease;
  animation:fade-up 700ms cubic-bezier(.2,.7,.1,1) both;
  animation-delay:calc(var(--i,0) * 35ms + 180ms);
  display:flex; flex-direction:column;
}}
.card::before {{
  content:""; position:absolute; inset:-1px; z-index:0;
  background:linear-gradient(135deg,
    hsla(var(--hue,30), 90%, 65%, 0.22), transparent 40%);
  opacity:0; transition:opacity 380ms ease; pointer-events:none;
}}
.card:hover {{ transform:translateY(-3px); border-color:rgba(255,255,255,0.14); }}
.card:hover::before {{ opacity:1; }}
.card > * {{ position:relative; z-index:1; }}

.card-head {{
  display:flex; align-items:center; gap:14px; margin-bottom:14px;
}}
.avatar {{
  width:56px; height:56px; border-radius:50%;
  object-fit:cover; flex:none;
  background:#1a1a24;
  border:1px solid rgba(255,255,255,0.08);
}}
.avatar-fallback {{
  display:flex; align-items:center; justify-content:center;
  font-family:'Fraunces', serif; font-weight:700; font-size:20px;
  color:var(--accent);
  background:radial-gradient(circle at 30% 30%, rgba(255,179,71,0.15), rgba(178,124,255,0.08));
}}
.head-text {{
  display:flex; flex-direction:column; gap:4px;
  min-width:0; flex:1;
}}
.name {{
  margin:0; font-family:'Fraunces', serif; font-weight:700;
  font-size:22px; letter-spacing:-0.01em; line-height:1.15;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}}
.badge {{
  font-size:11px; letter-spacing:0.1em; text-transform:uppercase;
  color:var(--muted);
  align-self:flex-start;
}}

ul.shows {{
  list-style:none; padding:0; margin:0 0 14px;
  display:flex; flex-direction:column; gap:4px;
}}
.shows a {{
  display:grid; grid-template-columns:92px 1fr auto;
  grid-template-areas:"date venue city" "date time city";
  column-gap:12px; row-gap:2px;
  padding:9px 11px; border-radius:10px;
  color:var(--text);
  background:rgba(255,255,255,0.02);
  transition:background 200ms ease;
  font-size:14px;
}}
.shows a:hover {{ background:rgba(255,179,71,0.08); }}
.show-date {{ grid-area:date; font-variant-numeric:tabular-nums; color:var(--accent); font-weight:600; }}
.show-time {{ grid-area:time; font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; }}
.show-venue {{ grid-area:venue; font-weight:500; }}
.show-city {{ grid-area:city; color:var(--muted); font-size:12px; align-self:start; }}

.clips {{
  display:grid; grid-template-columns:1fr 1fr; gap:8px;
  margin-top:auto;
}}
.clip {{
  position:relative; display:block; aspect-ratio:9/16;
  border-radius:10px; overflow:hidden; background:#000;
  transition:transform 260ms ease;
}}
.clip img {{
  width:100%; height:100%; object-fit:cover;
  transition:transform 400ms ease, filter 260ms ease;
  filter:saturate(0.9) brightness(0.82);
}}
.clip:hover img {{ transform:scale(1.05); filter:saturate(1) brightness(1); }}
.clip .play {{
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:28px;
  text-shadow:0 2px 14px rgba(0,0,0,0.7);
  opacity:0.82; transition:opacity 200ms ease;
}}
.clip:hover .play {{ opacity:1; }}
.clip .views {{
  position:absolute; left:8px; bottom:8px;
  font-size:11px; font-weight:600; letter-spacing:0.03em;
  color:#fff; background:rgba(0,0,0,0.55);
  padding:2px 7px; border-radius:999px;
  backdrop-filter:blur(6px);
}}

.clips-fallback {{
  display:inline-block; margin-top:4px;
  color:var(--accent);
  font-size:13px; border-bottom:1px dashed rgba(255,179,71,0.4);
  padding-bottom:1px;
}}
.clips-fallback:hover {{ border-bottom-style:solid; }}

.empty {{
  margin-top:48px; padding:32px;
  border:1px dashed var(--border); border-radius:var(--radius);
  color:var(--muted); text-align:center;
  font-family:'Fraunces', serif; font-style:italic;
}}

footer.site-foot {{
  margin-top:72px; padding-top:24px;
  border-top:1px solid var(--border);
  color:var(--muted); font-size:12px;
  display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between;
}}
footer a {{ color:var(--muted); }}

@keyframes fade-up {{
  from {{ opacity:0; transform:translateY(14px); }}
  to   {{ opacity:1; transform:translateY(0); }}
}}

@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{ animation:none !important; transition:none !important; }}
}}

@media (max-width: 520px) {{
  .wrap {{ padding:32px 16px 64px; }}
  .shows a {{ grid-template-columns:80px 1fr; grid-template-areas:"date venue" "date city"; }}
  .show-time {{ display:none; }}
  .avatar {{ width:48px; height:48px; }}
}}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <span class="eyebrow">amysterling · boston comedy</span>
    <h1 class="month">{hero_word}</h1>
    <p class="month-sub">{hero_sub} — {year}</p>
    <div class="stats">
      <div class="stat"><b>{comedian_count}</b><span>comedians</span></div>
      <div class="stat"><b>{show_count}</b><span>shows</span></div>
      <div class="stat"><b>{venue_count}</b><span>venues</span></div>
    </div>
    <nav class="month-nav">{month_nav}</nav>
    <div class="venues">{venue_pills}</div>
  </header>

  {empty}

  {sections}

  <footer class="site-foot">
    <span>Updated {updated}. Refreshed monthly.</span>
    <span><a href="/">amysterling.org</a></span>
  </footer>
</div>
</body>
</html>
"""
