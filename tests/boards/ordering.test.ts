import { describe, expect, it } from "vitest";
import {
  mergeByRank,
  placeInLane,
  sortAtEnd,
  sortAtTop,
  sortLane,
  STEP,
} from "@/modules/boards/ordering";

const lane = [
  { id: "a", sort: 1000 },
  { id: "b", sort: 2000 },
  { id: "c", sort: 3000 },
];

describe("lane ordering", () => {
  it("sorts by the number and keeps insertion order on ties", () => {
    const shuffled = [
      { id: "c", sort: 3000 },
      { id: "a", sort: 1000 },
      { id: "b", sort: 1000 },
    ];
    expect(sortLane(shuffled).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("joins at the end and at the top with a whole step of room", () => {
    expect(sortAtEnd(lane)).toBe(4000);
    expect(sortAtTop(lane)).toBe(0);
    expect(sortAtEnd([])).toBe(STEP);
    expect(sortAtTop([])).toBe(STEP);
  });

  it("moves one card and leaves every other number where it was", () => {
    // The rank is shared with the sprint's lanes (docs/adr/0033): a move
    // that renumbered the lane would shift every committed card with it.
    expect(placeInLane(lane, "c", 0)).toEqual([{ id: "c", sort: 0 }]);
    expect(placeInLane(lane, "a", 1)).toEqual([{ id: "a", sort: 2500 }]);
    expect(placeInLane(lane, "a", 3)).toEqual([{ id: "a", sort: 4000 }]);
  });

  it("adds a card from another lane at the asked-for position", () => {
    expect(placeInLane(lane, "x", 1)).toEqual([{ id: "x", sort: 1500 }]);
    expect(placeInLane([], "x", 0)).toEqual([{ id: "x", sort: STEP }]);
  });

  it("clamps the index to the lane and treats no index as the end", () => {
    expect(placeInLane(lane, "x", 99)).toEqual([{ id: "x", sort: 4000 }]);
    expect(placeInLane(lane, "x", undefined)).toEqual([{ id: "x", sort: 4000 }]);
    expect(placeInLane(lane, "a", -5)).toEqual([]);
  });

  it("writes nothing when the card is already where it is asked to go", () => {
    expect(placeInLane(lane, "b", 1)).toEqual([]);
    expect(placeInLane(lane, "c", undefined)).toEqual([]);
  });

  it("writes as few rows as will make room, never the whole lane", () => {
    // A board carrying years of work arrives with blocks of rows holding
    // the same number — ranks written before docs/adr/0033 came from two
    // lanes numbering independently. Spreading the whole lane for one
    // arrow press rewrote, re-stamped and audited every card on the
    // board; the window stops at the rows that actually need a number.
    const crowded = [
      ...Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, sort: 1000 })),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, sort: 2000 })),
      ...Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, sort: 3000 + i * 1000 })),
    ];
    const moved = placeInLane(crowded, "c19", 2);
    expect(moved.length).toBeLessThan(crowded.length / 2);
    expect(moved.some((change) => change.id === "c19")).toBe(true);
    // Whatever it wrote, the order it asked for is the order it leaves.
    const after = new Map(crowded.map((c) => [c.id, c.sort]));
    for (const change of moved) after.set(change.id, change.sort);
    const order = [...after.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
    expect(order.indexOf("c19")).toBe(2);
    expect(new Set(moved.map((c) => c.sort)).size).toBe(moved.length);
  });

  it("respaces the lane only when the neighbours have no number between them", () => {
    const tight = [
      { id: "a", sort: 1000 },
      { id: "b", sort: 1001 },
      { id: "c", sort: 3000 },
    ];
    expect(placeInLane(tight, "c", 1)).toEqual([
      { id: "c", sort: 2000 },
      { id: "b", sort: 3000 },
    ]);
    // Ties are no room either, and the same repair answers them.
    const tied = [
      { id: "a", sort: 1000 },
      { id: "b", sort: 1000 },
      { id: "c", sort: 3000 },
    ];
    expect(placeInLane(tied, "c", 1)).toEqual([
      { id: "c", sort: 2000 },
      { id: "b", sort: 3000 },
    ]);
  });

  it("keeps a lane right through more moves into one gap than it has room for", () => {
    const rows = [
      { id: "a", sort: 1000 },
      { id: "b", sort: 2000 },
      { id: "c", sort: 3000 },
    ];
    let respaced = 0;
    for (let round = 0; round < 30; round += 1) {
      const before = sortLane(rows).map((r) => r.id);
      const last = before.at(-1)!;
      const changes = placeInLane(rows, last, 1);
      if (changes.length > 1) respaced += 1;
      for (const change of changes) {
        rows.find((r) => r.id === change.id)!.sort = change.sort;
      }
      expect(sortLane(rows).map((r) => r.id)).toEqual([before[0], last, before[1]]);
    }
    // The gap between two whole numbers runs out eventually; the lane is
    // then written out again, and the order never suffers for it.
    expect(respaced).toBeGreaterThan(0);
  });
});

describe("the one priority as one sequence", () => {
  const free = [
    { id: "a", sort: 1000, number: 1 },
    { id: "c", sort: 3000, number: 3 },
  ];
  const promised = [
    { id: "b", sort: 2000, number: 2 },
    { id: "d", sort: 3000, number: 4 },
  ];

  it("merges the promised rows on the rank they share and marks them", () => {
    expect(mergeByRank(free, promised).map((row) => [row.card.id, row.committed])).toEqual([
      ["a", false],
      ["b", true],
      ["c", false],
      ["d", true],
    ]);
  });
});
