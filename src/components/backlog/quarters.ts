import { todayInCopenhagen } from "@/core/dates";
import { quarterOf, quartersBetween, nextQuarter } from "@/modules/boards/structure/rules";

/** The quarters an epic can aim at: this one and the next eleven. An epic is a quarter or two, not a decade. */
export function quarterOptions(now: Date = new Date()): string[] {
  const current = quarterOf(todayInCopenhagen(now));
  let last = current;
  for (let i = 0; i < 11; i += 1) last = nextQuarter(last);
  return quartersBetween(current, last);
}
