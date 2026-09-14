import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull } from "@/modules/boards/read";
import {
  applyLaneLocally,
  assignmentFor,
  boardLanes,
  columnIndexFor,
  effectiveSwimlaneMode,
  laneKeyOf,
} from "@/modules/boards/structure/swimlanes";
import { createTheme } from "@/modules/boards/structure/write-lists";
import { createBoard, updateStructureView } from "@/modules/boards/write-boards";
import { createCard } from "@/modules/boards/write-cards";
import {
  applySwimlaneAssignment,
  createSwimlane,
  updateSwimlane,
} from "@/modules/boards/write-swimlanes";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * Swimlanes (docs/adr/0017): the grouping is arithmetic on the flat card
 * list, the choice is refused where it cannot hold, and a drop across
 * lanes writes exactly the lane's field through the same services as
 * every other page.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let todo: string;
let scrumId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

const code = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "NO_ERROR";
  } catch (error) {
    return (error as Error).message;
  }
};

const view = {
  structureLevels: "epic",
  showKind: true,
  showThemes: true,
  showAreas: true,
} as const;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "swim_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Flow", key: "FLW", mode: "kanban", firstArea: "Butik" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  todo = full.columns.find((c) => c.category === "todo")!.id;
  const scrum = await run((tx) =>
    createBoard(tx, ctx, { name: "Sprint", key: "SPR", mode: "scrum", firstArea: "Butik" }),
  );
  scrumId = scrum.id;
});

afterAll(async () => {
  await admin.end();
});

describe("the swimlane choice", () => {
  it("is refused on a Scrum board and for a hidden field, and holds on Kanban", async () => {
    expect(
      await code(
        run((tx) => updateStructureView(tx, ctx, scrumId, { ...view, swimlaneBy: "area" })),
      ),
    ).toBe("invalid");
    expect(
      await code(
        run((tx) =>
          updateStructureView(tx, ctx, boardId, {
            ...view,
            showThemes: false,
            swimlaneBy: "theme",
          }),
        ),
      ),
    ).toBe("invalid");
    await run((tx) => updateStructureView(tx, ctx, boardId, { ...view, swimlaneBy: "manual" }));
    expect((await getBoardFull(ctx, boardId))!.board.swimlaneBy).toBe("manual");
  });

  it("is a view: hidden with its field, back when the field returns", () => {
    const base = { mode: "kanban", swimlaneBy: "theme", ...view };
    expect(effectiveSwimlaneMode({ ...base, showThemes: false })).toBe("none");
    expect(effectiveSwimlaneMode(base)).toBe("theme");
    expect(effectiveSwimlaneMode({ ...base, mode: "scrum" })).toBe("none");
  });
});

describe("manual lanes", () => {
  it("are created in order, refuse a taken name, and deactivate rather than delete", async () => {
    const fast = await run((tx) => createSwimlane(tx, ctx, { boardId, name: "Haster" }));
    const calm = await run((tx) => createSwimlane(tx, ctx, { boardId, name: "Roligt" }));
    expect([fast.sort, calm.sort]).toEqual([0, 1]);
    expect(await code(run((tx) => createSwimlane(tx, ctx, { boardId, name: "haster" })))).toBe(
      "conflict",
    );
    await run((tx) =>
      updateSwimlane(tx, ctx, { swimlaneId: calm.id, name: "Roligt", active: false }),
    );
    const lanes = (await getBoardFull(ctx, boardId))!.swimlanes;
    expect(lanes.find((l) => l.id === calm.id)?.active).toBe(false);
  });

  it("hold a card from birth, and refuse an inactive or foreign lane", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const fast = full.swimlanes.find((l) => l.name === "Haster")!;
    const calm = full.swimlanes.find((l) => l.name === "Roligt")!;
    const card = await run((tx) =>
      createCard(tx, ctx, {
        boardId,
        title: "I banen",
        columnId: todo,
        areaId: full.areas[0]!.id,
        swimlaneId: fast.id,
      }),
    );
    expect(
      (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)?.swimlaneId,
    ).toBe(fast.id);
    expect(
      await code(
        run((tx) =>
          createCard(tx, ctx, {
            boardId,
            title: "Nej",
            areaId: full.areas[0]!.id,
            swimlaneId: calm.id,
          }),
        ),
      ),
    ).toBe("invalid");
    const scrumArea = (await getBoardFull(ctx, scrumId))!.areas[0]!.id;
    expect(
      await code(
        run((tx) =>
          createCard(tx, ctx, {
            boardId: scrumId,
            title: "Nej",
            areaId: scrumArea,
            swimlaneId: fast.id,
          }),
        ),
      ),
    ).toBe("notFound");
  });

  it("take a drop: the lane's field is written, a mismatched grouping is refused", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const fast = full.swimlanes.find((l) => l.name === "Haster")!;
    const card = full.cards.find((c) => c.title === "I banen")!;
    expect(
      await code(
        run((tx) => applySwimlaneAssignment(tx, ctx, card, { by: "kind", kind: "enabler" })),
      ),
    ).toBe("invalid");
    await run((tx) => applySwimlaneAssignment(tx, ctx, card, { by: "manual", swimlaneId: null }));
    const after = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!;
    expect(after.swimlaneId).toBeNull();
    await run((tx) =>
      applySwimlaneAssignment(tx, ctx, after, { by: "manual", swimlaneId: fast.id }),
    );
    expect(
      (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)?.swimlaneId,
    ).toBe(fast.id);
  });
});

