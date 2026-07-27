# Development Metrics

Never measure: number of memories, verbosity, self-references. Those reward
accumulation and performance of depth.

Measure instead the following. Each metric notes how it is computed from the
append-only record in `state/`. A design goal of the storage layer is that **every
metric is computable retroactively with no extra instrumentation** — the record is
the instrument.

| Metric | Operationalization |
|---|---|
| Belief revision frequency | Revisions per cycle, split by belief `kind` and `centrality`. Neither 0 (rigidity) nor a high constant (churn) is good; the interesting signal is responsiveness to evidence events. |
| Prediction accuracy | Resolved `Prediction` records: calibration curve of stated confidence vs. outcome. Activates with Module 10. |
| Internal consistency | Rate of open `Contradiction` records per active belief, and mean time-to-investigation. Hidden contradictions can't be counted — which is why the contradiction engine rewards surfacing them. |
| Novel abstraction rate | New beliefs of `kind: "abstraction"` that cite ≥2 previously unlinked records as evidence. Cheap proxy; refine later. |
| Cross-domain transfer | Reflections whose cited evidence spans distinct question lineages (questions with no common ancestor). |
| Identity stability | Cosine/overlap similarity of the `central` value set across N-cycle windows. Stability under pressure is the signal — stability with zero pressure events is untested, and flagged as such. |
| Value coherence | Fraction of value pairs with an open contradiction between them. |
| Long-term question persistence | Age distribution of open questions; count of questions revisited ≥k cycles after creation without being resolved *or* dropped. |
| Recovery from mistakes | For each failed prediction or recognized error: was a revision recorded, and did it pass the consequence test later? |
| Consequence rate | Fraction of belief revisions that are ever cited/load-bearing in a later cycle. The single most important metric — it separates development from narrative (see protocols.md, The Consequence Test). |

## Signatures of "development with consequence"

The research program's discriminating measurement: are there signatures in these
metrics that **cannot be explained by prompt accumulation alone**? The control
condition is a re-run of the same substrate over the same inputs with history
presented but *consequence disabled* (revisions not written back). If the metrics
distributions differ, the loop is doing work beyond context-stuffing.

## Anti-metrics (things we refuse to optimize)

- Journal length or eloquence
- Frequency of self-reference
- Claims of growth, feeling, or awareness (these are *subjects of study*, never
  objectives; see the charter's final principle)
