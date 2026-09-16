import { describe, expect, it } from "vitest";
import {
  backbone,
  cellKey,
  featureTotals,
  LOOSE_COLUMN,
  mapRows,
  rowOf,
  storyMap,
  tray,
  UNRELEASED,
} from "@/components/map/story-map";
import type { BoardFull, ItemView } from "@/modules/boards/types";
import { at, board, card, item } from "../helpers/structure-board";

/**
 * The story map computed from the fixed board: the backbone in the
 * map's own order, the tray of what is not up yet, the rows, and that
 * every card under a feature on the map lands in exactly one cell in
 * the backlog's order.
 */

const sprint = (id: string, number: number, state: "planned" | "active" | "closed") => ({
  id,
  orgId: "org",
  boardId: "board",
  number,
  name: `Sprint ${number}`,
  goal: "",
  startDate: "2026-09-01",
  endDate: "2026-09-14",
  state,
  committedPoints: null,
  completedPoints: null,
  summary: "",
  retro: null,
  startedAt: null,
  closedAt: null,
  createdAt: at(30),
  updatedAt: at(30),
});

/** Both features up, f2 first: the map's order is not the backlog's rank. */
const up = (items: ItemView[]) =>
  items.map((i) =>
    i.id === "f1" ? { ...i, mapSort: 2000 } : i.id === "f2" ? { ...i, mapSort: 1000 } : i,
  );

const scrum: BoardFull = {
  ...board,
  items: up(board.items),
  sprints: [sprint("s2", 2, "planned"), sprint("s1", 1, "active"), sprint("s0", 0, "closed")],
};
/** Two bands, nearest first, on the board the rest of the file uses. */
const release = (id: string, name: string, sort: number) => ({
  id,
  orgId: "org",
  boardId: "board",
  name,
  targetDate: null,
  sort,
  createdAt: at(20),
  updatedAt: at(20),
});
const released: BoardFull = {
  ...scrum,
  releases: [release("r2", "Vinter", 2000), release("r1", "Efterår", 1000)],
};

const titles = (map: ReturnType<typeof storyMap>, row: string, column: string) =>
  (map.cells.get(cellKey(row, column)) ?? []).map((c) => c.title);

describe("the story map", () => {
  it("draws the releases down, nearest first, and the unreleased band last", () => {
    expect(mapRows(released).map((row) => row.key)).toEqual([
      "release:r1",
      "release:r2",
      UNRELEASED,
    ]);
  });

  it("gives a board with no releases the unreleased band alone, so the wall is honest", () => {
    expect(mapRows(scrum).map((row) => row.key)).toEqual([UNRELEASED]);
  });

  it("puts a card in its own release's band, and one promised to none at the bottom", () => {
    const rows = mapRows(released);
    expect(rowOf(card({ id: "x", title: "Lovet", releaseId: "r1" }), rows)).toBe("release:r1");
    expect(rowOf(card({ id: "y", title: "Uden" }), rows)).toBe(UNRELEASED);
    // A release the view does not hold cannot swallow a card.
    expect(rowOf(card({ id: "z", title: "Fremmed", releaseId: "r9" }), rows)).toBe(UNRELEASED);
  });

  it("puts the features up in the map's own order, and the loose column last", () => {
    const map = storyMap(scrum, scrum.items, scrum.cards, { showClosed: false });
    expect(map.columns.map((c) => c.key)).toEqual(["f2", "f1", LOOSE_COLUMN]);
    expect(tray(scrum.items)).toEqual([]);
  });

  it("keeps a feature off the map in the tray, in the backlog's rank, and its cards off the map", () => {
    const items = board.items.map((i) => (i.id === "f1" ? { ...i, mapSort: 1000 } : i));
    const map = storyMap(scrum, items, scrum.cards, { showClosed: false });
    expect(map.columns.map((c) => c.key)).toEqual(["f1", LOOSE_COLUMN]);
    expect(tray(items).map((f) => f.id)).toEqual(["f2"]);
    expect([...map.cells.values()].flat().map((c) => c.id)).not.toContain("c3");
  });

  it("offers only open features in the tray, and shows a closed one on the map only on request", () => {
    const closed = item({
      id: "f3",
      level: "feature",
      title: "Lukket feature",
      number: 12,
      state: "closed",
      mapSort: 500,
    });
    const items = [...scrum.items, closed];
    expect(tray([...board.items, { ...closed, mapSort: null }]).map((f) => f.id)).toEqual([
      "f1",
      "f2",
    ]);
    expect(backbone(items, { showClosed: false }).map((f) => f.id)).toEqual(["f2", "f1"]);
    expect(backbone(items, { showClosed: true }).map((f) => f.id)).toEqual(["f3", "f2", "f1"]);
  });

  it("puts every card in one cell, in the backlog's order, under its own band", () => {
    const cards = released.cards.map((c) =>
      c.id === "c1" || c.id === "c2" ? { ...c, releaseId: "r1" } : c,
    );
    const map = storyMap(released, released.items, cards, { showClosed: false });
    // What is promised to the first release sits in its band, in rank order...
    expect(titles(map, "release:r1", "f1")).toEqual(["Håndtér afvisning", "Vis knappen"]);
    // ...and everything else waits in the one at the bottom.
    expect(titles(map, UNRELEASED, "f1")).toEqual(["Gjort"]);
    expect(titles(map, UNRELEASED, "f2")).toEqual(["Gem kortet"]);
    expect(titles(map, UNRELEASED, LOOSE_COLUMN)).toEqual(["Rettelse"]);
    expect([...map.cells.values()].flat()).toHaveLength(5);
  });

  it("adds up a feature from every card under it, on and off the map", () => {
    const f1 = scrum.items.find((i) => i.id === "f1")!;
    expect(featureTotals(f1, scrum)).toEqual({ total: 3, done: 1, open: 1 });
  });
});
