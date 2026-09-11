import { describe, expect, it } from "vitest";
import { backlogStories, grouped, hierarchy } from "@/components/backlog/group-backlog";
import { overview } from "@/modules/boards/structure/overview";
import { roadmap } from "@/modules/boards/structure/roadmap";
import { quarterOf, quarterRange, quartersBetween } from "@/modules/boards/structure/rules";
import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";

/**
 * The three views computed from a board — the backlog's groups, the
 * roadmap and the overview — against one fixed board, so a change in a
 * number is a change somebody decided on.
 */

const day = 86_400_000;
const now = new Date("2026-09-11T10:00:00Z");
const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * day);

function item(partial: Partial<ItemView> & Pick<ItemView, "id" | "level" | "title">): ItemView {
  return {
    orgId: "org",
    boardId: "board",
    parentId: null,
    number: 1,
    description: "",
    doneWhen: "når det er sådan",
    kind: "business",
    enablerType: null,
    areaId: "a1",
    state: "open",
    closedAt: null,
    targetQuarter: null,
    reviewConfirmedAt: null,
    sort: 1000,
    createdBy: null,
    createdAt: at(10),
    updatedAt: at(10),
    themeIds: [],
    ...partial,
  };
}

function card(partial: Partial<CardView> & Pick<CardView, "id" | "title">): CardView {
  return {
    orgId: "org",
    boardId: "board",
    columnId: "todo",
    sprintId: null,
    featureId: null,
    kind: "business",
    enablerType: null,
    areaId: "a1",
    bug: false,
    acceptance: "",
    number: 1,
    description: "",
    sort: 1000,
    assigneeUserId: null,
    estimate: null,
    priority: "normal",
    dueDate: null,
    checklist: [],
    blocked: false,
    blockedReason: "",
    startedAt: null,
    doneAt: null,
    archivedAt: null,
    createdBy: null,
    createdAt: at(5),
    updatedAt: at(5),
    assigneeName: null,
    themeIds: [],
    checklistDone: 0,
    checklistTotal: 0,
    commentCount: 0,
    ...partial,
  };
}

const theme = (id: string, name: string, color: string) => ({
  id,
  orgId: "org",
  boardId: "board",
  name,
  color,
  ownerUserId: null,
  active: true,
  sort: 0,
  createdAt: at(30),
  updatedAt: at(30),
});

const area = (id: string, name: string, active = true) => ({
  id,
  orgId: "org",
  boardId: "board",
  name,
  ownerUserId: null,
  active,
  sort: 0,
  createdAt: at(30),
  updatedAt: at(30),
});

const board: BoardFull = {
  board: {
    id: "board",
    orgId: "org",
    name: "Webshop",
    key: "WEB",
    mode: "scrum",
    description: "",
    sprintLengthDays: 14,
    nextCardNumber: 20,
    nextSprintNumber: 3,
    epicReviewDays: 180,
    createdBy: null,
    archivedAt: null,
    createdAt: at(400),
    updatedAt: at(1),
  },
  columns: [
    {
      id: "todo",
      orgId: "org",
      boardId: "board",
      name: "Planlagt",
      category: "todo",
      wipLimit: null,
      sort: 0,
      createdAt: at(400),
      updatedAt: at(400),
    },
    {
      id: "done",
      orgId: "org",
      boardId: "board",
      name: "Færdig",
      category: "done",
      wipLimit: null,
      sort: 2,
      createdAt: at(400),
      updatedAt: at(400),
    },
  ],
  themes: [
    theme("t1", "Selvbetjening", "moss"),
    theme("t2", "Stabil drift", "clay"),
    theme("t3", "Regulatorisk", "rust"),
  ],
  areas: [area("a1", "Betalinger"), area("a2", "Login"), area("a3", "Gammelt", false)],
  items: [
    item({
      id: "e1",
      level: "epic",
      title: "Kunder kan betale med MobilePay",
      number: 1,
      themeIds: ["t1"],
      targetQuarter: "2026-Q4",
      createdAt: at(200),
      sort: 2000,
    }),
    item({
      id: "e2",
      level: "epic",
      title: "Vi kan udrulle uden nedetid",
      number: 2,
      kind: "enabler",
      enablerType: "infrastructure",
      themeIds: ["t2"],
      sort: 1000,
    }),
    item({
      id: "e3",
      level: "epic",
      title: "Gammel epic",
      number: 3,
      state: "closed",
      closedAt: at(3),
      targetQuarter: "2026-Q1",
    }),
    item({
      id: "f1",
      level: "feature",
      title: "Kunder kan betale i checkout",
      number: 4,
      parentId: "e1",
      themeIds: ["t1"],
      sort: 1000,
    }),
    item({
      id: "f2",
      level: "feature",
      title: "Kunder kan gemme et kort",
      number: 5,
      areaId: "a2",
      sort: 2000,
    }),
  ],
  cards: [
    card({
      id: "c1",
      title: "Vis knappen",
      number: 6,
      featureId: "f1",
      themeIds: ["t1"],
      estimate: 3,
      sort: 2000,
    }),
    card({
      id: "c2",
      title: "Håndtér afvisning",
      number: 7,
      featureId: "f1",
      themeIds: ["t1"],
      estimate: 5,
      sprintId: "s1",
      sort: 1000,
    }),
    card({
      id: "c3",
      title: "Gem kortet",
      number: 8,
      featureId: "f2",
      areaId: "a2",
      estimate: 2,
      kind: "enabler",
      enablerType: "architecture",
      sort: 3000,
    }),
    card({
      id: "c4",
      title: "Rettelse",
      number: 9,
      areaId: null,
      bug: true,
      estimate: 1,
      sort: 500,
    }),
    card({
      id: "c5",
      title: "Gjort",
      number: 10,
      featureId: "f1",
      columnId: "done",
      doneAt: at(1),
      estimate: 8,
      sprintId: "s1",
      sort: 100,
    }),
  ],
  sprints: [],
  activeSprint: null,
  members: [],
};

