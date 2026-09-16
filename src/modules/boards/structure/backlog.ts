import type { BoardFull, CardView } from "@/modules/boards/types";

/**
 * What "the backlog" means, in one place. Two pages and one health
 * check ask the question — the list itself, the care summary, the
 * navigator — and they must answer with the same set of cards, or a
 * headline says thirteen and the page it links to shows five.
 *
 * The answer differs by board type, which is the whole reason it needs
 * writing down: a Scrum board's backlog is what has no sprint yet, a
 * Kanban board's is what stands in a backlog column.
 */

/** The stories that are in the backlog, in the backlog's own order. */
export function backlogStories(full: BoardFull): CardView[] {
  const { board, columns, cards } = full;
  let inBacklog: (card: CardView) => boolean;
  if (board.mode === "scrum") {
    inBacklog = (card) => !card.sprintId;
  } else {
    const backlogColumns = columns.filter((c) => c.category === "backlog").map((c) => c.id);
    const ids = backlogColumns.length > 0 ? backlogColumns : columns.slice(0, 1).map((c) => c.id);
    inBacklog = (card) => ids.includes(card.columnId);
  }
  return cards.filter(inBacklog).sort((a, b) => a.sort - b.sort || a.number - b.number);
}

/**
 * Scrum: the cards already committed to an open sprint and not yet done.
 * They left the backlog's order, but not the backlog's sight — the list
 * shows them marked with their sprint, so the whole of a feature is one
 * look (docs/adr/0027).
 */
export function allocatedStories(full: BoardFull): CardView[] {
  if (full.board.mode !== "scrum") return [];
  const open = new Map(full.sprints.filter((s) => s.state !== "closed").map((s) => [s.id, s]));
  return full.cards
    .filter((c) => c.sprintId && open.has(c.sprintId) && !c.doneAt)
    .sort((a, b) => {
      const sprintA = open.get(a.sprintId!)!;
      const sprintB = open.get(b.sprintId!)!;
      return sprintA.number - sprintB.number || a.sort - b.sort || a.number - b.number;
    });
}
