import type { EnablerType, Kind } from "@/core/db/schema";

/**
 * The rules of the backlog structure as pure functions (docs/adr/0011).
 * Two tests decide where something belongs: can it be finished (then it
 * is in the hierarchy), and does it have exactly one parent (then it is
 * in the hierarchy). Everything that fails either test is a category — a
 * theme or an area — and a field on the item, never a container.
 *
 * The blocking rules (1–6) throw a RuleViolation whose code the form can
 * render; the warning rules (7–9) answer a value the interface shows and
 * never refuses on.
 */

export const RULE_CODES = [
  /** Rule 1: a parent is exactly one level up, on the same board. */
  "parentLevel",
  /** Rule 3: an item without a parent needs an area. */
  "needsArea",
  /** Rule 4: an epic or feature says when it is done. */
  "doneWhenRequired",
  /** Rule 5: an enabler type belongs to an enabler. */
  "enablerTypeOnly",
  /** Rule 10: closing with open children needs a decision for each of them. */
  "openChildren",
  /** A closed item does not take new children or new work. */
  "itemClosed",
  /** A theme or area that is deactivated cannot be set on an item. */
  "inactiveCategory",
  /** The list is closed at eight themes; a ninth is a theme that should be an area, or an epic. */
  "themeLimit",
  /** A child in a closing plan that is not a child of the item. */
  "notAChild",
] as const;
export type RuleCode = (typeof RULE_CODES)[number];

export class RuleViolation extends Error {
  constructor(public readonly code: RuleCode) {
    super(code);
    this.name = "RuleViolation";
  }
}

export const MAX_ACTIVE_THEMES = 8;
export const MAX_ACTIVE_AREAS = 40;

export type TitleWarning = "matchesCategory" | "tooShort";

/**
 * Rules 7 and 8: a title that is a theme's or an area's name, or one or
 * two words long, looks like a category rather than a result. Heuristics,
 * shown as a warning; the person decides.
 */
export function titleWarnings(title: string, categoryNames: string[]): TitleWarning[] {
  const clean = title.trim();
  if (!clean) return [];
  const warnings: TitleWarning[] = [];
  const lower = clean.toLowerCase();
  if (categoryNames.some((name) => name.trim().toLowerCase() === lower)) {
    warnings.push("matchesCategory");
  }
  if (clean.split(/\s+/).length <= 2) warnings.push("tooShort");
  return warnings;
}

/**
 * Rule 9: an epic open longer than the board's review period is marked
 * for review, counted from the last confirmation or from creation, until
 * it closes or an owner confirms it is still a result.
 */
export function reviewDue(
  item: { level: string; state: string; createdAt: Date; reviewConfirmedAt: Date | null },
  reviewDays: number,
  now: Date = new Date(),
): boolean {
  if (item.level !== "epic" || item.state !== "open") return false;
  const since = item.reviewConfirmedAt ?? item.createdAt;
  return now.getTime() - since.getTime() > reviewDays * 86_400_000;
}

/** Rule 5, resolved: the enabler type an item keeps for a kind. */
export function enablerTypeFor(
  kind: Kind,
  enablerType: EnablerType | null | undefined,
): EnablerType | null {
  if (kind === "enabler") return enablerType ?? null;
  if (enablerType) throw new RuleViolation("enablerTypeOnly");
  return null;
}

/** Rule 3, resolved: with no parent, an area is the one thing an item must have. */
export function assertPlaced(parentId: string | null, areaId: string | null): void {
  if (!parentId && !areaId) throw new RuleViolation("needsArea");
}

/* ---------------------------- Quarters ---------------------------- */

/** "2026-09-11" → "2026-Q3". */
export function quarterOf(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

export function compareQuarters(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function nextQuarter(quarter: string): string {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(6));
  return q === 4 ? `${year + 1}-Q1` : `${year}-Q${q + 1}`;
}

/** Every quarter from `from` to `to`, both included. */
export function quartersBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let current = from;
  while (compareQuarters(current, to) <= 0 && out.length < 40) {
    out.push(current);
    current = nextQuarter(current);
  }
  return out;
}

/** The quarter's first and last day as ISO dates. */
export function quarterRange(quarter: string): { start: string; end: string } {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(6));
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}
