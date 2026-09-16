import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { backlogStories } from "@/components/backlog/group-backlog";
import { backlogCare } from "@/modules/boards/structure/hygiene";
import { MULTI, overview, type Bucket } from "@/modules/boards/structure/overview";
import type { BoardFull } from "@/modules/boards/types";
import da from "../../messages/da.json";
import en from "../../messages/en.json";
import { at, board, card, now } from "../helpers/structure-board";

/**
 * Backlog care and the weight distribution under it (docs/adr/0031). The
 * page states a total once and prints rows and percentages under it, so
 * what has to hold is arithmetic a reader can do in their head: the rows
 * add up to the stated total, the number in the headline is the set the
 * link behind it opens, and every sum is named in what the board counts
 * in (docs/adr/0030).
 */

const points = (rows: Array<{ estimate: number | null }>) =>
  rows.reduce((total, row) => total + (row.estimate ?? 0), 0);

const sum = (buckets: Bucket[], of: "cards" | "points") =>
  buckets.reduce((total, bucket) => total + bucket[of], 0);

/** Every axis accounts for the whole of the total it is printed under. */
function expectAxesReconcile(full: BoardFull) {
  const data = overview(full, now);
  for (const [name, axis] of [
    ["byTheme", data.byTheme],
    ["byArea", data.byArea],
    ["byKind", data.byKind],
  ] as const) {
    expect({ axis: name, cards: sum(axis, "cards"), points: sum(axis, "points") }).toEqual({
      axis: name,
      cards: data.openCards,
      points: data.openPoints,
    });
  }
}

describe("the weight distribution", () => {
  it("adds up to the total the section states once", () => {
    expectAxesReconcile(board);
  });

  it("shows a story with two themes as exactly that, rather than counting it twice", () => {
    const shared: BoardFull = {
      ...board,
      cards: board.cards.map((c) => (c.id === "c1" ? { ...c, themeIds: ["t1", "t2"] } : c)),
    };
    expectAxesReconcile(shared);
    const data = overview(shared, now);
    const several = data.byTheme.find((b) => b.key === MULTI)!;
    expect(several).toMatchObject({ cards: 1, points: 3 });
    // The card left Selvbetjening's own row; it did not leave the total.
    expect(data.byTheme.find((b) => b.key === "t1")).toMatchObject({ cards: 1, points: 5 });
    expect(data.openCards).toBe(4);
    expect(data.openPoints).toBe(11);
  });

  it("leaves the extra row out when no story carries more than one theme", () => {
    expect(overview(board, now).byTheme.map((b) => b.key)).not.toContain(MULTI);
  });

  it("does not print a theme whose every story is shared as a theme with no work", () => {
    // Stabil drift is on both of Selvbetjening's stories and on nothing
    // else: eight points of real work, never a story's only theme.
    const shared: BoardFull = {
      ...board,
      cards: board.cards.map((c) =>
        c.themeIds.includes("t1") ? { ...c, themeIds: ["t1", "t2"] } : c,
      ),
    };
    expectAxesReconcile(shared);
    const data = overview(shared, now);
    // The old row said "0 cards · 0 points" beside the theme's name,
    // which reads as "nothing open here" while the work sits under the
    // shared bucket. An absent row says nothing; a zero row said
    // something false.
    expect(data.byTheme.map((b) => b.key)).not.toContain("t2");
    expect(data.byTheme.find((b) => b.key === MULTI)).toMatchObject({ cards: 2, points: 8 });
  });

  it("prints no empty row on any axis", () => {
    for (const full of [board, kanban]) {
      const data = overview(full, now);
      for (const axis of [data.byTheme, data.byArea, data.byKind]) {
        expect(axis.filter((b) => b.cards === 0)).toEqual([]);
      }
    }
  });

  it("keeps a bucket for a theme taken off the list that open work still carries", () => {
    const retired: BoardFull = {
      ...board,
      themes: board.themes.map((t) => (t.id === "t1" ? { ...t, active: false } : t)),
    };
    expectAxesReconcile(retired);
    expect(overview(retired, now).byTheme.find((b) => b.key === "t1")).toMatchObject({
      retired: true,
      cards: 2,
      points: 8,
    });
  });

  it("keeps a bucket for an area taken off the list that open work still carries", () => {
    const retired: BoardFull = {
      ...board,
      areas: board.areas.map((a) => (a.id === "a2" ? { ...a, active: false } : a)),
    };
    expectAxesReconcile(retired);
    expect(overview(retired, now).byArea.find((b) => b.key === "a2")).toMatchObject({
      retired: true,
      cards: 1,
    });
    // "Gammelt" is off the list and carries nothing, so it stays off the page.
    expect(overview(retired, now).byArea.map((b) => b.key)).not.toContain("a3");
  });
});

