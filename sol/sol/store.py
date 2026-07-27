"""Append-only persistence. The Scar Principle, enforced structurally.

There is no update or delete anywhere in this module. A revision is a new record
with a `revises` pointer; current state is a fold over history. Past beliefs
remain readable forever because the state *is* the history.

Layout (one JSONL file per record family, under the state directory):
    self.jsonl            Belief (incl. values, self-model items)
    episodic.jsonl        EpisodicMemory
    questions.jsonl       OpenQuestion
    contradictions.jsonl  Contradiction
    predictions.jsonl     Prediction
    journal.jsonl         JournalEntry
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterator, Optional

from .models import (
    Belief, Contradiction, EpisodicMemory, JournalEntry, OpenQuestion,
    Prediction, Record, from_dict,
)

FILES = {
    Belief: "self.jsonl",
    EpisodicMemory: "episodic.jsonl",
    OpenQuestion: "questions.jsonl",
    Contradiction: "contradictions.jsonl",
    Prediction: "predictions.jsonl",
    JournalEntry: "journal.jsonl",
}


class CentralValueError(ValueError):
    """Raised when a central value revision arrives without evidence."""


class Store:
    def __init__(self, state_dir: str | os.PathLike | None = None):
        self.dir = Path(state_dir or os.environ.get("SOL_STATE_DIR", "state"))
        self.dir.mkdir(parents=True, exist_ok=True)

    # -- write ------------------------------------------------------------

    def append(self, record: Record) -> Record:
        self._check_invariants(record)
        path = self.dir / FILES[type(record)]
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record.to_dict(), ensure_ascii=False, sort_keys=True) + "\n")
        return record

    def _check_invariants(self, record: Record) -> None:
        if isinstance(record, Belief) and record.revises:
            old = self.get(record.revises)
            if old is None:
                raise ValueError(f"revision of unknown record {record.revises}")
            # Module 9: changing a central value requires cited evidence.
            if isinstance(old, Belief) and old.kind == "value" and old.centrality == "central":
                if not (record.evidence_for or record.evidence_against):
                    raise CentralValueError(
                        f"refusing to revise central value {old.id!r} without evidence"
                    )
            if not record.why_changed:
                raise ValueError("a revision must record why it changed")

    # -- read -------------------------------------------------------------

    def _iter_file(self, cls: type) -> Iterator[Record]:
        path = self.dir / FILES[cls]
        if not path.exists():
            return
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield from_dict(json.loads(line))

    def all(self, cls: type) -> list[Record]:
        """Full history, oldest first — fossils included."""
        return list(self._iter_file(cls))

    def get(self, record_id: str) -> Optional[Record]:
        for cls in FILES:
            for r in self._iter_file(cls):
                if r.id == record_id:
                    return r
        return None

    def current(self, cls: type) -> list[Record]:
        """Fold history to current state: latest record per revision chain."""
        superseded: set[str] = set()
        records: dict[str, Record] = {}
        for r in self._iter_file(cls):
            records[r.id] = r
            revises = getattr(r, "revises", None)
            if revises:
                superseded.add(revises)
        return [r for rid, r in records.items() if rid not in superseded]

    def history_of(self, record_id: str) -> list[Record]:
        """The full revision chain containing record_id, oldest first."""
        target = self.get(record_id)
        if target is None:
            return []
        cls = type(target)
        by_id = {r.id: r for r in self._iter_file(cls)}
        # walk back to the root
        root = target
        while getattr(root, "revises", None) and root.revises in by_id:
            root = by_id[root.revises]
        # walk forward from the root
        chain, frontier = [root], {root.id}
        changed = True
        while changed:
            changed = False
            for r in by_id.values():
                if getattr(r, "revises", None) in frontier and r.id not in frontier:
                    chain.append(r)
                    frontier.add(r.id)
                    changed = True
        return chain

    # -- convenience ------------------------------------------------------

    def cycle_count(self) -> int:
        return sum(1 for _ in self._iter_file(JournalEntry))

    def open_questions(self) -> list[OpenQuestion]:
        qs = [q for q in self.current(OpenQuestion) if q.status in ("open", "evolving")]
        return sorted(qs, key=lambda q: -q.priority)

    def consequence_rate(self) -> Optional[float]:
        """Fraction of belief revisions later cited by a journal entry.

        The single most important metric (docs/metrics.md): development is a
        revision that later cognition was load-bearing on.
        """
        revisions = [b for b in self.all(Belief) if b.revises]
        if not revisions:
            return None
        cited: set[str] = set()
        for entry in self.all(JournalEntry):
            cited.update(entry.cited)
        hit = sum(1 for b in revisions if b.id in cited)
        return hit / len(revisions)
