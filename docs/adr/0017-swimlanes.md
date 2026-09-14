# ADR 0017: Swimlanes on a Kanban board — three views and one field

Status: accepted · Date: 2026-09-14

## Context

Swimlanes stood on the list of things deliberately not built: a board of
columns says one thing, and every axis added to it costs quiet. The owner
has now asked for them, for Kanban boards only: the team should be able
to split the board into rows, either by naming lanes itself or by one of
the structure's own fields — kind, theme or area.

The structure gives most of this for free. ADR 0011 put kind, theme and
area on every card; ADR 0014 made how much of the structure a board
shows a per-board choice that changes the view only. A swimlane grouped
by a field the cards already carry is the same kind of thing: a way of
looking, not a shape.

## Decision

**One choice on the board.** `swimlane_by`: `none` (default), `kind`,
`theme`, `area` or `manual`, set with the rest of the view under the
board's settings, owner or admin. Scrum boards do not have the choice;
the service refuses it, as it refuses a grouping by a field the same
choice hides. Grouping by a shown field is pure view: switching it on,
off or over touches no card.

**Manual lanes are one new table.** `swimlanes` follows the closed
lists' shape — board-owned, named, ordered, deactivated rather than
deleted — and `cards.swimlane_id` points into it, set null when a lane
goes. This is the trade-off accepted: the product's tenth concept, and
the only part of the feature that is data rather than view. It earns its
place because "the team's own rows" cannot be derived from anything.

**Every card in exactly one row.** The lane of a card is its kind, its
area, its manual lane — or, for themes, its _topmost_ theme in the
themes' own order, because themes are many-to-many and a board must stay
a partition. A drop into another theme lane swaps that one theme and
keeps the card's others; the themes' "without" row takes no drops,
because a drop cannot say which themes to take away. Areas' and manual
lanes' "without" rows are real targets and write null.

**A drop is one move.** Crossing a lane rides on the same move action as
crossing a column: one gesture, one transaction, one entry in the feed.
The lane's field is written through the same services every other page
uses — kind through the card update, area and themes through the
placement rules (rule 3 still refuses a parentless card without an
area) — and the server refuses an assignment that does not name the
board's own grouping. The menu on the card offers the same lane moves,
so the keyboard and the phone lose nothing.

**The WIP limit stays the column's.** A split column shows the whole
column's count in every row; lanes do not get limits of their own. The
insight page is untouched: lanes are not part of what happened, only of
how it is shown.

## Consequences

- Deactivating a lane leaves its cards standing in a row that stays
  visible until it empties; the row then disappears, the name survives
  in the history.
- The demo and the export know nothing of lanes until a board uses
  them; `swimlane_id` exports like every other column.
- Reordering manual lanes is creation order for now; a later complaint
  decides whether that is enough.
- Swimlanes leave the omissions list in CLAUDE.md; the rest of the list
  stands.
