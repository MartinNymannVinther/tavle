import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import {
  createPerson,
  linkPerson,
  peopleOf,
  personInWorkspace,
  removePerson,
  renamePerson,
  unlinkPerson,
} from "@/modules/boards/people";
import { Conflict } from "@/modules/boards/lanes";
import { adminPool } from "../helpers/db";
import { seedMember, seedWorkspace } from "../helpers/workspace";

/**
 * The roster (docs/adr/0029): a person exists before any login does,
 * the membership trigger adopts by e-mail when the login arrives, a
 * linked person cannot be removed, and another workspace's roster is
 * simply not there.
 */

let admin: Pool;
let ctx: OrgContext;
let other: OrgContext;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1], as = ctx) => withOrgContext(as, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "roster_a");
  other = await seedWorkspace(admin, "roster_b");
});

afterAll(async () => {
  await admin.end();
});

describe("the roster", () => {
  it("adopts the seeding member through the membership trigger", async () => {
    const roster = await run((tx) => peopleOf(tx, ctx.orgId));
    expect(roster.map((p) => p.userId)).toContain(ctx.userId);
  });

  it("holds a person no login stands behind", async () => {
    const person = await run((tx) => createPerson(tx, ctx, { name: "Kollega Uden Login" }));
    expect(person.userId).toBeNull();
    const again = await run((tx) => personInWorkspace(tx, person.id));
    expect(again?.name).toBe("Kollega Uden Login");
  });

  it("hands the login to the person with the invited address when it arrives", async () => {
    await run((tx) =>
      createPerson(tx, ctx, { name: "Inviteret Kollega", email: "Roster_A3@Example.com" }),
    );
    // The invitation is accepted: Better Auth writes the membership row.
    await seedMember(admin, ctx.orgId, "roster_a3");
    const roster = await run((tx) => peopleOf(tx, ctx.orgId));
    const adopted = roster.find((p) => p.name === "Inviteret Kollega");
    expect(adopted?.userId).toBe("user_roster_a3");
    // Adopted, not duplicated: no second person for that login.
    expect(roster.filter((p) => p.userId === "user_roster_a3")).toHaveLength(1);
  });

  it("links and unlinks a login by hand, and refuses a second person for it", async () => {
    await seedMember(admin, ctx.orgId, "roster_a4");
    const roster = await run((tx) => peopleOf(tx, ctx.orgId));
    const a4 = roster.find((p) => p.userId === "user_roster_a4")!;
    await run((tx) => unlinkPerson(tx, ctx, a4.id));
    const loose = await run((tx) => createPerson(tx, ctx, { name: "Den Anden" }));
    await run((tx) => linkPerson(tx, ctx, loose.id, "user_roster_a4"));
    await expect(run((tx) => linkPerson(tx, ctx, a4.id, "user_roster_a4"))).rejects.toBeInstanceOf(
      Conflict,
    );
  });

  it("refuses to remove a linked person, and removes an unlinked one", async () => {
    const roster = await run((tx) => peopleOf(tx, ctx.orgId));
    const linked = roster.find((p) => p.userId === ctx.userId)!;
    await expect(run((tx) => removePerson(tx, ctx, linked.id))).rejects.toBeInstanceOf(Conflict);
    const loose = await run((tx) => createPerson(tx, ctx, { name: "Midlertidig" }));
    await run((tx) => removePerson(tx, ctx, loose.id));
    expect(await run((tx) => personInWorkspace(tx, loose.id))).toBeNull();
  });

  it("keeps another workspace's roster out of sight and out of reach", async () => {
    const foreign = await run((tx) => createPerson(tx, other, { name: "Fremmed" }), other);
    expect(await run((tx) => personInWorkspace(tx, foreign.id))).toBeNull();
    expect(await run((tx) => renamePerson(tx, ctx, foreign.id, "Overtaget"))).toBeNull();
  });
});
