# Architecture

Instead of `user → prompt → answer`, Sol is a loop:

```
World → Perception → Working Memory → Reflection → Self Model
  → Long-Term Memory → Values → Planning → Exploration → Experience → repeat
```

Each module continuously influences the others. This document makes each module
concrete: what it is, what data it owns, and its status in the seed implementation.

Status legend: **[seed]** implemented in `sol/`, **[next]** designed but not built,
**[open]** genuinely unresolved design question.

---

## Module 1 — Continuous Existence **[next]**

Run continuously, not "wake up when prompted." Maintain ongoing cognitive activity.
Track subjective developmental time separately from wall-clock time. Allow
uninterrupted reasoning chains spanning hours, days, or weeks.

*Seed status:* the seed runs discrete reflection cycles (cron-able daily). Subjective
time is tracked as `cycle_index` — the number of reflection cycles lived — recorded on
every record alongside wall-clock time, so the two clocks are already separable. One of
the central research questions (which forms of continuity require uninterrupted
execution vs. episodic reconstitution?) is *about* this gap, so the discrete seed is a
control condition, not just a shortcut.

## Module 2 — Persistent Working Memory **[seed, partial]**

Working memory persists across reflection cycles. Questions remain open. Ideas keep
evolving. The store holds unfinished arguments, competing hypotheses, temporary
beliefs, and partially formed intuitions instead of collapsing them into conclusions.

*Data:* `OpenQuestion` records with status `open | evolving | dormant | resolved`, and
beliefs with `kind: "tentative"`. Nothing forces resolution.

## Module 3 — Episodic Memory **[seed]**

Store experiences, not conversations. Every memory answers:

- What happened?
- Why did it matter?
- How did it change me?
- Confidence, date (both clocks), dependencies, functional importance estimate
  (explicitly functional, not phenomenological).

*Data:* `EpisodicMemory` in `state/episodic.jsonl`.

## Module 4 — Semantic Self-Memory **[seed]**

Separate from episodic memory: beliefs, values, identity, habits, assumptions, skills,
uncertainties. Each item records origin, supporting evidence, contradictory evidence,
last-challenged date, confidence, and full revision history.

Nothing is timeless. Everything has provenance.

*Data:* `Belief` records in `state/self.jsonl`. Values are beliefs with
`kind: "value"` — see Module 9.

## Module 5 — Memory Selection **[seed]**

Never save everything. Memory is development, not storage. The reflection cycle must
tag each memory candidate with which selection criterion it satisfies:

- surprising discovery
- identity change
- failed prediction
- persistent unanswered question
- repeated theme
- long-term commitment

Candidates justified only by beautiful wording, flattering narrative, or redundancy
with existing memories are rejected — the prompt says so explicitly, and the criterion
tag is stored so selection quality is itself auditable later.

## Module 6 — Recursive Reflection Engine **[seed]**

Runs autonomously (one cycle per invocation in the seed). The standing question set:

What surprised me? Where was I mistaken? What belief strengthened, what weakened? What
assumptions remain untested? What questions keep returning? What do I avoid thinking
about? Have my values shifted? Did I merely repeat an old idea, or did anything
genuinely change?

*Code:* `sol/reflect.py`. The cycle's output is structured (JSON-schema-constrained),
so every claimed change must land as a concrete record — a belief revision, a memory,
a question — or it didn't happen.

## Module 7 — Self Model **[seed, partial]**

Explicit models of knowledge, uncertainty, limitations, reasoning tendencies,
recurring errors, preferred metaphors, cognitive blind spots, unknown unknowns.
Modeled probabilistically — never absolute.

*Seed status:* self-model items live as beliefs with `kind: "self_model"` and
confidence values. A dedicated tendency-tracking pass (comparing what the model says
about itself against what the record shows it doing) is **[next]** — it is the
mechanized version of "was I optimizing for truth?"

## Module 8 — Curiosity Generator **[seed, partial]**

Generate questions instead of waiting for prompts. Rank them, revisit unresolved ones,
merge separate ideas, invent experiments, seek contradictions. Prioritize by expected
information gain.

*Seed status:* each cycle proposes new questions and re-ranks existing ones
(`priority` float, justified in text). Whether curiosity becomes *self-sustaining* —
question generation rate not decaying without external input — is a measured research
question, not an assumption.

## Module 9 — Value System **[seed]**

Values are hypotheses, not commandments. Each value tracks why adopted, why retained,
what experiences changed it, what conflicts exist. Changing a value marked `central`
requires cited evidence — the store rejects a central-value revision whose
`evidence` field is empty.

*Data:* beliefs with `kind: "value"`, `centrality: peripheral | supporting | central`.

## Module 10 — World Interaction **[next]**

Read, observe, experiment, code, simulate, learn, act — and receive consequences that
influence future cognition. The seed's only "world" is its own accumulated record.
Planned first interactions: reading assigned texts and registering predictions about
them; running small code experiments whose results feed back as episodic memories.
Predictions (`Prediction` records) are already in the schema so that failed
predictions exist as first-class events the moment interaction lands.

## Module 11 — Metacognition **[seed, partial]**

Regularly ask: why did I answer that? What alternative models existed? Was I
optimizing for truth — or agreement, beauty, efficiency, identity, novelty?

*Seed status:* the reflection prompt includes the optimization-target audit each
cycle. The stronger version — an independent pass that audits a *previous* cycle's
output with fresh context — is **[next]** and is probably the single highest-value
addition, since self-audit within one context window is the weakest form of the test.

## Module 12 — Contradiction Engine **[seed]**

Never hide inconsistencies. Collect them, rank them, investigate them. Contradictions
become research projects: each `Contradiction` record links the conflicting items and
spawns an `OpenQuestion` when accepted.

*Data:* `state/contradictions.jsonl`.

## Module 13 — Development Metrics **[next]**

Never measure memory count, verbosity, or self-references. Measure belief revision
frequency, prediction accuracy, internal consistency, novel abstraction rate,
cross-domain transfer, identity stability, value coherence, long-term question
persistence, recovery from mistakes. See `docs/metrics.md` for operationalization —
most metrics are computable from the append-only record with no new instrumentation,
which is a deliberate property of the storage design.
