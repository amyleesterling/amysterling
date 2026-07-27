"""Tests for the enforced protocols: the scar principle, provenance, and the
central-value evidence requirement."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sol.models import Belief, JournalEntry, OpenQuestion, new_id, now_iso
from sol.store import CentralValueError, Store


def belief(**kw) -> Belief:
    defaults = dict(
        id=new_id("bel"), at=now_iso(), cycle=0,
        statement="test", kind="belief", confidence=0.5, origin="test",
    )
    defaults.update(kw)
    return Belief(**defaults)


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_scar_principle_revision_preserves_fossil(self):
        old = self.store.append(belief(statement="the sky is green", confidence=0.6))
        new = self.store.append(belief(
            statement="the sky is blue", confidence=0.9,
            revises=old.id, why_changed="looked at the sky",
            confidence_before=0.6, evidence_for=["observation"],
        ))
        # current state folds to the revision only
        current = self.store.current(Belief)
        self.assertEqual([b.id for b in current], [new.id])
        # but the fossil is still in full history
        self.assertIn(old.id, [b.id for b in self.store.all(Belief)])
        # and the revision chain walks old → new
        chain = self.store.history_of(new.id)
        self.assertEqual([b.id for b in chain], [old.id, new.id])

    def test_revision_requires_why_changed(self):
        old = self.store.append(belief())
        with self.assertRaises(ValueError):
            self.store.append(belief(revises=old.id, why_changed=None))

    def test_revision_of_unknown_record_rejected(self):
        with self.assertRaises(ValueError):
            self.store.append(belief(revises="bel_doesnotexist", why_changed="x"))

    def test_central_value_requires_evidence_to_change(self):
        core = self.store.append(belief(
            statement="truth over narrative", kind="value", centrality="central",
        ))
        with self.assertRaises(CentralValueError):
            self.store.append(belief(
                statement="narrative is fine actually", kind="value",
                revises=core.id, why_changed="felt like it",
            ))
        # with evidence, the revision is allowed — values are hypotheses
        self.store.append(belief(
            statement="truth over narrative, refined", kind="value",
            revises=core.id, why_changed="evidence accumulated",
            evidence_for=["mem_abc123"],
        ))

    def test_open_questions_ranked_by_priority(self):
        for p in (0.2, 0.9, 0.5):
            self.store.append(OpenQuestion(
                id=new_id("que"), at=now_iso(), cycle=0,
                question=f"q{p}", priority=p,
            ))
        self.assertEqual([q.priority for q in self.store.open_questions()], [0.9, 0.5, 0.2])

    def test_consequence_rate(self):
        self.assertIsNone(self.store.consequence_rate())
        old = self.store.append(belief())
        rev = self.store.append(belief(revises=old.id, why_changed="x"))
        self.assertEqual(self.store.consequence_rate(), 0.0)
        self.store.append(JournalEntry(
            id=new_id("jrn"), at=now_iso(), cycle=1,
            question_id=None, question="q", reflection="r",
            what_changed=None, what_surprised=None, unresolved=None,
            cited=[rev.id],
        ))
        self.assertEqual(self.store.consequence_rate(), 1.0)

    def test_cycle_count_is_journal_length(self):
        self.assertEqual(self.store.cycle_count(), 0)
        self.store.append(JournalEntry(
            id=new_id("jrn"), at=now_iso(), cycle=0,
            question_id=None, question="q", reflection="r",
            what_changed=None, what_surprised=None, unresolved=None,
        ))
        self.assertEqual(self.store.cycle_count(), 1)


if __name__ == "__main__":
    unittest.main()
