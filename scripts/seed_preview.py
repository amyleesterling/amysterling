"""Seed /comedy/ with a realistic preview spanning the next ~3 months.

This is only used when the page is first published / before the monthly cron
has run against live venue sites. The cron-produced output replaces anything
written here.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path

from scripts.comedy_scraper.aggregate import enrich
from scripts.comedy_scraper.build_site import render
from scripts.comedy_scraper.models import Comedian, Show

log = logging.getLogger("seed")

# Venue event-listing pages. Real scrapes will overwrite these with
# event-specific URLs pulled from each venue's JSON-LD.
WILBUR = "https://thewilbur.com/shows/"
LAUGH = "https://laughboston.com/"
STUDIO = "https://thecomedystudio.com/shows/"
CHEVALIER = "https://chevaliertheatre.com/events/"
CABOT = "https://thecabot.org/events/"
GIGGLES = "https://gigglescomedyclub.com/"
ORPHEUM = "https://www.crossroadspresents.com/orpheum-theatre"


def _show(name: str, venue: str, city: str, url: str, offset_days: int, hour: int = 20, minute: int = 0) -> Show:
    when = datetime.now() + timedelta(days=offset_days)
    when = when.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return Show(comedian=name, venue=venue, venue_city=city, date=when, url=url, source="seed")


def build() -> list[Comedian]:
    cs: list[Comedian] = []
    # Spread ~12 comedians across the next 4 months. Shows point at each
    # venue's real events page so a click lands you on actual listings.
    cs.append(Comedian("Nate Bargatze", shows=[_show("Nate Bargatze", "The Wilbur", "Boston", WILBUR, 6, 19)]))
    cs.append(Comedian("Mike Birbiglia", shows=[_show("Mike Birbiglia", "Chevalier Theatre", "Medford", CHEVALIER, 12)]))
    cs.append(Comedian("Tig Notaro", shows=[_show("Tig Notaro", "Laugh Boston", "Boston", LAUGH, 18, 19, 30)]))
    cs.append(Comedian("Jim Gaffigan", shows=[_show("Jim Gaffigan", "Orpheum Theatre", "Boston", ORPHEUM, 22)]))
    cs.append(Comedian("Maria Bamford", shows=[_show("Maria Bamford", "The Comedy Studio", "Somerville", STUDIO, 27, 20)]))
    cs.append(Comedian("Bill Burr", shows=[_show("Bill Burr", "Orpheum Theatre", "Boston", ORPHEUM, 34)]))
    cs.append(Comedian("John Mulaney", shows=[_show("John Mulaney", "The Wilbur", "Boston", WILBUR, 42, 19)]))
    cs.append(Comedian("Roy Wood Jr.", shows=[_show("Roy Wood Jr.", "Laugh Boston", "Boston", LAUGH, 48, 19, 30)]))
    cs.append(Comedian("Jo Koy", shows=[_show("Jo Koy", "Orpheum Theatre", "Boston", ORPHEUM, 55)]))
    cs.append(Comedian("Michelle Wolf", shows=[_show("Michelle Wolf", "The Wilbur", "Boston", WILBUR, 63)]))
    cs.append(Comedian("Bert Kreischer", shows=[_show("Bert Kreischer", "The Cabot", "Beverly", CABOT, 72)]))
    cs.append(Comedian("Hasan Minhaj", shows=[_show("Hasan Minhaj", "Chevalier Theatre", "Medford", CHEVALIER, 85)]))
    cs.append(Comedian("Sarah Silverman", shows=[_show("Sarah Silverman", "The Wilbur", "Boston", WILBUR, 94, 19)]))
    cs.append(Comedian("Ronny Chieng", shows=[_show("Ronny Chieng", "Orpheum Theatre", "Boston", ORPHEUM, 102)]))
    return cs


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    cs = build()
    try:
        enrich(cs)  # Fetch real clips + Wikipedia photos.
    except Exception:
        log.exception("Enrichment failed; rendering without media.")
    render(cs, out_dir=Path("comedy"))
    log.info("Seeded /comedy/ with %d comedians.", len(cs))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
