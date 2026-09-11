import { addDaysIso, diffDays, mondayOf, weekKey } from "@/core/dates";
import { endOfDayCopenhagen } from "./burndown";

/**
 * What a Kanban team wants to know, read from the record rather than
 * estimated: how much gets finished per week, how long a card takes once
 * somebody picks it up, and how the work is spread across the columns
 * over time. All of it is pure arithmetic over rows the pages fetch.
 */

export type FlowCard = {
  id: string;
  createdAt: Date;
  startedAt: Date | null;
  doneAt: Date | null;
  archivedAt: Date | null;
};

export type FlowTransition = { cardId: string; toCategory: string; at: Date };

export type WeekCount = { week: string; monday: string; count: number };

/** Cards finished per ISO week, for the last `weeks` weeks ending in the week of `today`. */
export function throughput(cards: FlowCard[], today: string, weeks = 8): WeekCount[] {
  const buckets: WeekCount[] = [];
  let monday = mondayOf(addDaysIso(today, -7 * (weeks - 1)));
  for (let i = 0; i < weeks; i++) {
    buckets.push({ week: weekKey(monday), monday, count: 0 });
    monday = addDaysIso(monday, 7);
  }
  const byWeek = new Map(buckets.map((b) => [b.week, b]));
  for (const card of cards) {
    if (!card.doneAt) continue;
    const bucket = byWeek.get(weekKey(isoDayOf(card.doneAt)));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/** The Copenhagen calendar day an instant falls on. */
export function isoDayOf(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export type CycleTime = {
  /** Cards the numbers are based on. */
  sample: number;
  /** Days from first pick-up to done, average and median. */
  averageDays: number | null;
  medianDays: number | null;
  /** Days from creation to done, average. */
  leadAverageDays: number | null;
};

const DAY = 86_400_000;

/** Cycle and lead time over the cards finished in the last `days` days. */
export function cycleTime(cards: FlowCard[], today: string, days = 30): CycleTime {
  const since = endOfDayCopenhagen(addDaysIso(today, -days)).getTime();
  const done = cards.filter((c) => c.doneAt && c.doneAt.getTime() > since);
  const cycles = done
    .filter((c) => c.startedAt)
    .map((c) => (c.doneAt!.getTime() - c.startedAt!.getTime()) / DAY);
  const leads = done.map((c) => (c.doneAt!.getTime() - c.createdAt.getTime()) / DAY);
  return {
    sample: done.length,
    averageDays: average(cycles),
    medianDays: median(cycles),
    leadAverageDays: average(leads),
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round1(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export const FLOW_CATEGORIES = ["backlog", "todo", "doing", "done"] as const;
export type FlowCategory = (typeof FLOW_CATEGORIES)[number];

export type FlowDay = { date: string; counts: Record<FlowCategory, number> };

/**
 * The cumulative flow: for each of the last `days` days, how many cards
 * sat in each category at the end of the day, replayed from the
 * transition log. A card whose last transition is `archived` is not
 * counted from that day on; a card with no transition yet that day does
 * not exist yet.
 */
export function cumulativeFlow(transitions: FlowTransition[], today: string, days = 30): FlowDay[] {
  const sorted = [...transitions].sort((a, b) => a.at.getTime() - b.at.getTime());
  const state = new Map<string, string>();
  const out: FlowDay[] = [];
  let cursor = 0;
  for (let day = addDaysIso(today, -(days - 1)); day <= today; day = addDaysIso(day, 1)) {
    const end = endOfDayCopenhagen(day).getTime();
    while (cursor < sorted.length && sorted[cursor]!.at.getTime() <= end) {
      const t = sorted[cursor]!;
      state.set(t.cardId, t.toCategory);
      cursor++;
    }
    const counts: Record<FlowCategory, number> = { backlog: 0, todo: 0, doing: 0, done: 0 };
    for (const category of state.values()) {
      if (category in counts) counts[category as FlowCategory] += 1;
    }
    out.push({ date: day, counts });
  }
  return out;
}

/** Days between two ISO dates, exported for the pages that label axes. */
export { diffDays };
