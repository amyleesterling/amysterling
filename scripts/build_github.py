"""Poll GitHub for amyleesterling's public repositories and write data/github.json.

Run locally with `python scripts/build_github.py` (uses GITHUB_TOKEN, or `gh auth token`).
The daily workflow .github/workflows/github-data.yml runs the same thing.

Counts:
  commits  = commits on the default branch (or the branch named in curation.json) since Jan 1 of this year whose GitHub
             author is amyleesterling. Scheduled bots author as github-actions, so
             the cron refreshes on philogelos, findmytown, review and this repo
             are not counted.
  live     = the homepage (or GitHub Pages) URL answered HTTP 200 when this ran.
"""
import datetime as dt
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

OWNER = "amyleesterling"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURATION = os.path.join(ROOT, "data", "curation.json")
OUT = os.path.join(ROOT, "data", "github.json")


def token():
    t = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if t:
        return t
    try:
        return subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return ""


TOKEN = token()


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "amysterling.org"})
    if TOKEN:
        req.add_header("Authorization", "Bearer " + TOKEN)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.load(r)
        link = r.headers.get("Link", "")
    nxt = re.search(r'<([^>]+)>;\s*rel="next"', link)
    return body, (nxt.group(1) if nxt else None)


def get_all(url):
    out = []
    while url:
        page, url = get(url)
        out.extend(page)
    return out


def answers(url):
    """True when the URL ends in an HTTP 200 over https after redirects."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 amysterling.org link check"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    now = dt.datetime.now(dt.timezone.utc)
    year = now.year
    since = f"{year}-01-01T00:00:00Z"
    cur = json.load(open(CURATION, encoding="utf-8"))
    rooms = cur["rooms"]
    room_of = {name: rid for rid, r in rooms.items() for name in r["repos"]}
    titles = cur.get("titles", {})
    descs = cur.get("descriptions", {})
    keep_forks = set(cur.get("keep_forks", []))
    hidden = set(cur.get("hidden", []))
    live_override = cur.get("live", {})
    branches = cur.get("branches", {})

    repos = get_all(f"https://api.github.com/users/{OWNER}/repos?type=owner&per_page=100")
    rows = []
    for r in repos:
        name = r["name"]
        if r["private"] or r["archived"] or name in hidden:
            continue
        if r["fork"] and name not in keep_forks:
            continue
        months = [0] * 12
        commits = 0
        if (r.get("pushed_at") or "") >= since and r.get("size", 0) > 0:
            try:
                url = (f"https://api.github.com/repos/{OWNER}/{name}/commits"
                       f"?author={OWNER}&since={since}&per_page=100"
                       + (f"&sha={branches[name]}" if name in branches else ""))
                for c in get_all(url):
                    when = c["commit"]["author"]["date"]
                    if when.startswith(str(year)):
                        months[int(when[5:7]) - 1] += 1
                        commits += 1
            except urllib.error.HTTPError as e:
                if e.code != 409:  # 409 = empty repository
                    raise
        home = live_override.get(name) or (r.get("homepage") or "").strip()
        if not home and r.get("has_pages"):
            home = f"https://{OWNER}.github.io/{name}/"
        live = home if home and answers(home) else ""
        rows.append({
            "name": name,
            "title": titles.get(name) or name.replace("_", " ").replace("-", " ").strip(),
            "description": descs.get(name) or (r.get("description") or "").strip(),
            "language": r.get("language") or "",
            "room": room_of.get(name, "toys"),
            "repo": r["html_url"],
            "live": live,
            "pushed": (r.get("pushed_at") or "")[:10],
            "created": (r.get("created_at") or "")[:10],
            "stars": r.get("stargazers_count", 0),
            "fork": r["fork"],
            "commits": commits,
            "months": months,
        })
        print(f"{name:40s} {commits:5d} {'live' if live else ''}", file=sys.stderr)

    rows.sort(key=lambda x: x["pushed"], reverse=True)
    data = {
        "owner": OWNER,
        "updated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "year": year,
        "commit_rule": f"Commits on each default branch since Jan 1 {year} authored by {OWNER}. Bot commits are not counted.",
        "rooms": {rid: {k: v for k, v in r.items() if k != "repos"} for rid, r in rooms.items()},
        "repos": rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{len(rows)} repos, {sum(r['commits'] for r in rows)} commits, {sum(1 for r in rows if r['live'])} live", file=sys.stderr)


if __name__ == "__main__":
    main()
