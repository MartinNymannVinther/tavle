# ADR 0033: One rank, one number — a move writes one row

Status: accepted · Date: 2026-09-16 · Amends ADR 0007 (a card's `sort`
is a rank, not a place in a lane of its own), ADR 0013 (the flat list)
and ADR 0027 (the altitudes)

> Corrected 2026-09-17, not amended. The respace below was first written
> down as the lane put out again as 1000, 2000, 3000. The code was
> narrowed to a window around the landing the same evening this decision
> was taken, and the paragraph did not follow. What moved is the worst
> case inside the decision, not the decision — a move still writes one
> row — and it moved on the decision's own day. A back-pointer would
> send a reader looking for a second decision that was never taken, so
> the sentence is put right where it stands instead. Why the window is
> narrow is argued where it bites, in `modules/boards/ordering.ts`.

## Context

ADR 0013 made the backlog one flat list in the backlog's own order, and
ADR 0027 kept that order at every altitude. The list also shows the
cards already promised to an open sprint, marked with the sprint's name
and not draggable, so the whole of a feature is one look. It shows them
"standing where they stood" — the code said so in two places.

They did not stand there. `cards.sort` was a position _within a lane_,
and a card had a different lane depending on where it was: the backlog
is one lane for the whole board, while a card in the active sprint is
ordered within its column. Two numberings, both starting at 1000, were
then merged by raw value in the list. Two defects came out of that, and
a user test found both:

- Committing a card to the **running** sprint threw its row to the
  bottom of the backlog, while committing the same card to a **planned**
  sprint left it where it was. The two are the same promise to the
  person making it.
- One click on "Flyt op" re-shuffled every marked row on the page,
  because a move renumbered the whole backlog lane to 1000, 2000,
  3000 … while the marked rows kept numbers written in a column's
  numbering.

The second is the older mistake: renumbering a lane on every move made
every other row's number a function of somebody else's move.

## Decision

**A card's `sort` is its rank in the board's one priority, and the
backlog and the sprint's columns read the same number.** Committing a
card to a sprint never rewrites it, and neither does sending it back:
allocation is a promise, not a new priority, for the running sprint as
much as for a planned one. The backlog list can therefore merge the
free rows and the promised ones on the rank they share, which is what
it always claimed to do.

**A move writes one row.** `placeInLane` gives the moved card a whole
number between the two neighbours it landed between and leaves every
other number alone. Only when those two neighbours are adjacent whole
numbers — after roughly ten moves into the same gap, or on a tie — does
a move write more than the row a person moved: the window around the
landing is spread apart, growing outwards a row at a time until the
numbers just bounding it can hold everything inside with a whole number
each, and only that window is written. A lane with room somewhere near
costs two or three rows; the whole lane is the worst case, not the
ordinary one.

**The rank travels with the card, the column does not.** Entering the
active sprint a card keeps its column; entering a planned one it starts
over in the first column (unchanged from before). Only where it _sits_
changes; where it _stands_ does not.

## Alternatives rejected

- **A second column, `backlog_sort`.** One rank in the backlog, another
  on the board. It is a migration, a field to keep in step on every
  write, and two numbers that can disagree — which is the bug we have,
  made official.
- **Merging the list on something other than the rank.** There is
  nothing else to merge on: the key is creation order, not priority.
  The marked rows would have to be banished to a block of their own,
  and the one priority would stop being one.
- **Renumbering the whole priority — backlog and open sprints — on
  every backlog move.** It keeps the neat 1000, 2000, 3000 and heals
  old rows, but a drag on the board still renumbers a column on its
  own and would put those cards back at the top of the list. The
  renumbering itself is the thing to give up.
- **Fractions.** Halving a gap forever is the same idea without the
  repair, and it hands the export numbers nobody can read.

## Trade-offs accepted

- The numbers are no longer an even 1000, 2000, 3000 in an export; they
  are whole numbers in the right order, with gaps and, where a respace
  has made room, an even spread across the stretch it rewrote. Order is
  what they mean, and order is all they ever meant.
- Rows written before this decision keep the numbers their old lane
  gave them, so a board that has been used already can still show a
  marked row at a place no one chose. Nothing new drifts, and the next
  move of a row settles it.
- A card that moves between columns _on the board_ keeps its rank when
  the move does not say where it lands: picking a column from the menu,
  or dropping while a filter hides part of the column, changes where the
  card sits and not what it is worth. A drop that does say where is a
  re-ranking, as it looks like one. Settled in `write-cards.ts`, with
  the same reasoning as the sprint: the column is not a priority of its
  own. The undo of a sprint move follows it — the reverse restores the
  column and leaves the number alone, because the move no longer
  touched it.
- The arrows and the drag move a card past the row beside it in what is
  read, marked rows included: `reorderBacklog` names the row it passes
  instead of counting an index in a list half the rows could not be in,
  and ranks against the board's whole priority. The first cut of this
  decision let them rank against the free rows alone and accepted the
  vault that follows — one press carried a card past three rows nobody
  had pointed at, which a user test duly found. A marked row is a place
  to land and never a thing to move: the service still refuses to rank a
  card that is promised to a sprint, which is why dragging one out of a
  sprint takes the promise back first and ranks it second.
