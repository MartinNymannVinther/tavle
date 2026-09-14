# ADR 0023: Features plan on sprints — and sprints can be laid ahead

Status: accepted · Date: 2026-09-14

## Context

The owner wants features planned on a timeline the way epics are
planned on quarters. Two units were on the table: weeks, or sprints —
and sprints won, in the owner's own words: laying a run of sprints
ahead of time "could actually be a very good idea". Sprints are already
the board's time unit; weeks would have been a new concept invented for
one view.

## Decision

**Sprints ahead of time.** One button lays a run of planned sprints
back to back from the last one's end, each the board's own
`sprintLengthDays`, numbered and named on from the counter. Twelve
planned sprints is the ceiling — a plan further out is what the epics'
quarters are for. Scrum only; refused elsewhere.

**A feature spans sprints like an epic spans quarters.**
`start_sprint_id` and `target_sprint_id` on `backlog_items` (FK, set
null when a sprint goes), features only, null is unplanned. A span the
wrong way round is swapped; one end alone means one sprint; both null
unplans. The plan is a marker for the roadmap — it commits no card to
any sprint; the cards' own sprint commitment is untouched and a later
insight may compare the two.

**The roadmap carries both axes.** A toggle on the roadmap page:
"Epics · kvartaler" and "Features · sprints". The feature view is the
epic view's twin — sprint columns with the active one marked, bars
coloured by first theme with the epic as crumb, drag the middle to
move and an edge to stretch, two selects as the pointerless path,
optimistic with rollback — and the unplanned features wait underneath
with a way in. The plan change is an event with its reverse (ADR
0022), so Fortryd came along for free.

## Trade-offs accepted

- Two planning surfaces (quarters and sprints) that nothing forces
  into agreement; honesty over enforcement, and the overview can later
  say when they disagree.
- Undoing a sprint series is not carried: deleting sprints is not a
  thing the product does lightly, and empty planned sprints are
  harmless. A later decision if real use complains.
- Kanban boards have no feature timeline yet; week-based planning
  there is its own decision, not a fallback smuggled in.
