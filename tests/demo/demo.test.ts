import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  cleanupExpiredDemos,
  createDemoWorkspace,
  demoLandingUrl,
  isDemoWorkspace,
} from "@/modules/demo/service";
import { getBoardFull } from "@/modules/boards/read";
import { listBoards } from "@/modules/boards/read-lists";
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
    expect(demo.ok).toBe(true);
    if (!demo.ok) return;
    boardId = demo.boardId;
    expect(demo.headers.get("cookie")).toMatch(/better-auth/);
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
    expect(kanban.doneCount).toBe(32);
    const scrum = boards.find((b) => b.key === "APP")!;
    expect(scrum.activeSprint?.name).toBe("Sprint 7");
  });

  it("has a Scrum board with history to draw", async () => {
    const boards = await listBoards({ orgId, userId });
    const scrum = boards.find((b) => b.key === "APP")!;
    const full = (await getBoardFull({ orgId, userId }, scrum.id))!;
    // Six sprints behind the team: about three months of fortnights.
    expect(full.sprints.map((s) => s.state)).toEqual([
      "planned",
      "active",
      ...Array<string>(6).fill("closed"),
    ]);
    const closed = full.sprints.filter((s) => s.state === "closed");
    expect(closed).toHaveLength(6);
    // Six backlog cards plus what each closed sprint left unfinished.
    expect(full.cards.filter((c) => !c.sprintId)).toHaveLength(12);
    const insight = (await boardInsight({ orgId, userId }, scrum.id))!;
    // One bar per closed sprint, oldest first, so the chart has a shape.
    expect(insight.velocity.bars.map((b) => b.completed)).toEqual([15, 19, 15, 21, 19, 23]);
    expect(insight.activeBurndown?.committed).toBe(26);
    expect(insight.activeBurndown?.remainingNow).toBe(21);
  });

  it("has the structure above the cards: areas, themes, epics with features, one closed", async () => {
    const boards = await listBoards({ orgId, userId });
    const scrum = boards.find((b) => b.key === "APP")!;
    const full = (await getBoardFull({ orgId, userId }, scrum.id))!;
    expect(full.areas.map((a) => a.name)).toHaveLength(4);
    expect(full.themes).toHaveLength(3);
    const epics = full.items.filter((i) => i.level === "epic");
    const features = full.items.filter((i) => i.level === "feature");
    expect(epics).toHaveLength(5);
    expect(features).toHaveLength(8);
    // What the six sprints finished is closed behind them.
    expect(epics.filter((e) => e.state === "closed")).toHaveLength(2);
    expect(features.filter((f) => f.state === "closed")).toHaveLength(4);
    expect(features.every((f) => f.parentId)).toBe(true);
    expect(full.cards.filter((c) => c.featureId).length).toBeGreaterThan(10);
    expect(full.cards.every((c) => c.featureId || c.areaId)).toBe(true);
    expect(full.cards.some((c) => c.bug)).toBe(true);
    expect(full.cards.some((c) => c.kind === "enabler")).toBe(true);
    // Every epic was made to look older than its cards; one Kanban epic is old enough for review.
    const kanban = (await getBoardFull({ orgId, userId }, boardId))!;
    const aged = kanban.items.filter(
      (i) => i.level === "epic" && Date.now() - i.createdAt.getTime() > 180 * 86_400_000,
    );
    expect(aged).toHaveLength(1);
  });

  it("has a Kanban board whose numbers come from a past", async () => {
    const insight = (await boardInsight({ orgId, userId }, boardId))!;
    expect(insight.wip).toBe(4);
    // Eight weeks of throughput, filled from twelve weeks of finished work.
    // A range, not a number: the cards are dated from today, so the count
    // drifts by one as the window's Monday boundaries slide past them.
    const finished = insight.throughput.reduce((t, w) => t + w.count, 0);
    expect(finished).toBeGreaterThanOrEqual(15);
    expect(finished).toBeLessThanOrEqual(24);
    // Spread across the weeks rather than a single spike; the newest week may
    // still be empty, because the last card finished a few days ago.
    expect(insight.throughput.filter((week) => week.count > 0).length).toBeGreaterThanOrEqual(6);
    expect(insight.cycle.sample).toBeGreaterThan(0);
    expect(insight.flow.at(-1)?.counts.doing).toBe(4);
    // The board had a past before the flow window opened, so it starts full.
    expect(insight.flow[0]?.counts.done).toBeGreaterThan(0);
  });

  /**
   * The screen promises the whole thing is gone within the day, account
   * included. Everything the visitor typed passes through the audit
   * triggers on its way in, so "gone" has to mean the audit rows too —
   * and the deliberate, bounded exception that makes that possible
   * (drizzle/0017) is worth a test that would notice if it stopped
   * happening.
   */
  it("is deleted whole when its time is up, guest account included", async () => {
    const before = await admin.query(`select count(*)::int as n from audit_log where org_id = $1`, [
      orgId,
    ]);
    expect(before.rows[0].n).toBeGreaterThan(0);

    await admin.query(
      `update demo_workspaces set expires_at = now() - interval '1 minute' where organization_id = $1`,
      [orgId],
    );
    expect(await cleanupExpiredDemos()).toBe(1);
    const org = await admin.query(`select 1 from organizations where id = $1`, [orgId]);
    const user = await admin.query(`select 1 from users where id = $1`, [userId]);
    const cards = await admin.query(`select 1 from cards where org_id = $1`, [orgId]);
    expect([org.rowCount, user.rowCount, cards.rowCount]).toEqual([0, 0, 0]);

    // Nothing the visitor wrote, and no row about the account itself.
    const orgTrail = await admin.query(`select 1 from audit_log where org_id = $1`, [orgId]);
    const accountTrail = await admin.query(
      `select 1 from audit_log
       where actor_user_id = $1 or (entity_type = 'users' and entity_id = $1)`,
      [userId],
    );
    expect([orgTrail.rowCount, accountTrail.rowCount]).toEqual([0, 0]);

    // One context-free row is left, so an installation can see it happen.
    const mark = await admin.query(
      `select org_id, actor_type from audit_log where action = 'demo.expired' and entity_id = $1`,
      [orgId],
    );
    expect(mark.rows).toEqual([{ org_id: null, actor_type: "system" }]);
  });

  /**
   * The guard is the demo_workspaces row, not the caller's word for it.
   * A workspace a team works in is not in that table, so there is no
   * argument to this function that reaches one.
   */
  it("refuses to purge a workspace that is not an expired demo", async () => {
    const other = await admin.query(
      `insert into organizations (id, name, slug) values ($1, 'Ikke en demo', $1) returning id`,
      [`not-a-demo-${Date.now()}`],
    );
    const id = other.rows[0].id;
    const refused = await admin.query(`select delete_demo_workspace($1) as deleted`, [id]);
    expect(refused.rows[0].deleted).toBe(false);
    const still = await admin.query(`select 1 from organizations where id = $1`, [id]);
    expect(still.rowCount).toBe(1);
    await admin.query(`delete from organizations where id = $1`, [id]);

    // And it is reachable from the one pool that runs the cleanup, and
    // from nowhere else. CREATE FUNCTION grants EXECUTE to PUBLIC by
    // default, so this is a test about a REVOKE that has to stay written.
    const grants = await admin.query(
      `select has_function_privilege($1, 'delete_demo_workspace(text)', 'execute') as auth,
              has_function_privilege($2, 'delete_demo_workspace(text)', 'execute') as app,
              has_function_privilege('public', 'delete_demo_workspace(text)', 'execute') as anyone`,
      ["tavle_auth", "tavle_app"],
    );
    expect(grants.rows[0]).toEqual({ auth: true, app: false, anyone: false });
  });
});
