"""Rebuild the archive list in blog/index.html from data/blog-posts.json.

The list sits between <!-- ARCHIVE --> and <!-- /ARCHIVE --> in blog/index.html;
everything else on that page is written by hand. Posts of 500 words or more get a
short excerpt; the rest are one line each.
"""
import datetime as dt
import html
import json
import os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, "data", "blog-posts.json"), encoding="utf-8"))
by_year = defaultdict(list)
for p in data["posts"]:
    by_year[p["date"][:4]].append(p)

out = ['<section class="archive" aria-labelledby="archive-h">',
       '    <h2 class="mini" id="archive-h">From my old blog, 2008 to 2016</h2>',
       f'    <p class="archive-intro">{len(data["posts"])} posts from <a href="{data["source"]}">amyrobinson.wordpress.com</a>, the words as I wrote them then: TEDx, the TEDx Music Project, #LifeBonus, MIT, and the early days of Eyewire.</p>']
for year in sorted(by_year, reverse=True):
    posts = sorted(by_year[year], key=lambda p: p["date"], reverse=True)
    out.append(f'    <h3 class="arch-year">{year} <span class="fine">{len(posts)}</span></h3>\n    <ol class="arch-list">')
    for p in posts:
        d = dt.date.fromisoformat(p["date"])
        href = p["path"].removeprefix("blog/")
        long = p["words"] >= 500
        dek = f'<span class="arch-dek">{html.escape(p["dek"])}</span>' if long else ""
        cls = ' class="long"' if long else ""
        out.append(f'      <li{cls}><a href="{href}"><span class="arch-date">{d:%b} {d.day}</span>'
                   f'<span class="arch-title">{html.escape(p["title"])}</span>{dek}</a></li>')
    out.append("    </ol>")
out.append("  </section>")

p = os.path.join(ROOT, "blog", "index.html")
s = open(p, encoding="utf-8").read()
a, b = s.index("<!-- ARCHIVE -->") + len("<!-- ARCHIVE -->"), s.index("<!-- /ARCHIVE -->")
s = s[:a] + "\n  " + "\n".join(out) + "\n  " + s[b:]
open(p, "w", encoding="utf-8").write(s)
print(len(data["posts"]), "posts listed")