describe("the backlog's groups", () => {
  it("takes the uncommitted stories in their own order, and hangs them in the hierarchy", () => {
    const stories = backlogStories(board);
    expect(stories.map((s) => s.title)).toEqual(["Rettelse", "Vis knappen", "Gem kortet"]);
    const tree = hierarchy(board, stories, { showClosed: false });
    expect(tree.epics.map((n) => n.epic.number)).toEqual([2, 1]);
    expect(tree.epics[1]!.features[0]!.stories.map((s) => s.title)).toEqual(["Vis knappen"]);
    expect(tree.epics[1]!.features[0]!.elsewhere).toEqual({ open: 1, done: 1 });
    expect(tree.looseFeatures.map((n) => n.feature.title)).toEqual(["Kunder kan gemme et kort"]);
    expect(tree.looseStories.map((s) => s.title)).toEqual(["Rettelse"]);
    expect(hierarchy(board, stories, { showClosed: true }).epics).toHaveLength(3);
  });

  it("groups the same stories by theme, area and kind", () => {
    const stories = backlogStories(board);
    const names = { none: "Uden", business: "Business", enabler: "Enabler" };
    expect(grouped(board, stories, "theme", names).map((g) => [g.name, g.stories.length])).toEqual([
      ["Selvbetjening", 1],
      ["Uden", 2],
    ]);
    expect(grouped(board, stories, "area", names).map((g) => [g.name, g.stories.length])).toEqual([
      ["Betalinger", 1],
      ["Login", 1],
      ["Uden", 1],
    ]);
    expect(grouped(board, stories, "kind", names).map((g) => g.stories.length)).toEqual([2, 1]);
  });
});

describe("the overview", () => {
  it("counts open stories and points per theme, area and kind, and the enabler share by points", () => {
    const data = overview(board, now);
    expect(data.openCards).toBe(4);
    expect(data.openPoints).toBe(11);
    expect(data.byTheme.map((b) => [b.name || b.key, b.cards, b.points])).toEqual([
      ["Selvbetjening", 2, 8],
      ["Stabil drift", 0, 0],
      ["Regulatorisk", 0, 0],
      ["none", 2, 3],
    ]);
    expect(data.byArea.map((b) => [b.name || b.key, b.cards])).toEqual([
      ["Betalinger", 2],
      ["Login", 1],
      ["none", 1],
    ]);
    expect(data.byKind.map((b) => b.points)).toEqual([9, 2]);
    expect(data.enablerShare).toBeCloseTo(2 / 11);
  });

  it("measures the health of the structure", () => {
    const { health } = overview(board, now);
    // f2 and c4 have no parent, among 2 open features and 4 open stories.
    expect(health.parentless).toEqual({ count: 2, total: 6 });
    expect(health.reviewEpics.map((e) => e.number)).toEqual([1]);
    // c4 has no area, among 4 open items and 4 open stories.
    expect(health.withoutArea).toEqual({ count: 1, total: 8 });
    // "Stabil drift" is carried by the open enabler epic, so only the third theme is idle.
    expect(health.idleThemes.map((t) => t.name)).toEqual(["Regulatorisk"]);
    expect(health.idleAreas).toEqual([]);
  });
});

describe("the roadmap", () => {
  it("draws open epics with a target and closed epics of late, and lists the rest as unplanned", () => {
    const data = roadmap(board, now);
    expect(data.current).toBe("2026-Q3");
    expect(data.rows.map((r) => [r.epic.number, r.startQuarter, r.endQuarter])).toEqual([
      [3, "2026-Q3", "2026-Q3"],
      [1, "2026-Q1", "2026-Q4"],
    ]);
    expect(data.rows[1]).toMatchObject({
      reviewDue: true,
      features: 1,
      doneStories: 1,
      openStories: 2,
    });
    expect(data.unplanned.map((r) => r.epic.number)).toEqual([2]);
    expect(data.quarters[0]).toBe("2026-Q1");
    expect(data.quarters.at(-1)).toBe("2027-Q2");
  });

  it("does quarter arithmetic", () => {
    expect(quarterOf("2026-09-11")).toBe("2026-Q3");
    expect(quarterOf("2026-12-31")).toBe("2026-Q4");
    expect(quartersBetween("2026-Q3", "2027-Q1")).toEqual(["2026-Q3", "2026-Q4", "2027-Q1"]);
    expect(quarterRange("2027-Q1")).toEqual({ start: "2027-01-01", end: "2027-03-31" });
    expect(quarterRange("2028-Q1").end).toBe("2028-03-31");
  });
});
