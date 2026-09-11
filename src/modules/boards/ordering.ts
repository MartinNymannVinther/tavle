/**
 * Where a card sits in its lane, as pure arithmetic.
 *
 * A lane is the list of cards that are ordered against each other: a
 * column on a Kanban board, a column within the active sprint on a Scrum
 * board, or the product backlog. Every move rewrites the whole lane as
 * whole numbers spaced by STEP, so the numbers stay readable in an export
 * and never drift into fractions that need a repair job. Lanes hold tens
 * of cards, not thousands; the simple thing is the right thing here.
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
 * Places `cardId` at `index` in the lane and answers the whole lane's new
 * numbering. The card may or may not already be in the lane; either way
 * it ends up exactly once, at the asked-for position, clamped to the
 * lane's length. Returns only the cards whose number changed, so the
 * caller writes as little as possible.
 */
export function placeInLane(
  lane: Positioned[],
  cardId: string,
  index: number | undefined,
): Array<{ id: string; sort: number }> {
  const ordered = sortLane(lane).filter((c) => c.id !== cardId);
  const at = index === undefined ? ordered.length : Math.max(0, Math.min(index, ordered.length));
  ordered.splice(at, 0, { id: cardId, sort: Number.NaN });
  const before = new Map(lane.map((c) => [c.id, c.sort]));
  const changes: Array<{ id: string; sort: number }> = [];
  ordered.forEach((card, i) => {
    const sort = (i + 1) * STEP;
    if (before.get(card.id) !== sort) changes.push({ id: card.id, sort });
  });
  return changes;
}
