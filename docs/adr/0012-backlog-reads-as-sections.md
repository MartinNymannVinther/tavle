# ADR 0012: The backlog reads as sections, and every kind of thing has a symbol

Status: accepted · Date: 2026-09-11

## Context

0.10 gave the backlog its structure (ADR 0011) and drew it as one flat
list: every epic, feature and story a row of the same height and
weight, the level as an uppercase word in a column, and the area and
themes repeated as chips on each row, inherited or not. On the Scrum
board, where the sprints take two fifths of the width, the chips and
the counts pushed the titles down to "Medlemm…". Three levels that look
alike are not a hierarchy, and a row that repeats its parent says
nothing of its own. The owner's verdict on the first walk through was
that it was neither pretty nor clear, and that the kinds of thing
should be told apart by a symbol, not a word.

## Decision

**Three levels, three weights.** An epic is a section head on the
secondary ground, two lines deep: the key, the title and the rules'
marks, then its place (kind, area, themes), what it holds and a way to
start a feature under it; a progress bar at the right says how many of
its stories are done. A feature is one line under the epic, behind an
indent rule, with its own progress and how many of its stories are
under way elsewhere. A story is the lightest line: symbol, key, title
and the planning facts (points, priority, who). The same story line is
used in the grouped views and in the sprints, so a card looks the same
wherever it is listed.

**A row says only what is its own.** A feature under an epic and a
story under a feature show the area and themes only where they differ
from the parent; in a view grouped by theme or area the heading's value
is left out of the rows. The chips stop repeating and the titles get the
width. The full place of a card is still one click away on the card.

**One symbol per kind of thing, everywhere.** A flag for an epic, a
puzzle piece for a feature, a note for a card, a bug for a bug and a
wrench for enabler work, each on its own tint and each carrying its word
for assistive technology (`src/components/board/type-icon.tsx`). The
symbol replaces the level word in the backlog, stands before the key on
the item and card pages, in the item's children, on the roadmap and in
the "part of" line on the board's cards, and sits inside the bug and
enabler chips. Meaning never rests on the shape alone; the word is there
for a screen reader and as a tooltip.

**Folded by default, remembered per browser.** The page opens with only
the epic sections and the "no parent" section visible, closed. What a
person folds out is kept per board in the browser's local storage; the
features under an open epic are open unless folded in. "Fold all" and
"unfold all" sit in the toolbar. The fold is a way of looking, so it is
never written to the server and never shared.

**The header in two layers.** The title and the two "new" buttons on
the first line; the grouping as a segmented choice, the closed-items
switch and the fold on the second; the filters on the third. Ticking a
story on a Scrum board brings up one bar with the count, the target
sprint and the button; nothing else in the header changes. A Kanban
board, which has no sprint to commit to, draws no tick boxes at all.

## Alternatives rejected

- **A table with columns.** Aligns the keys and the facts, and loses the
  hierarchy the moment a row is indented. The backlog is a tree first.
- **Icons without tints, or tints without icons.** Either alone is
  learnable; the pair is recognised at a glance, and the palette has the
  five tints already.
- **Folding kept on the server, per person.** True across devices and
  costs a table, a service and a write on every click for a preference
  that is reset by "unfold all". Not worth it until a team asks.
- **Opening the page with everything unfolded.** The owner chose the
  overview: a page of epics first, the detail on request.

## Trade-offs accepted

- A story's inherited area and themes are not visible on its backlog
  row. Somebody scanning for "everything in Betalinger" uses the filter
  or the grouping, which exist for exactly that.
- The fold state lives in one browser. Another device opens the page
  folded.
- Five symbols are five things to learn. They are the same five on every
  page, which is what makes them worth learning.
