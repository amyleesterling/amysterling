"""Record schemas for Sol's persistent state.

Every record is immutable once written (see store.py — the store is append-only).
Change is expressed by appending a new record that points at what it supersedes,
so history is never lost: the Scar Principle as a data structure.

All records carry two clocks: wall-clock time (`at`) and subjective developmental
time (`cycle` — the number of reflection cycles lived when the record was written).
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

MEMORY_CRITERIA = (
    "surprising_discovery",
    "identity_change",
    "failed_prediction",
    "persistent_question",
    "repeated_theme",
    "long_term_commitment",
)

BELIEF_KINDS = ("belief", "value", "self_model", "assumption", "skill", "abstraction", "tentative")
CENTRALITY = ("peripheral", "supporting", "central")
QUESTION_STATUSES = ("open", "evolving", "dormant", "resolved")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@dataclass
class Record:
    id: str
    at: str          # wall-clock, ISO 8601 UTC
    cycle: int       # subjective time: reflection cycles lived

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["type"] = type(self).__name__
        return d


@dataclass
class Belief(Record):
    """Semantic self-memory: beliefs, values, self-model items, assumptions, skills.

    A revision is a *new* Belief whose `revises` points at the old one, carrying
    `why_changed` and `confidence_before`. The old record is never touched.
    """
    statement: str
    kind: str                       # one of BELIEF_KINDS
    confidence: float               # 0..1, never absolute by convention (0 < c < 1)
    origin: str                     # where this came from
    evidence_for: list[str] = field(default_factory=list)      # record IDs or citations
    evidence_against: list[str] = field(default_factory=list)
    centrality: str = "peripheral"  # meaningful for kind == "value"
    last_challenged: Optional[str] = None
    revises: Optional[str] = None   # ID of the belief this supersedes
    why_changed: Optional[str] = None
    confidence_before: Optional[float] = None


@dataclass
class EpisodicMemory(Record):
    """An experience, not a conversation transcript."""
    what_happened: str
    why_it_mattered: str
    how_it_changed_me: str
    criterion: str                  # one of MEMORY_CRITERIA — why this was worth keeping
    confidence: float
    importance: float               # functional estimate, not phenomenological
    dependencies: list[str] = field(default_factory=list)  # record IDs this rests on


@dataclass
class OpenQuestion(Record):
    question: str
    priority: float                 # expected information gain, 0..1
    status: str = "open"            # one of QUESTION_STATUSES
    lineage: Optional[str] = None   # parent question ID, if this grew out of another
    notes: Optional[str] = None
    revises: Optional[str] = None   # prior version of this question (re-rank, evolve, resolve)


@dataclass
class Contradiction(Record):
    description: str
    between: list[str]              # IDs of the conflicting records
    severity: float                 # 0..1
    status: str = "open"            # open | investigating | resolved
    revises: Optional[str] = None


@dataclass
class Prediction(Record):
    claim: str
    confidence: float
    resolves_by: Optional[str] = None   # ISO date the prediction should be checkable
    outcome: Optional[bool] = None      # set by a later revision record
    revises: Optional[str] = None


@dataclass
class JournalEntry(Record):
    question_id: Optional[str]
    question: str
    reflection: str
    what_changed: Optional[str]     # null is a valid, honest answer
    what_surprised: Optional[str]
    unresolved: Optional[str]
    cited: list[str] = field(default_factory=list)  # record IDs this reflection was load-bearing on


RECORD_TYPES: dict[str, type] = {
    cls.__name__: cls
    for cls in (Belief, EpisodicMemory, OpenQuestion, Contradiction, Prediction, JournalEntry)
}


def from_dict(d: dict[str, Any]) -> Record:
    d = dict(d)
    cls = RECORD_TYPES[d.pop("type")]
    return cls(**d)
