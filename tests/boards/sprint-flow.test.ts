import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull, getCardFull } from "@/modules/boards/read";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard, moveCard, updateCard } from "@/modules/boards/write-cards";
import {
  closeSprint,
  createSprint,
  reorderBacklog,
  saveRetro,
  setCardsSprint,
  SprintStateError,
  startSprint,
} from "@/modules/boards/write-sprints";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * A Scrum board through one sprint: a backlog in order, a sprint planned
 * and started with its points frozen, work done, the sprint closed with
 * its velocity written down and the unfinished cards carried to the top
 * of the backlog.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let colId: Record<string, string>;
const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

const backlogTitles = async () =>
  (await getBoardFull(ctx, boardId))!.cards.filter((c) => !c.sprintId).map((c) => c.title);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "sprint_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "App", key: "APP", mode: "scrum", firstArea: "App" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  colId = Object.fromEntries(full.columns.map((c) => [c.category, c.id]));
  const areaId = full.areas[0]!.id;
  for (const [title, estimate] of [
    ["Login", 3],
    ["Søgning", 5],
    ["Kurv", 8],
    ["Betaling", 13],
  ] as const) {
    await run((tx) => createCard(tx, ctx, { boardId, title, estimate, areaId }));
  }
});

afterAll(async () => {
  await admin.end();
});

