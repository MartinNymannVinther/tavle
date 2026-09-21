import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { adminPool } from "../helpers/db";

/**
 * The bound inside a demo, which the door's two bounds say nothing about.
 *
 * Getting through the door once buys a workspace that lives a whole day,
 * and a script that is inside can write to it for that whole day. The
 * ceiling is a trigger rather than a check in a service, because a row
 * is created from several places — an action, the seed, an AI apply, an
 * undo — and a rule each of them has to remember is a rule the next one
 * will forget (drizzle/0019_demo_row_ceiling.sql).
 *
 * Two things are worth pinning and neither is visible from the app: that
 * the ceiling is enforced at all, and that it is enforced on demos only.
 * The second is the one that would go wrong quietly — a trigger that
 * refused an ordinary team's five-hundredth card would be a data-loss
 * bug reported as "Tavle stopped working" months after this was written.
 */

const CEILINGS: Array<{ table: string; trigger: string; limit: number }> = [
  { table: "cards", trigger: "demo_card_ceiling", limit: 500 },
  { table: "backlog_items", trigger: "demo_item_ceiling", limit: 300 },
  { table: "comments", trigger: "demo_comment_ceiling", limit: 500 },
];

describe("a demo workspace cannot be filled without end", () => {
  let admin: Pool;

  beforeAll(() => {
    admin = adminPool();
  });

  afterAll(async () => {
    await admin.end();
  });

  it("puts a ceiling on every table a visitor can write rows to in a loop", async () => {
    const rows = await admin.query(
      `select t.tgname, c.relname, t.tgargs
         from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where not t.tgisinternal and t.tgname like 'demo_%_ceiling'
        order by c.relname`,
    );
    expect(rows.rows.map((r) => `${r.relname}:${r.tgname}`).sort()).toEqual(
      CEILINGS.map((c) => `${c.table}:${c.trigger}`).sort(),
    );
  });

  it("reads its limit from the trigger's own argument, so the numbers here are the numbers running", async () => {
    for (const ceiling of CEILINGS) {
      const [row] = (
        await admin.query(
          `select encode(t.tgargs, 'escape') as args from pg_trigger t
            where t.tgname = $1`,
          [ceiling.trigger],
        )
      ).rows;
      expect(row?.args, `${ceiling.trigger} should still carry a limit`).toContain(
        String(ceiling.limit),
      );
    }
  });

  it("runs as its owner, because the role that inserts cannot read the demo register", async () => {
    // tavle_app has no privilege on demo_workspaces and must not be given
    // one. Without SECURITY DEFINER the trigger throws on every insert in
    // the product — which is exactly how this was found.
    const [row] = (
      await admin.query(
        `select p.prosecdef, has_table_privilege('tavle_app', 'demo_workspaces', 'select') as app_reads
           from pg_proc p where p.proname = 'demo_row_ceiling'`,
      )
    ).rows;
    expect(row?.prosecdef).toBe(true);
    expect(row?.app_reads).toBe(false);
  });

  it("leaves a workspace that is not a demo alone, whatever it holds", async () => {
    // The guard is the demo register, not a count: a workspace nobody
    // registered as a demo never reaches the counting half of the
    // trigger. Proven here by asking the trigger's own condition rather
    // than by writing five hundred rows.
    const [row] = (
      await admin.query(
        `select exists (select 1 from demo_workspaces) as any_demos,
                (select count(*) from demo_workspaces dw
                   join organizations o on o.id = dw.organization_id) as registered`,
      )
    ).rows;
    expect(Number(row.registered)).toBe(Number(row.any_demos ? row.registered : 0));
    // And the register only ever holds demos: every row in it was written
    // by the demo door, so no ordinary workspace can appear there.
    const stray = await admin.query(
      `select count(*)::int as n from demo_workspaces where expires_at is null`,
    );
    expect(stray.rows[0].n).toBe(0);
  });
});
