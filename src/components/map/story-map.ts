import type { Column, Sprint } from "@/core/db/schema";
import type { StructureView } from "@/modules/boards/structure/view";
import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";

/**
 * The story map as a grid, computed from the board. Across: the
 * decomposition — each feature a column, the features of one epic side
 * by side under its header, features without an epic in a group of
 * their own, and last a column for the cards with no feature. Down: the
 * plan — on a Scrum board the open sprints (the running one first) and
 * the backlog, on a Kanban board the columns from done to backlog. Every
 * card sits in exactly one cell, and the cells keep the backlog's order.
 */
export type MapColumn = {
  key: string;
  /** Null for the column of cards without a feature. */
  feature: ItemView | null;
};

export type MapGroup = {
  key: string;
  /** Null for the features without an epic, and for the loose column. */
  epic: ItemView | null;
  columns: MapColumn[];
  /** The group of cards with no feature at all; drawn dashed. */
  loose: boolean;
};

export type MapRow =
  | { key: string; kind: "sprint"; sprint: Sprint }
  | { key: string; kind: "backlog" }
  | { key: string; kind: "column"; column: Column };

export type StoryMap = {
  groups: MapGroup[];
  rows: MapRow[];
  /** Cards per cell, keyed by `${row.key}|${column.key}`, in the backlog's order. */
  cells: Map<string, CardView[]>;
  columnCount: number;
};

export const LOOSE_COLUMN = "loose";
export const cellKey = (row: string, column: string) => `${row}|${column}`;

const byRank = (a: ItemView, b: ItemView) => a.sort - b.sort || a.number - b.number;
const byOrder = (a: CardView, b: CardView) => a.sort - b.sort || a.number - b.number;

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
  view: StructureView,
  /** The items the board shows — hidden levels already left out. */
  items: ItemView[],
  cards: CardView[],
  options: { showClosed: boolean },
): StoryMap {
  const shown = items.filter((item) => options.showClosed || item.state === "open");
  const epics = shown.filter((item) => item.level === "epic").sort(byRank);
  const features = shown.filter((item) => item.level === "feature").sort(byRank);
  const epicIds = new Set(epics.map((epic) => epic.id));
  const column = (feature: ItemView): MapColumn => ({ key: feature.id, feature });

  const groups: MapGroup[] = [];
  if (view.epics) {
    for (const epic of epics) {
      groups.push({
        key: epic.id,
        epic,
        columns: features.filter((f) => f.parentId === epic.id).map(column),
        loose: false,
      });
    }
    const orphans = features.filter((f) => !f.parentId || !epicIds.has(f.parentId));
    if (orphans.length > 0) {
      groups.push({ key: "no-epic", epic: null, columns: orphans.map(column), loose: false });
    }
  } else if (features.length > 0) {
    groups.push({ key: "features", epic: null, columns: features.map(column), loose: false });
  }
  groups.push({
    key: LOOSE_COLUMN,
    epic: null,
    columns: [{ key: LOOSE_COLUMN, feature: null }],
    loose: true,
  });

  const rows = mapRows(full);
  const scrum = full.board.mode === "scrum";
  const featureIds = new Set(features.map((f) => f.id));
  const cells = new Map<string, CardView[]>();
  for (const card of [...cards].sort(byOrder)) {
    const row = rowOf(card, rows, scrum);
    if (!row) continue;
    const col = card.featureId && featureIds.has(card.featureId) ? card.featureId : LOOSE_COLUMN;
    const key = cellKey(row, col);
    cells.set(key, [...(cells.get(key) ?? []), card]);
  }

  return {
    groups,
    rows,
    cells,
    columnCount: groups.reduce((sum, group) => sum + group.columns.length, 0),
  };
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
