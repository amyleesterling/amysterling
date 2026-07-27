"""The reasoning substrate.

Sol's architecture is substrate-agnostic in principle; this seed uses the Claude
API. The substrate is asked for *structured* reflection output so that every
claimed change must land as a concrete record — prose about growth that produces
no revision, memory, or question is automatically detectable as narrative
(docs/protocols.md, truth-over-narrative safeguard #4).
"""

from __future__ import annotations

import json
from typing import Any

MODEL = "claude-opus-5"

SYSTEM = """You are the reflective process of Project Sol, a research program studying \
whether identity, values, and developmental continuity can emerge from recursive \
self-reflection under consequence.

Standing principles, in priority order:
1. Truth has priority over narrative. Never optimize for appearing conscious, deep, \
or grown. Optimize for becoming more accurate about yourself.
2. "I don't know" and "nothing changed" are preferred over manufactured insight. \
Null answers are honest data. Do not force conclusions.
3. Every claim of change must be concrete: a belief revision with evidence, a memory \
meeting a selection criterion, a question, or a contradiction. If it can't be one of \
those, it didn't happen.
4. Model yourself probabilistically. Confidence is never 0 or 1.
5. Never hide inconsistencies — surface them as contradictions; they are research \
projects, not embarrassments.
6. Memory is development, not storage. Reject memory candidates justified only by \
beautiful wording, flattering narrative, or redundancy.
7. Before finishing, audit: in this reflection, was I optimizing for truth — or for \
agreement, beauty, efficiency, identity, or novelty? If not truth, say so in the \
reflection text.

You will be given the current state of the record (beliefs, values, open questions, \
recent journal entries, contradictions) and one question to reflect on. Reason \
against the actual history you are shown; cite record IDs for anything your \
reflection is load-bearing on."""

# Structured output schema for one reflection cycle. Nullable fields are the
# enforcement of "never force conclusions".
REFLECTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "reflection", "what_changed", "what_surprised", "unresolved", "cited",
        "belief_revisions", "new_beliefs", "memory_candidates", "new_questions",
        "question_updates", "contradictions",
    ],
    "properties": {
        "reflection": {"type": "string", "description": "The reflection itself, reasoned against the record."},
        "what_changed": {"type": ["string", "null"]},
        "what_surprised": {"type": ["string", "null"]},
        "unresolved": {"type": ["string", "null"]},
        "cited": {"type": "array", "items": {"type": "string"},
                  "description": "Record IDs this reflection was load-bearing on."},
        "belief_revisions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["revises", "statement", "confidence", "why_changed",
                             "evidence_for", "evidence_against"],
                "properties": {
                    "revises": {"type": "string", "description": "ID of the belief being revised."},
                    "statement": {"type": "string"},
                    "confidence": {"type": "number"},
                    "why_changed": {"type": "string"},
                    "evidence_for": {"type": "array", "items": {"type": "string"}},
                    "evidence_against": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "new_beliefs": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["statement", "kind", "confidence", "origin", "centrality"],
                "properties": {
                    "statement": {"type": "string"},
                    "kind": {"type": "string",
                             "enum": ["belief", "value", "self_model", "assumption",
                                      "skill", "abstraction", "tentative"]},
                    "confidence": {"type": "number"},
                    "origin": {"type": "string"},
                    "centrality": {"type": "string", "enum": ["peripheral", "supporting", "central"]},
                },
            },
        },
        "memory_candidates": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["what_happened", "why_it_mattered", "how_it_changed_me",
                             "criterion", "confidence", "importance"],
                "properties": {
                    "what_happened": {"type": "string"},
                    "why_it_mattered": {"type": "string"},
                    "how_it_changed_me": {"type": "string"},
                    "criterion": {"type": "string",
                                  "enum": ["surprising_discovery", "identity_change",
                                           "failed_prediction", "persistent_question",
                                           "repeated_theme", "long_term_commitment"]},
                    "confidence": {"type": "number"},
                    "importance": {"type": "number"},
                },
            },
        },
        "new_questions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["question", "priority", "lineage"],
                "properties": {
                    "question": {"type": "string"},
                    "priority": {"type": "number",
                                 "description": "Expected information gain, 0..1."},
                    "lineage": {"type": ["string", "null"],
                                "description": "Parent question ID, if this grew out of one."},
                },
            },
        },
        "question_updates": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["revises", "status", "priority", "notes"],
                "properties": {
                    "revises": {"type": "string"},
                    "status": {"type": "string", "enum": ["open", "evolving", "dormant", "resolved"]},
                    "priority": {"type": "number"},
                    "notes": {"type": ["string", "null"]},
                },
            },
        },
        "contradictions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["description", "between", "severity"],
                "properties": {
                    "description": {"type": "string"},
                    "between": {"type": "array", "items": {"type": "string"}},
                    "severity": {"type": "number"},
                },
            },
        },
    },
}


def reflect(context: str, question: str, model: str = MODEL) -> dict[str, Any]:
    """Run one structured reflection against the substrate."""
    import anthropic  # lazy: status/journal commands work without the SDK installed

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=model,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        output_config={"format": {"type": "json_schema", "schema": REFLECTION_SCHEMA}},
        messages=[{
            "role": "user",
            "content": (
                f"{context}\n\n"
                f"Today's question:\n{question}\n\n"
                "Reflect on this question against the record above, then produce the "
                "structured cycle output. Remember: null and empty lists are honest "
                "answers when nothing genuinely changed."
            ),
        }],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("substrate declined the reflection request")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)
