import type { Release, Theme } from "@/core/db/schema";
import { diffDays, todayInCopenhagen } from "@/core/dates";
import type { BoardFull, ItemView } from "../types";
import {
  compareQuarters,
  nextQuarter,
  quarterOf,
  quarterRange,
  quartersBetween,
  reviewDue,
} from "./rules";

/**
 * The roadmap: epics on a line of quarters, coloured by their first
 * theme. An open epic runs from the quarter it was created in to its
 * target quarter; a closed one to the quarter it closed in, and only the
 * last few of those are shown. An open epic without a target is not
 * drawn — it is listed underneath as unplanned, because a bar with no end
 * is the kind of dishonesty a roadmap exists to avoid.
 */

export type RoadmapRow = {
  epic: ItemView;
  theme: Theme | null;
  startQuarter: string;
  endQuarter: string;
  reviewDue: boolean;
  openStories: number;
  doneStories: number;
  /** Features under the epic, open and closed. */
  features: number;
};

/** A release on the quarter axis: what ships, when, and how much of it is done. */
export type RoadmapRelease = {
  release: Release;
  /** Where its date falls on the axis, in columns; null without a date. */
  at: number | null;
  cards: number;
  points: number;
  donePoints: number;
};

export type Roadmap = {
  quarters: string[];
  current: string;
  rows: RoadmapRow[];
  unplanned: RoadmapRow[];
  /** The dated releases, nearest first, for the strip above the epics (docs/adr/0032). */
  releases: RoadmapRelease[];
};

const CLOSED_QUARTERS_SHOWN = 2;
const QUARTERS_AHEAD = 3;

export function roadmap(full: BoardFull, now: Date = new Date()): Roadmap {
  const today = todayInCopenhagen(now);
  const current = quarterOf(today);
  const themeOf = new Map(full.themes.map((t) => [t.id, t]));
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const featuresOf = new Map<string, string[]>();
  for (const item of full.items) {
    if (item.level === "feature" && item.parentId) {
      featuresOf.set(item.parentId, [...(featuresOf.get(item.parentId) ?? []), item.id]);
    }
  }
  const oldestShown = shift(current, -CLOSED_QUARTERS_SHOWN);

  const rows: RoadmapRow[] = [];
  const unplanned: RoadmapRow[] = [];
  for (const epic of full.items.filter((i) => i.level === "epic")) {
    const featureIds = featuresOf.get(epic.id) ?? [];
    const stories = full.cards.filter((c) => c.featureId && featureIds.includes(c.featureId));
    const done = stories.filter((c) => category.get(c.columnId) === "done").length;
    // Stored instants become dates in Danish time, like `current` above:
    // an epic closed 00:30 on 1 January belongs to Q1, not the UTC Q4.
    const endQuarter =
      epic.state === "closed"
        ? quarterOf(todayInCopenhagen(epic.closedAt ?? epic.updatedAt))
        : epic.targetQuarter;
    const row: RoadmapRow = {
      epic,
      theme: epic.themeIds[0] ? (themeOf.get(epic.themeIds[0]) ?? null) : null,
      // The planned start wins; without one the creation quarter is the honest fallback.
      startQuarter: epic.startQuarter ?? quarterOf(todayInCopenhagen(epic.createdAt)),
      endQuarter: endQuarter ?? current,
      reviewDue: reviewDue(epic, full.board.epicReviewDays, now),
      openStories: stories.length - done,
      doneStories: done,
      features: featureIds.length,
    };
    if (epic.state === "closed" && compareQuarters(row.endQuarter, oldestShown) < 0) continue;
    if (epic.state === "open" && !epic.targetQuarter) unplanned.push(row);
    else rows.push(row);
  }
  // A bar never runs backwards: an epic created after its target quarter is drawn in the target.
  for (const row of rows) {
    if (compareQuarters(row.startQuarter, row.endQuarter) > 0) row.startQuarter = row.endQuarter;
  }
  rows.sort(
    (a, b) =>
      compareQuarters(a.endQuarter, b.endQuarter) ||
      compareQuarters(a.startQuarter, b.startQuarter) ||
      a.epic.sort - b.epic.sort,
  );

  const first = rows.reduce(
    (min, r) => (compareQuarters(r.startQuarter, min) < 0 ? r.startQuarter : min),
    oldestShown,
  );
  const last = rows.reduce(
    (max, r) => (compareQuarters(r.endQuarter, max) > 0 ? r.endQuarter : max),
    shift(current, QUARTERS_AHEAD),
  );
  const quarters = quartersBetween(first, last);
  // A release is drawn where its date falls; one without a date has
  // nowhere honest to sit on a time axis, so it is left off.
  const releaseRows: RoadmapRelease[] = [...full.releases]
    .sort((a, b) => a.sort - b.sort || a.createdAt.getTime() - b.createdAt.getTime())
    .map((release) => {
      const inside = full.cards.filter((c) => c.releaseId === release.id);
      const done = inside.filter((c) => category.get(c.columnId) === "done");
      const sum = (rows: typeof inside) => rows.reduce((total, c) => total + (c.estimate ?? 0), 0);
      return {
        release,
        at: release.targetDate ? quarterPosition(release.targetDate, quarters) : null,
        cards: inside.length,
        points: sum(inside),
        donePoints: sum(done),
      };
    });
  return { quarters, current, rows, unplanned, releases: releaseRows };
}

/**
 * Where a date falls on the roadmap's quarter axis, as a fraction of
 * columns: 1.5 is halfway through the second quarter. Clamped to the
 * axis, so a span reaching outside is drawn to the edge rather than
 * into nothing (docs/adr/0023: the features' sprints on the epics'
 * quarters).
 */
export function quarterPosition(dateIso: string, quarters: string[]): number {
  if (quarters.length === 0) return 0;
  const q = quarterOf(dateIso);
  const index = quarters.indexOf(q);
  if (index === -1) return compareQuarters(q, quarters[0]!) < 0 ? 0 : quarters.length;
  const range = quarterRange(q);
  const days = diffDays(range.start, range.end) + 1;
  return index + diffDays(range.start, dateIso) / days;
}

export function shiftQuarter(quarter: string, by: number): string {
  return shift(quarter, by);
}

function shift(quarter: string, by: number): string {
  let q = quarter;
  if (by >= 0) for (let i = 0; i < by; i += 1) q = nextQuarter(q);
  else for (let i = 0; i > by; i -= 1) q = previousQuarter(q);
  return q;
}

function previousQuarter(quarter: string): string {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(6));
  return q === 1 ? `${year - 1}-Q4` : `${year}-Q${q - 1}`;
}
