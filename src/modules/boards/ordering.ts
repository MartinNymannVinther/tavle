/**
 * Where a card sits in its lane, as pure arithmetic.
 *
 * A lane is the list of cards that are ordered against each other: a
 * column on a Kanban board, a column within the active sprint on a Scrum
 * board, or the product backlog. A move gives the moved card a whole
 * number between its new neighbours and leaves every other number where
 * it was, so a rank keeps its meaning across the lanes that share the
 * field: on a Scrum board the backlog and the sprint's columns are one
 * priority read in two places (docs/adr/0033), and nobody else's row
 * stirs when one card moves. Only when two neighbours have no whole
 * number left between them is the lane respaced by STEP again, which is
 * the rare case and the only one that writes more than a single row.
 */

export const STEP = 1000;

export type Positioned = { id: string; sort: number };

/** The lane in display order. Ties keep the input order, which is insertion order. */
export function sortLane<T extends Positioned>(lane: T[]): T[] {
  return [...lane].sort((a, b) => a.sort - b.sort);
}

/** The sort value a new card gets at the end of a lane. */
export function sortAtEnd(lane: Positioned[]): number {
  return lane.length === 0 ? STEP : Math.max(...lane.map((c) => c.sort)) + STEP;
}

/** The sort value a new card gets at the top of a lane. */
export function sortAtTop(lane: Positioned[]): number {
  return lane.length === 0 ? STEP : Math.min(...lane.map((c) => c.sort)) - STEP;
}

/**
 * Places `cardId` at `index` in the lane and answers the numbering that
 * changed. The card may or may not already be in the lane; either way it
 * ends up exactly once, at the asked-for position, clamped to the lane's
 * length. Normally that is one row: the moved card, numbered between the
 * neighbours it landed between. When those two neighbours leave no whole
 * number between them, the rows around the landing are spread out — as
 * few of them as will make room, never the whole lane.
 */
export function placeInLane(
  lane: Positioned[],
  cardId: string,
  index: number | undefined,
): Array<{ id: string; sort: number }> {
  const ordered = sortLane(lane);
  const from = ordered.findIndex((c) => c.id === cardId);
  const others = ordered.filter((c) => c.id !== cardId);
  const at = index === undefined ? others.length : Math.max(0, Math.min(index, others.length));
  // Already standing there: the lane is left alone, and no row is written.
  if (at === from) return [];
  const above = others[at - 1];
  const below = others[at];
  if (!above && !below) return [{ id: cardId, sort: STEP }];
  if (!above) return [{ id: cardId, sort: below!.sort - STEP }];
  if (!below) return [{ id: cardId, sort: above.sort + STEP }];
  const room = below.sort - above.sort;
  if (room >= 2) return [{ id: cardId, sort: above.sort + Math.floor(room / 2) }];
  return spread(others, cardId, at, new Map(ordered.map((c) => [c.id, c.sort])));
}

/**
 * Making room where there is none.
 *
 * The first cut of this wrote the whole lane out again as 1000, 2000,
 * 3000 …, which is fine for a lane of six and quite another thing for a
 * board carrying years of work: every card rewritten, every one of them
 * re-stamped and audited, for one press of an arrow. Rows numbered
 * before the one-rank decision (docs/adr/0033) arrive in blocks holding
 * the same number, so a real board hit that on its first move.
 *
 * So the window grows from the landing outwards, one row at a time,
 * until the numbers just outside it can hold everything inside with a
 * whole number each — and only that window is written. A lane with room
 * somewhere near costs two or three rows; the whole lane is the worst
 * case, not the ordinary one.
 */
function spread(
  others: Positioned[],
  cardId: string,
  at: number,
  was: Map<string, number>,
): Array<{ id: string; sort: number }> {
  let lo = at;
  let hi = at;
  for (;;) {
    const under = others[lo - 1];
    const over = others[hi];
    // The moved card plus the rows inside the window, each needing a
    // whole number of its own between the two that bound it.
    const need = hi - lo + 1;
    const gap = under && over ? over.sort - under.sort - 1 : Number.POSITIVE_INFINITY;
    if (gap >= need) return written(others, cardId, at, lo, hi, under, over, need, was);
    // Widen upwards first: a card put between two crammed rows pushes
    // the ones after it along, which is what the eye expects, and it
    // keeps the numbers positive instead of digging below the lane.
    if (hi < others.length) hi += 1;
    else if (lo > 0) lo -= 1;
    else return written(others, cardId, at, lo, hi, undefined, undefined, need, was);
  }
}

/** The window's rows, evenly spread between the numbers that bound it. */
function written(
  others: Positioned[],
  cardId: string,
  at: number,
  lo: number,
  hi: number,
  under: Positioned | undefined,
  over: Positioned | undefined,
  need: number,
  was: Map<string, number>,
): Array<{ id: string; sort: number }> {
  const inside = [
    ...others.slice(lo, at),
    { id: cardId, sort: Number.NaN },
    ...others.slice(at, hi),
  ];
  // An open end is spread by the lane's own step, so the numbers stay
  // the round ones a person reading an export would expect.
  const first = under ? under.sort : over ? over.sort - need * STEP : STEP;
  const step = under && over ? Math.floor((over.sort - under.sort) / (need + 1)) : STEP;
  const base = under ? first + step : first;
  const changes: Array<{ id: string; sort: number }> = [];
  inside.forEach((card, i) => {
    const sort = base + i * step;
    if (was.get(card.id) !== sort) changes.push({ id: card.id, sort });
  });
  return changes;
}

/**
 * The one priority as one sequence: the rows a person can still rank and
 * the ones already promised to a sprint, merged on the rank they share
 * (docs/adr/0033). A promised card stands where it stood — the list
 * marks it rather than moving it — and ties fall back to the key, which
 * is the order the cards were made in.
 */
export function mergeByRank<T extends { sort: number; number: number }>(
  free: T[],
  promised: T[],
): Array<{ card: T; committed: boolean }> {
  return [
    ...free.map((card) => ({ card, committed: false })),
    ...promised.map((card) => ({ card, committed: true })),
  ].sort((a, b) => a.card.sort - b.card.sort || a.card.number - b.card.number);
}
