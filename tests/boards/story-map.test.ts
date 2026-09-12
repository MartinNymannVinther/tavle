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
const titles = (map: ReturnType<typeof storyMap>, row: string, column: string) =>
  (map.cells.get(cellKey(row, column)) ?? []).map((c) => c.title);

describe("the story map", () => {
  it("draws the open sprints down, the running one first, and the backlog last", () => {
    expect(mapRows(scrum).map((row) => row.key)).toEqual(["sprint:s1", "sprint:s2", "backlog"]);
  });

  it("draws a Kanban board's columns down, done first", () => {
    const kanban: BoardFull = { ...board, board: { ...board.board, mode: "kanban" } };
    expect(mapRows(kanban).map((row) => row.key)).toEqual(["column:done", "column:todo"]);
    expect(rowOf(board.cards[0]!, mapRows(kanban), false)).toBe("column:todo");
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

  it("puts every card in one cell, in the backlog's order, and a closed sprint's off the map", () => {
    const cards = [
      ...scrum.cards,
      card({ id: "c6", title: "Gammelt", number: 11, sprintId: "s0" }),
    ];
    const map = storyMap(scrum, scrum.items, cards, { showClosed: false });
    expect(titles(map, "sprint:s1", "f1")).toEqual(["Gjort", "Håndtér afvisning"]);
    expect(titles(map, "backlog", "f1")).toEqual(["Vis knappen"]);
    expect(titles(map, "backlog", "f2")).toEqual(["Gem kortet"]);
    expect(titles(map, "backlog", LOOSE_COLUMN)).toEqual(["Rettelse"]);
    const placed = [...map.cells.values()].flat();
    expect(placed).toHaveLength(5);
    expect(placed.map((c) => c.id)).not.toContain("c6");
  });

  it("adds up a feature from every card under it, on and off the map", () => {
    const f1 = scrum.items.find((i) => i.id === "f1")!;
    expect(featureTotals(f1, scrum)).toEqual({ total: 3, done: 1, open: 1 });
  });
});
