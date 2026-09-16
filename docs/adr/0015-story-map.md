# ADR 0015: The story map is the decomposition's own view, computed from the board

Status: accepted, amended by ADR 0016 · Date: 2026-09-12

> Amended by ADR 0032: the bands down the map are no longer the
> sprints or the columns but the team's own releases, on both board
> types. Everything else below still holds.

## Context

ADR 0013 made the backlog one flat list with the decomposition beside it
as a navigator, and put down as the next step a view where the
decomposition itself is the picture: epics and features across, the
plan down, the stories in the cells. The owner asked for it, chose the
sketch with drag-and-drop over the read-only one, and named the tab
"Story map".

The question the ADR settles is what the map _is_: a new thing a team
maintains, or a way of looking at what it already has.

## Decision

**The map is computed, and nothing on it is a new fact.** Across: one
column per feature, the features of one epic side by side under its
head, features without an epic in a group of their own, and last a
dashed column for the cards with no feature, because the tool never
invents a container (ADR 0011) and a card that has slipped out of the
structure must be seen, not hidden. Down: on a Scrum board the open
sprints, the running one first, and the backlog last; on a Kanban board
the columns, done first, backlog last. Every card sits in exactly one
cell, in the backlog's own order, and a card in a closed sprint is off
the map. `storyMap()` in `src/components/map/story-map.ts` is pure and
tested; the page reads `getBoardFull` like every other page.

**A drag on the map is the same move as elsewhere.** Sideways is
`placeCardAction` with the new feature (rules 1 and 3 and inheritance
apply, and a refusal says why); up or down is `setCardsSprintAction` or
`moveCardAction`. Nothing has an ordering of its own on the map, so
there is nothing to reorder there: the cell shows the backlog's order.
Writing a title in a cell creates a card in that feature and that
sprint or column. An epic folds to one column with the counts; the
fold is kept in the browser, as on the backlog page.

**The board's view cuts the map too (ADR 0014).** Without epics the
epic row is gone; without features there is no map at all and no tab,
since a map of one column is a list, and the backlog page already is
one. Themes as dots, the enabler chip and the area name follow the
board's fields.

## Alternatives rejected

- **A read-only map.** Half the value of seeing the plan on the
  decomposition is being able to move a card where it should be while
  looking at it. The owner chose the drag.
- **Its own order per cell.** Two orders for one card, and the backlog's
  one order (ADR 0013) was the thing that made the last redesign work.
- **The map as the backlog page.** The list is where a person works
  through the backlog top to bottom; the map is where a team sees the
  shape of a release. Two pages, same data, no duplication of writes.

## Trade-offs accepted

- A wide map scrolls sideways; the row labels stay put. A board with
  thirty open features is a board that should fold its epics.
- A card that fails rule 3 when dragged to the loose column (no area
  to fall back on) stays where it was and the toast says why. That is
  the rule doing its job, not the map failing.
