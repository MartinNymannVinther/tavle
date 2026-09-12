# ADR 0014: A board chooses how much of the structure it shows, and only shows

Status: accepted · Date: 2026-09-12

## Context

ADR 0011 gave every board the whole structure: three levels and three
fields. A team of four running a Kanban board for support tickets does
not want epics, and a team starting out does not want to choose a theme
for every card on day one. The owner asked for a board to be able to
run with epics, features and cards, with features and cards, or with
cards alone, and to switch the kind, the themes and the areas off and
on, with one condition: only the view changes, so a board can grow into
the structure later, or step back from it, without losing anything.

## Decision

**Four columns on the board, and nothing else.** `structure_levels`
("epic", "feature" or "card": the top level in use) and `show_kind`,
`show_themes`, `show_areas`. They are set on the new-board dialog and
under the board's settings, "Struktur". Changing them writes one row
and one event; no item, card, theme or area is touched. What is hidden
stays in the tables and comes back whole when it is shown again.

**One reading of the flags, everywhere.** `structureView(board)` in
`src/modules/boards/structure/view.ts` turns the columns into five
booleans, and `structureOf(full)` puts them in the lookup every page
reads, with the hidden levels' items already left out. From there the
pages follow: the backlog shows the navigator only with features and
the "new epic" and "new feature" buttons only for levels in use; a
hidden level's children stand as parentless in the navigator; the crumb
under a story, the dots, the enabler chip and the area name appear only
for fields shown; the filters, the groupings, the property panels, the
item form, the quick-add's choice of place and the overview's tiles and
distributions are cut to the same view; the roadmap tab exists only
with epics, and the legends name only the symbols in use.

**Rule 3 on a board that hides areas.** A thing with no parent needs an
area (ADR 0011), and on such a board nobody can choose one. The owner
chose that the board's first active area is set quietly on anything
created or placed without a parent while areas are hidden
(`settleArea` in `structure/write-lists.ts`). It is a real area on a
real row, it shows the day the field is switched on, and the rule
itself is untouched: with areas shown, the refusal is as before.

## Alternatives rejected

- **Per workspace.** One choice for unrelated boards; the owner chose
  per board, as with themes and areas.
- **Relaxing rule 3 while areas are hidden.** Honest, and it would
  leave cards without an area that the overview then counts as a health
  problem the day the field returns; the owner preferred a card that
  always has a place.
- **Deleting hidden items on switch-off.** Would make the choice a
  migration with a confirmation dialog and no way back. The whole point
  was the way back.

## Trade-offs accepted

- A card created while features were hidden has no feature, and one
  created while themes were hidden has no themes; switching the fields
  on shows honest gaps, not invented values. The exception is the area,
  by the owner's choice.
- An epic or feature page stays reachable by URL while its level is
  hidden. Harmless, and it keeps links in comments and history alive.
- The two boards of the demo run the full structure; a board that
  starts small is a click away in the new-board dialog.
