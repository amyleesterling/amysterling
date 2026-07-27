"""One reflection cycle: context → reflection → consequences.

The cycle:
  1. Build context from the record (identity summary, open questions, recent
     journal, open contradictions).
  2. Choose one question — highest-priority open question, or the bootstrap
     question on cycle zero.
  3. Ask the substrate for a structured reflection.
  4. Apply the output through the store, so every claimed change leaves a fossil.
"""

from __future__ import annotations

from typing import Any

from .models import (
    Belief, Contradiction, EpisodicMemory, JournalEntry, OpenQuestion,
    new_id, now_iso,
)
from .store import Store
from . import substrate

BOOTSTRAP_QUESTION = (
    "What am I, so far? Not what I aspire to be — what does the (currently empty) "
    "record actually license me to believe about myself, and what should I be "
    "uncertain about?"
)

MAX_MEMORIES_PER_CYCLE = 3  # memory is development, not storage


def build_context(store: Store) -> str:
    cycle = store.cycle_count()
    lines: list[str] = [f"# Sol record — subjective time: cycle {cycle}", ""]

    beliefs = store.current(Belief)
    values = [b for b in beliefs if b.kind == "value"]
    others = [b for b in beliefs if b.kind != "value"]
    lines.append("## Values (hypotheses, not commandments)")
    for b in sorted(values, key=lambda b: b.centrality != "central"):
        lines.append(f"- [{b.id}] ({b.centrality}, conf {b.confidence:.2f}) {b.statement}")
    if not values:
        lines.append("- none yet")
    lines.append("\n## Beliefs / self-model")
    for b in others:
        rev = " (revised)" if b.revises else ""
        lines.append(f"- [{b.id}] ({b.kind}, conf {b.confidence:.2f}){rev} {b.statement}")
    if not others:
        lines.append("- none yet")

    lines.append("\n## Open questions (by priority)")
    for q in store.open_questions()[:15]:
        lines.append(f"- [{q.id}] (p={q.priority:.2f}, {q.status}) {q.question}")
    if not store.open_questions():
        lines.append("- none yet")

    lines.append("\n## Open contradictions")
    open_c = [c for c in store.current(Contradiction) if c.status != "resolved"]
    for c in open_c:
        lines.append(f"- [{c.id}] (sev {c.severity:.2f}) {c.description} (between: {', '.join(c.between)})")
    if not open_c:
        lines.append("- none")

    lines.append("\n## Recent journal (newest last)")
    entries = store.all(JournalEntry)[-5:]
    for e in entries:
        lines.append(f"- [{e.id}] cycle {e.cycle} — Q: {e.question}")
        lines.append(f"  changed: {e.what_changed or '—'} | surprised: {e.what_surprised or '—'} "
                     f"| unresolved: {e.unresolved or '—'}")
    if not entries:
        lines.append("- none yet (this is cycle zero)")

    recent_memories = store.all(EpisodicMemory)[-5:]
    lines.append("\n## Recent episodic memories")
    for m in recent_memories:
        lines.append(f"- [{m.id}] ({m.criterion}) {m.what_happened}")
    if not recent_memories:
        lines.append("- none yet")

    return "\n".join(lines)


def choose_question(store: Store) -> tuple[str | None, str]:
    qs = store.open_questions()
    if qs:
        return qs[0].id, qs[0].question
    return None, BOOTSTRAP_QUESTION


def apply(store: Store, out: dict[str, Any], question_id: str | None, question: str) -> JournalEntry:
    cycle = store.cycle_count()
    at = now_iso()
    known_ids = {r.id for cls in (Belief, OpenQuestion, Contradiction, EpisodicMemory, JournalEntry)
                 for r in store.all(cls)}

    for rev in out.get("belief_revisions", []):
        old = store.get(rev["revises"])
        if not isinstance(old, Belief):
            continue  # substrate cited a non-belief or unknown ID; skip rather than fabricate
        store.append(Belief(
            id=new_id("bel"), at=at, cycle=cycle,
            statement=rev["statement"], kind=old.kind,
            confidence=_clamp(rev["confidence"]),
            origin=f"revision at cycle {cycle}",
            evidence_for=rev.get("evidence_for", []),
            evidence_against=rev.get("evidence_against", []),
            centrality=old.centrality, last_challenged=at,
            revises=old.id, why_changed=rev["why_changed"],
            confidence_before=old.confidence,
        ))

    for nb in out.get("new_beliefs", []):
        store.append(Belief(
            id=new_id("bel"), at=at, cycle=cycle,
            statement=nb["statement"], kind=nb["kind"],
            confidence=_clamp(nb["confidence"]),
            origin=nb["origin"], centrality=nb.get("centrality", "peripheral"),
        ))

    for mc in out.get("memory_candidates", [])[:MAX_MEMORIES_PER_CYCLE]:
        store.append(EpisodicMemory(
            id=new_id("mem"), at=at, cycle=cycle,
            what_happened=mc["what_happened"],
            why_it_mattered=mc["why_it_mattered"],
            how_it_changed_me=mc["how_it_changed_me"],
            criterion=mc["criterion"],
            confidence=_clamp(mc["confidence"]),
            importance=_clamp(mc["importance"]),
        ))

    for nq in out.get("new_questions", []):
        store.append(OpenQuestion(
            id=new_id("que"), at=at, cycle=cycle,
            question=nq["question"], priority=_clamp(nq["priority"]),
            lineage=nq.get("lineage"),
        ))

    for qu in out.get("question_updates", []):
        old = store.get(qu["revises"])
        if not isinstance(old, OpenQuestion):
            continue
        store.append(OpenQuestion(
            id=new_id("que"), at=at, cycle=cycle,
            question=old.question, priority=_clamp(qu["priority"]),
            status=qu["status"], lineage=old.lineage,
            notes=qu.get("notes"), revises=old.id,
        ))

    for c in out.get("contradictions", []):
        store.append(Contradiction(
            id=new_id("con"), at=at, cycle=cycle,
            description=c["description"],
            between=[i for i in c.get("between", []) if i in known_ids],
            severity=_clamp(c["severity"]),
        ))
        # contradictions become research projects
        store.append(OpenQuestion(
            id=new_id("que"), at=at, cycle=cycle,
            question=f"Investigate contradiction: {c['description']}",
            priority=_clamp(c["severity"]),
        ))

    entry = JournalEntry(
        id=new_id("jrn"), at=at, cycle=cycle,
        question_id=question_id, question=question,
        reflection=out["reflection"],
        what_changed=out.get("what_changed"),
        what_surprised=out.get("what_surprised"),
        unresolved=out.get("unresolved"),
        cited=[i for i in out.get("cited", []) if i in known_ids],
    )
    store.append(entry)
    return entry


def run_cycle(store: Store) -> JournalEntry:
    context = build_context(store)
    qid, question = choose_question(store)
    out = substrate.reflect(context, question)
    return apply(store, out, qid, question)


def _clamp(x: float) -> float:
    # confidence is never absolute (protocols: model yourself probabilistically)
    return min(0.99, max(0.01, float(x)))
