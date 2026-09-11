import { describe, expect, it } from "vitest";
import { burndown, endOfDayCopenhagen } from "@/modules/boards/metrics/burndown";
import { cumulativeFlow, cycleTime, isoDayOf, throughput } from "@/modules/boards/metrics/flow";
import { velocity } from "@/modules/boards/metrics/velocity";

const at = (iso: string) => new Date(iso);

describe("burndown", () => {
  const sprint = { startDate: "2026-09-07", endDate: "2026-09-11", committedPoints: 20 };
  const cards = [
    { estimate: 5, doneAt: at("2026-09-08T10:00:00Z"), createdAt: at("2026-09-01T00:00:00Z") },
    { estimate: 8, doneAt: at("2026-09-10T15:00:00Z"), createdAt: at("2026-09-01T00:00:00Z") },
    { estimate: 7, doneAt: null, createdAt: at("2026-09-01T00:00:00Z") },
  ];

  it("burns the committed points down by the day the cards were done", () => {
    const result = burndown(sprint, cards, "2026-09-10");
    expect(result.committed).toBe(20);
    expect(result.points.map((p) => p.remaining)).toEqual([20, 15, 15, 7, null]);
    expect(result.points.map((p) => p.ideal)).toEqual([20, 15, 10, 5, 0]);
    expect(result.remainingNow).toBe(7);
  });

  it("counts a card done just before Copenhagen midnight on that day", () => {
    const late = [
      { estimate: 4, doneAt: at("2026-09-08T21:30:00Z"), createdAt: at("2026-09-01T00:00:00Z") },
    ];
    const result = burndown({ ...sprint, committedPoints: 4 }, late, "2026-09-09");
    expect(result.points[1]?.remaining).toBe(0);
    expect(endOfDayCopenhagen("2026-09-08").toISOString()).toBe("2026-09-08T21:59:59.999Z");
    expect(endOfDayCopenhagen("2026-01-08").toISOString()).toBe("2026-01-08T22:59:59.999Z");
  });

  it("falls back to the cards' points when the sprint never recorded a commitment", () => {
    const result = burndown({ ...sprint, committedPoints: null }, cards, "2026-09-07");
    expect(result.committed).toBe(20);
  });
});

describe("throughput and cycle time", () => {
  const cards = [
    {
      id: "a",
      createdAt: at("2026-08-20T08:00:00Z"),
      startedAt: at("2026-08-25T08:00:00Z"),
      doneAt: at("2026-08-28T08:00:00Z"),
      archivedAt: null,
    },
    {
      id: "b",
      createdAt: at("2026-09-01T08:00:00Z"),
      startedAt: at("2026-09-02T08:00:00Z"),
      doneAt: at("2026-09-09T08:00:00Z"),
      archivedAt: null,
    },
    {
      id: "c",
      createdAt: at("2026-09-01T08:00:00Z"),
      startedAt: null,
      doneAt: at("2026-09-10T08:00:00Z"),
      archivedAt: null,
    },
    {
      id: "d",
      createdAt: at("2026-09-01T08:00:00Z"),
      startedAt: at("2026-09-03T08:00:00Z"),
      doneAt: null,
      archivedAt: null,
    },
  ];

  it("counts finished cards per ISO week, oldest week first", () => {
    const weeks = throughput(cards, "2026-09-11", 4);
    expect(weeks.map((w) => w.week)).toEqual(["2026-W34", "2026-W35", "2026-W36", "2026-W37"]);
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 0, 2]);
  });

  it("averages cycle time over cards that were picked up, lead time over all done", () => {
    const result = cycleTime(cards, "2026-09-11", 30);
    expect(result.sample).toBe(3);
    // a: 3 days, b: 7 days; c never started so it has no cycle time.
    expect(result.averageDays).toBe(5);
    expect(result.medianDays).toBe(5);
    // a: 8, b: 8, c: 9
    expect(result.leadAverageDays).toBe(8.3);
  });

  it("names the Copenhagen day of an instant", () => {
    expect(isoDayOf(at("2026-09-08T22:30:00Z"))).toBe("2026-09-09");
  });
});

describe("cumulative flow", () => {
  it("replays the transition log into daily counts per category", () => {
    const transitions = [
      { cardId: "a", toCategory: "todo", at: at("2026-09-08T09:00:00Z") },
      { cardId: "b", toCategory: "todo", at: at("2026-09-08T09:00:00Z") },
      { cardId: "a", toCategory: "doing", at: at("2026-09-09T09:00:00Z") },
      { cardId: "a", toCategory: "done", at: at("2026-09-10T09:00:00Z") },
      { cardId: "b", toCategory: "archived", at: at("2026-09-10T09:00:00Z") },
    ];
    const days = cumulativeFlow(transitions, "2026-09-10", 4);
    expect(days.map((d) => d.date)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
    ]);
    expect(days.map((d) => d.counts)).toEqual([
      { backlog: 0, todo: 0, doing: 0, done: 0 },
      { backlog: 0, todo: 2, doing: 0, done: 0 },
      { backlog: 0, todo: 1, doing: 1, done: 0 },
      { backlog: 0, todo: 0, doing: 0, done: 1 },
    ]);
  });
});

describe("velocity", () => {
  it("lists closed sprints in order and averages the last three", () => {
    const result = velocity([
      {
        id: "4",
        name: "Sprint 4",
        number: 4,
        state: "active",
        committedPoints: 20,
        completedPoints: null,
      },
      {
        id: "3",
        name: "Sprint 3",
        number: 3,
        state: "closed",
        committedPoints: 20,
        completedPoints: 18,
      },
      {
        id: "1",
        name: "Sprint 1",
        number: 1,
        state: "closed",
        committedPoints: 15,
        completedPoints: 10,
      },
      {
        id: "2",
        name: "Sprint 2",
        number: 2,
        state: "closed",
        committedPoints: 18,
        completedPoints: 14,
      },
    ]);
    expect(result.bars.map((b) => b.name)).toEqual(["Sprint 1", "Sprint 2", "Sprint 3"]);
    expect(result.average).toBe(14);
  });

  it("has no average without a closed sprint", () => {
    expect(velocity([]).average).toBeNull();
  });
});
