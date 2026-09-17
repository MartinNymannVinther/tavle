# ADR 0027: The backlog at three altitudes

Status: accepted · Date: 2026-09-15 · Amended by ADR 0033 (an arrow at
any altitude moves one row of what is read, marked rows included)

## Context

The owner wants the backlog to read the way Azure DevOps boards read:
choose an epic backlog, a feature backlog or a card backlog, fold an
epic out to its features and on to its cards, reorder anything by drag
as well as by the arrows — and give the rows room on a desktop: a
title that can wrap, and the description visible. ADR 0013 made the
backlog one flat list with the decomposition as a navigator beside it;
this amends it rather than replaces it.

## Decision

**A level picker on the list** — Epics · Features · Kort, shown for the
levels the board's view exposes, remembered per board in the browser
(`use-pref.ts`, the folds' pattern). "Kort" is ADR 0013's flat list
with the navigator, unchanged, and remains the default. The epic and
feature altitudes render the decomposition as the list itself: epic →
features → backlog cards, each level folding out, with the loose
things under their own heading — the tool still never invents a
container. The navigator is hidden at those altitudes because it would
be the list twice.

**One order per level, still.** A drag or an arrow at any altitude
moves a thing past a visible sibling, and the write is the same
`reorderItem`/`reorderBacklog` the flat list makes — indexed against
the whole lane, so hidden closed items cannot bend the step. Item
drags are scoped to siblings under the same parent; ranking is order,
never reparenting (the navigator's drop and the placement fields do
that).

**Room on a desktop.** Titles wrap to two lines everywhere, and rows
carry a one-line description at container width @3xl. Cards ship a
`descriptionPreview` (first ~200 characters, computed in `toViews`) so
the list can say what a card is about without reverting ADR 0024's
slim payload. On Scrum the sprint panels can be hidden per board
("Vis sprints"), giving the list the whole width.

## Trade-off accepted

A fold-out shows the feature's backlog cards, not everything under it
— cards in a sprint or done are one counted line ("2 i gang · 3
færdige uden for backloggen"), because the backlog page is about the
backlog and the board already shows the rest. The card payload grows
by up to 200 characters per card; the prose itself still stays on the
card page.
