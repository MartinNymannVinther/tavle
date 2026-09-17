import { describe, expect, it } from "vitest";
import { addDaysIso, diffDays } from "@/core/dates";
import { PLAN_DATE_MAX, PLAN_DATE_MIN } from "@/modules/boards/plan-dates";
import { dateAtPosition, quarterPosition } from "@/modules/boards/structure/roadmap";
import { quarterRange, quartersBetween } from "@/modules/boards/structure/rules";

/**
 * A release's date is dragged along the roadmap's strip (docs/adr/0019,
 * 0032), and a drag is only as honest as the arithmetic under it: the
 * day the marker is let go over has to be the day that is written. So
 * the two directions are tested against each other — a date placed on
 * the axis and read back must be the same date — and the edges are
 * tested on their own, because a pointer that runs off the strip is the
 * ordinary case, not the exception.
 */

const axis = quartersBetween("2026-Q1", "2026-Q4");

describe("dateAtPosition", () => {
  it("reads back every day quarterPosition placed on the axis", () => {
    for (const quarter of axis) {
      const { start, end } = quarterRange(quarter);
      for (let day = 0; day <= diffDays(start, end); day += 1) {
        const date = addDaysIso(start, day);
        expect(dateAtPosition(quarterPosition(date, axis), axis)).toBe(date);
      }
    }
  });

  it("keeps a quarter's first and last day inside their own quarter", () => {
    // 31 March and 1 April are a day apart and a column apart; the
    // boundary is where an off-by-one would show first.
    expect(dateAtPosition(quarterPosition("2026-03-31", axis), axis)).toBe("2026-03-31");
    expect(dateAtPosition(quarterPosition("2026-04-01", axis), axis)).toBe("2026-04-01");
    expect(quarterPosition("2026-04-01", axis)).toBe(1);
  });

  it("puts a column's start and end where the axis does", () => {
    expect(dateAtPosition(0, axis)).toBe("2026-01-01");
    expect(dateAtPosition(1, axis)).toBe("2026-04-01");
    // A whole column in, less a hair: the last day of the first quarter.
    expect(dateAtPosition(1 - 1 / 200, axis)).toBe("2026-03-31");
  });

  it("clamps a pointer that ran off either end onto the axis", () => {
    expect(dateAtPosition(-4, axis)).toBe("2026-01-01");
    expect(dateAtPosition(axis.length, axis)).toBe("2026-12-31");
    expect(dateAtPosition(axis.length + 9, axis)).toBe("2026-12-31");
  });

  it("never answers with a day the service would refuse", () => {
    // The axis is drawn from what is planned on it and can reach further
    // than a plan date is allowed to; the strip must not write the
    // difference.
    expect(dateAtPosition(9, quartersBetween("2100-Q1", "2101-Q4"))).toBe(PLAN_DATE_MAX);
    expect(dateAtPosition(-1, quartersBetween("1969-Q1", "1969-Q4"))).toBe(PLAN_DATE_MIN);
  });

  it("has an answer with nothing drawn to read it off", () => {
    // The strip is not drawn without an axis, but the function is total:
    // whatever comes back is a real day inside the plannable range.
    const date = dateAtPosition(0.5, []);
    expect(date >= PLAN_DATE_MIN && date <= PLAN_DATE_MAX).toBe(true);
  });
});
