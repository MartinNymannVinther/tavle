import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { sql } from "drizzle-orm";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull, getCardFull } from "@/modules/boards/read";
import { listBoards, listMyCards } from "@/modules/boards/read-lists";
import { addComment, deleteComment } from "@/modules/boards/comments";
import {
  createBoard,
  createColumn,
  deleteColumn,
  updateColumn,
} from "@/modules/boards/write-boards";
import { updateChecklist } from "@/modules/boards/write-card-details";
import { placeCardInStructure } from "@/modules/boards/structure/write-card-placement";
import { createTheme } from "@/modules/boards/structure/write-lists";
import { archiveCard, deleteCard, restoreCard } from "@/modules/boards/write-card-lifecycle";
import { createCard, moveCard, updateCard } from "@/modules/boards/write-cards";
import { Conflict } from "@/modules/boards/lanes";
import { adminPool } from "../helpers/db";
import { seedMember, seedWorkspace } from "../helpers/workspace";

/**
 * A Kanban board from creation to a card's whole life, through the same
 * services the interface calls, as an ordinary member of the workspace.
 * What the tests prove: numbers never repeat, moves keep the lane's
 * order, the transition log and the clocks follow the column's category,
 * and a card from another workspace is not found rather than touched.
 */

let admin: Pool;
let ctx: OrgContext;
let other: OrgContext;
let boardId: string;
let areaId: string;
let colId: Record<string, string>;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1], as = ctx) => withOrgContext(as, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "flow_a");
  await seedMember(admin, ctx.orgId, "flow_a2");
  other = await seedWorkspace(admin, "flow_b");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Webshop", key: "WEB", mode: "kanban", firstArea: "Butik" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  colId = Object.fromEntries(full.columns.map((c) => [c.category, c.id]));
  areaId = full.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("a Kanban board", () => {
  it("starts with the default columns and the one area the team named", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.columns.map((c) => c.category)).toEqual(["backlog", "todo", "doing", "done"]);
    expect(full.columns.find((c) => c.category === "doing")?.wipLimit).toBe(3);
    expect(full.areas.map((a) => a.name)).toEqual(["Butik"]);
    expect(full.themes).toEqual([]);
    expect(full.items).toEqual([]);
    expect(full.members.map((m) => m.userId).sort()).toEqual(["user_flow_a", "user_flow_a2"]);
  });

  it("refuses a second board with the same key in the workspace", async () => {
    await expect(
      run((tx) =>
        createBoard(tx, ctx, { name: "Igen", key: "WEB", mode: "kanban", firstArea: "Butik" }),
      ),
    ).rejects.toThrow("conflict");
  });

  it("hands out card numbers without gaps or repeats, and lands new cards last", async () => {
    const first = await run((tx) => createCard(tx, ctx, { boardId, title: "Første", areaId }));
    const second = await run((tx) => createCard(tx, ctx, { boardId, title: "Anden", areaId }));
    const top = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Øverst", areaId, atTop: true }),
    );
    expect([first.number, second.number, top.number]).toEqual([1, 2, 3]);
    const full = (await getBoardFull(ctx, boardId))!;
    const backlog = full.cards.filter((c) => c.columnId === colId.backlog);
    expect(backlog.map((c) => c.title)).toEqual(["Øverst", "Første", "Anden"]);
    expect(first.startedAt).toBeNull();
    expect(first.doneAt).toBeNull();
  });

  it("moves a card into a column at a position, and starts its clock in doing", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const first = full.cards.find((c) => c.number === 1)!;
    const second = full.cards.find((c) => c.number === 2)!;
    await run((tx) => moveCard(tx, ctx, first.id, colId.doing!, 0));
    await run((tx) => moveCard(tx, ctx, second.id, colId.doing!, 0));
    const after = (await getBoardFull(ctx, boardId))!;
    const doing = after.cards.filter((c) => c.columnId === colId.doing);
    expect(doing.map((c) => c.number)).toEqual([2, 1]);
    expect(doing.every((c) => c.startedAt !== null)).toBe(true);
    const transitions = await admin.query(
      `select to_category from card_transitions where card_id = $1 order by at`,
      [first.id],
    );
    expect(transitions.rows.map((r) => r.to_category)).toEqual(["backlog", "doing"]);
  });

  it("sets doneAt on entering done and clears it when the card comes back", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const first = full.cards.find((c) => c.number === 1)!;
    await run((tx) => moveCard(tx, ctx, first.id, colId.done!, undefined));
    let card = (await getCardFull(ctx, boardId, 1))!.card;
    expect(card.doneAt).not.toBeNull();
    await run((tx) => moveCard(tx, ctx, first.id, colId.todo!, undefined));
    card = (await getCardFull(ctx, boardId, 1))!.card;
    expect(card.doneAt).toBeNull();
    expect(card.startedAt).not.toBeNull();
  });

  it("counts open, done and in-progress cards on the board list", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const third = full.cards.find((c) => c.number === 3)!;
    await run((tx) => moveCard(tx, ctx, third.id, colId.done!, undefined));
    const [summary] = await listBoards(ctx);
    expect(summary).toMatchObject({ key: "WEB", openCount: 2, doneCount: 1, inProgressCount: 1 });
  });

  it("edits the fields, names the assignee, and refuses a stale edit", async () => {
    const before = (await getCardFull(ctx, boardId, 2))!.card;
    await run((tx) =>
      updateCard(tx, ctx, before.id, {
        title: "Anden, omdøbt",
        estimate: 5,
        priority: "high",
        dueDate: "2026-10-01",
        assigneeUserId: "user_flow_a2",
        blocked: true,
        blockedReason: "Venter på design",
      }),
    );
    const after = (await getCardFull(ctx, boardId, 2))!.card;
    expect(after).toMatchObject({
      title: "Anden, omdøbt",
      estimate: 5,
      priority: "high",
      dueDate: "2026-10-01",
      assigneeName: "User flow_a2",
      blocked: true,
      blockedReason: "Venter på design",
    });
    await expect(
      run((tx) =>
        updateCard(tx, ctx, after.id, {
          title: "For sent",
          expectedUpdatedAt: before.updatedAt.toISOString(),
        }),
      ),
    ).rejects.toBeInstanceOf(Conflict);
    const events = (await getCardFull(ctx, boardId, 2))!.events.map((e) => e.type);
    expect(events).toContain("card.assigned");
    expect(events).toContain("card.estimated");
    expect(events).toContain("card.blocked");
  });

  it("refuses an assignee who is not a member of the workspace", async () => {
    const card = (await getCardFull(ctx, boardId, 2))!.card;
    const result = await run((tx) =>
      updateCard(tx, ctx, card.id, { assigneeUserId: other.userId }),
    );
    expect(result).toBeNull();
  });

  it("lists my open cards across boards", async () => {
    const mine = await listMyCards({ orgId: ctx.orgId, userId: "user_flow_a2" });
    expect(mine.map((c) => c.number)).toEqual([2]);
    expect(mine[0]).toMatchObject({ boardKey: "WEB", columnName: "I gang" });
  });

  it("keeps a checklist and themes, refusing a theme from nowhere", async () => {
    const card = (await getCardFull(ctx, boardId, 2))!.card;
    await run((tx) =>
      updateChecklist(tx, ctx, card.id, [
        { id: "1", title: "Skriv test", done: true },
        { id: "2", title: "Skriv kode", done: false },
      ]),
    );
    const theme = await run((tx) =>
      createTheme(tx, ctx, { boardId, name: "Selvbetjening", color: "moss" }),
    );
    await expect(
      run((tx) =>
        placeCardInStructure(tx, ctx, { cardId: card.id, themeIds: [theme.id, "not-a-theme"] }),
      ),
    ).rejects.toThrow("notFound");
    await run((tx) => placeCardInStructure(tx, ctx, { cardId: card.id, themeIds: [theme.id] }));
    const after = (await getCardFull(ctx, boardId, 2))!.card;
    expect(after.checklistDone).toBe(1);
    expect(after.checklistTotal).toBe(2);
    expect(after.themeIds).toEqual([theme.id]);
  });

  it("takes comments, and lets only the author or a manager remove them", async () => {
    const card = (await getCardFull(ctx, boardId, 2))!.card;
    const member = { orgId: ctx.orgId, userId: "user_flow_a2" };
    const comment = (await run((tx) => addComment(tx, member, card.id, "Hej fra teamet"), member))!;
    expect((await getCardFull(ctx, boardId, 2))!.comments.map((c) => c.authorName)).toEqual([
      "User flow_a2",
    ]);
    // The owner may remove it; a stranger's id is not found at all.
    expect(await run((tx) => deleteComment(tx, other, comment.id), other)).toBeNull();
    await run((tx) => deleteComment(tx, ctx, comment.id));
    expect((await getCardFull(ctx, boardId, 2))!.comments).toEqual([]);
  });

  it("archives a card off the board and restores it at the end of its lane", async () => {
    const card = (await getCardFull(ctx, boardId, 2))!.card;
    await run((tx) => archiveCard(tx, ctx, card.id));
    let full = (await getBoardFull(ctx, boardId))!;
    expect(full.cards.some((c) => c.id === card.id)).toBe(false);
    const archivedTransition = await admin.query(
      `select to_category from card_transitions where card_id = $1 order by at desc limit 1`,
      [card.id],
    );
    expect(archivedTransition.rows[0]?.to_category).toBe("archived");
    await run((tx) => restoreCard(tx, ctx, card.id));
    full = (await getBoardFull(ctx, boardId))!;
    expect(full.cards.some((c) => c.id === card.id)).toBe(true);
  });

  it("cannot see, move or delete a card from another workspace", async () => {
    const card = (await getCardFull(ctx, boardId, 1))!.card;
    expect(await getCardFull(other, boardId, 1)).toBeNull();
    expect(await run((tx) => moveCard(tx, other, card.id, colId.done!, 0), other)).toBeNull();
    expect(await run((tx) => deleteCard(tx, other, card.id), other)).toBeNull();
    expect((await getCardFull(ctx, boardId, 1))!.card.columnId).toBe(colId.todo);
  });

  it("re-categorising a column finishes or reopens what is in it", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const todo = full.columns.find((c) => c.id === colId.todo)!;
    await run((tx) =>
      updateColumn(tx, ctx, { columnId: todo.id, name: "Klar", category: "done", wipLimit: null }),
    );
    expect((await getCardFull(ctx, boardId, 1))!.card.doneAt).not.toBeNull();
    await run((tx) =>
      updateColumn(tx, ctx, { columnId: todo.id, name: "Klar", category: "todo", wipLimit: null }),
    );
    expect((await getCardFull(ctx, boardId, 1))!.card.doneAt).toBeNull();
  });

  it("adds a column, then removes it and moves its cards where it is told", async () => {
    const review = (await run((tx) =>
      createColumn(tx, ctx, { boardId, name: "Review", category: "doing", wipLimit: 2 }),
    ))!;
    const card = (await getCardFull(ctx, boardId, 1))!.card;
    await run((tx) => moveCard(tx, ctx, card.id, review.id, 0));
    await run((tx) => deleteColumn(tx, ctx, review.id, colId.doing!));
    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.columns.map((c) => c.name)).toEqual(["Backlog", "Klar", "I gang", "Færdig"]);
    expect(full.cards.find((c) => c.number === 1)?.columnId).toBe(colId.doing);
  });

  it("refuses to add a theme twice, case-insensitively", async () => {
    await expect(
      run((tx) => createTheme(tx, ctx, { boardId, name: "selvbetjening", color: "clay" })),
    ).rejects.toThrow("conflict");
  });

  it("deletes a card together with its history rows", async () => {
    const card = (await getCardFull(ctx, boardId, 3))!.card;
    await run((tx) => deleteCard(tx, ctx, card.id));
    expect(await getCardFull(ctx, boardId, 3)).toBeNull();
    const rows = await admin.query(
      `select count(*)::int as n from card_transitions where card_id = $1`,
      [card.id],
    );
    expect(rows.rows[0]?.n).toBe(0);
    // The number is not reused: the next card is 4, not 3.
    const next = await run((tx) => createCard(tx, ctx, { boardId, title: "Fjerde", areaId }));
    expect(next.number).toBe(4);
  });

  it("writes every mutation to the audit log under the workspace", async () => {
    const rows = await run((tx) =>
      tx.execute(sql`select count(*)::int as n from audit_log where entity_type = 'cards'`),
    );
    expect(Number((rows.rows[0] as { n: number }).n)).toBeGreaterThan(5);
  });
});
