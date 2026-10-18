"""Build data/publications.json from Ames's ORCID record and OpenAlex.

Run by hand: `python scripts/build_publications.py`, then read the diff before committing.
It is deliberately NOT in the daily workflow: a name match in an index can be wrong,
and a wrong paper on a personal site is worse than a missing one.

Sources
  ORCID 0000-0002-4961-3954 (her own record) and OpenAlex author A5064891337
  (the Princeton record carrying that ORCID). Works ORCID has and OpenAlex lacks
  are filled in from Crossref.
Rules
  one entry per DOI; a preprint is dropped when the same paper is published;
  datasets, PubMed Central copies and conference abstracts are left out.
"""
import difflib
import html
import json
import os
import re
import urllib.request

ORCID = "0000-0002-4961-3954"
OPENALEX = "A5064891337"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "publications.json")
SKIP_DOI_PREFIXES = ("10.12751/",)  # G-Node conference abstracts
SKIP_TYPES = {"dataset", "peer-review", "paratext"}
# Preprints published under a reworded title, or posted twice. Checked by hand 2026-10-17.
SAME_AS = {
    "10.1101/2025.07.09.663979": "10.1038/s41593-026-02388-9",   # CA3 -> Nature Neuroscience 2026
    "10.1101/2024.06.04.596633": "10.1038/s41586-025-08925-z",   # descending/ascending -> Nature 2025
    "10.1101/2023.05.02.539144": "10.1038/s41586-024-07763-9",   # LIF model -> Nature 2024
    "10.1101/2023.10.31.564922": "10.1038/s41586-024-07982-0",   # effectome -> Nature 2024
    "10.21203/rs.3.rs-6881911/v1": "10.1101/2025.06.10.658788",  # Research Square copy of the bioRxiv preprint
}


def get(url, accept="application/json"):
    req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": "amysterling.org (mailto:amysterling@princeton.edu)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def clean(t):
    t = html.unescape(re.sub(r"<[^>]+>", "", t or ""))
    return re.sub(r"\s+", " ", t).strip()


def norm(t):
    return re.sub(r"[^a-z0-9]+", " ", clean(t).lower()).strip()


VENUES = {"bioRxiv (Cold Spring Harbor Laboratory)": "bioRxiv", "SSRN Electronic Journal": "SSRN",
          "International Conference on the Foundations of Digital Games": "Foundations of Digital Games",
          "Proceedings of the 13th International Conference on the Foundations of Digital Games": "Foundations of Digital Games",
          "International Conference on the Foundations of Digital Games (FDG)": "Foundations of Digital Games",
          "Proceedings of the ACM on Human-Computer Interaction": "Proceedings of the ACM on HCI"}


def doi_of(u):
    return (u or "").lower().replace("https://doi.org/", "").strip() or None


def main():
    works = {}
    oa = get(f"https://api.openalex.org/works?filter=author.id:{OPENALEX}&per-page=200")
    for w in oa["results"]:
        doi = doi_of(w.get("doi"))
        if not doi or w["type"] in SKIP_TYPES or doi.startswith(SKIP_DOI_PREFIXES):
            continue
        src = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
        if src == "PubMed Central":
            continue
        au = w["authorships"]
        works.setdefault(doi, {
            "title": clean(w["title"]),
            "year": w["publication_year"],
            "venue": src,
            "doi": doi,
            "kind": "preprint" if w["type"] == "preprint" or "rxiv" in src.lower() or "SSRN" in src else "paper",
            "first_author": au[0]["author"]["display_name"] if au else "",
            "authors": len(au),
        })

    orcid = get(f"https://pub.orcid.org/v3.0/{ORCID}/works")
    for g in orcid.get("group", []):
        ids = [x for x in g.get("external-ids", {}).get("external-id", []) if x["external-id-type"] == "doi"]
        for x in ids:
            doi = x["external-id-value"].lower()
            if doi in works or doi.startswith(SKIP_DOI_PREFIXES):
                continue
            try:
                m = get(f"https://api.crossref.org/works/{doi}")["message"]
            except Exception:
                continue
            if m.get("type") in ("dataset", "peer-review"):
                continue
            au = m.get("author", [])
            first = au[0] if au else {}
            venue = (m.get("container-title") or [""])[0] or (m.get("institution") or [{}])[0].get("name", "")
            works[doi] = {
                "title": clean((m.get("title") or [""])[0]),
                "year": m["issued"]["date-parts"][0][0],
                "venue": venue,
                "doi": doi,
                "kind": "preprint" if m.get("type") == "posted-content" or "rxiv" in venue.lower() else "paper",
                "first_author": first.get("name") or f'{first.get("given", "")} {first.get("family", "")}'.strip(),
                "authors": len(au),
            }

    # A preprint whose title matches a published paper is the same work: keep the paper.
    papers = [w for w in works.values() if w["kind"] == "paper"]
    keep = []
    for w in works.values():
        if SAME_AS.get(w["doi"]) in works:
            continue
        if w["kind"] == "preprint" and any(
            difflib.SequenceMatcher(None, norm(w["title"]), norm(p["title"])).ratio() > 0.8 or
            norm(p["title"]).startswith(norm(w["title"])[:45])
            for p in papers):
            continue
        keep.append(w)

    for w in keep:
        w["venue"] = VENUES.get(w["venue"], w["venue"])
        w.pop("authors", None)  # OpenAlex stops listing at 100, so a count would be wrong
    keep.sort(key=lambda w: (-w["year"], w["kind"] != "paper", w["title"]))
    data = {"orcid": f"https://orcid.org/{ORCID}", "works": keep}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    for w in keep:
        print(w["year"], w["kind"][:5], w["venue"][:24].ljust(24), w["title"][:80])
    print(len(keep), "works")


if __name__ == "__main__":
    main()
