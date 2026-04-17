"""Render the comedian list into a static, oddly-satisfying HTML page."""
from __future__ import annotations

import html
import json
from datetime import datetime
from pathlib import Path
from typing import Iterable

from .models import Comedian

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def render(comedians: list[Comedian], *, out_dir: Path, now: datetime | None = None) -> Path:
    now = now or datetime.now()
    out_dir.mkdir(parents=True, exist_ok=True)

    data_path = out_dir / "data.json"
    data_path.write_text(
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
    cards = "\n".join(_card(c, i) for i, c in enumerate(comedians))
    total_shows = sum(len(c.shows) for c in comedians)
    venues = sorted({s.venue for c in comedians for s in c.shows})
    venue_pills = " ".join(
        f'<span class="pill">{html.escape(v)}</span>' for v in venues
    )
    empty_block = "" if comedians else _empty_state()
    month_word = MONTHS[now.month - 1].upper()
    return _PAGE.format(
        month=month_word,
        year=now.year,
        comedian_count=len(comedians),
        show_count=total_shows,
        venue_pills=venue_pills,
        cards=cards,
        empty=empty_block,
        updated=now.strftime("%B %-d, %Y"),
    )


def _card(c: Comedian, idx: int) -> str:
    shows = sorted(c.shows, key=lambda s: s.date)
    show_rows = "\n".join(
        (
            '<li class="show">'
            f'<a href="{html.escape(s.url)}" target="_blank" rel="noopener">'
            f'<span class="show-date">{html.escape(s.date.strftime("%a %b %-d"))}</span>'
            f'<span class="show-time">{html.escape(s.date.strftime("%-I:%M %p")) if s.date.hour or s.date.minute else ""}</span>'
            f'<span class="show-venue">{html.escape(s.venue)}</span>'
            f'<span class="show-city">{html.escape(s.venue_city)}</span>'
            "</a></li>"
        )
        for s in shows
    )
    clips_block = _clips_block(c)
    # Subtle per-card hue rotation keeps the grid alive without being loud.
    hue = (idx * 23) % 360
    return f"""
<article class="card" style="--i:{idx}; --hue:{hue}">
  <header class="card-head">
    <h2 class="name">{html.escape(c.name)}</h2>
    <span class="badge">{len(c.shows)} show{"" if len(c.shows) == 1 else "s"}</span>
  </header>
  <ul class="shows">{show_rows}</ul>
  {clips_block}
</article>
""".strip()


def _clips_block(c: Comedian) -> str:
    if not c.clips:
        # Graceful fallback: link to YouTube search.
        import urllib.parse
        q = urllib.parse.quote_plus(f"{c.name} stand up")
        return (
            f'<a class="clips-fallback" href="https://www.youtube.com/results?search_query={q}" '
            f'target="_blank" rel="noopener">Watch clips on YouTube →</a>'
        )
    tiles = []
    for clip in c.clips[:3]:
        tiles.append(
            f'<a class="clip" href="{html.escape(clip.watch_url)}" target="_blank" rel="noopener" '
            f'title="{html.escape(clip.title)}">'
            f'<img loading="lazy" src="{html.escape(clip.thumbnail)}" alt="">'
            f'<span class="play" aria-hidden="true">▶</span>'
            "</a>"
        )
    return f'<div class="clips">{"".join(tiles)}</div>'


def _empty_state() -> str:
    return (
        '<section class="empty">'
        '<p>The calendar\'s a little quiet right now. '
        'Check back after the 1st — the scraper wakes up monthly.</p>'
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
<title>{month} in Boston — Comedy Calendar</title>
<meta name="description" content="Stand-up comedians announced for the Boston area this month, with video clips.">
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

.wrap {{ max-width:1180px; margin:0 auto; padding:64px 28px 96px; }}

header.hero {{
  display:flex; flex-direction:column; gap:20px;
  padding:40px 0 56px;
  border-bottom:1px solid var(--border);
}}

.eyebrow {{
  font-family:'Inter', sans-serif;
  text-transform:uppercase; letter-spacing:0.22em;
  font-size:12px; color:var(--muted);
}}

h1.month {{
  font-family:'Fraunces', Georgia, serif;
  font-weight:700;
  font-size:clamp(72px, 14vw, 180px);
  line-height:0.9; margin:0;
  letter-spacing:-0.02em;
  background:linear-gradient(135deg, #fff 0%, var(--accent) 55%, var(--accent-2) 100%);
  -webkit-background-clip:text; background-clip:text;
  color:transparent;
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
  font-size:34px; font-weight:700; line-height:1;
  color:var(--text);
}}
.stat span {{ font-size:13px; color:var(--muted); letter-spacing:0.08em; text-transform:uppercase; }}

.venues {{
  display:flex; flex-wrap:wrap; gap:8px; margin-top:24px;
  animation:fade-up 900ms 320ms cubic-bezier(.2,.7,.1,1) both;
}}
.pill {{
  border:1px solid var(--border); border-radius:999px;
  padding:6px 12px; font-size:12px; color:var(--muted);
  background:rgba(255,255,255,0.015);
}}

.grid {{
  display:grid; gap:22px;
  grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));
  margin-top:56px;
}}

.card {{
  background:linear-gradient(180deg, var(--surface), var(--surface-2));
  border:1px solid var(--border); border-radius:var(--radius);
  padding:22px 22px 20px;
  box-shadow:var(--shadow);
  position:relative; overflow:hidden;
  transition:transform 340ms cubic-bezier(.2,.7,.1,1), border-color 340ms ease;
  animation:fade-up 700ms cubic-bezier(.2,.7,.1,1) both;
  animation-delay:calc(var(--i,0) * 40ms + 200ms);
}}

.card::before {{
  content:""; position:absolute; inset:-1px; z-index:0;
  background:linear-gradient(135deg,
    hsla(var(--hue,30), 90%, 65%, 0.22),
    transparent 40%);
  opacity:0; transition:opacity 380ms ease;
  pointer-events:none;
}}
.card:hover {{ transform:translateY(-3px); border-color:rgba(255,255,255,0.14); }}
.card:hover::before {{ opacity:1; }}
.card > * {{ position:relative; z-index:1; }}

.card-head {{
  display:flex; align-items:baseline; justify-content:space-between; gap:12px;
  margin-bottom:14px;
}}

.name {{
  margin:0; font-family:'Fraunces', serif; font-weight:700;
  font-size:24px; letter-spacing:-0.01em; line-height:1.15;
}}

.badge {{
  font-size:11px; letter-spacing:0.1em; text-transform:uppercase;
  color:var(--muted); border:1px solid var(--border);
  border-radius:999px; padding:4px 10px; white-space:nowrap;
  background:rgba(255,255,255,0.02);
}}

ul.shows {{
  list-style:none; padding:0; margin:0 0 16px;
  display:flex; flex-direction:column; gap:4px;
}}
.shows a {{
  display:grid; grid-template-columns:92px 1fr auto;
  grid-template-areas:"date venue city" "date time city";
  column-gap:12px; row-gap:2px;
  padding:10px 12px; border-radius:10px;
  color:var(--text); text-decoration:none;
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
  display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;
  margin-top:auto;
}}
.clip {{
  position:relative; display:block; aspect-ratio:16/9;
  border-radius:8px; overflow:hidden;
  background:#000;
  transition:transform 260ms ease;
}}
.clip img {{
  width:100%; height:100%; object-fit:cover;
  transition:transform 400ms ease, filter 260ms ease;
  filter:saturate(0.9) brightness(0.85);
}}
.clip:hover img {{ transform:scale(1.06); filter:saturate(1) brightness(1); }}
.clip .play {{
  position:absolute; inset:0; display:flex;
  align-items:center; justify-content:center;
  color:#fff; font-size:22px;
  text-shadow:0 2px 10px rgba(0,0,0,0.6);
  opacity:0.85; transition:opacity 200ms ease;
}}
.clip:hover .play {{ opacity:1; }}

.clips-fallback {{
  display:inline-block; margin-top:4px;
  color:var(--accent); text-decoration:none;
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
  .wrap {{ padding:32px 18px 64px; }}
  .shows a {{ grid-template-columns:80px 1fr; grid-template-areas:"date venue" "date city"; }}
  .show-time {{ display:none; }}
}}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <span class="eyebrow">amysterling · boston comedy</span>
    <h1 class="month">{month}</h1>
    <p class="month-sub">stand-up announced for greater Boston — {year}</p>
    <div class="stats">
      <div class="stat"><b>{comedian_count}</b><span>comedians</span></div>
      <div class="stat"><b>{show_count}</b><span>shows</span></div>
    </div>
    <div class="venues">{venue_pills}</div>
  </header>

  {empty}

  <section class="grid">
{cards}
  </section>

  <footer class="site-foot">
    <span>Updated {updated}. Refreshed monthly.</span>
    <span><a href="/">amysterling.org</a></span>
  </footer>
</div>
</body>
</html>
"""
