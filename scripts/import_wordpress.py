"""Import Ames's old blog, amyrobinson.wordpress.com (2008 to 2016), into blog/.

Run once: `python scripts/import_wordpress.py`. Re-running rebuilds the same files.

What it does
  * Reads every post from the public WordPress.com REST API.
  * Writes blog/<year>/<slug>.html per post, the words exactly as written.
  * Copies images Ames uploaded to that blog (her media library) into
    media/blog/<year>/, as webp at most 1400 px wide (animated GIFs become animated webp).
    Images the old posts showed from other websites (through WordPress's i0.wp.com
    proxy, or Quora) stay linked to their sources, as they were on WordPress.
  * Keeps YouTube, Vimeo, TED, SlideShare and SoundCloud embeds; drops scripts and
    WordPress wrapper markup.
  * Points links between old posts at the new copies.
  * Writes data/blog-posts.json, which blog/index.html is built from.
"""
import datetime as dt
import hashlib
import html
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

import bleach
from PIL import Image

SITE = "amyrobinson.wordpress.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = f"https://public-api.wordpress.com/rest/v1.1/sites/{SITE}/posts"
EMBED_HOSTS = {"www.youtube.com", "youtube.com", "player.vimeo.com", "embed.ted.com",
               "www.slideshare.net", "w.soundcloud.com"}
OWN_MEDIA = re.compile(r"^https?://(amyrobinson\.wordpress\.com/wp-content/uploads|amyrobinson\.files\.wordpress\.com)/", re.I)
UA = {"User-Agent": "amysterling.org blog import (amysterling@princeton.edu)"}