const column = (
  id: string,
  name: string,
  category: "backlog" | "todo" | "doing" | "done",
  sort: number,
) => ({ ...board.columns[0]!, id, name, category, sort });

/** A Kanban board with all four categories, so "waiting" has somewhere to go wrong. */
const kanban: BoardFull = {
  ...board,
  board: { ...board.board, mode: "kanban" },
  columns: [
    column("backlog", "Backlog", "backlog", 0),
    column("todo", "Klar", "todo", 1),
    column("doing", "I gang", "doing", 2),
    column("done", "Færdig", "done", 3),
  ],
  cards: [
    card({ id: "k1", number: 31, title: "I backloggen", columnId: "backlog", estimate: 3 }),
    card({ id: "k2", number: 32, title: "Også backlog", columnId: "backlog", estimate: 5 }),
    card({ id: "k3", number: 33, title: "Klar", columnId: "todo", estimate: 8 }),
    card({ id: "k4", number: 34, title: "I gang", columnId: "doing", estimate: 13 }),
    card({
      id: "k5",
      number: 35,
      title: "Færdig",
      columnId: "done",
      estimate: 21,
      doneAt: at(1),
    }),
  ],
};

describe("what the care summary counts as waiting", () => {
  it("on Kanban counts the backlog columns, not everything that is not done", () => {
    const care = backlogCare(kanban, now);
    // Klar and I gang are work already taken up; only the backlog waits.
    expect(care.waiting).toMatchObject({ cards: 2, points: 8 });
  });

  it("counts the very set the backlog it links to lists, on both board types", () => {
    for (const full of [kanban, board]) {
      const listed = backlogStories(full);
      const care = backlogCare(full, now);
      expect([care.waiting.cards, care.waiting.points]).toEqual([listed.length, points(listed)]);
    }
  });
});

describe("the sentences that print a sum", () => {
  const say = (
    locale: "da" | "en",
    namespace: "care" | "insight",
    key: string,
    values: Record<string, string | number>,
  ) =>
    createTranslator({
      locale,
      messages: locale === "da" ? da : en,
      namespace,
    })(
      // The catalogue is walked by key here, which the typed helper cannot know.
      key as never,
      values as never,
    ) as unknown as string;

  it("names the board's unit in the depth finding, on an hours board too", () => {
    const hours = say("da", "care", "tooDeep.body", { value: 756, of: 84, unit: "hours" });
    expect(hours).toContain("756 timer");
    expect(hours).not.toContain("point");
    expect(say("en", "care", "tooDeep.body", { value: 756, of: 84, unit: "hours" })).toContain(
      "756 hours",
    );
    expect(say("da", "care", "tooDeep.body", { value: 52, of: 8, unit: "points" })).toContain(
      "52 point",
    );
  });

  it("never frames the burndown's remainder as a fraction of the commitment", () => {
    // Scope was added after the sprint started: 18 left against 5 promised.
    const values = { name: "Sprint 11", remaining: 18, committed: 5, end: "25. sep." };
    const danish = say("da", "insight", "burndownBody", { ...values, unit: "points" });
    expect(danish).toContain("18 point tilbage");
    expect(danish).toContain("5 lovet ved start");
    expect(danish).not.toContain("18 af 5");
    const english = say("en", "insight", "burndownBody", { ...values, unit: "points" });
    expect(english).toContain("18 points left");
    expect(english).toContain("5 committed at start");
    expect(english).not.toContain("18 of 5");
    expect(say("da", "insight", "burndownBody", { ...values, unit: "hours" })).toContain(
      "18 timer tilbage",
    );
  });
});
