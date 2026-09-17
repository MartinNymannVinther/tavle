/**
 * Whether a board's decomposition is still bare. It is the one question
 * that decides which of the two AI offers stands in the slot beside the
 * backlog and the breakdown (docs/adr/0037).
 *
 * The starting point (docs/adr/0021) proposes areas, themes and a whole
 * tree at once: it is a midwife for an empty board, and on a board the
 * team has already built it would lay a second structure down beside the
 * first. So it is offered only while there is next to nothing for it to
 * collide with, and from there on the assistant takes the slot.
 *
 * The threshold: fewer than three epics and features together. Zero is
 * too strict — one epic jotted down by hand is not a backlog, and the
 * team that jotted it is exactly the team a starting point helps. Three
 * is a judgement call and nothing more, which is why it lives here
 * alone: moving the number moves both call sites and neither has an
 * opinion of its own.
 *
 * Closed items count. A team that finished its first epics has built a
 * backlog and worked it; that the work is done is no reason to offer to
 * start the backlog over.
 */
export const BARE_DECOMPOSITION_LIMIT = 3;

export function isBareDecomposition(items: Array<{ level: string }>): boolean {
  const built = items.filter((item) => item.level === "epic" || item.level === "feature");
  return built.length < BARE_DECOMPOSITION_LIMIT;
}