def get(url, raw=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read() if raw else json.load(r)


def fetch_posts():
    posts, page = [], 1
    while True:
        d = get(f"{API}?number=100&page={page}&order_by=date&order=ASC"
                "&fields=ID,title,date,URL,slug,content,excerpt")
        posts += d["posts"]
        if len(posts) >= d["found"] or not d["posts"]:
            return posts
        page += 1


def copy_image(src, year):
    """Download one of Ames's own uploads and return its local path from the site root."""
    clean = src.split("?")[0]
    name = os.path.basename(urllib.parse.unquote(clean))
    stem, ext = os.path.splitext(name)
    stem = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")[:60] or "image"
    tag = hashlib.sha1(clean.encode()).hexdigest()[:6]
    folder = os.path.join(ROOT, "media", "blog", year)
    os.makedirs(folder, exist_ok=True)
    data = get(clean, raw=True)
    im = Image.open(io.BytesIO(data))
    if getattr(im, "is_animated", False):
        # animated WebP keeps the motion at a fraction of the GIF's weight
        out = f"{stem}-{tag}.webp"
        frames, durations = [], []
        for f in range(im.n_frames):
            im.seek(f)
            fr = im.convert("RGBA")
            fr.thumbnail((900, 900), Image.LANCZOS)
            frames.append(fr)
            durations.append(im.info.get("duration", 80) or 80)
        frames[0].save(os.path.join(folder, out), "WEBP", save_all=True, append_images=frames[1:],
                       duration=durations, loop=0, quality=72, method=4)
    else:
        out = f"{stem}-{tag}.webp"
        if im.mode in ("P", "LA"):
            im = im.convert("RGBA")
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im.thumbnail((1400, 1400), Image.LANCZOS)
        im.save(os.path.join(folder, out), "WEBP", quality=82, method=6)
    return f"media/blog/{year}/{out}"


def https(u):
    return re.sub(r"^http://", "https://", u.strip()) if u else u


def clean_html(content, year, links, media_map, stats):
    c = content
    # WordPress wraps videos in divs and adds scripts and sharing junk
    c = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", "", c, flags=re.I)
    c = re.sub(r"<div[^>]*class=\"[^\"]*(sharedaddy|jp-relatedposts|wpcnt|wordads)[^\"]*\"[\s\S]*?</div>\s*</div>", "", c, flags=re.I)
    c = re.sub(r"<h1(\s|>)", r"<h2\1", c, flags=re.I).replace("</h1>", "</h2>")
    c = re.sub(r"<h5(\s|>)", r"<h4\1", c, flags=re.I).replace("</h5>", "</h4>")

    def img(m):
        tag = m.group(0)
        src = https(html.unescape((re.search(r'src="([^"]+)"', tag) or [None, ""])[1]))
        alt = html.unescape((re.search(r'alt="([^"]*)"', tag) or [None, ""])[1])
        if OWN_MEDIA.match(src):
            key = src.split("?")[0]
            if key not in media_map:
                try:
                    media_map[key] = copy_image(src, year)
                    stats["copied"] += 1
                except Exception as e:
                    print("  image failed, kept remote:", key, e, file=sys.stderr)
                    media_map[key] = None
            if media_map[key]:
                return f'<img src="../../{media_map[key]}" alt="{html.escape(alt)}" loading="lazy">'
        stats["remote"] += 1
        return f'<img src="{html.escape(src)}" alt="{html.escape(alt)}" loading="lazy">'
    c = re.sub(r"<img\b[^>]*>", img, c, flags=re.I)

    def iframe(m):
        tag = m.group(0)
        src = https(html.unescape((re.search(r'src=[\'"]([^\'"]+)', tag) or [None, ""])[1]))
        host = urllib.parse.urlparse(src).netloc.lower()
        if host not in EMBED_HOSTS:
            return ""
        stats["embeds"] += 1
        return f'<span class="embed"><iframe src="{html.escape(src)}" loading="lazy" allowfullscreen allow="autoplay; encrypted-media; fullscreen; picture-in-picture" title="Embedded video"></iframe></span>'
    c = re.sub(r"<iframe\b[\s\S]*?</iframe>|<iframe\b[^>]*/?>", iframe, c, flags=re.I)

    c = bleach.clean(
        c,
        tags={"p", "a", "img", "br", "em", "strong", "i", "b", "h2", "h3", "h4", "blockquote",
              "ul", "ol", "li", "sup", "figure", "figcaption", "iframe", "span"},
        attributes={"a": ["href", "title"], "img": ["src", "alt", "loading"],
                    "iframe": ["src", "loading", "allowfullscreen", "allow", "title"], "span": ["class"]},
        protocols={"http", "https", "mailto"},
        strip=True,
    )

    # WordPress wraps each photo in a link to its "attachment page"; link the photo itself instead,
    # and drop any other attachment link, keeping its words
    attach = r'https?://amyrobinson\.wordpress\.com/20\d\d/\d\d/\d\d/[^/"]+/[^/"]+/?'
    c = re.sub(r'<a href="' + attach + r'"[^>]*>\s*(<img src="([^"]+)"[^>]*>)\s*</a>', r'<a href="\2">\1</a>', c)
    c = re.sub(r'<a href="' + attach + r'"[^>]*>([\s\S]*?)</a>', r'\1', c)

    def link(m):
        href = html.unescape(m.group(1))
        h = href.split("#")[0].rstrip("/")
        key = re.sub(r"^https?://", "", h)
        if key in links:
            return f'href="../../{links[key]}"'
        if OWN_MEDIA.match(href):
            key = href.split("?")[0]
            if key not in media_map:
                # a file she linked rather than showed (slides as PDF, a full size photo): keep a copy
                try:
                    name = re.sub(r"[^a-zA-Z0-9.]+", "-", os.path.basename(urllib.parse.unquote(key))).lower()
                    folder = os.path.join(ROOT, "media", "blog", "files")
                    os.makedirs(folder, exist_ok=True)
                    open(os.path.join(folder, name), "wb").write(get(key, raw=True))
                    media_map[key] = f"media/blog/files/{name}"
                    stats["files"] = stats.get("files", 0) + 1
                except Exception as e:
                    print("  file failed, kept remote:", key, e, file=sys.stderr)
                    media_map[key] = None
            if media_map[key]:
                return f'href="../../{media_map[key]}"'
        return f'href="{html.escape(https(href))}"'
    c = re.sub(r'href="([^"]+)"', link, c)
    c = re.sub(r'<a href="([^"]+)"', r'<a href="\1" rel="noopener"', c)
    c = re.sub(r"(<p>\s*(&nbsp;)?\s*</p>\s*)+", "", c)
    return c.strip()


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title_txt} · Amy Sterling</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://amysterling.org/blog/{path}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='6' fill='%237cc4ff'/%3E%3Cpath d='M16 10V2M16 22v8M10 16H2M22 16h8M11.5 11.5 6 6M20.5 20.5 26 26' stroke='%237cc4ff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../../assets/site.css">
</head>
<body>
<header class="top">
  <a class="mark" href="../../" aria-label="Amy Sterling, home"><span class="dot" aria-hidden="true"></span>Amy Sterling</a>
  <nav aria-label="Sections">
    <a href="../../#brains">Brains</a>
    <a href="../../#play">Play</a>
    <a href="../../#kids">Kids</a>
    <a href="../../#gallery">Art</a>
    <a href="../../#papers">Papers</a>
    <a class="on" href="../">Blog</a>
    <a href="../../#about">About</a>
  </nav>
