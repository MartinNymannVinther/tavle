# ADR 0026: The AI as counsel — a goal, a plan, a brief

Status: accepted · Date: 2026-09-15

## Context

The owner said yes to the three candidates ADR 0025 left on the list.
They share a shape the first assists did not have: the AI reads a state
the person is about to act on — a sprint being planned, an item being
closed, an epic due for review — and says what it would do.

## Decision

**The sprint-goal drafter.** Editing an existing sprint offers "Foreslå
mål": one sentence naming the outcome, drafted from the sprint's own
cards, their features, the points and the team's written-down average.
The person rewrites and saves; the save runs through `updateSprint`
marked `actorKind: ai`. A written goal also feeds the sprint-story
proposal's prompt, so the proposals compound.

**The prefilled close conversation.** When rule 10's dialog opens with
a model set up, one call proposes an action per open child with a
one-line why, shown under each row. The selects arrive pre-set — never
over a child the person already touched, and a slow answer for a closed
dialog is dropped. Nothing is written by the AI: confirm still goes
through the ordinary close action, which re-validates every id and
rule, so the close stays the person's own act, unmarked.

**The review brief.** The rule-9 banner gains "Lav et rids": a
read-only account of what moved since the last confirmation, what
stands open, and whether the done-when still reads true — signed with
the engine line. Nothing can be applied; dogma 5 is held by
construction.

House law as in ADR 0025: fenced prose, sanitizers that resolve keys
and actions against the real children and targets (an invented child,
an illegal action or an unknown move target drops that line and the
dialog's default stands), the AI ceilings, honest absence without a
model.

## Trade-off accepted

The close advice identifies children and targets by their board keys,
not ids — models repeat keys far more reliably than UUIDs, at the cost
of a lookup layer. The review brief re-reads what the item page
already loaded; a shared loader would save a query but couple the
counsel to the page, and the counsel should outlive any one page.
