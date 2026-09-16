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
 * neighbours it landed between. When those two neighbours are adjacent
 * numbers there is nowhere to land, and the whole lane is respaced.
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
  return respace(others, cardId, at, new Map(ordered.map((c) => [c.id, c.sort])));
}

/** The lane written out again as 1000, 2000, 3000 …, with the card at `at`. */
function respace(
  others: Positioned[],
  cardId: string,
  at: number,
  was: Map<string, number>,
): Array<{ id: string; sort: number }> {
  const settled = [...others.slice(0, at), { id: cardId, sort: Number.NaN }, ...others.slice(at)];
  const changes: Array<{ id: string; sort: number }> = [];
  settled.forEach((card, i) => {
    const sort = (i + 1) * STEP;
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
