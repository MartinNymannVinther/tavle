# ADR 0019: The roadmap's bars are the plan — a chosen start, moved and stretched in place

Status: accepted · Date: 2026-09-14

## Context

The roadmap drew an epic from the quarter it was _created_ in to its
target quarter. The start was history, not intent: a bar's length said
"how long this has existed", never "how long we plan for it". The owner
asked for an interactive roadmap — move an epic, change its duration —
and duration cannot be changed when one end of the bar is a fact.

## Decision

**An epic may choose its start.** `backlog_items.start_quarter`,
nullable; null keeps today's honest fallback, the creation quarter. The
span is epics-only — features have no bar — and a span the wrong way
round is swapped rather than refused, the same grace dates get. With
the same migration the old `done_when <> ''` database check goes: rule
4 moved to the close in ADR 0018, and the constraint predates that
decision.

**The bar is the control.** Dragging its middle moves the whole span;
dragging an edge changes the duration; the preview snaps to whole
quarters and one write happens on release, optimistically, rolled back
if the server says no. Two small selects under the title do the same
without a pointer, because every move also exists as a control. The
unplanned list keeps its single target select — planning an epic the
first time is choosing where it ends.

## Trade-offs accepted

- The bar no longer always shows how long an epic has been open; the
  review mark and the item page carry that. A plan view and a history
  view were fighting over one bar, and the plan won.
- A drag is clamped to the quarters on screen; planning further out
  goes through the selects, and the axis grows on the next paint.
