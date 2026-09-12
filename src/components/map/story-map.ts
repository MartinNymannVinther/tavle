import type { Column, Sprint } from "@/core/db/schema";
import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";

/**
 * The story map as a grid, computed from the board. Across: the
 * backbone — the features somebody has put on the map, left to right
 * in the story's order (`mapSort`), and last a dashed column for the
 * cards with no feature at all. Down: the plan — on a Scrum board the
 * open sprints (the running one first) and the backlog, on a Kanban
 * board the columns from done to backlog. Every card under a feature
 * on the map sits in exactly one cell, in the backlog's order; cards
 * under a feature that is not on the map are not drawn, and the tray
 * says how many wait there.
 */
export type MapColumn = {
  key: string;
  /** Null for the column of cards without a feature. */
  feature: ItemView | null;
};

export type MapRow =
  | { key: string; kind: "sprint"; sprint: Sprint }
  | { key: string; kind: "backlog" }
  | { key: string; kind: "column"; column: Column };

export type StoryMap = {
  columns: MapColumn[];
  rows: MapRow[];
  /** Cards per cell, keyed by `${row.key}|${column.key}`, in the backlog's order. */
  cells: Map<string, CardView[]>;
};

export const LOOSE_COLUMN = "loose";
export const cellKey = (row: string, column: string) => `${row}|${column}`;

const byMapOrder = (a: ItemView, b: ItemView) =>
  (a.mapSort ?? 0) - (b.mapSort ?? 0) || a.number - b.number;
const byRank = (a: ItemView, b: ItemView) => a.sort - b.sort || a.number - b.number;
const byOrder = (a: CardView, b: CardView) => a.sort - b.sort || a.number - b.number;

/** The features on the map, left to right. */
export function backbone(items: ItemView[], options: { showClosed: boolean }): ItemView[] {
  return items
    .filter((item) => item.level === "feature" && item.mapSort !== null)
    .filter((item) => options.showClosed || item.state === "open")
    .sort(byMapOrder);
}

/** The open features not on the map, in the backlog's rank: what the tray offers. */
export function tray(items: ItemView[]): ItemView[] {
  return items
    .filter((item) => item.level === "feature" && item.mapSort === null && item.state === "open")
    .sort(byRank);
}

export function mapRows(full: BoardFull): MapRow[] {
  if (full.board.mode === "scrum") {
    const open = full.sprints
      .filter((sprint) => sprint.state !== "closed")
      .sort((a, b) => (a.state === b.state ? a.number - b.number : a.state === "active" ? -1 : 1));
    return [
      ...open.map((sprint) => ({ key: `sprint:${sprint.id}`, kind: "sprint" as const, sprint })),
      { key: "backlog", kind: "backlog" as const },
    ];
  }
  return [...full.columns]
    .sort((a, b) => b.sort - a.sort)
    .map((column) => ({ key: `column:${column.id}`, kind: "column" as const, column }));
}

/** The row a card belongs to, or null when it is in a closed sprint and off the map. */
export function rowOf(card: CardView, rows: MapRow[], scrum: boolean): string | null {
  if (scrum) {
    if (!card.sprintId) return "backlog";
    return rows.some((row) => row.key === `sprint:${card.sprintId}`)
      ? `sprint:${card.sprintId}`
      : null;
  }
  return `column:${card.columnId}`;
}

export function storyMap(
  full: BoardFull,
  /** The items the board shows — hidden levels already left out. */
  items: ItemView[],
  cards: CardView[],
  options: { showClosed: boolean },
): StoryMap {
  const features = backbone(items, options);
  const columns: MapColumn[] = [
    ...features.map((feature) => ({ key: feature.id, feature })),
    { key: LOOSE_COLUMN, feature: null },
  ];
  const onMap = new Set(features.map((f) => f.id));
  const rows = mapRows(full);
  const scrum = full.board.mode === "scrum";
  const cells = new Map<string, CardView[]>();
  for (const card of [...cards].sort(byOrder)) {
    const row = rowOf(card, rows, scrum);
    if (!row) continue;
    const column = card.featureId
      ? onMap.has(card.featureId)
        ? card.featureId
        : null
      : LOOSE_COLUMN;
    if (!column) continue;
    const key = cellKey(row, column);
    cells.set(key, [...(cells.get(key) ?? []), card]);
  }
  return { columns, rows, cells };
}

/** How far a feature is, from every card under it, on and off the map. */
export function featureTotals(
  feature: ItemView,
  full: BoardFull,
): { total: number; done: number; open: number } {
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const under = full.cards.filter((c) => c.featureId === feature.id);
  const done = under.filter((c) => category.get(c.columnId) === "done").length;
  const backlog = full.board.mode === "scrum" ? under.filter((c) => !c.sprintId).length : 0;
  return { total: under.length, done, open: under.length - done - backlog };
}
