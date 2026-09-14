import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { cardEvents, recentBoardEvents } from "@/modules/boards/events";
import { getBoardFull } from "@/modules/boards/read";
import { NotUndoable, undoEvent } from "@/modules/boards/undo";
import { closeItem } from "@/modules/boards/structure/close";
import { createItem } from "@/modules/boards/structure/write-items";
import { createBoard } from "@/modules/boards/write-boards";
import { archiveCard } from "@/modules/boards/write-card-lifecycle";
import { createCard, moveCard, updateCard } from "@/modules/boards/write-cards";
import { setCardsSprint, createSprint } from "@/modules/boards/write-sprints";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * Undo (docs/adr/0022): the events carry their own reverse, the reverse
 * runs through the ordinary services, an undone event cannot be undone
 * twice, and the undo itself stands in the feed as a new event.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let todo: string;
let doing: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

async function lastEventFor(cardId: string, type: string) {
  const rows = await run((tx) => cardEvents(tx, cardId));
  return rows.find((event) => event.type === type);
}

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "undo_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Fortryd", key: "UND", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  todo = full.columns.find((c) => c.category === "todo")!.id;
  doing = full.columns.find((c) => c.category === "doing")!.id;
  areaId = full.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("events carry their reverse", () => {
  it("a move is undone back to its column, and only once", async () => {
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Flyt mig", columnId: todo, areaId }),
    );
    await run((tx) => moveCard(tx, ctx, card.id, doing, 0));
    const moved = (await lastEventFor(card.id, "card.moved"))!;
    expect((moved.payload as { undo?: { kind?: string } }).undo?.kind).toBe("card.move");
    await run((tx) => undoEvent(tx, ctx, moved.id));
    const fresh = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!;
    expect(fresh.columnId).toBe(todo);
    // The feed says so, and a second undo is refused.
    expect(await lastEventFor(card.id, "undo.applied")).toBeTruthy();
    await expect(run((tx) => undoEvent(tx, ctx, moved.id))).rejects.toThrow(NotUndoable);
  });

  it("a field edit is undone to the old values", async () => {
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Ret mig", columnId: todo, areaId }),
    );
    await run((tx) => updateCard(tx, ctx, card.id, { title: "Rettet", priority: "high" }));
    const updated = (await lastEventFor(card.id, "card.updated"))!;
    await run((tx) => undoEvent(tx, ctx, updated.id));
    const fresh = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!;
    expect([fresh.title, fresh.priority]).toEqual(["Ret mig", "normal"]);
  });

  it("a creation is undone by deletion, an archive by restore", async () => {
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Fortrudt fødsel", columnId: todo, areaId }),
    );
    const created = (await lastEventFor(card.id, "card.created"))!;
    await run((tx) => undoEvent(tx, ctx, created.id));
    expect((await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)).toBeUndefined();

    const kept = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Arkiveret", columnId: todo, areaId }),
    );
    await run((tx) => archiveCard(tx, ctx, kept.id));
    const archived = (await lastEventFor(kept.id, "card.archived"))!;
    await run((tx) => undoEvent(tx, ctx, archived.id));
    const fresh = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === kept.id);
    expect(fresh?.archivedAt).toBeNull();
  });

  it("a sprint commit is undone back to the backlog", async () => {
    const sprint = await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 1",
        goal: "",
        startDate: "2026-09-14",
        endDate: "2026-09-28",
      }),
    );
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Til sprint", columnId: todo, areaId }),
    );
    await run((tx) => setCardsSprint(tx, ctx, [card.id], sprint!.id));
    const committed = (await lastEventFor(card.id, "card.sprint"))!;
    await run((tx) => undoEvent(tx, ctx, committed.id));
    const fresh = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!;
    expect(fresh.sprintId).toBeNull();
  });

  it("a close is undone by reopening, through the same rules", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Lukket for tidligt",
        doneWhen: "Alt virker",
        areaId,
      }),
    );
    await run((tx) => closeItem(tx, ctx, epic.id, undefined));
    const events = await run((tx) => recentBoardEvents(tx, boardId, 10));
    const closed = events.find(
      (event) => event.type === "item.closed" && event.itemId === epic.id,
    )!;
    await run((tx) => undoEvent(tx, ctx, closed.id));
    const fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === epic.id)!;
    expect(fresh.state).toBe("open");
  });

  it("an event without a reverse is refused", async () => {
    const events = await run((tx) => recentBoardEvents(tx, boardId, 50));
    const bare = events.find((event) => event.type === "board.created")!;
    await expect(run((tx) => undoEvent(tx, ctx, bare.id))).rejects.toThrow(NotUndoable);
  });
});
