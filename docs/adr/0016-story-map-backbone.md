# ADR 0016: The story map has its own backbone — chosen features, in the story's order

Status: accepted · Date: 2026-09-12 · Amends ADR 0015 · Amended by ADR
0032 (the bands down the map)

> Amended by ADR 0032: the bands down the map are no longer the
> sprints or the columns but the team's own releases, on both board
> types. Everything else below still holds.

## Context

ADR 0015 drew the map from the board alone: every feature, grouped
under its epic, in the backlog's rank. The owner tried it and asked for
three changes, pointing at Patton's original: only features across the
top; the team chooses which features stand on the map; and the team
chooses their order. In a story map the left-to-right order is the
narrative — what the user does first stands at the left — and that is a
different question from what the team builds first, which is what the
backlog's rank answers. He also asked for more air and a sticky-note
feel.

## Decision

**One column on the feature: `map_sort`.** Null means the feature is
not on the map; a number is its place from the left. It is the map's
own order and never touches `sort`, the backlog's rank. One service,
`placeOnMap(itemId, index | null)` in `structure/write-map.ts`, puts a
feature up at an index (the end when none), moves it, or takes it down;
`placeInLane` renumbers as the backlog does. Only a feature can go up,
and only an open one; a closed one may stay until somebody takes it
down, and the map hides it unless "show closed" is on. Going up and
coming down are events (`item.mapped`, `item.unmapped`); a move is not,
as a rank change is not.

**The tray is where features wait.** Under the map's header, the open
features not on the map, in the backlog's rank, each with its card
count. A click puts one up at the right end. A note on the backbone is
dragged past its neighbours, nudged with two arrows (every drag has a
button, as everywhere), and taken down from its menu. The map is
otherwise as ADR 0015 said: sprints or columns down, one cell per card,
the backlog's order inside a cell, the loose column last, a card's drag
the same write as anywhere else. Cards under a feature that is not on
the map are not drawn; the tray's count says they are there.

**No epic row.** The map is features and cards. The epic is on the
feature's page and in the backlog's navigator; the wall does not need
it, and without it every feature is one note of the same size.

**A wall, not a table.** The backbone's notes are sticky yellow
(`--sticky`, `--sticky-ink`, one pair in each theme), leaning a hair
alternately; cards are paper notes with a soft shadow; cells have air;
no hairline grid, only a shade on every other column and a dashed line
between rows — Patton's release slice.

## Alternatives rejected

- **The backlog's rank as the map's order.** No new data, but then the
  map cannot tell the story; it would be the backlog turned sideways.
- **Every feature on the map, hide the rest.** A map of thirty features
  is a spreadsheet. Building it up from a tray is how a story map is
  made on a wall, and a new feature is not on the map until somebody
  puts it there.
- **Order per browser.** Two colleagues would see two maps.

## Trade-offs accepted

- `map_sort` is the first field on an item that is about a view rather
  than the thing itself. It is one nullable number, it is exported with
  the item, and it earns its place because the order is a fact the team
  agrees on, not a way of looking.
- The demo seeds its open features onto the map in the words' order, so
  the demo has a wall from the first visit.
