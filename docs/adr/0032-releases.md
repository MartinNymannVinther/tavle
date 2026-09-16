# ADR 0032: A release is the story map's band

Status: accepted · Date: 2026-09-16

## Context

The story map's horizontal bands were the board's own plan: open
sprints on a Scrum board, columns on a Kanban one. Both are derived —
a card's band was wherever the card already was.

The owner asked for bands the team makes and removes itself, to show
releases across the backlog, each with a name, an intended delivery
date, and the weight of the work in it; and to see those releases on
the roadmap.

That is what a story map's bands are in the practice the map is named
after. Sprints-as-bands was our deviation, not the norm.

## Decision

**A release is a concept of its own — the eleventh.** It cannot be
folded into an existing one: it is not a theme (why), not an area
(where), not a sprint (the team's cadence), not a swimlane (one
Kanban board's rows). A release is what the customer gets, and it cuts
across sprints. On a Kanban board, where there are no sprints at all,
it is the only thing that answers "what ships together".

The honest objection is that a release and a sprint are structurally
alike: a name, a date, a set of cards. The difference is purpose, and
it is the purpose that makes both worth having — a sprint's velocity
is meaningless for a release, and a release's date is meaningless for
a sprint.

**The map's bands become the board's releases**, nearest first, with
one band at the bottom for work no release has promised. A board with
no releases is that band alone: an honest empty wall rather than no
wall. Dragging a card between bands is the same gesture it always was;
it now writes `release_id` instead of a sprint or a column. Each band
carries the count and the weight of its cards, in the board's own unit
(ADR 0030).

**Deleting a band frees its cards.** The foreign key clears
`release_id` rather than cascading, and the dialog says so before the
button is pressed. A band is a way of grouping work, and removing the
grouping must never remove the work.

**On the roadmap the releases are a thin strip above the epics**, each
standing on the quarter its date falls in. A release with no date is
left off and counted in the label instead: a time axis has no honest
place for something with no time.

Making, naming, ordering and deleting a band takes an owner or an
admin, like every other change to a board's shape. Putting a card in a
release takes anybody, because that is ordinary work.

## Trade-off accepted

The Scrum team loses the sprint wall on the map. Planning a sprint by
dragging on the story map is gone; it remains on the backlog page and
in the card's own panel, and every drag still has a menu path. The
owner chose this over an axis picker, and the gain is that the map has
one meaning on both board types instead of two.

A card belongs to at most one release, like its feature and its
sprint. Work that ships partly in two releases has to be split into
two cards — which is the same answer the backlog structure already
gives for work that belongs in two features.
