import type { Area, Theme } from "@/core/db/schema";
import type { BoardFull, CardView, ItemView } from "../types";
import { reviewDue } from "./rules";

/**
 * The overview page's numbers, computed from the board as it is: how the
 * open work is spread over themes, areas and kinds, the enabler share as
 * one number, and the five health measures that say whether the
 * structure is being kept. Pure, so the page hands over the board and the
 * tests hand over fixtures.
 */

export type Bucket = {
  key: string;
  name: string;
  color: string | null;
  /** A theme or area taken off the board's list that open work still carries. */
  retired: boolean;
  /** Open stories in the bucket. */
  cards: number;
  /** Their points; unestimated cards count nothing. */
  points: number;
};

export type Overview = {
  byTheme: Bucket[];
  byArea: Bucket[];
  byKind: Bucket[];
  /** Enabler points over all points, or enabler cards over all cards when nothing is estimated. */
  enablerShare: number;
  openCards: number;
  openPoints: number;
  health: {
    /** Open features and stories without a parent, over all open features and stories. */
    parentless: { count: number; total: number };
    reviewEpics: ItemView[];
    /** Open items of any level without an area. */
    withoutArea: { count: number; total: number };
    idleThemes: Theme[];
    idleAreas: Area[];
  };
};

/** The bucket for a story that carries no value on the axis at all. */
export const NONE = "none";
/** The bucket for a story that carries more than one theme. */
export const MULTI = "multi";

function openStories(full: BoardFull): CardView[] {
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  return full.cards.filter((card) => category.get(card.columnId) !== "done");
}

export function overview(full: BoardFull, now: Date = new Date()): Overview {
  const stories = openStories(full);
  const items = full.items.filter((item) => item.state === "open");
  const points = (rows: CardView[]) => rows.reduce((sum, c) => sum + (c.estimate ?? 0), 0);
  const bucket = (
    key: string,
    name: string,
    color: string | null,
    rows: CardView[],
    retired = false,
  ): Bucket => ({
    key,
    name,
    color,
    retired,
    cards: rows.length,
    points: points(rows),
  });

  /**
   * Every open story lands in exactly one bucket on every axis, so the
   * rows add up to the total the section states once above them (docs/adr
   * 0031). Two things used to break that on the theme axis.
   *
   * A story carrying two themes was counted under both, so the rows added
   * up to more cards and more points than the board holds and every share
   * was measured against an inflated total. Splitting the story in halves
   * was the alternative, and was turned down: it prints half cards and
   * rounds points until the rows stop adding up again. Choosing one of
   * the two themes for the team was never an option — the tool does not
   * decide what it has not been told. So a story with more than one theme
   * is shown as exactly that, in a bucket of its own, the same way a
   * story with no theme is.
   *
   * And a story whose theme or area had been taken off the board's list
   * fell out of the distribution entirely: not in its own value, because
   * the value was filtered away, and not under "none", because it has one.
   * A retired value keeps its bucket for as long as open work carries it.
   */
  const single = (card: CardView) => (card.themeIds.length === 1 ? card.themeIds[0]! : null);
  const byTheme: Bucket[] = [];
  for (const theme of full.themes) {
    const rows = stories.filter((c) => single(c) === theme.id);
    if (!theme.active && rows.length === 0) continue;
    byTheme.push(bucket(theme.id, theme.name, theme.color, rows, !theme.active));
  }
  const several = stories.filter((c) => c.themeIds.length > 1);
  if (several.length > 0) byTheme.push(bucket(MULTI, "", null, several));
  byTheme.push(
    bucket(
      NONE,
      "",
      null,
      stories.filter((c) => c.themeIds.length === 0),
    ),
  );

  const byArea: Bucket[] = [];
  for (const area of full.areas) {
    const rows = stories.filter((c) => c.areaId === area.id);
    if (!area.active && rows.length === 0) continue;
    byArea.push(bucket(area.id, area.name, null, rows, !area.active));
  }
  byArea.push(
    bucket(
      NONE,
      "",
      null,
      stories.filter((c) => !c.areaId),
    ),
  );

  const business = stories.filter((c) => c.kind !== "enabler");
  const enabler = stories.filter((c) => c.kind === "enabler");
  const byKind = [bucket("business", "", null, business), bucket("enabler", "", null, enabler)];
  const activeThemes = full.themes.filter((t) => t.active);
  const activeAreas = full.areas.filter((a) => a.active);
  const totalPoints = points(stories);
  const enablerShare =
    totalPoints > 0
      ? points(enabler) / totalPoints
      : stories.length > 0
        ? enabler.length / stories.length
        : 0;

  const features = items.filter((i) => i.level === "feature");
  const parentless =
    features.filter((f) => !f.parentId).length + stories.filter((c) => !c.featureId).length;
  const usedThemes = new Set([
    ...items.flatMap((i) => i.themeIds),
    ...stories.flatMap((c) => c.themeIds),
  ]);
  const usedAreas = new Set([
    ...items.map((i) => i.areaId).filter(Boolean),
    ...stories.map((c) => c.areaId).filter(Boolean),
  ]);

  return {
    byTheme,
    byArea,
    byKind,
    enablerShare,
    openCards: stories.length,
    openPoints: totalPoints,
    health: {
      parentless: { count: parentless, total: features.length + stories.length },
      reviewEpics: items.filter((i) => reviewDue(i, full.board.epicReviewDays, now)),
      withoutArea: {
        count: items.filter((i) => !i.areaId).length + stories.filter((c) => !c.areaId).length,
        total: items.length + stories.length,
      },
      idleThemes: activeThemes.filter((t) => !usedThemes.has(t.id)),
      idleAreas: activeAreas.filter((a) => !usedAreas.has(a.id)),
    },
  };
}
