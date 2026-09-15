import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull } from "@/modules/boards/read";
import { createItem } from "@/modules/boards/structure/write-items";
import { createBoard } from "@/modules/boards/write-boards";
import { buildRoadmapPptx } from "@/modules/export/roadmap-pptx";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The one-slide roadmap (docs/adr/0028): a real .pptx comes back for
 * the caller's own board, and a foreign board id is simply not found.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "pptx_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Slidebar", key: "PPT", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  const areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
  await run((tx) =>
    createItem(tx, ctx, {
      boardId,
      level: "epic",
      title: "På sliden",
      doneWhen: "Roadmappet kan vises",
      areaId,
      targetQuarter: "2027-Q1",
    }),
  );
});

afterAll(async () => {
  await admin.end();
});

describe("the roadmap slide", () => {
  it("returns a real pptx (a zip) for the board", async () => {
    const buffer = await buildRoadmapPptx(ctx, boardId);
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBeGreaterThan(2000);
    expect(buffer!.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("answers null for a board that is not the workspace's", async () => {
    const stranger = await seedWorkspace(admin, "pptx_b");
    expect(await buildRoadmapPptx(stranger, boardId)).toBeNull();
  });
});
