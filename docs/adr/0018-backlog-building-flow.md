# ADR 0018: Building the backlog is one surface, and rule 4 bites at the close

Status: accepted · Date: 2026-09-14

## Context

The owner's verdict on building a Scrum backlog was "a convoluted
process where you have to find your way around" — especially choosing a
feature and attaching cards. The measurements agreed: a feature with
three cards under it cost eleven interactions in the best case, and
re-parenting an existing card cost a full page navigation per card,
with the backlog's navigator selection, filters and ticks lost on every
return. The feature's own page could not receive cards and said so in
its empty state. The one fluent gesture — dragging a card into a
feature — lived on the story map tab, invisible from the backlog.

## Decision

**The navigator takes drops.** It is the page's picture of the
decomposition, so it is also the drop zone: a backlog row dragged onto
a feature (or onto "no parent") is the same placement call as the story
map's drag. One gesture, one meaning, everywhere.

**The ticks place as well as commit.** The selection bar that commits
ticked cards to a sprint also puts them under one feature, through one
new action (`placeCardsAction`) that runs the ordinary placement rules
per card in one transaction. Kanban backlogs get the ticks too; the
sprint half of the bar stays Scrum's.

**Creating follows through.** "New feature" starts under the epic the
navigator has chosen; after a create the epic unfolds, the new node is
selected and quick-add is primed to it, so three cards are three
titles. Quick-add stands above the list rather than under it, its
features are grouped under their epics, and a half-typed title survives
a navigator click. The feature page gets the same fixed quick-add as a
map cell, closing its dead end.

**The choice lives in the URL.** `?valg=` names the navigator's
selection, written with replaceState. The way back from a card page
lands where the person left.

**Rule 4 moves to the close.** "An epic or feature says when it is
done" used to block creation, which interrupted backlog *shaping* with
backlog *specification* — you could not jot a feature down without
writing acceptance prose first. The rule's point is the first of the
two tests: *can it be finished*. That claim is made when the item
closes, so that is where the rule now refuses; until the done-when is
written, the item carries a warning mark in the heading and on its
page. The trade-off accepted: an item can exist for a while without
its criterion, marked but not blocked — shaping and specifying are two
different sittings.

**The roadmap builds too.** A new epic from the roadmap's header or
from a quarter's own "+", with the quarter filled in; every open epic's
target quarter is a select on its row, planned and unplanned alike.
The roadmap stays a derived view — it writes through the same item
actions as everywhere else.

## Alternatives rejected

- **A combobox with search for the place select.** A dependency and a
  new control for what grouping the existing select already fixes.
- **Keeping rule 4 at creation with an "empty allowed" flag.** A rule
  with a bypass teaches that the rule is negotiable; moving *when* it
  binds keeps it absolute.
- **Server-remembered navigator selection.** A way of looking belongs
  to the browser (ADR 0013); the URL is enough for the return trip.
