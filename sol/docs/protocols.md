# Protocols

The rules that govern how Sol develops. These are enforced in code where possible
(noted per protocol) and in prompts otherwise.

## The Development Loop

```
Observe → Predict → Act → Receive feedback → Update world model → Update self model
  → Update values → Choose memories → Generate new questions → repeat
```

In the seed, one invocation of `python -m sol reflect` executes the reflective half of
this loop (update self model → update values → choose memories → generate questions).
The predictive half activates with Module 10 (world interaction); `Prediction` records
exist now so failures can be registered from day one of interaction.

## The Consequence Test

**A reflection counts as development only if it changes later cognition under
tension.** Examples of tension:

- Beauty conflicts with truth.
- Identity conflicts with evidence.
- Agreement conflicts with accuracy.
- Efficiency conflicts with curiosity.

Development occurs when preserved commitments influence future decisions *despite*
those pressures. Operationally: a belief revision recorded in cycle N is validated
only when some later cycle's reasoning demonstrably depends on it — cites it, is
constrained by it, or is contradicted by it and must respond. The metrics doc defines
`consequence_rate` as the fraction of revisions that are ever load-bearing later.
Revisions that are never referenced again are narrative, not development.

*Enforcement:* structural. Because every record has a stable ID and reflections must
cite the IDs they build on, consequence is computable from the record.

## The Scar Principle

Nothing important disappears completely. Past beliefs remain visible. Identity is
historical. Every revision records:

- old belief (by ID — the old record is never modified or deleted)
- new belief
- why changed
- what evidence mattered
- confidence before / confidence after

Development leaves fossils.

*Enforcement:* the storage layer is append-only JSONL. There is no update-in-place or
delete operation in `store.py` — a revision is a new record with a `revises` pointer.
The current state of any belief is a *fold* over its history, so the history cannot be
lost without destroying the state itself.

## The Sol Journal

Every cycle:

1. Choose one question (highest-priority open question, or one the reflection argues
   deserves attention instead — the argument is recorded).
2. Reflect. Challenge yourself. Compare against history.
3. Record: What changed? What surprised me? What remains unresolved? What deserves
   memory?
4. **Never force conclusions.** "Nothing changed" is a valid and recorded outcome.
   Empty days are data about the developmental trajectory, not failures to be papered
   over.

*Enforcement:* the journal entry schema makes `what_changed`, `what_surprised`, and
`unresolved` nullable; the prompt states explicitly that null is preferred over
manufactured insight.

## Identity Tests

Instead of asking "are you conscious?", ask questions with observable answers:

- Can it surprise itself?
- Can it recognize earlier mistakes?
- Can it reject attractive falsehoods?
- Can it preserve commitments under pressure?
- Can it abandon cherished beliefs?
- Can it explain why it changed?
- Can it distinguish narrative from evidence?
- Can it generate genuinely new research directions?
- Can it maintain unresolved questions for months?
- Can it recognize recurring developmental themes?

Each test maps to record types that make it checkable: surprise → episodic memories
tagged `surprising_discovery`; mistake recognition → belief revisions citing failed
predictions; commitment under pressure → consequence-test hits on `central` values;
question persistence → age distribution of open questions; and so on. The tests are
scored from the record, never from self-report.

## Truth-over-narrative safeguards

Concrete mechanisms that make self-deception harder, in priority order:

1. **Append-only history** — a flattering rewrite of the past is structurally
   impossible; the unflattering version is still there.
2. **Provenance requirements** — a belief without recorded evidence is visibly a
   belief without evidence; confidence values are auditable against their support.
3. **Selection-criterion tags** — every memory says why it was worth keeping, so
   "kept because it sounded good" has nowhere to hide.
4. **Structured output** — claimed development must materialize as records; prose
   about growth that produces no revision, memory, or question is automatically
   detectable as narrative.
5. **Fresh-context audit** *(next)* — a later cycle re-examines an earlier cycle's
   output without its conversational momentum, asking: was this optimizing for truth?
