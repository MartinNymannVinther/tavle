import { describe, expect, it } from "vitest";
import { placeInLane, sortAtEnd, sortAtTop, sortLane, STEP } from "@/modules/boards/ordering";

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

  it("moves a card within its lane and renumbers only what changed", () => {
    const changes = placeInLane(lane, "c", 0);
    expect(changes).toEqual([
      { id: "c", sort: 1000 },
      { id: "a", sort: 2000 },
      { id: "b", sort: 3000 },
    ]);
  });

  it("adds a card from another lane at the asked-for position", () => {
    const changes = placeInLane(lane, "x", 1);
    expect(changes).toEqual([
      { id: "x", sort: 2000 },
      { id: "b", sort: 3000 },
      { id: "c", sort: 4000 },
    ]);
  });

  it("clamps the index to the lane and treats no index as the end", () => {
    expect(placeInLane(lane, "x", 99)).toEqual([{ id: "x", sort: 4000 }]);
    expect(placeInLane(lane, "x", undefined)).toEqual([{ id: "x", sort: 4000 }]);
    expect(placeInLane(lane, "a", -5)).toEqual([]);
  });

  it("writes nothing when the card is already where it is asked to go", () => {
    expect(placeInLane(lane, "b", 1)).toEqual([]);
  });
});
