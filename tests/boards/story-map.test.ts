import { describe, expect, it } from "vitest";
import {
  cellKey,
  featureTotals,
  LOOSE_COLUMN,
  mapRows,
  rowOf,
  storyMap,
} from "@/components/map/story-map";
import { structureView } from "@/modules/boards/structure/view";
import type { BoardFull } from "@/modules/boards/types";
import { at, board, card } from "../helpers/structure-board";

/**
 * The story map computed from the fixed board: which columns it draws,
 * which rows, and that every card lands in exactly one cell in the
 * backlog's own order.
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

const scrum: BoardFull = {
  ...board,
  sprints: [sprint("s2", 2, "planned"), sprint("s1", 1, "active"), sprint("s0", 0, "closed")],
};
const full = structureView(board.board);
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

  it("puts the epics across with their features, the orphans after, the loose column last", () => {
    const map = storyMap(scrum, full, scrum.items, scrum.cards, { showClosed: false });
    expect(map.groups.map((g) => [g.key, g.columns.map((c) => c.key)])).toEqual([
      ["e2", []],
      ["e1", ["f1"]],
      ["no-epic", ["f2"]],
      [LOOSE_COLUMN, [LOOSE_COLUMN]],
    ]);
    expect(map.columnCount).toBe(3);
    const withClosed = storyMap(scrum, full, scrum.items, scrum.cards, { showClosed: true });
    expect(withClosed.groups.map((g) => g.key)).toEqual(["e2", "e3", "e1", "no-epic", "loose"]);
  });

  it("drops the epic row when the board shows features and cards only", () => {
    const view = structureView({ ...board.board, structureLevels: "feature" });
    const items = scrum.items.filter((item) => item.level !== "epic");
    const map = storyMap(scrum, view, items, scrum.cards, { showClosed: false });
    expect(map.groups.map((g) => [g.key, g.columns.map((c) => c.key)])).toEqual([
      ["features", ["f1", "f2"]],
      [LOOSE_COLUMN, [LOOSE_COLUMN]],
    ]);
  });

  it("puts every card in one cell, in the backlog's order, and a closed sprint's off the map", () => {
    const cards = [
      ...scrum.cards,
      card({ id: "c6", title: "Gammelt", number: 11, sprintId: "s0" }),
    ];
    const map = storyMap(scrum, full, scrum.items, cards, { showClosed: false });
    expect(titles(map, "sprint:s1", "f1")).toEqual(["Gjort", "Håndtér afvisning"]);
    expect(titles(map, "backlog", "f1")).toEqual(["Vis knappen"]);
    expect(titles(map, "backlog", "f2")).toEqual(["Gem kortet"]);
    expect(titles(map, "backlog", LOOSE_COLUMN)).toEqual(["Rettelse"]);
    const placed = [...map.cells.values()].flat();
    expect(placed).toHaveLength(5);
    expect(placed.map((c) => c.id)).not.toContain("c6");
  });

  it("counts a card under a hidden feature as loose", () => {
    const view = structureView({ ...board.board, structureLevels: "card" });
    const map = storyMap(scrum, view, [], scrum.cards, { showClosed: false });
    expect(map.groups.map((g) => g.key)).toEqual([LOOSE_COLUMN]);
    expect(titles(map, "backlog", LOOSE_COLUMN)).toEqual(["Rettelse", "Vis knappen", "Gem kortet"]);
  });

  it("adds up a feature from every card under it, on and off the map", () => {
    const f1 = scrum.items.find((item) => item.id === "f1")!;
    expect(featureTotals(f1, scrum)).toEqual({ total: 3, done: 1, open: 1 });
  });
});
