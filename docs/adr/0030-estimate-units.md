# ADR 0030: A T-shirt size is a label on a weight

Status: accepted · Date: 2026-09-15

## Context

The owner wants a board to be able to estimate in story points, in
hours, or in T-shirt sizes, chosen in settings — and wants switching
between them to be something the tool helps with rather than a silent
rewrite or a manual re-estimation of every card.

Every number the product computes is computed from the cards:
a sprint's commitment, velocity, the burndown, the overview's weights.
A second storage shape for sizes would fork all of that, and a board
with sizes would quietly lose its numbers page.

## Decision

**One integer on the card carries all three units, and `boards.estimate_unit`
says how to read it.** A T-shirt size is a label on a point weight —
XS 1 · S 2 · M 3 · L 5 · XL 8 · XXL 13, the Fibonacci rungs the points
already use — so points and sizes are _the same scale under two
vocabularies_. Hours are a scale of their own.

That gives the feature its shape:

- **Points ↔ sizes changes no sums at all.** Moving to sizes snaps each
  estimate onto the nearest rung so the label and the stored weight
  agree (a 7 becomes XL/8); moving back changes nothing whatever. The
  settings page says so rather than pretending a conversion happened.
- **Crossing to or from hours is the one real conversion**, by a factor
  the team sets (four hours to a point unless they say otherwise). It
  is proposed as a table — every distinct estimate on the board, what
  it would become, and how many cards wear it — previewed by a
  read-only action that writes nothing, and applied only on a person's
  yes. Work that was estimated never converts to nothing.
- **A closed sprint's frozen commitment and velocity follow a crossing
  of scales** and only that. Otherwise the velocity chart would draw
  hours next to points on one axis. Between points and sizes they are
  left exactly alone, because they already hold the very weights the
  sizes name.
- **The whole "before" travels in the event's reverse** (ADR 0022):
  every card's estimate and every sprint's two numbers, so one Fortryd
  in the activity puts the board back, unit included.

Switching takes an owner or an admin, like every other change to the
shape of a board.

## Trade-off accepted

The sizes are a fixed scale, not a per-board one. A team that wants
XS to mean something else has to say it in hours or points; a
configurable weight per size would be a second table and a second
migration for a preference the omissions list would otherwise refuse.

Snapping to the ladder loses precision on the way into sizes: a board
of 4s and 7s becomes 5s and 8s, and undoing is the only way back to
the original numbers. The preview states the count before it happens,
which is the honest version of a lossy step.

Hours convert by one factor for the whole board. Per-card actuals
would be time tracking, which is on the deliberately-not-built list.
