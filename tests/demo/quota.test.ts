import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { resetRateLimits } from "@/core/rate-limit";
import {
  MAX_DEMOS_PER_ADDRESS_PER_DAY,
  MAX_DEMOS_PER_ADDRESS_PER_HOUR,
  MAX_LIVE_DEMOS,
  reserveDemoForAddress,
} from "@/modules/demo/quota";
import { createDemoWorkspace } from "@/modules/demo/service";
import { adminPool } from "../helpers/db";

/**
 * The two bounds on the demo door — the only place in Tavle where
 * somebody with no account makes the application write. One names the
 * caller, one is the installation's, and a visitor who meets either is
 * told so rather than shown a failure.
 */

const FILLER = "demo-cap-test";

let admin: Pool;

function from(address: string): Headers {
  return new Headers({ "x-forwarded-for": address });
}

beforeAll(async () => {
  admin = adminPool();
});

afterAll(async () => {
  await admin.query(`delete from organizations where id like $1`, [`${FILLER}%`]);
  await admin.end();
});

beforeEach(() => resetRateLimits());

describe("the bound on one address", () => {
  it("allows a handful in an hour and refuses the one after", () => {
    for (let i = 0; i < MAX_DEMOS_PER_ADDRESS_PER_HOUR; i++)
      expect(reserveDemoForAddress(from("203.0.113.7")).allowed).toBe(true);
    const refused = reserveDemoForAddress(from("203.0.113.7"));
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each address on its own", () => {
    for (let i = 0; i < MAX_DEMOS_PER_ADDRESS_PER_HOUR; i++)
      reserveDemoForAddress(from("198.51.100.1"));
    expect(reserveDemoForAddress(from("198.51.100.2")).allowed).toBe(true);
  });

  /**
   * The hour alone would be seventy-two a day from one address, which is
   * enough to fill the installation on its own. The day is the window a
   * script runs into, and it is why the hour can afford to be generous
   * enough for an office that all leaves by one address.
   */
  it("stops well short of a day of hours", () => {
    expect(MAX_DEMOS_PER_ADDRESS_PER_DAY).toBeLessThan(MAX_DEMOS_PER_ADDRESS_PER_HOUR * 24);
  });
});

describe("the ceiling on the installation", () => {
  /**
   * A demo holds its place for the whole day it lives, so this ceiling is
   * also, within a day, the ceiling on how many demos the installation
   * will ever build. The rows are placed straight in the table rather
   * than seeded: what is being tested is the count and the refusal, and
   * two hundred seeded workspaces would be a minute of nothing.
   */
  it("refuses a new demo once the live ones fill it, and says which refusal it is", async () => {
    await admin.query(
      `insert into organizations (id, name, slug)
       select $1 || n, 'Demo ' || n, $1 || n from generate_series(1, $2) as n`,
      [FILLER, MAX_LIVE_DEMOS],
    );
    await admin.query(
      `insert into demo_workspaces (organization_id, user_id, expires_at)
       select $1 || n, 'user-' || n, now() + interval '12 hours'
       from generate_series(1, $2) as n`,
      [FILLER, MAX_LIVE_DEMOS],
    );

    const demo = await createDemoWorkspace("da");
    expect(demo).toEqual({ ok: false, reason: "full" });

    // Nothing was half-built on the way to the refusal: the count is
    // asked before the account is.
    const live = await admin.query(`select count(*)::int as n from demo_workspaces`);
    expect(live.rows[0].n).toBe(MAX_LIVE_DEMOS);

    await admin.query(`delete from organizations where id like $1`, [`${FILLER}%`]);
    const after = await createDemoWorkspace("da");
    expect(after.ok).toBe(true);
    if (after.ok) {
      const row = await admin.query(
        `select organization_id from demo_workspaces order by created_at desc limit 1`,
      );
      await admin.query(
        `update demo_workspaces set expires_at = now() - interval '1 minute'
         where organization_id = $1`,
        [row.rows[0].organization_id],
      );
      await admin.query(`select delete_demo_workspace($1)`, [row.rows[0].organization_id]);
    }
  });
});