describe("theme lanes", () => {
  it("put a card in its topmost theme's lane, and a drop swaps only that theme", async () => {
    await run((tx) => updateStructureView(tx, ctx, boardId, { ...view, swimlaneBy: "theme" }));
    const pay = await run((tx) =>
      createTheme(tx, ctx, { boardId, name: "Betaling", color: "moss" }),
    );
    const trust = await run((tx) =>
      createTheme(tx, ctx, { boardId, name: "Tillid", color: "clay" }),
    );
    const full0 = (await getBoardFull(ctx, boardId))!;
    const card = await run((tx) =>
      createCard(tx, ctx, {
        boardId,
        title: "To temaer",
        columnId: todo,
        areaId: full0.areas[0]!.id,
        themeIds: [trust.id, pay.id],
      }),
    );
    let full = (await getBoardFull(ctx, boardId))!;
    let row = full.cards.find((c) => c.id === card.id)!;
    // Topmost by the themes' own order, not the card's list order.
    expect(laneKeyOf(row, "theme", full.themes)).toBe(pay.id);
    await run((tx) => applySwimlaneAssignment(tx, ctx, row, { by: "theme", themeId: trust.id }));
    full = (await getBoardFull(ctx, boardId))!;
    row = full.cards.find((c) => c.id === card.id)!;
    expect(new Set(row.themeIds)).toEqual(new Set([trust.id]));
  });
});

describe("the grouping arithmetic", () => {
  const themes = [
    { id: "t1", name: "Først", active: true, sort: 0 },
    { id: "t2", name: "Sidst", active: false, sort: 1 },
  ] as never[];
  const cards = [
    { id: "a", kind: "business", areaId: null, swimlaneId: null, themeIds: ["t2"] },
    { id: "b", kind: "enabler", areaId: "x", swimlaneId: null, themeIds: [] },
  ];

  it("draws active rows, keeps a deactivated row that still has cards, and words the rest", () => {
    const lanes = boardLanes("theme", { themes: themes as never, areas: [] }, [], cards);
    expect(lanes.map((l) => l.key)).toEqual(["t1", "t2", null]);
    const kindLanes = boardLanes("kind", { themes: [], areas: [] }, [], cards);
    expect(kindLanes.map((l) => l.key)).toEqual(["business", "enabler"]);
  });

  it("translates a lane-local drop index to the column's own", () => {
    const column = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const laneCards = [{ id: "b" }, { id: "d" }];
    expect(columnIndexFor(column, laneCards, 0)).toBe(1);
    expect(columnIndexFor(column, laneCards, 2)).toBe(4);
    expect(columnIndexFor(column, [], 0)).toBeUndefined();
  });

  it("keeps the card's other themes when its lane theme is swapped locally", () => {
    const card = {
      id: "a",
      kind: "business",
      areaId: null,
      swimlaneId: null,
      enablerType: null,
      themeIds: ["t1", "t2"],
    };
    const next = applyLaneLocally(card, { by: "theme", themeId: "t3" }, themes as never);
    expect(next.themeIds).toEqual(["t3", "t2"]);
    expect(assignmentFor("theme", null)).toBeNull();
    expect(assignmentFor("area", null)).toEqual({ by: "area", areaId: null });
  });
});
