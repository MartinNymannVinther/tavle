# ADR 0020: The breakdown is a surface of its own — containment, a tray, and the same moves

Status: accepted · Date: 2026-09-14

## Context

The owner asked for a place to work directly with breaking the product
down — a WBS for the product: create epics, decompose them into
features and cards, and see what has no parent so it can be dragged
into the structure. The backlog (ADR 0013) is the planning surface and
deliberately flat; the story map (ADR 0015) crosses the decomposition
with time. Neither is a surface for _shaping_ the hierarchy itself.

## Decision

**A new view, "Nedbrydning"** (`/boards/[id]/structure`), shown
whenever the board shows features. It is a derived view: no new tables,
no new fields, and every write goes through the placements and creates
every other page already uses.

**Containment instead of connector lines.** Epics stand as columns;
each epic's box holds its feature boxes, each feature box holds its
card rows. A WBS drawn as boxes-in-boxes reads on a phone, works for a
screen reader, and needs no SVG. The symbols are the family's (ADR
0012).

**The tray is the honest pile.** Parentless features and cards stand in
"Uden forælder" beside the columns, draggable into the structure — and
the structure drags back out to it. The tool still never invents a
container; the tray _is_ the "shown as exactly that" of ADR 0011.

**Drag is the quick path, never the only one.** Every box and row
carries a "move to …" menu, and creating happens in place: an epic from
the form, a feature from a title alone in its epic's column (it
inherits area and themes, and rule 4 waits at the close, ADR 0018), a
card from the fixed quick-add on its feature.

**The backlog keeps the order.** No ranking on this surface — one order
per level lives in the backlog and the navigator (ADR 0013). This page
answers "what is the shape", not "what comes first". Closing is not
here either; that conversation belongs to the item page (rule 10).

## Trade-offs accepted

- A third surface that can move cards between features. All three write
  through the same service, so they cannot disagree; the cost is one
  more place to learn, taken deliberately because building and planning
  are different sittings.
- Cards under a closed feature do not appear here; a closed feature's
  work is accounted for, and the page shows only what can still be
  shaped.
