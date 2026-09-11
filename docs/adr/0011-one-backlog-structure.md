# ADR 0011: One backlog structure — a hierarchy that finishes, categories that never do

Status: accepted · Date: 2026-09-11

## Context

A backlog that grows with the team grows in one of two ways. The good
way is more cards under more features under more epics, each of which
closes when its result is reached. The bad way is theme-epics, "Diverse"
epics and epics that never close: containers invented to answer "what
belongs to what" and "what is this for", which are questions of
grouping, not of decomposition. Once a container exists people put
things in it, and a backlog that has grown that way is the one teams
leave for a whiteboard.

Tavle 0.9 had cards, labels and nothing above them. That is honest for a
Kanban board of fifteen cards and useless for a Scrum board of three
hundred.

## Decision

One structure, with one hard boundary: the hierarchy is used only to
break the product down; every question of overview, grouping and
belonging is answered by fields on the item.

Two tests decide where a thing belongs, and the tool enforces them
rather than a policy. Can it be finished? Then it is in the hierarchy.
Can it never be finished? Then it is a category. And: does it have
exactly one parent? Then it is hierarchy. Can it belong to several at
once? Then it is a category.

**The hierarchy** is epic → feature → card (the story), all one
relation, "part of". An epic is a result the team reaches in one or two
quarters, has no parent and must say when it is done. A feature is a
releasable slice of an epic, one to three sprints, at most one epic as
parent, and must also say when it is done. A card is the smallest
deliverable, fits one sprint, has at most one feature as parent;
acceptance criteria are optional. A bug is a card with a flag, not a
fourth level. There is no level above epic: an initiative level moves
the problem one floor up, and people use it for themes.

**The kind** — business or enabler — is a field on every level, never a
separate tree or backlog. An enabler carries a subtype (architecture,
infrastructure, exploration, compliance) that can only be set when the
kind is enabler; the purpose is to see how much capacity goes where,
not to run the work differently. Children inherit the kind at creation
and may differ.

**The categories** are two closed lists per board, each value with a
named owner. Theme answers why (Selvbetjening, Stabil drift,
Regulatorisk); an item may carry several, a theme never finishes and
has no status, and the list closes at eight. Area answers where
(Betalinger, Login, Rapportering); an item has at most one. Both are
inherited from the parent when an item is created or moved, and can be
changed on the item afterwards; a change on the parent never cascades by
itself, the tool offers to take the children along. Values are
deactivated, never deleted, so history keeps its names. There are no
free-text tags and no custom fields.

**Labels are gone.** The defaults of 0.9 — Fejl, Forbedring, Teknisk
gæld — are precisely what the structure replaces with the bug flag, the
kind and the categories, and labels were the one thing in the product
that looked like free tags. Nobody used Tavle yet, so the table is
dropped in its own migration (`drizzle/0005`) and the audit log keeps
the rows.

**The rules**, blocking (the tool refuses) and warning (the tool says so
and lets the person continue), live in `src/modules/boards/structure`:

1. A parent is exactly one level up, on the same board. Enforced in the
   service and again by two database triggers.
2. An item has at most one parent. Enforced by having one column.
3. An item without a parent needs an area. Checked when an item is
   created or when its parent or area changes, so a title edit on an old
   card is never refused for a missing area.
4. Epic and feature must say when they are done. Schema, service and a
   database constraint all refuse an empty one.
5. An enabler subtype only on an enabler. Service and constraint.
6. The tool never creates containers: no automatic "Diverse" epic, no
   default feature. Items without a parent are shown as exactly that, in
   a group at the bottom of the hierarchy.
7. An epic or feature whose title equals a theme's or area's name gets
   "Det ligner et tema, ikke et resultat".
8. A title of one or two words gets the same warning; a heuristic, not
   a verdict.
9. An epic open longer than the board's setting (180 days) is marked
   "Til revision" until it closes or an owner confirms it is still a
   result; the clock then starts over. Any member may confirm; the
   confirmation is a line in the item's activity with a name on it.
10. Closing a feature or an epic with open children is a conversation:
    the first call answers the children, the second carries a decision
    for each — close (a feature with nothing open under it), archive (a
    story), move (to another parent one level up) or keep without a
    parent — and nothing closes on its own.
11. A change of theme or area on a parent does not cascade; the same
    action offers to update the subtree.

Ranking is one order per level, business and enabler alike; a move to
another parent takes the subtree with it because the subtree is defined
by the parent link. Card numbers are shared across levels, so `WEB-12`
names one thing on the board.

**The views.** The backlog is one list with a grouping — hierarchy by
default, or theme, area or kind — and filters on theme, area, kind and
the bug flag; on a Scrum board the sprints stand beside it as before, on
a Kanban board the backlog is the cards in its backlog columns. The
roadmap draws epics on a line of quarters, coloured by their first
theme, filtered by area, with the review mark on the bar; an epic gets
its place from an optional target quarter, and an open epic without one
is listed as unplanned rather than drawn to nowhere. The overview shows
open cards and points per theme, area and kind, the enabler share as
one number, and five health measures: the share of features and stories
without a parent, the epics for review, the items without an area, the
enabler share, and the themes and areas nobody uses.

All of it is per board, like columns and sprints: a board is one team's
work, and two teams on one product maintain two lists until a real team
asks for shared ones.

## Alternatives rejected

- **Labels alongside the structure.** Two systems for one need, and the
  one that looks like tags wins by being easier. Removed instead.
- **Themes and areas at workspace level.** Right for one product with
  several teams, wrong for a workspace with unrelated boards; per board
  is the simple shape and the one every other list in Tavle has.
- **An initiative level above epics.** The problem one floor up.
- **Rule 3 waived while a board has no areas.** It would make the rule a
  suggestion on the day it matters most. A new board asks for its first
  area instead, named by the team, and a card without a parent names it
  or a feature from the first click.
- **Dates on epics for the roadmap.** A target quarter is coarse on
  purpose: an epic is a quarter or two, and a day-precise end on a
  quarter-sized thing is false precision.
- **Deriving the roadmap from sprints.** Honest and empty until the
  work is under way, with no forward plan at all.

## Trade-offs accepted

- A card in a feature that closes with open stories is archived, moved
  or orphaned by the person closing; a story is never "closed" by a
  parent. That makes the close dialog longer and the backlog truer.
- The hierarchy view ranks features globally but shows them under their
  epics, so the arrows move a feature past its neighbour under the same
  epic; the server computes the position from the whole lane. A feature
  can be ranked above one under another epic only by moving both.
- The title warnings are heuristics in two languages' word counts. A
  two-word result ("Kunder betaler") is warned about; the person
  decides.
- Every epic and feature is an extra row to read on the backlog page
  and the roadmap. A board holds tens of them; the pages read the board
  once, as before.