describe("a Scrum board", () => {
  it("starts with three columns and keeps new cards in the backlog", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.columns.map((c) => c.category)).toEqual(["todo", "doing", "done"]);
    expect(full.cards.every((c) => c.sprintId === null)).toBe(true);
    expect(await backlogTitles()).toEqual(["Login", "Søgning", "Kurv", "Betaling"]);
  });

  it("reorders the backlog", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const betaling = full.cards.find((c) => c.title === "Betaling")!;
    const login = full.cards.find((c) => c.title === "Login")!;
    // Past the row it is moved past, named: an index only ever meant
    // something in a list the marked rows could not be in (docs/adr/0033).
    await run((tx) => reorderBacklog(tx, betaling.id, login.id, false));
    expect(await backlogTitles()).toEqual(["Betaling", "Login", "Søgning", "Kurv"]);
  });

  it("keeps a card's backlog rank across a planned sprint and back", async () => {
    // Allocation is a promise, not a new priority: committed to a sprint
    // that has not begun, the card stands where it stood, and coming back
    // it still does. Its own board, so the suite's sprint numbers and
    // backlog order stay what the other tests expect.
    const own = await run((tx) =>
      createBoard(tx, ctx, { name: "Rang", key: "RANG", mode: "scrum", firstArea: "Alt" }),
    );
    const area = (await getBoardFull(ctx, own.id))!.areas[0]!.id;
    for (const title of ["Et", "To", "Tre"]) {
      await run((tx) => createCard(tx, ctx, { boardId: own.id, title, areaId: area }));
    }
    const sprint = (await run((tx) =>
      createSprint(tx, ctx, {
        boardId: own.id,
        name: "Sprint 1",
        goal: "",
        startDate: "2026-08-31",
        endDate: "2026-09-11",
      }),
    ))!;
    const before = (await getBoardFull(ctx, own.id))!.cards.find((c) => c.title === "To")!;
    await run((tx) => setCardsSprint(tx, ctx, [before.id], sprint.id));
    const committed = (await getBoardFull(ctx, own.id))!.cards.find((c) => c.id === before.id)!;
    expect(committed.sprintId).toBe(sprint.id);
    expect(committed.sort).toBe(before.sort);
    await run((tx) => setCardsSprint(tx, ctx, [before.id], null));
    const back = (await getBoardFull(ctx, own.id))!.cards.find((c) => c.id === before.id)!;
    expect(back.sprintId).toBeNull();
    expect(back.sort).toBe(before.sort);
  });

  it("plans a sprint, commits cards to it and freezes the points on start", async () => {
    const sprint = (await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 1",
        goal: "Kunden kan købe",
        startDate: "2026-09-14",
        endDate: "2026-09-25",
      }),
    ))!;
    expect(sprint.number).toBe(1);
    expect(sprint.state).toBe("planned");
    const full = (await getBoardFull(ctx, boardId))!;
    const ids = full.cards
      .filter((c) => ["Login", "Søgning", "Kurv"].includes(c.title))
      .map((c) => c.id);
    expect(await run((tx) => setCardsSprint(tx, ctx, ids, sprint.id))).toBe(3);
    expect(await backlogTitles()).toEqual(["Betaling"]);

    await run((tx) => startSprint(tx, ctx, sprint.id));
    const after = (await getBoardFull(ctx, boardId))!;
    expect(after.activeSprint?.committedPoints).toBe(16);
    // Re-estimating afterwards does not rewrite what was committed.
    const kurv = after.cards.find((c) => c.title === "Kurv")!;
    await run((tx) => updateCard(tx, ctx, kurv.id, { estimate: 5 }));
    expect((await getBoardFull(ctx, boardId))!.activeSprint?.committedPoints).toBe(16);
  });

  it("allows one active sprint at a time", async () => {
    const second = (await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 2",
        goal: "",
        startDate: "2026-09-28",
        endDate: "2026-10-09",
      }),
    ))!;
    await expect(run((tx) => startSprint(tx, ctx, second.id))).rejects.toBeInstanceOf(
      SprintStateError,
    );
  });

  it("keeps a card's column when it joins the active sprint, resets it otherwise", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const active = full.activeSprint!;
    const betaling = full.cards.find((c) => c.title === "Betaling")!;
    await run((tx) => setCardsSprint(tx, ctx, [betaling.id], active.id));
    const login = full.cards.find((c) => c.title === "Login")!;
    await run((tx) => moveCard(tx, ctx, login.id, colId.doing!, 0));
    // Back to the backlog: the card is no longer in progress.
    await run((tx) => setCardsSprint(tx, ctx, [login.id], null));
    const card = (await getCardFull(ctx, boardId, login.number))!.card;
    expect(card.sprintId).toBeNull();
    expect(card.columnId).toBe(colId.todo);
    await run((tx) => setCardsSprint(tx, ctx, [login.id], active.id));
  });

  it("closes the sprint with its velocity and carries the rest to the top of the backlog", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const active = full.activeSprint!;
    const done = full.cards.filter((c) => ["Søgning", "Kurv"].includes(c.title));
    for (const card of done) await run((tx) => moveCard(tx, ctx, card.id, colId.done!, undefined));
    const betaling = full.cards.find((c) => c.title === "Betaling")!;
    await run((tx) => moveCard(tx, ctx, betaling.id, colId.doing!, 0));

    await run((tx) => closeSprint(tx, ctx, active.id, null));
    const after = (await getBoardFull(ctx, boardId))!;
    const closed = after.sprints.find((s) => s.id === active.id)!;
    expect(closed.state).toBe("closed");
    // Søgning 5 + Kurv 5 (re-estimated before it was done).
    expect(closed.completedPoints).toBe(10);
    expect(after.activeSprint).toBeNull();
    // The done cards stay with the sprint; the others are back, first.
    expect(
      after.cards
        .filter((c) => c.sprintId === active.id)
        .map((c) => c.title)
        .sort(),
    ).toEqual(["Kurv", "Søgning"]);
    expect(await backlogTitles()).toEqual(["Betaling", "Login"]);
    const carried = (await getCardFull(ctx, boardId, betaling.number))!.card;
    expect(carried.columnId).toBe(colId.todo);
    expect(carried.doneAt).toBeNull();
    const sprintEvent = await admin.query(
      `select payload from events where board_id = $1 and type = 'sprint.closed'`,
      [boardId],
    );
    expect(sprintEvent.rows[0]?.payload).toMatchObject({
      completed: 10,
      committed: 16,
      carried: 2,
    });
  });

  it("carries unfinished cards into a planned sprint when asked", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const next = full.sprints.find((s) => s.name === "Sprint 2")!;
    const third = (await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 3",
        goal: "",
        startDate: "2026-10-12",
        endDate: "2026-10-23",
      }),
    ))!;
    const betaling = full.cards.find((c) => c.title === "Betaling")!;
    await run((tx) => setCardsSprint(tx, ctx, [betaling.id], next.id));
    await run((tx) => startSprint(tx, ctx, next.id));
    await run((tx) => closeSprint(tx, ctx, next.id, third.id));
    const card = (await getCardFull(ctx, boardId, betaling.number))!.card;
    expect(card.sprintId).toBe(third.id);
    expect(
      (await getBoardFull(ctx, boardId))!.sprints.find((s) => s.id === next.id)?.completedPoints,
    ).toBe(0);
  });

  it("keeps the retro on the sprint", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const closed = full.sprints.find((s) => s.name === "Sprint 1")!;
    await run((tx) =>
      saveRetro(tx, ctx, closed.id, {
        wentWell: "Parprogrammering",
        improve: "Færre møder",
        actions: "Dagligt kl. 9",
      }),
    );
    const after = (await getBoardFull(ctx, boardId))!.sprints.find((s) => s.id === closed.id)!;
    expect(after.retro).toEqual({
      wentWell: "Parprogrammering",
      improve: "Færre møder",
      actions: "Dagligt kl. 9",
    });
  });

  it("refuses sprints on a Kanban board", async () => {
    const kanban = await run((tx) =>
      createBoard(tx, ctx, { name: "Drift", key: "OPS", mode: "kanban", firstArea: "Drift" }),
    );
    const sprint = await run((tx) =>
      createSprint(tx, ctx, {
        boardId: kanban.id,
        name: "Nej",
        goal: "",
        startDate: "2026-09-01",
        endDate: "2026-09-14",
      }),
    );
    expect(sprint).toBeNull();
  });
});
