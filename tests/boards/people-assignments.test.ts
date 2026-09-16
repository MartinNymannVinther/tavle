import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { cardInWorkspace } from "@/modules/boards/lanes";
import { getBoardFull } from "@/modules/boards/read";
import { assignmentCounts, createPerson, removePerson } from "@/modules/boards/people";
import { createBoard } from "@/modules/boards/write-boards";
import { archiveCard } from "@/modules/boards/write-card-lifecycle";
import { createCard } from "@/modules/boards/write-cards";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * What a person takes with them when they are removed (docs/adr/0029).
 * The card's assignee is a foreign key with `on delete set null`, so
 * every card that points at the person loses its assignee — and the
 * question asked before the removal has to count the same set, or it is
 * a warning about something other than what happens. An archived card is
 * the case that proves it: off the board, still pointing, still restored
 * one click later.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "assign_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Ansvar", key: "ANS", mode: "kanban", firstArea: "Alt" }),
  );
  boardId = board.id;
  // A card with no parent needs an area of its own (rule 3).
  areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("what a person carries", () => {
  it("counts the archived cards too, because removal takes their assignee as well", async () => {
    const person = await run((tx) => createPerson(tx, ctx, { name: "Bodil Arkiv" }));
    const open = await run((tx) =>
      createCard(tx, ctx, { boardId, areaId, title: "På tavlen", assigneePersonId: person.id }),
    );
    const filed = await run((tx) =>
      createCard(tx, ctx, { boardId, areaId, title: "Lagt væk", assigneePersonId: person.id }),
    );
    await run((tx) => archiveCard(tx, ctx, filed.id));

    expect((await run((tx) => assignmentCounts(tx, ctx.orgId))).get(person.id)).toBe(2);

    // And the warning was true: both cards come out of it unassigned.
    await run((tx) => removePerson(tx, ctx, person.id));
    expect((await run((tx) => cardInWorkspace(tx, open.id)))?.assigneePersonId).toBeNull();
    expect((await run((tx) => cardInWorkspace(tx, filed.id)))?.assigneePersonId).toBeNull();
  });

  it("says nothing of a person no card points at", async () => {
    const person = await run((tx) => createPerson(tx, ctx, { name: "Ingen Kort" }));
    expect((await run((tx) => assignmentCounts(tx, ctx.orgId))).has(person.id)).toBe(false);
  });
});
