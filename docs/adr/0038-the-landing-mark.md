# ADR 0038: The landing mark — motion answers a move, not a gesture

Status: accepted · Date: 2026-09-18

## Context

A card dragged from the backlog into a sprint arrives without a word.
The drag itself is well signalled — the sprint panel outlines itself the
moment a card is lifted and tints when the pointer is over it — but the
drop is silent: `useBoardActions` speaks for a refusal and says nothing
for a success, so the list simply re-renders and the card is somewhere
else. The owner put it plainly: it sometimes happens so fast you do not
quite see what happened.

The obvious answer is to animate the drag — let the card fly from where
it was to where it lands. Two things are wrong with it. The design
language moves surfaces in and out (dialogs, popups, sheets, all fade
and zoom at `duration-100`) and never moves content across the page, so
a flying card would be the only thing of its kind in the product. And
the card crosses between two different components with different markup,
which needs shared layout identity to animate honestly — fragile against
a list that is also being re-rendered from the server.

The deeper problem with animating the drag is that the drag is not the
only way to make the move. A card goes into a sprint from the selection
bar's button, from a select on its own row, from the arrow keys. The
constitution has the drag as the quick path and never the only one; a
gesture-shaped answer would quietly make every other path the poorer
one.

## Decision

**The mark answers the landing, not the gesture.** When a move lands,
the card is marked where it now stands for `LANDED_MS` (1100ms) — a moss
tint laid over the row, fading out. It is set by the move, so a drag, a
button, a select and the arrow keys all land equally visibly.

**It is marked everywhere it is drawn.** A card put in a sprint lights
in the backlog list, where it now stands as promised away, and in the
sprint panel that took it. Landing in a _folded_ panel it is drawn
nowhere at all, and the panel's header answers for it — that is the move
that vanishes most completely and the one most in need of saying so.

**The tint is laid over the row, not set on it.** Rows sit on three
different grounds — the list's, a card's, a sprint panel's — and
animating `background-color` would fade whichever one it is to nothing
on the way out. A `::after` overlay with `pointer-events: none` leaves
the row's own ground alone.

**Reduced motion may take the fade. It may not take the mark.** Under
`prefers-reduced-motion: reduce` the tint stands for the same 1100ms and
simply stops fading. The mark is the information; the fade is the
decoration, and only the decoration is negotiable. This is the first
`prefers-reduced-motion` rule in the codebase and the shape the next one
should take.

## Trade-offs accepted

- A card that moves twice in a second gets one mark, not two: the second
  move takes the mark over rather than queueing behind it. The answer
  belongs to what just happened.
- The mark is set the moment the write is confirmed, not when the
  re-rendered list arrives, so on a slow connection the old position can
  light for a beat before the new one does. It reads as "this one is
  moving" rather than as an error, and waiting for the refresh would mean
  threading transition state through every call site.
- Two numbers have to agree — the timeout that removes the class and the
  animation that fades the tint — and they live in files that cannot see
  each other. `tests/meta/landed.test.ts` holds them together, along with
  what reduced motion is allowed to take away.
- The card detail page's own selects do not mark: you are standing on the
  card, and it has not gone anywhere you cannot see.
