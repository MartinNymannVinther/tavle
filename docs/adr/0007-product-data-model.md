# ADR 0007: The product's data model — six concepts and a record of moves

Status: accepted · Date: 2026-09-11

## Context

A board tool can grow a table for everything: swimlanes, epics, custom
fields, watchers, attachments, automation rules. Each one is reasonable
alone and together they are the reason people leave for a whiteboard.
Tavle's principle is as few concepts as possible, and the schema has to
hold that line while still carrying what a team needs to run a board for
real and read honest numbers from it afterwards.

## Decision

Six concepts the interface names: **board**, **column**, **card**,
**label**, **sprint**, **comment**. Two tables the interface never names
but the numbers depend on: **card_transitions** and **events**.

- A board belongs to a workspace, has a mode (`kanban` or `scrum`), a
  short uppercase key for card numbers, and two counters. Cards are
  numbered per board, gaplessly: the counter is bumped with an
  `UPDATE … RETURNING` inside the card's own transaction, so two people
  creating cards at once get two numbers and nobody gets a repeat. A
  deleted card's number is not reused; `WEB-12` means one thing forever.
- A column has a name the team chooses and a **category** the metrics
  read (`backlog`, `todo`, `doing`, `done`). Renaming a column changes
  nothing; changing its category re-clocks the cards in it. A WIP limit
  is a number the board shows against; it never refuses a card.
- A card has one column and, on a Scrum board, at most one sprint; a card
  with no sprint is the backlog. Its position is a `sort` number within
  its lane — the column on Kanban, the column within the sprint on Scrum,
  or the backlog — rewritten as whole thousands on every move
  (`modules/boards/ordering.ts`). Lanes hold tens of cards, and a
  numbering anybody can read in an export beats fractional keys that
  need a repair job.
- A card carries its own clocks: `started_at` the first time it enters a
  `doing` or `done` column, never cleared; `done_at` while it sits in
  `done`, cleared when it leaves. Those two columns make "how long did
  this take" a subtraction, not a replay.
- A sprint is `planned`, then `active`, then `closed`; one active sprint
  per board. Starting writes `committed_points` down; closing writes
  `completed_points` down. Neither is ever recomputed: velocity is a
  record, and a re-estimate next month does not rewrite what the team
  promised or did.
- `card_transitions` is one row per column change, with the category on
  both sides and the card's points at the time. The cumulative flow
  diagram is a replay of it; throughput and cycle time read the cards'
  clocks. Archiving writes a transition to the pseudo-category
  `archived`, so a card that leaves the board without being done stops
  being counted from that day.
- `events` is the board's structured history — a type and a payload,
  rendered into the reader's language by the interface — and the source
  of a card's activity feed. The AI's own writes are marked
  `actor_kind = 'ai'`.

Every one of these tables carries `org_id`, forced RLS and, except the
two logs, an audit trigger (ADR 0002, 0003). Deleting a workspace takes
them all with it through cascades, audit rows included, via the same
`delete_workspace()` function Ajour has.

## Alternatives rejected

- **Fractional ordering keys** (lexicographic or floating midpoints).
  Fewer writes per move, and unreadable numbers that eventually need
  renormalisation anyway. A lane is small; rewriting it is cheap and the
  export stays legible.
- **Deriving the clocks from the transition log.** One source of truth,
  and a join on every board render. The clocks are denormalised on
  purpose and set by the same function that writes the transition, so
  they cannot disagree.
- **Recomputing velocity from the cards.** Honest until somebody
  re-estimates or moves a card between sprints after the fact, at which
  point last quarter's velocity changes. Written down at close, it is a
  fact about that sprint.
- **Swimlanes, epics, custom fields.** Each is a real need for some team
  and a concept for every team. Left out of 0.9; each is a later decision
  with its own ADR if a real team asks for it.

## Trade-offs accepted

- A card cannot be in two sprints, and a sprint cannot span boards. Both
  are the simple shape and both are what a small team means by a sprint.
- Moving a card between sprints resets it to the first column unless the
  target is the active sprint. A card committed to a sprint that has not
  begun is not in progress, whatever it was before; that is opinionated,
  and it is written down here rather than hidden in a service.
- The backlog's order is the same `sort` column the board uses, in a lane
  of its own. A Scrum backlog card nominally sits in the first column; the
  column is meaningless until the card joins a sprint.
