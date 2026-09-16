import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull } from "@/modules/boards/read";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard } from "@/modules/boards/write-cards";
import {
  createRelease,
  deleteRelease,
  releasesOf,
  reorderRelease,
  setCardsRelease,
  updateRelease,
} from "@/modules/boards/write-releases";
import { NameTaken } from "@/modules/boards/structure/write-lists";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * Releases (docs/adr/0032): the bands a story map is divided into. What
 * has to hold is that a card belongs to at most one, that another
 * board's release is not a placement this board can make, and above all
 * that deleting a band frees its cards instead of taking them with it.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "rel_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Udgivelser", key: "REL", mode: "kanban", firstArea: "Alt" }),
  );
  boardId = board.id;
  areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("a board's releases", () => {
  it("are made with a name and an optional date, in the order they are made", async () => {
    const autumn = await run((tx) =>
      createRelease(tx, ctx, { boardId, name: "Efterår", targetDate: "2026-11-01" }),
    );
    const later = await run((tx) => createRelease(tx, ctx, { boardId, name: "Senere" }));
    expect(autumn!.targetDate).toBe("2026-11-01");
    // A release with no date yet is an ordinary state, not a missing field.
    expect(later!.targetDate).toBeNull();
    expect((await run((tx) => releasesOf(tx, boardId))).map((r) => r.name)).toEqual([
      "Efterår",
      "Senere",
    ]);
  });

  it("refuses a second band with the same name, whatever the casing", async () => {
    await expect(
      run((tx) => createRelease(tx, ctx, { boardId, name: "efterår" })),
    ).rejects.toBeInstanceOf(NameTaken);
  });

  it("renames and re-dates a band, and can be reordered", async () => {
    const [first, second] = await run((tx) => releasesOf(tx, boardId));
    await run((tx) =>
      updateRelease(tx, ctx, { releaseId: first!.id, name: "Efterårsudgaven", targetDate: null }),
    );
    await run((tx) => reorderRelease(tx, ctx, second!.id, 0));
    const after = await run((tx) => releasesOf(tx, boardId));
    expect(after.map((r) => r.name)).toEqual(["Senere", "Efterårsudgaven"]);
    expect(after.find((r) => r.name === "Efterårsudgaven")!.targetDate).toBeNull();
  });

  it("takes cards in and out, one release at a time", async () => {
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Noget arbejde", areaId, estimate: 5 }),
    );
    const [near, far] = await run((tx) => releasesOf(tx, boardId));
    expect(await run((tx) => setCardsRelease(tx, ctx, [card.id], near!.id))).toBe(1);
    expect((await getBoardFull(ctx, boardId))!.cards[0]!.releaseId).toBe(near!.id);
    // Moving it to another band replaces the promise rather than adding one.
    await run((tx) => setCardsRelease(tx, ctx, [card.id], far!.id));
    expect((await getBoardFull(ctx, boardId))!.cards[0]!.releaseId).toBe(far!.id);
    await run((tx) => setCardsRelease(tx, ctx, [card.id], null));
    expect((await getBoardFull(ctx, boardId))!.cards[0]!.releaseId).toBeNull();
  });

  it("will not take a release from another board", async () => {
    const other = await run((tx) =>
      createBoard(tx, ctx, { name: "Anden", key: "AND", mode: "kanban", firstArea: "Alt" }),
    );
    const foreign = await run((tx) => createRelease(tx, ctx, { boardId: other.id, name: "Deres" }));
    const card = (await getBoardFull(ctx, boardId))!.cards[0]!;
    expect(await run((tx) => setCardsRelease(tx, ctx, [card.id], foreign!.id))).toBe(0);
    expect((await getBoardFull(ctx, boardId))!.cards[0]!.releaseId).toBeNull();
  });

  it("frees the cards when a band is deleted, rather than taking them with it", async () => {
    const [near] = await run((tx) => releasesOf(tx, boardId));
    const card = (await getBoardFull(ctx, boardId))!.cards[0]!;
    await run((tx) => setCardsRelease(tx, ctx, [card.id], near!.id));

    await run((tx) => deleteRelease(tx, ctx, near!.id));

    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.releases.map((r) => r.id)).not.toContain(near!.id);
    // The work survives its band and falls back to unreleased.
    expect(full.cards.map((c) => c.id)).toContain(card.id);
    expect(full.cards.find((c) => c.id === card.id)!.releaseId).toBeNull();
  });
});
