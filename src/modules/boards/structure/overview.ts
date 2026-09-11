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

const NONE = "none";

function openStories(full: BoardFull): CardView[] {
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  return full.cards.filter((card) => category.get(card.columnId) !== "done");
}

export function overview(full: BoardFull, now: Date = new Date()): Overview {
  const stories = openStories(full);
  const items = full.items.filter((item) => item.state === "open");
  const points = (rows: CardView[]) => rows.reduce((sum, c) => sum + (c.estimate ?? 0), 0);
  const bucket = (key: string, name: string, color: string | null, rows: CardView[]): Bucket => ({
    key,
    name,
    color,
    cards: rows.length,
    points: points(rows),
  });

  const activeThemes = full.themes.filter((t) => t.active);
  const byTheme = activeThemes.map((theme) =>
    bucket(
      theme.id,
      theme.name,
      theme.color,
      stories.filter((c) => c.themeIds.includes(theme.id)),
    ),
  );
  byTheme.push(
    bucket(
      NONE,
      "",
      null,
      stories.filter((c) => c.themeIds.length === 0),
    ),
  );

  const activeAreas = full.areas.filter((a) => a.active);
  const byArea = activeAreas.map((area) =>
    bucket(
      area.id,
      area.name,
      null,
      stories.filter((c) => c.areaId === area.id),
    ),
  );
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
