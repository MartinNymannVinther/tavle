import { ISO_DATE } from "@/core/dates";

/**
 * The days a plan can point at. A native date field fires a change for
 * every digit of a year, so typing "2026" passes through 0002, 0020 and
 * 0202 on the way, and a card once kept whichever of them arrived last.
 * The widget commits once now, and this is the boundary's own answer to
 * the same thing: a plan date is a real calendar day in a century a team
 * could be working in, and anything else is refused by the service, not
 * only by the field.
 */

export const PLAN_DATE_MIN = "1970-01-01";
export const PLAN_DATE_MAX = "2100-12-31";

/** True when the string is a real day inside the plannable range. */
export function isPlannableDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  if (iso < PLAN_DATE_MIN || iso > PLAN_DATE_MAX) return false;
  // 2026-02-31 has the shape of a date and is not a day; the round trip says so.
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === iso;
}

/** The same check where the answer is a refusal. No date at all is a state, and always allowed. */
export function assertPlannableDate(iso: string | null | undefined): void {
  if (iso === null || iso === undefined) return;
  if (!isPlannableDate(iso)) throw new Error("invalid");
}
