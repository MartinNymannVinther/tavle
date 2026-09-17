import type { BoardFull, CardView } from "../types";

/**
 * Where the open work sits, computed from the board as it is: spread
 * over themes, areas and kinds, with the enabler share as one number.
 * Pure, so the page hands over the board and the tests hand over
 * fixtures.
 *
 * The five health measures that used to be computed here went with the
 * page they were drawn on (docs/adr/0031): a percentage that nags is not
 * a workbench. What replaced them is `hygiene.ts`, which answers with
 * findings that link to the rows behind them and says nothing when there
 * is nothing to say.
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
  /** Only buckets that hold open work; an empty row says nothing true. */
  byTheme: Bucket[];
  byArea: Bucket[];
  byKind: Bucket[];
  /** Enabler points over all points, or enabler cards over all cards when nothing is estimated. */
  enablerShare: number;
  openCards: number;
  openPoints: number;
};

/** The bucket for a story that carries no value on the axis at all. */
export const NONE = "none";
/** The bucket for a story that carries more than one theme. */
export const MULTI = "multi";

function openStories(full: BoardFull): CardView[] {
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  return full.cards.filter((card) => category.get(card.columnId) !== "done");
}

export function overview(full: BoardFull): Overview {
  const stories = openStories(full);
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
   *
   * The one-bucket rule leaves a row that has to be handled rather than
   * printed. A theme that is never a story's only theme holds no bucket
   * of its own, and a row saying "0 cards · 0 points" beside its name is
   * read as "no open work on this theme" — which is false while three
   * shared stories carry it. The same row is written for a theme that
   * genuinely has nothing open, so the reader cannot tell the true one
   * from the false one. So an empty row is not printed at all: every row
   * in the distribution stands for work that is there, the axis still
   * accounts for the whole of the total stated above it (nothing is
   * dropped but zero), and what a theme shares with another is counted
   * where it is — under "more than one theme". A theme that no open work
   * touches at all is named by the health measures instead, which is the
   * place that says so on purpose.
   */
  const single = (card: CardView) => (card.themeIds.length === 1 ? card.themeIds[0]! : null);
  const held = (rows: Bucket[]) => rows.filter((row) => row.cards > 0);
  const byTheme = held([
    ...full.themes.map((theme) =>
      bucket(
        theme.id,
        theme.name,
        theme.color,
        stories.filter((c) => single(c) === theme.id),
        !theme.active,
      ),
    ),
    bucket(
      MULTI,
      "",
      null,
      stories.filter((c) => c.themeIds.length > 1),
    ),
    bucket(
      NONE,
      "",
      null,
      stories.filter((c) => c.themeIds.length === 0),
    ),
  ]);

  const byArea = held([
    ...full.areas.map((area) =>
      bucket(
        area.id,
        area.name,
        null,
        stories.filter((c) => c.areaId === area.id),
        !area.active,
      ),
    ),
    bucket(
      NONE,
      "",
      null,
      stories.filter((c) => !c.areaId),
    ),
  ]);

  const business = stories.filter((c) => c.kind !== "enabler");
  const enabler = stories.filter((c) => c.kind === "enabler");
  const byKind = held([
    bucket("business", "", null, business),
    bucket("enabler", "", null, enabler),
  ]);
  const totalPoints = points(stories);
  const enablerShare =
    totalPoints > 0
      ? points(enabler) / totalPoints
      : stories.length > 0
        ? enabler.length / stories.length
        : 0;

  return {
    byTheme,
    byArea,
    byKind,
    enablerShare,
    openCards: stories.length,
    openPoints: totalPoints,
  };
}
