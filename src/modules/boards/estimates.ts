import type { EstimateUnit } from "@/core/db/schema";

/**
 * What a team counts in (docs/adr/0030): story points, hours, or
 * T-shirt sizes. One integer on the card carries all three, so every
 * sum the product already computes — a sprint's commitment, velocity,
 * the burndown, the overview's weights — keeps working whatever the
 * board has chosen.
 *
 * A T-shirt size is a label on a point weight, so points and sizes are
 * the same scale and moving between them is a change of words, not of
 * numbers. Hours are a scale of their own, and crossing to or from them
 * is the one conversion that rewrites what is written down — which is
 * why it is proposed, previewed and undoable rather than silent.
 */

/** The sizes and what each weighs. Fibonacci, like the points they label. */
export const TSHIRT = [
  { size: "XS", weight: 1 },
  { size: "S", weight: 2 },
  { size: "M", weight: 3 },
  { size: "L", weight: 5 },
  { size: "XL", weight: 8 },
  { size: "XXL", weight: 13 },
] as const;

export type TshirtSize = (typeof TSHIRT)[number]["size"];

/** The ladder a point estimate is snapped to; the sizes' weights and one step beyond. */
const POINT_SCALE = [1, 2, 3, 5, 8, 13, 21] as const;

/** Hours one point stands for, when nothing else is said. Half a working day. */
export const DEFAULT_HOURS_PER_POINT = 4;

/** Which scale a unit counts on: sizes are points wearing a name. */
export function scaleOf(unit: EstimateUnit): "points" | "hours" {
  return unit === "hours" ? "hours" : "points";
}

/** The nearest value on a ladder; ties go up, because work is rarely smaller than it looks. */
function snap(value: number, ladder: readonly number[]): number {
  let best = ladder[0]!;
  let bestGap = Math.abs(value - best);
  for (const step of ladder) {
    const gap = Math.abs(value - step);
    if (gap <= bestGap) {
      best = step;
      bestGap = gap;
    }
  }
  return best;
}

/** The size a weight wears; anything off the ladder takes the nearest one. */
export function sizeOf(value: number): TshirtSize {
  const weight = snap(
    value,
    TSHIRT.map((t) => t.weight),
  );
  return TSHIRT.find((t) => t.weight === weight)!.size;
}

/** What a card shows: "5", "5 t" or "L". Null stays null — unestimated is a state. */
export function labelOf(value: number | null | undefined, unit: EstimateUnit): string | null {
  if (value === null || value === undefined) return null;
  if (unit === "tshirt") return sizeOf(value);
  if (unit === "hours") return `${value} t`;
  return String(value);
}

/**
 * What a *sum* shows. A T-shirt size names one card, so a band or a
 * release holding eleven weights is eleven points, not "XL" — the size
 * vocabulary simply has no word for a total.
 */
export function totalLabel(value: number, unit: EstimateUnit): string {
  return unit === "hours" ? `${value} t` : String(value);
}

/** The values a card may be given, for the picker the board's unit asks for. */
export function choicesFor(unit: EstimateUnit): number[] {
  if (unit === "tshirt") return TSHIRT.map((t) => t.weight);
  if (unit === "hours") return [1, 2, 4, 8, 16, 24, 40];
  return [...POINT_SCALE];
}

/**
 * One estimate under a new unit. Within a scale the number stands,
 * except that a move to sizes snaps it onto the ladder so the label and
 * the stored weight agree. Across scales the factor decides, and a
 * result is never rounded down to nothing: work that was estimated
 * stays estimated.
 */
export function convert(
  value: number,
  from: EstimateUnit,
  to: EstimateUnit,
  hoursPerPoint: number = DEFAULT_HOURS_PER_POINT,
): number {
  if (value === 0) return 0;
  const factor = hoursPerPoint > 0 ? hoursPerPoint : DEFAULT_HOURS_PER_POINT;
  const fromScale = scaleOf(from);
  const toScale = scaleOf(to);

  let points = fromScale === "hours" ? value / factor : value;
  if (fromScale === toScale && to !== "tshirt") return value;

  if (toScale === "hours") return Math.max(1, Math.round(points * factor));
  if (to === "tshirt") {
    return snap(
      points,
      TSHIRT.map((t) => t.weight),
    );
  }
  points = snap(points, POINT_SCALE);
  return Math.max(1, points);
}

/**
 * A sum converts by arithmetic alone. The ladder exists to force a
 * conversation about one card's size; a sprint's written-down total is
 * not a card and has no business being snapped onto it — sixty-four
 * hours is sixteen points, not the thirteen the nearest rung would say.
 */
export function convertTotal(
  value: number,
  from: EstimateUnit,
  to: EstimateUnit,
  hoursPerPoint: number = DEFAULT_HOURS_PER_POINT,
): number {
  if (value === 0) return 0;
  const factor = hoursPerPoint > 0 ? hoursPerPoint : DEFAULT_HOURS_PER_POINT;
  if (scaleOf(from) === scaleOf(to)) return value;
  return scaleOf(to) === "hours"
    ? Math.max(1, Math.round(value * factor))
    : Math.max(1, Math.round(value / factor));
}

export type EstimateChange = { from: number; to: number; cards: number };

/**
 * The whole proposal, as a table a person can read before saying yes:
 * every distinct estimate on the board, what it becomes, and how many
 * cards wear it. Unestimated cards are not in it — they have nothing to
 * convert — and a row where nothing changes is kept, so the table shows
 * the whole board rather than only its edits.
 */
export function conversionTable(
  values: Array<number | null>,
  from: EstimateUnit,
  to: EstimateUnit,
  hoursPerPoint: number = DEFAULT_HOURS_PER_POINT,
): EstimateChange[] {
  const counts = new Map<number, number>();
  for (const value of values) {
    if (value === null || value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, cards]) => ({
      from: value,
      to: convert(value, from, to, hoursPerPoint),
      cards,
    }));
}

/** How many cards a proposal would actually rewrite; zero means the switch is only a change of words. */
export function changedCount(table: EstimateChange[]): number {
  return table.reduce((total, row) => total + (row.from === row.to ? 0 : row.cards), 0);
}
