# ADR 0010: Every number is computed from the record, on request

Status: accepted · Date: 2026-09-11

## Context

Board tools are judged by their charts, and charts are where board tools
lie: a burndown drawn from a nightly aggregate, a velocity that changes
when somebody re-estimates last quarter's cards, a cycle time averaged
over cards that were never started. A team that cannot trust a number
stops looking at it, and a number nobody looks at is a feature nobody
uses.

## Decision

The insight page (`src/modules/boards/metrics`) computes everything when
it is asked, from three sources and nothing else:

- **The cards' own clocks** (`started_at`, `done_at`, `created_at`) give
  throughput — cards done per ISO week — and cycle time (pick-up to
  done) and lead time (creation to done), as median and average over the
  cards finished in the last 30 days. A card never picked up has no cycle
  time and is left out of that average, not counted as zero.
- **The transition log** (`card_transitions`) is replayed day by day into
  the cumulative flow diagram: for each of the last 30 days, how many
  cards sat in each category at the end of that day in Copenhagen. Cards
  that existed before the window are seeded from their last transition
  before it, so day one is not empty.
- **The sprints' written-down points** (`committed_points` at start,
  `completed_points` at close) give velocity, with the plain average of
  the last three as the forecast. The burndown of a running sprint is the
  committed points less the points on cards done by the end of each day,
  which means scope added after the start shows as a bump — on purpose.

The functions are pure and tested against fixed inputs; the page fetches
rows and hands them over. Nothing is cached and no aggregate table
exists. A board has hundreds of cards at most; the computation is
milliseconds, and a number that can be recomputed from its source is a
number nobody has to doubt.

## Alternatives rejected

- **Nightly aggregates.** Faster at a scale Tavle does not have, and a
  second truth that drifts from the first the moment a migration or a
  bug touches one of them.
- **Cycle time from the transition log** rather than the clocks. More
  general — it could measure time in any column — and a replay on every
  page view. The clocks answer the question a small team actually asks;
  per-column time is a later feature that the log is already there for.
- **Story-point burndown that ignores scope change** (drawing from the
  committed total down, only). Prettier and dishonest; a burndown that
  hides scope creep is decoration.

## Trade-offs accepted

- A card done in the last hour of a winter day (between 22:00 and 23:59
  UTC) lands on the right Copenhagen day, because the end of a day is
  computed with the real offset. The tests pin both seasons.
- The cumulative flow reads the last 35 days of transitions plus one
  seed row per older card; a board with years of history reads a little
  more each year. When that matters, the seed query is the one to
  narrow.
