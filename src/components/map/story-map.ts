import type { Release } from "@/core/db/schema";
import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";

/**
 * The story map as a grid, computed from the board. Across: the
 * backbone — the features somebody has put on the map, left to right
 * in the story's order (`mapSort`), and last a dashed column for the
 * cards with no feature at all. Down: the releases the team has named,
 * nearest first, and last the band for work no release has promised
 * (docs/adr/0032) — what a story map's bands are in the practice the
 * map is named after. Every card under a feature
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
  | { key: string; kind: "release"; release: Release }
  /** Everything not promised to a release yet; always last, always there. */
  | { key: string; kind: "unreleased" };

export type StoryMap = {
  columns: MapColumn[];
  rows: MapRow[];
  /** Cards per cell, keyed by `${row.key}|${column.key}`, in the backlog's order. */
  cells: Map<string, CardView[]>;
};

export const LOOSE_COLUMN = "loose";

/** The band for work no release has promised. */
export const UNRELEASED = "unreleased";
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
export function tray(items: ItemView[], options: { showClosed?: boolean } = {}): ItemView[] {
  return items
    .filter(
      (item) =>
        item.level === "feature" &&
        item.mapSort === null &&
        // A closed feature waits in the tray only while the wall is
        // showing closed ones — otherwise putting it up would answer a
        // pick with nothing appearing. It has to be offered somewhere,
        // or a note taken down could never go back.
        (item.state === "open" || options.showClosed === true),
    )
    .sort(byRank);
}

/**
 * The map's bands are the board's releases, nearest first, with one
 * band at the bottom for work not promised to any of them (docs/adr/
 * 0032). A board with no releases is that last band alone: an honest
 * empty wall rather than no wall at all.
 */
export function mapRows(full: BoardFull): MapRow[] {
  const ordered = [...full.releases].sort(
    (a, b) => a.sort - b.sort || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return [
    ...ordered.map((release) => ({
      key: `release:${release.id}`,
      kind: "release" as const,
      release,
    })),
    { key: UNRELEASED, kind: "unreleased" as const },
  ];
}

/** The band a card sits in: its release, or the unreleased one. */
export function rowOf(card: CardView, rows: MapRow[]): string {
  if (!card.releaseId) return UNRELEASED;
  const key = `release:${card.releaseId}`;
  // A release the view does not hold cannot be drawn in; the card falls
  // back to the band that is always there rather than disappearing.
  return rows.some((row) => row.key === key) ? key : UNRELEASED;
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
  const cells = new Map<string, CardView[]>();
  for (const card of [...cards].sort(byOrder)) {
    const row = rowOf(card, rows);
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