</header>

<main class="block blog">
  <article class="post">
    <p class="eyebrow"><a href="../">Blog</a> · {date_long}</p>
    <h1 class="blog-title">{title_html}</h1>
    <div class="post-html">
{body}
    </div>
    <p class="fine post-origin">First published on my old blog, <a href="{url}">{site}</a>, {date_long}.</p>
    <nav class="post-nav" aria-label="More posts">{prev}{next}</nav>
  </article>
</main>

<footer class="foot">
  <p>Thank you for being here. ♡</p>
  <p class="fine"><a href="../../">amysterling.org</a></p>
</footer>
</body>
</html>
"""


def main():
    posts = fetch_posts()
    print(len(posts), "posts", file=sys.stderr)
    for p in posts:
        p["year"] = p["date"][:4]
        p["slug"] = p["slug"] or f"post-{p['ID']}"
        p["path"] = f"{p['year']}/{p['slug']}.html"
    links = {re.sub(r"^https?://", "", p["URL"].rstrip("/")): f"blog/{p['path']}" for p in posts}
    media_map, stats = {}, {"copied": 0, "remote": 0, "embeds": 0}
    index = []
    for i, p in enumerate(posts):
        body = clean_html(p["content"], p["year"], links, media_map, stats)
        title = html.unescape(p["title"]).strip()
        date = dt.datetime.fromisoformat(p["date"])
        date_long = f"{date:%B} {date.day}, {date.year}"
        shown = title or f"Untitled, {date_long}"
        text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body))).strip()
        words = len(text.split())
        dek = " ".join(text.split()[:28]) + ("…" if words > 28 else "")
        prev = posts[i - 1] if i else None
        nxt = posts[i + 1] if i + 1 < len(posts) else None
        nav = lambda q, label: (f'<a href="../{q["path"]}">{label} {html.escape(html.unescape(q["title"]).strip() or "Untitled")}</a>' if q else "<span></span>")
        page = PAGE.format(
            title_txt=html.escape(shown), title_html=html.escape(shown), desc=html.escape(dek),
            path=p["path"], date_long=date_long, body=body, url=html.escape(p["URL"]), site=SITE,
            prev=nav(prev, "← "), next=nav(nxt, "→"))
        out = os.path.join(ROOT, "blog", p["path"])
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(page)
        first_img = re.search(r'<img src="\.\./\.\./(media/blog/[^"]+)"', body)
        index.append({"title": shown, "date": p["date"][:10], "path": f"blog/{p['path']}", "words": words,
                      "dek": dek, "image": first_img.group(1) if first_img else None, "original": p["URL"]})
        print(f"{p['date'][:10]} {shown[:60]}", file=sys.stderr)
    json.dump({"source": f"https://{SITE}", "imported": dt.date.today().isoformat(), "posts": index},
              open(os.path.join(ROOT, "data", "blog-posts.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(stats, file=sys.stderr)


if __name__ == "__main__":
    main()
