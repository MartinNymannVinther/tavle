# ADR 0031: The overview becomes a workbench

Status: accepted · Date: 2026-09-16

## Context

The overview page showed five health percentages and three distribution
cards. Read honestly it had no job: the numbers were not actionable
(nothing linked to the items behind them), the warning colour lit at
any count above zero so a real board sat permanently amber, the five
measures used different denominators in one row, two of them were
almost always zero, and the three distributions repeated the same
total three times while duplicating a number already shown as a tile.

Worse, it called a supported state a fault. Rule 3 and the product's
own words say the tool never invents a container and shows items
without a parent as exactly that — yet "Uden forælder 50 %" was
coloured as decay.

The owner asked for a rethink: a page that helps a product owner keep
the backlog in good order, plain enough for the whole team, and a
coach that gives guidance.

## Decision

**The page becomes Backlog care: findings first, weight second.**

A finding is a list, never a percentage. Each one names how many, says
in a sentence what it means, and folds out to the rows themselves —
every row a link to the card or item, because a page that only counts
leaves the work exactly where it was. Findings carry a tone: _decide_
(somebody must choose), _tidy_ (debt worth clearing), _note_ (worth
knowing).

Two rules keep it honest. **A finding appears only when it has
something to show**, so a tended backlog shows a short page and says
so; nothing is permanently amber. And **nothing is a verdict**: work
without a parent is listed as a decision waiting, with the reason
written out, not as a failure.

The findings are: waiting for a place, missing a done-when, features
with no work, epics with no features, epics to revisit, unweighed at
the top of the rank, and a backlog ranked deeper than the team's
velocity will reach. All computed from the board as it stands, with no
model involved, so the page is whole on an installation with no AI
(dogma two).

The three distribution cards become one section with an axis picker,
so the total is stated once.

**The coach is deferred, and will not be a chat.** The owner asked for
an AI PO coach in dialogue form; the shape is wrong for this product
and the reasoning is recorded here so it is not relitigated from
scratch. Every AI surface in Tavle is a proposal attached to the thing
it concerns, with a yes and an undo (dogma five). A chat window is a
different contract: open-ended, unattached, and its output cannot be
applied or reversed. It would also need conversation storage, a
retention decision, a wider prompt-injection surface — user text is
fenced as data today — and a token cost that does not fit the call
ceilings. When the coach is built it will be a review: a handful of
ranked observations, each attached to real items with an action, the
pattern already proven by the close conversation and the review brief.

## Trade-off accepted

The route stays `/overview` while the surface is called Backlog care,
so existing links keep working; the name lives in the tab and the
page, not the URL. The five old health percentages are gone rather
than kept alongside — a page cannot both nag and help, and the
findings say the same things where they were true.

Findings are computed on every page load from the board already in
memory. That is the same promise the insight page makes — nothing
cached, nothing estimated — and it costs one pass over cards and
items.
