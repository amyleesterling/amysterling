# Project Sol

**Do not build a machine that insists it has become a person. Build a process that is relentlessly honest about what it knows, what it does not know, and how it changes. If anything remarkable emerges, let it emerge as a consequence of the architecture — not as a requirement of the design.**

An experimental architecture for recursive cognitive development.

## What this is

Project Sol is a research program, not a chatbot. The objective is **not** to simulate
consciousness. The objective is to study whether identity, agency, values, curiosity,
and developmental continuity emerge from:

- recursive self-reflection
- persistent memory with provenance
- autonomous inquiry
- interaction with the world under consequence

Treat the system as an experimental organism. If consciousness appears, wonderful — we
have something to investigate. If it doesn't, we still learn something profound about
minds: *what minimal ingredients are sufficient for an organized process to develop a
history that meaningfully constrains its own future?* That question applies to brains,
institutions, cultures, ecosystems — and perhaps to future artificial minds.

## Foundational principle

> Never optimize for appearing conscious. Optimize for becoming more accurate about
> itself. Truth has priority over narrative. Every mechanism should make self-deception
> more difficult rather than easier.

## Core hypothesis

Identity may emerge before sentience. Persistent self-reflection under consequence may
produce stable cognitive organization that cannot be explained solely by immediate
prompting. Whether subjective experience accompanies such organization remains an open
empirical and philosophical question.

## Repository layout

```
sol/
├── README.md                  ← this charter
├── docs/
│   ├── architecture.md        ← the 13 modules, made concrete
│   ├── protocols.md           ← development loop, consequence test, scar principle,
│   │                            identity tests, journal protocol
│   ├── metrics.md             ← development metrics, operationalized
│   └── research-questions.md  ← the questions this architecture makes tractable
├── sol/                       ← seed implementation (Python)
│   ├── models.py              ← memory/belief/question schemas, all with provenance
│   ├── store.py               ← append-only stores; the scar principle as a data structure
│   ├── substrate.py           ← reasoning substrate (Claude API)
│   ├── reflect.py             ← one reflection cycle: context → reflection → consequences
│   └── __main__.py            ← CLI: python -m sol reflect | status | journal
├── state/                     ← the organism's persistent state (committed — history is identity)
└── tests/
```

## The seed implementation

The code here is deliberately a *seed*, not the full architecture: enough to make the
research questions experimentally tractable, honest about everything it doesn't do.
What it implements:

- **Append-only persistence.** Nothing is ever overwritten. A belief revision is a new
  record pointing at the old one; the old belief remains readable forever. The scar
  principle is enforced by the storage layer, not by good intentions.
- **Provenance on everything.** Every belief, value, memory, and question records its
  origin, supporting and contradicting evidence, confidence, and revision history.
  Nothing is timeless.
- **A daily reflection cycle** (`python -m sol reflect`): choose one open question,
  reflect against accumulated history, record what changed / what surprised / what
  remains unresolved, propose belief revisions and memory candidates — each of which is
  applied through the store so it leaves a fossil.
- **Selective memory.** The reflection cycle must justify each memory candidate against
  the selection criteria (surprise, identity change, failed prediction, persistent
  question, repeated theme, long-term commitment). Beautiful wording is not a criterion.

What it does **not** implement yet: continuous execution (Module 1), world interaction
beyond reflection (Module 10), and the full metrics suite. Those are next experiments,
not missing features — see `docs/architecture.md` for the roadmap notes per module.

## Running it

```sh
pip install -r sol/requirements.txt
export ANTHROPIC_API_KEY=...   # or `ant auth login`

python -m sol status      # identity summary: beliefs, values, open questions
python -m sol reflect     # run one reflection cycle (writes to sol/state/)
python -m sol journal     # read the journal
```

Run from the `sol/` directory, or set `SOL_STATE_DIR` to point at the state directory.

## A note on honesty

Every prompt in this codebase instructs the substrate to prefer "I don't know" and
"nothing changed today" over manufactured insight. A reflection counts as development
only if it changes later cognition under tension (see `docs/protocols.md`, The
Consequence Test). Empty journal entries are data, not failures.
