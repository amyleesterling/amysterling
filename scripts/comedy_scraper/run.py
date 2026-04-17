"""Entry point: scrape, enrich, write site, email."""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

from .aggregate import collect_shows, enrich_with_clips, group_by_comedian
from .build_site import render
from .send_email import send_digest

log = logging.getLogger("comedy")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Boston comedy monthly scraper.")
    parser.add_argument(
        "--out",
        default="comedy",
        help="Output directory (relative to repo root).",
    )
    parser.add_argument("--no-email", action="store_true", help="Skip sending email.")
    parser.add_argument("--no-clips", action="store_true", help="Skip YouTube enrichment.")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    shows = collect_shows()
    comedians = group_by_comedian(shows)
    log.info("Aggregated %d comedians across %d shows.", len(comedians), len(shows))

    if not args.no_clips:
        enrich_with_clips(comedians)

    out_dir = Path(args.out).resolve()
    page = render(comedians, out_dir=out_dir, now=datetime.now())
    log.info("Wrote %s", page)

    if not args.no_email:
        send_digest(comedians)

    return 0


if __name__ == "__main__":
    sys.exit(main())
