import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { recentBoardEvents } from "@/modules/boards/events";
import { getBoardFull } from "@/modules/boards/read";
import { planFeature } from "@/modules/boards/structure/plan-feature";
import { createItem } from "@/modules/boards/structure/write-items";
import { undoEvent } from "@/modules/boards/undo";
import { createBoard } from "@/modules/boards/write-boards";
import { createSprintSeries, MAX_PLANNED_SPRINTS } from "@/modules/boards/write-sprint-series";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The feature plan (docs/adr/0023): sprints laid ahead back to back,
 * features spanning them the way epics span quarters, the reverse
 * carried like every other plan change.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let featureId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "plan_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Planen", key: "PLA", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  const feature = await run((tx) =>
    createItem(tx, ctx, {
      boardId,
      level: "feature",
      title: "Kan planlægges",
      doneWhen: "Featuren ligger på en sprint",
      areaId: full.areas[0]!.id,
    }),
  );
  featureId = feature.id;
});

afterAll(async () => {
  await admin.end();
});

describe("the sprint series", () => {
  it("lays sprints back to back, numbered on, each the board's length", async () => {
    const created = await run((tx) => createSprintSeries(tx, ctx, { boardId, count: 4 }));
    expect(created).toHaveLength(4);
    expect(created.map((s) => s.name)).toEqual(["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"]);
    for (let i = 1; i < created.length; i += 1) {
      const gap =
        (Date.parse(created[i]!.startDate) - Date.parse(created[i - 1]!.endDate)) / 86_400_000;
      expect(gap).toBe(1);
    }
    const days =
      (Date.parse(created[0]!.endDate) - Date.parse(created[0]!.startDate)) / 86_400_000 + 1;
    expect(days).toBe(14);
  });

  it("refuses a series past the ceiling, and a series on Kanban", async () => {
    await expect(
      run((tx) => createSprintSeries(tx, ctx, { boardId, count: MAX_PLANNED_SPRINTS })),
    ).rejects.toThrow("invalid");
    const kanban = await run((tx) =>
      createBoard(tx, ctx, { name: "Flow", key: "PFL", mode: "kanban", firstArea: "Alt" }),
    );
    expect(
      await run((tx) => createSprintSeries(tx, ctx, { boardId: kanban.id, count: 2 })),
    ).toEqual([]);
  });
});

describe("the feature's span", () => {
  it("spans sprints the right way round, one end alone means one sprint", async () => {
    const sprints = (await getBoardFull(ctx, boardId))!.sprints.sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    // Drawn backwards: swapped quietly, like the epics' quarters.
    await run((tx) =>
      planFeature(tx, ctx, {
        itemId: featureId,
        startSprintId: sprints[2]!.id,
        targetSprintId: sprints[0]!.id,
      }),
    );
    let fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === featureId)!;
    expect([fresh.startSprintId, fresh.targetSprintId]).toEqual([sprints[0]!.id, sprints[2]!.id]);

    await run((tx) =>
      planFeature(tx, ctx, {
        itemId: featureId,
        startSprintId: sprints[1]!.id,
        targetSprintId: null,
      }),
    );
    fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === featureId)!;
    expect([fresh.startSprintId, fresh.targetSprintId]).toEqual([sprints[1]!.id, sprints[1]!.id]);
  });

  it("refuses an epic and a foreign sprint, and carries its reverse", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Ikke på sprints",
        doneWhen: "Aldrig her",
        areaId: full.areas[0]!.id,
      }),
    );
    const sprint = full.sprints[0]!;
    await expect(
      run((tx) =>
        planFeature(tx, ctx, {
          itemId: epic.id,
          startSprintId: sprint.id,
          targetSprintId: sprint.id,
        }),
      ),
    ).rejects.toThrow("invalid");

    const other = await run((tx) =>
      createBoard(tx, ctx, { name: "Anden", key: "PAN", mode: "scrum", firstArea: "Alt" }),
    );
    const foreign = await run((tx) => createSprintSeries(tx, ctx, { boardId: other.id, count: 1 }));
    await expect(
      run((tx) =>
        planFeature(tx, ctx, {
          itemId: featureId,
          startSprintId: foreign[0]!.id,
          targetSprintId: foreign[0]!.id,
        }),
      ),
    ).rejects.toThrow("notFound");

    // The last plan change can be taken back like everything else.
    const events = await run((tx) => recentBoardEvents(tx, boardId, 20));
    const planned = events.find((e) => e.type === "item.planned" && e.itemId === featureId)!;
    const before = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === featureId)!;
    await run((tx) => undoEvent(tx, ctx, planned.id));
    const after = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === featureId)!;
    expect(after.startSprintId).not.toBe(before.startSprintId);
  });
});
