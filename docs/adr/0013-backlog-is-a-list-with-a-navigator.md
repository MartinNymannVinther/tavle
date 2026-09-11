# ADR 0013: The backlog is one list; the decomposition is a navigator beside it

Status: accepted · Date: 2026-09-11 · Supersedes the section layout of
ADR 0012 (the type symbols and the "a row says only what is its own"
rule from 0012 stand)

## Context

ADR 0012 drew the backlog as a tree: epics as sections, features as
blocks, stories nested under them. It was clearer than the flat list of
0.10, and the owner's verdict on it was still "not good enough". The
reason is in the model, not the styling. The backlog has one order per
level (ADR 0011), and a Scrum team plans from the stories' order: what
is at the top goes in the next sprint. A tree that hangs the stories
under their features hides that order — a story ranked third in the
backlog sits under whatever feature it belongs to, next to stories
ranked thirtieth — so the page that exists for planning cannot show the
one thing planning needs. And a tree needs three visual weights and an
indent per level, which on a Scrum board beside the sprints leaves the
titles no room.

Four ways out were sketched with the demo's data: a navigator with a
flat list, cascading columns per level, epic tiles that open one at a
time, and a story map with the decomposition across and the sprints
down. The owner chose the navigator and the list now, and the story map
as the decomposition's own view next.

## Decision

**The list is flat and in the backlog's own order.** Every story in the
backlog, top to bottom as ranked, one line each: the symbol, the key,
the title, and under the title, small, the epic and feature it is part
of, with the parent's symbols. Points, priority and who at the right.
Moving a story past its neighbour is the same move as in the whole
backlog, because it is the whole backlog.

**The decomposition is a navigator on the left.** Epics with their
features indented under them, what has no parent at the bottom, each
with the number of backlog stories it holds; titles only. Clicking a
node narrows the list to that node's stories — every story under an
epic's features, a feature's own, or the stories with no feature — and
the list's heading becomes the item: symbol, key, title as a link to
the item page, the rules' marks, what it is done by, its place, how far
it is, and a way to start a feature under an epic. Under a narrowed
list the crumb under each title says only what the heading has not:
under an epic the feature, under a feature nothing. The epics fold in
the navigator, closed by default and remembered per board in the
browser as before; the arrows in the navigator rank an epic or a
feature among its level. Below the width for a column, the navigator is
one `<select>` above the list.

**The grouped views stay** (theme, area, kind) and apply to whatever the
navigator has narrowed the list to; the filters likewise. Quick add
starts a card under the selected feature, or in the selected epic's
area, so the place a person is looking at is the place a new card lands.

**The story map is the next view**, not part of this decision: epics and
features across the top, the sprints (on a Kanban board the columns)
down the side, stories in the cells. It shows the decomposition better
than any tree and is a separate build with its own ADR.

## Alternatives rejected

- **Keeping the tree and fixing its weights.** The problem was the
  order it hides, not the weights.
- **Cascading columns per level.** One ranked list per level, which is
  exactly the model, but each pane is narrow, a card is three clicks
  away, and the sprints have nowhere to stand on a Scrum board.
- **Epic tiles with one open at a time.** A fine overview and a poor
  planning surface; the overview page already answers "how is the work
  spread".
- **Remembering the selection on the server.** A way of looking, like
  the fold; the page opens on "all cards".

## Trade-offs accepted

- The shape of the decomposition is no longer visible in the list
  itself, only in the navigator and in the crumbs. The story map will
  carry that picture.
- The navigator takes fifteen rem of width. On a Scrum board the sprints
  therefore go beside the list only from a wide container, and under it
  before that.
- A story's inherited area and themes are still not on its line; the
  crumb and the heading say where it is, the filter and the grouping say
  what is where.
