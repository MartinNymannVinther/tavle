# ADR 0025: The quiet assists — AI woven into the moment, still under dogma five

Status: accepted · Date: 2026-09-14

## Context

The owner's standing direction is AI support wherever it makes sense,
"also without the user directly noticing it". The four proposals (draft,
split, sprint story, bootstrap — ADR 0021) are destinations a person
walks to; the assists live where the person already stands. The
candidates were weighed by user value against build effort; three ship
now, three stayed on the list (sprint-goal draft, a prefilled close
conversation, an epic review brief) — the owner said yes to those the
day after, and ADR 0026 carries them.

## Decision

**The done-when drafter.** On an epic or feature with a model set up, a
"Foreslå" button beside the done-when drafts the one or two checkable
sentences rule 4 will one day demand, from the item's own title,
description, parent and children. The draft fills the editor, the
person rewrites and saves, and the save runs through `updateItem`
marked `actorKind: ai` — visible in the feed, undoable like any edit.

**The quick-add assist.** When a card title has been typed and rests
for 800 ms, one model call answers two things at once: where the card
belongs (the select moves, with a small "AI foreslår" line — never over
a choice the person already made) and whether it already exists (at
most three "Ligner:" links). It writes nothing: creating the card stays
the person's own act through the ordinary action, so no marking is
needed — the AI only moved a select in plain sight.

**The velocity note.** Not AI at all: the planning panels say "snittet
er N" next to what the sprint holds, computed from the closed sprints'
written-down points. The record was already there; now it speaks at
the moment of planning.

House law throughout: prose fenced with `fenceUntrusted`, answers cut
to shape by sanitizers that resolve names and numbers against the
board's own rows (an invented feature or a foreign card number simply
disappears), every call counted against the AI ceilings, and without a
model the buttons are absent and the assist asks once, learns
`noModel`, and goes quiet — degrade to nothing, not to broken.

## Trade-off accepted

The quick-add assist spends model calls on half-formed titles; the
debounce, the 8-character floor, one call per pause and the existing
per-user ceiling bound it. Exact-name resolution means the model must
repeat a feature's name verbatim to place a card — a fuzzy match would
place more cards and misplace some; we chose the misses.
