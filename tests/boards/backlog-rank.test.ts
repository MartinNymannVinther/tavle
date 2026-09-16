import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { mergeByRank } from "@/modules/boards/ordering";
import { getBoardFull } from "@/modules/boards/read";
import type { CardView } from "@/modules/boards/types";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard, moveCard } from "@/modules/boards/write-cards";
import {
  createSprint,
  reorderBacklog,
  setCardsSprint,
  startSprint,
} from "@/modules/boards/write-sprints";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * One rank, one number (docs/adr/0033). A card promised to a sprint —
 * the running one as much as a planned one — keeps the rank it had, and
 * a move in the backlog moves that one card and nothing else. The
 * backlog list reads the two together, so both must hold for the list to
 * stand still around the row a person actually moved.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let sprintId: string;
const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

const titles = ["En", "To", "Tre", "Fire", "Fem", "Seks"];

/** The backlog list as a person reads it: free rows and promised ones on one rank. */
async function listed(): Promise<string[]> {
  const full = (await getBoardFull(ctx, boardId))!;
  const byRank = (a: CardView, b: CardView) => a.sort - b.sort || a.number - b.number;
  const free = full.cards.filter((c) => !c.sprintId).sort(byRank);
  const promised = full.cards.filter((c) => c.sprintId && !c.doneAt).sort(byRank);
  return mergeByRank(free, promised).map(
    ({ card, committed }) => `${card.title}${committed ? "*" : ""}`,
  );
}

const sortOf = async (title: string) =>
  (await getBoardFull(ctx, boardId))!.cards.find((c) => c.title === title)!.sort;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "rank_one");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Rang", key: "RNK", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  const areaId = full.areas[0]!.id;
  for (const title of titles) {
    await run((tx) => createCard(tx, ctx, { boardId, title, areaId }));
  }
  const sprint = (await run((tx) =>
    createSprint(tx, ctx, {
      boardId,
      name: "Sprint 1",
      goal: "",
      startDate: "2026-09-14",
      endDate: "2026-09-25",
    }),
  ))!;
  sprintId = sprint.id;
  // The sprint runs: it is the running sprint that used to throw a card
  // to the bottom of the backlog when it was committed.
  await run((tx) => startSprint(tx, ctx, sprint.id));
});

afterAll(async () => {
  await admin.end();
});

describe("the backlog's one priority", () => {
  it("starts as the backlog's own order", async () => {
    expect(await listed()).toEqual(titles);
  });

  it("keeps a card's rank when it is committed to the running sprint", async () => {
    const was = await sortOf("En");
    const card = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.title === "En")!;
    expect(await run((tx) => setCardsSprint(tx, ctx, [card.id], sprintId))).toBe(1);
    expect(await sortOf("En")).toBe(was);
    expect(await listed()).toEqual(["En*", "To", "Tre", "Fire", "Fem", "Seks"]);
  });

  it("gives the card its rank back when it returns to the backlog", async () => {
    const card = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.title === "Fem")!;
    await run((tx) => setCardsSprint(tx, ctx, [card.id], sprintId));
    expect(await listed()).toEqual(["En*", "To", "Tre", "Fire", "Fem*", "Seks"]);
    await run((tx) => setCardsSprint(tx, ctx, [card.id], null));
    expect(await sortOf("Fem")).toBe(card.sort);
    expect(await listed()).toEqual(["En*", "To", "Tre", "Fire", "Fem", "Seks"]);
    await run((tx) => setCardsSprint(tx, ctx, [card.id], sprintId));
  });

  it("keeps the rank when a move says only which column, not where", async () => {
    // Picking a column from the menu — or dropping under a filter, which
    // cannot say an index — is a move on the board, not a re-ranking of
    // the backlog: the marked row must not travel with it.
    const full = (await getBoardFull(ctx, boardId))!;
    const card = full.cards.find((c) => c.title === "En")!;
    const doing = full.columns.find((c) => c.category === "doing")!;
    const listing = await listed();
    await run((tx) => moveCard(tx, ctx, card.id, doing.id, undefined));
    expect(await sortOf("En")).toBe(card.sort);
    expect(await listed()).toEqual(listing);
    // A move that does say where is still a re-ranking, as it should be.
    const sameColumn = full.columns.find((c) => c.category === "todo")!;
    await run((tx) => moveCard(tx, ctx, card.id, sameColumn.id, 0));
  });

  it("moves one row of what is read, even when that row is a promised one", async () => {
    // The list reads En* · To · Tre · Fire · Fem* · Seks. One "move up" on
    // the last row must pass exactly one row — and the row above it is
    // Fem*, promised to the sprint. Ranking against the free rows alone
    // would vault the card past both Fem* and Fire in one press.
    const before = (await getBoardFull(ctx, boardId))!.cards;
    expect(await listed()).toEqual(["En*", "To", "Tre", "Fire", "Fem*", "Seks"]);
    const seks = before.find((c) => c.title === "Seks")!;
    const fem = before.find((c) => c.title === "Fem")!;
    await run((tx) => reorderBacklog(tx, seks.id, fem.id, false));
    expect(await listed()).toEqual(["En*", "To", "Tre", "Fire", "Seks", "Fem*"]);
    const after = (await getBoardFull(ctx, boardId))!.cards;
    const stirred = after.filter(
      (card) => card.id !== seks.id && card.sort !== before.find((c) => c.id === card.id)!.sort,
    );
    expect(stirred.map((c) => c.title)).toEqual([]);
  });

  it("refuses to rank a card that is promised to a sprint", async () => {
    // The marked row is not a person's to move: it stands at its rank and
    // the way to change that is to take the promise back.
    const cards = (await getBoardFull(ctx, boardId))!.cards;
    const fem = cards.find((c) => c.title === "Fem")!;
    const to = cards.find((c) => c.title === "To")!;
    expect(await run((tx) => reorderBacklog(tx, fem.id, to.id, false))).toBe(false);
    expect(await sortOf("Fem")).toBe(fem.sort);
  });
});
