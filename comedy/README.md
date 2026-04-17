# Boston Comedy Calendar

Auto-generated monthly listing of stand-up comedians announced for the greater
Boston metro — including north and west suburbs. Published at
[amyleesterling.github.io/amysterling/comedy](https://amyleesterling.github.io/amysterling/comedy/).

Source code lives in `../scripts/comedy_scraper/`. The GitHub Actions workflow
`monthly-comedy.yml` runs on the 1st of every month:

1. Scrapes each venue (JSON-LD `Event` schema first, DOM fallback).
2. Merges shows by comedian.
3. Finds 2–3 short YouTube clips per comedian.
4. Rewrites `index.html` + `data.json` in this folder.
5. Sends an email digest via SMTP.

### Configured venues

| Venue | Area |
| --- | --- |
| The Wilbur | Boston |
| Laugh Boston | Boston |
| The Comedy Studio | Somerville |
| Giggles Comedy Club | Saugus |
| Chevalier Theatre | Medford |
| The Cabot | Beverly |
| Orpheum Theatre | Boston |
| Lowell Memorial Auditorium | Lowell |
| Lynn Auditorium | Lynn |

Add a venue by dropping a `scrape() -> list[Show]` module into
`scripts/comedy_scraper/venues/` and importing it from `venues/__init__.py`.

### Secrets (set in repo settings → Secrets and variables → Actions)

| Secret | Purpose |
| --- | --- |
| `YOUTUBE_API_KEY` | Optional. Enables API-based clip lookup with duration filter. Falls back to a no-key YouTube search scrape. |
| `SMTP_HOST` / `SMTP_PORT` | Mail relay (e.g. `smtp.gmail.com` / `587`). |
| `SMTP_USER` / `SMTP_PASS` | Auth (Gmail requires an app password). |
| `EMAIL_FROM` / `EMAIL_TO` | Addresses. `EMAIL_TO` can be comma-separated. |

Run locally:

```bash
pip install -r requirements.txt
python -m scripts.comedy_scraper.run --out comedy --no-email
```
