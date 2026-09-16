import { describe, expect, it } from "vitest";
import { yTicks } from "@/components/charts/chart-bits";

/**
 * The insight page's four charts count cards and points, and neither has
 * a half. All four floor their maximum at 1, so a quiet board — nothing
 * done in the window yet — used to draw 0, 0.5, 1 up the axis: an
 * English decimal point on a page whose language writes 0,5. The axis
 * is pure arithmetic, so the rule is pinned here rather than in a
 * screenshot.
 */
describe("the charts' y axis", () => {
  it("never puts a fraction on the axis, at any scale", () => {
    for (let max = 0; max <= 400; max++) {
      for (const tick of yTicks(max)) {
        expect(Number.isInteger(tick), `yTicks(${max}) drew ${tick}`).toBe(true);
      }
    }
    for (const max of [0.5, 1.5, 2.5, 7.25, 999, 1234, 100_000]) {
      for (const tick of yTicks(max)) {
        expect(Number.isInteger(tick), `yTicks(${max}) drew ${tick}`).toBe(true);
      }
    }
  });

  it("steps by one on the small boards that used to show halves", () => {
    expect(yTicks(1)).toEqual([0, 1]);
    expect(yTicks(2)).toEqual([0, 1, 2]);
    expect(yTicks(3)).toEqual([0, 1, 2, 3]);
    expect(yTicks(4)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps the round steps it always had further up", () => {
    expect(yTicks(5)).toEqual([0, 2, 4, 6]);
    expect(yTicks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(yTicks(21)).toEqual([0, 10, 20, 30]);
    expect(yTicks(250)).toEqual([0, 100, 200, 300]);
  });

  it("always draws a top the data fits under", () => {
    for (let max = 0; max <= 400; max++) {
      const ticks = yTicks(max);
      expect(ticks.at(-1)!, `yTicks(${max}) topped out below the data`).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
    }
  });

  it("answers a single zero when there is nothing to plot", () => {
    expect(yTicks(0)).toEqual([0]);
    expect(yTicks(-3)).toEqual([0]);
  });
});
