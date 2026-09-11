import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  cleanupExpiredDemos,
  createDemoWorkspace,
  demoLandingUrl,
  isDemoWorkspace,
} from "@/modules/demo/service";
import { getBoardFull, listBoards } from "@/modules/boards/read";
import { boardInsight } from "@/modules/boards/metrics/read";
import { adminPool } from "../helpers/db";

/**
 * The demo, built through the ordinary sign-up path and the ordinary
 * services: a real workspace with two boards in the middle of their
 * work, a throwaway account, and a date it stops existing. The suite
 * runs with DEMO=on (see the test environment); the shipped default is
 * off and proven in tests/core/env.
 */

let admin: Pool;
let orgId: string;
let userId: string;
let boardId: string;

beforeAll(async () => {
  admin = adminPool();
});

afterAll(async () => {
  await admin.end();
});

describe("a demo workspace", () => {
  it("is created with two boards and a signed-in guest", async () => {
    const demo = await createDemoWorkspace("da");
    expect(demo).not.toBeNull();
    boardId = demo!.boardId;
    expect(demo!.headers.get("cookie")).toMatch(/better-auth/);
    const row = await admin.query(
      `select organization_id, user_id from demo_workspaces order by created_at desc limit 1`,
    );
    orgId = row.rows[0].organization_id;
    userId = row.rows[0].user_id;
    expect(await isDemoWorkspace(orgId)).toBe(true);
    expect(demoLandingUrl("da", boardId).pathname).toBe(`/boards/${boardId}`);
    expect(demoLandingUrl("en", boardId).pathname).toBe(`/en/boards/${boardId}`);

    const boards = await listBoards({ orgId, userId });
    expect(boards.map((b) => [b.key, b.mode])).toEqual([
      ["APP", "scrum"],
      ["WEB", "kanban"],
    ]);
    const kanban = boards.find((b) => b.key === "WEB")!;
    expect(kanban.inProgressCount).toBe(4);
    expect(kanban.doneCount).toBe(5);
    const scrum = boards.find((b) => b.key === "APP")!;
    expect(scrum.activeSprint?.name).toBe("Sprint 3");
  });

  it("has a Scrum board with history to draw", async () => {
    const boards = await listBoards({ orgId, userId });
    const scrum = boards.find((b) => b.key === "APP")!;
    const full = (await getBoardFull({ orgId, userId }, scrum.id))!;
    expect(full.sprints.map((s) => s.state)).toEqual(["planned", "active", "closed", "closed"]);
    const closed = full.sprints.filter((s) => s.state === "closed");
    expect(closed.map((s) => s.completedPoints)).toEqual([19, 15]);
    expect(full.cards.filter((c) => !c.sprintId)).toHaveLength(5 + 2);
    const insight = (await boardInsight({ orgId, userId }, scrum.id))!;
    expect(insight.velocity.bars.map((b) => b.completed)).toEqual([15, 19]);
    expect(insight.activeBurndown?.committed).toBe(26);
    expect(insight.activeBurndown?.remainingNow).toBe(21);
  });

  it("has a Kanban board whose numbers come from a past", async () => {
    const insight = (await boardInsight({ orgId, userId }, boardId))!;
    expect(insight.wip).toBe(4);
    expect(insight.throughput.reduce((t, w) => t + w.count, 0)).toBe(5);
    expect(insight.cycle.sample).toBeGreaterThan(0);
    expect(insight.flow.at(-1)?.counts.doing).toBe(4);
    expect(insight.flow[0]?.counts.done).toBe(0);
  });

  it("is deleted whole when its time is up, guest account included", async () => {
    await admin.query(
      `update demo_workspaces set expires_at = now() - interval '1 minute' where organization_id = $1`,
      [orgId],
    );
    expect(await cleanupExpiredDemos()).toBe(1);
    const org = await admin.query(`select 1 from organizations where id = $1`, [orgId]);
    const user = await admin.query(`select 1 from users where id = $1`, [userId]);
    const cards = await admin.query(`select 1 from cards where org_id = $1`, [orgId]);
    expect([org.rowCount, user.rowCount, cards.rowCount]).toEqual([0, 0, 0]);
  });
});
