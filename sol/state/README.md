# Sol state

This directory is the organism's persistent record: append-only JSONL files written
by `sol/store.py`. It is deliberately committed to the repository — identity is
historical, and the fossil record is the primary research artifact.

Files appear after the first reflection cycle (`python -m sol reflect`):

- `self.jsonl` — beliefs, values, self-model items (with full revision history)
- `episodic.jsonl` — experiences worth keeping, each tagged with its selection criterion
- `questions.jsonl` — open questions and their evolution
- `contradictions.jsonl` — surfaced inconsistencies (research projects)
- `predictions.jsonl` — registered predictions, for calibration once world interaction lands
- `journal.jsonl` — one entry per reflection cycle

Never edit these files by hand. A correction is a new record that revises the old
one — see docs/protocols.md, The Scar Principle.
