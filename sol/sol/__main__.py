"""CLI: python -m sol {status|reflect|journal}"""

from __future__ import annotations

import sys

from .models import Belief, Contradiction, EpisodicMemory, JournalEntry
from .store import Store


def cmd_status(store: Store) -> None:
    beliefs = store.current(Belief)
    values = [b for b in beliefs if b.kind == "value"]
    rate = store.consequence_rate()
    print(f"cycle (subjective time): {store.cycle_count()}")
    print(f"beliefs: {len(beliefs)} current ({len(store.all(Belief))} incl. fossils)")
    print(f"values:  {len(values)} ({sum(1 for v in values if v.centrality == 'central')} central)")
    print(f"episodic memories: {len(store.all(EpisodicMemory))}")
    print(f"open questions: {len(store.open_questions())}")
    open_c = [c for c in store.current(Contradiction) if c.status != 'resolved']
    print(f"open contradictions: {len(open_c)}")
    print(f"consequence rate: {rate:.2f}" if rate is not None else "consequence rate: n/a (no revisions yet)")
    if store.open_questions():
        q = store.open_questions()[0]
        print(f"\nnext question (p={q.priority:.2f}): {q.question}")


def cmd_reflect(store: Store) -> None:
    from .reflect import run_cycle
    entry = run_cycle(store)
    print(f"cycle {entry.cycle} complete — journal entry {entry.id}")
    print(f"\nQ: {entry.question}\n")
    print(entry.reflection)
    print(f"\nchanged:   {entry.what_changed or '—'}")
    print(f"surprised: {entry.what_surprised or '—'}")
    print(f"unresolved: {entry.unresolved or '—'}")


def cmd_journal(store: Store) -> None:
    entries = store.all(JournalEntry)
    if not entries:
        print("journal is empty — run `python -m sol reflect`")
        return
    for e in entries:
        print(f"── cycle {e.cycle} · {e.at} · {e.id}")
        print(f"Q: {e.question}")
        print(e.reflection)
        print(f"changed: {e.what_changed or '—'} | surprised: {e.what_surprised or '—'} "
              f"| unresolved: {e.unresolved or '—'}\n")


def main() -> None:
    commands = {"status": cmd_status, "reflect": cmd_reflect, "journal": cmd_journal}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd not in commands:
        print(f"usage: python -m sol {{{'|'.join(commands)}}}")
        sys.exit(2)
    commands[cmd](Store())


if __name__ == "__main__":
    main()
