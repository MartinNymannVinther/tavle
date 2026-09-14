import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { boards, cards, columns, sprints, type Retro, type Sprint } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { cardsInBoard, firstColumn, joiningSort, laneFor, placeCard, sumPoints } from "./lanes";
import { boardInWorkspace } from "./read";
import { enterColumn } from "./transitions";
import { orderedDates } from "./validation";

/**
 * Sprints: planned, then active, then closed, and only one active at a
 * time on a board. The board shows the active sprint; everything not in
 * a sprint is the backlog. Starting a sprint writes down what it holds,
 * closing it writes down what got done, and neither number is ever
 * recomputed afterwards — velocity is a record, not a query.
 */

async function sprintInWorkspace(tx: AppTransaction, sprintId: string): Promise<Sprint | null> {
  const [row] = await tx.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
  return row ?? null;
}

async function activeSprintOf(tx: AppTransaction, boardId: string): Promise<Sprint | null> {
  const [row] = await tx
    .select()
    .from(sprints)
    .where(and(eq(sprints.boardId, boardId), eq(sprints.state, "active")))
    .limit(1);
  return row ?? null;
}

/**
 * The sprint's cards with their column's category, for points done and
 * carry-over. Ordered the way the board reads: column by column, top to
 * bottom, so a carry-over keeps the order the team had them in.
 */
async function sprintCards(tx: AppTransaction, sprintId: string) {
  return tx
    .select({ card: cards, category: columns.category, columnSort: columns.sort })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(and(eq(cards.sprintId, sprintId), isNull(cards.archivedAt)))
    .orderBy(asc(columns.sort), asc(cards.sort), asc(cards.number));
}

export async function createSprint(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; name: string; goal: string; startDate: string; endDate: string },
): Promise<Sprint | null> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board || board.mode !== "scrum") return null;
  const [numbered] = await tx
    .update(boards)
    .set({ nextSprintNumber: sql`${boards.nextSprintNumber} + 1` })
    .where(eq(boards.id, board.id))
    .returning({ next: boards.nextSprintNumber });
  const [startDate, endDate] = orderedDates(input.startDate, input.endDate);
  const [sprint] = await tx
    .insert(sprints)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      number: numbered!.next - 1,
      name: input.name,
      goal: input.goal,
      startDate,
      endDate,
    })
    .returning();
  await recordEvent(tx, ctx, board.id, "sprint.created", { name: input.name });
  return sprint!;
}

export async function updateSprint(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { sprintId: string; name: string; goal: string; startDate: string; endDate: string },
): Promise<Sprint | null> {
  const sprint = await sprintInWorkspace(tx, input.sprintId);
  if (!sprint || sprint.state === "closed") return null;
  const [startDate, endDate] = orderedDates(input.startDate, input.endDate);
  await tx
    .update(sprints)
    .set({ name: input.name, goal: input.goal, startDate, endDate })
    .where(eq(sprints.id, sprint.id));
  await recordEvent(tx, ctx, sprint.boardId, "sprint.updated", { name: input.name });
  return sprint;
}

export class SprintStateError extends Error {
  constructor(readonly why: "notPlanned" | "anotherActive" | "notActive" | "empty") {
    super(why);
    this.name = "SprintStateError";
  }
}

/** The sprint begins: its points are counted and frozen as the burndown's top. */
export async function startSprint(
  tx: AppTransaction,
  ctx: OrgContext,
  sprintId: string,
): Promise<Sprint | null> {
  const sprint = await sprintInWorkspace(tx, sprintId);
  if (!sprint) return null;
  if (sprint.state !== "planned") throw new SprintStateError("notPlanned");
  if (await activeSprintOf(tx, sprint.boardId)) throw new SprintStateError("anotherActive");
  const rows = await sprintCards(tx, sprint.id);
  const committedPoints = sumPoints(rows.map((r) => r.card));
  await tx
    .update(sprints)
    .set({ state: "active", committedPoints, startedAt: new Date() })
    .where(eq(sprints.id, sprint.id));
  await recordEvent(tx, ctx, sprint.boardId, "sprint.started", {
    name: sprint.name,
    cards: rows.length,
    points: committedPoints,
  });
  return sprint;
}

/**
 * The sprint ends. What was done stays with the sprint and counts as its
 * velocity; what was not goes to the backlog or to a planned sprint, at
 * the top, because it was promised once already. The carry-over is
 * written into the event so the team can see it later.
 */
export async function closeSprint(
  tx: AppTransaction,
  ctx: OrgContext,
  sprintId: string,
  moveUnfinishedTo: string | null,
): Promise<Sprint | null> {
  const sprint = await sprintInWorkspace(tx, sprintId);
  if (!sprint) return null;
  if (sprint.state !== "active") throw new SprintStateError("notActive");
  let target: Sprint | null = null;
  if (moveUnfinishedTo) {
    target = await sprintInWorkspace(tx, moveUnfinishedTo);
    if (!target || target.boardId !== sprint.boardId || target.state !== "planned") return null;
  }
  const rows = await sprintCards(tx, sprint.id);
  const done = rows.filter((r) => r.category === "done");
  const unfinished = rows.filter((r) => r.category !== "done");
  const completedPoints = sumPoints(done.map((r) => r.card));
  const first = await firstColumn(tx, sprint.boardId);
  const board = await boardInWorkspace(tx, sprint.boardId);

  // The cards furthest along go first: what was in progress is closest
  // to done and should be picked up first. Placed at the top of the target
  // lane one by one, from the last to the first, so the order holds.
  const carried = [...unfinished].sort(
    (a, b) => b.columnSort - a.columnSort || a.card.sort - b.card.sort,
  );
  for (const row of carried.reverse()) {
    const lane = laneFor(board?.mode ?? "scrum", {
      boardId: row.card.boardId,
      columnId: first?.id ?? row.card.columnId,
      sprintId: target?.id ?? null,
    });
    const sort = await joiningSort(tx, lane, true);
    if (first && first.id !== row.card.columnId) {
      const from = { id: row.card.columnId, category: row.category };
      await enterColumn(tx, ctx, row.card, from, first, { sprintId: target?.id ?? null, sort });
    } else {
      await tx
        .update(cards)
        .set({ sprintId: target?.id ?? null, sort })
        .where(eq(cards.id, row.card.id));
    }
  }
  await tx
    .update(sprints)
    .set({ state: "closed", completedPoints, closedAt: new Date() })
    .where(eq(sprints.id, sprint.id));
  await recordEvent(tx, ctx, sprint.boardId, "sprint.closed", {
    name: sprint.name,
    completed: completedPoints,
    committed: sprint.committedPoints ?? 0,
    carried: unfinished.length,
    into: target?.name ?? "",
  });
  return sprint;
}

/**
 * Commits cards to a sprint, or sends them back to the backlog. Into the
 * active sprint a card keeps its column; anywhere else it starts over in
 * the first column, because a card in a sprint that has not begun is not
 * in progress, whatever it was before.
 */
export async function setCardsSprint(
  tx: AppTransaction,
  ctx: OrgContext,
  cardIds: string[],
  sprintId: string | null,
  actor: ActorKind = "user",
): Promise<number> {
  const target = sprintId ? await sprintInWorkspace(tx, sprintId) : null;
  if (sprintId && (!target || target.state === "closed")) return 0;
  const boardId = target?.boardId;
  const rows = boardId
    ? await cardsInBoard(tx, boardId, cardIds)
    : await tx.select().from(cards).where(inArray(cards.id, cardIds));
  if (rows.length === 0) return 0;
  const board = await boardInWorkspace(tx, rows[0]!.boardId);
  if (!board || board.mode !== "scrum") return 0;
  const first = await firstColumn(tx, board.id);
  const columnRows = await tx.select().from(columns).where(eq(columns.boardId, board.id));
  const categoryOf = new Map(columnRows.map((c) => [c.id, c]));
  let moved = 0;
  for (const card of rows) {
    if (card.boardId !== board.id || card.sprintId === (target?.id ?? null)) continue;
    const keepColumn = target?.state === "active";
    const column = keepColumn ? categoryOf.get(card.columnId) : first;
    if (!column) continue;
    const sort = await joiningSort(
      tx,
      laneFor("scrum", {
        boardId: card.boardId,
        columnId: column.id,
        sprintId: target?.id ?? null,
      }),
    );
    if (column.id !== card.columnId) {
      const from = categoryOf.get(card.columnId) ?? null;
      await enterColumn(tx, ctx, card, from, column, { sprintId: target?.id ?? null, sort });
    } else {
      await tx
        .update(cards)
        .set({ sprintId: target?.id ?? null, sort })
        .where(eq(cards.id, card.id));
    }
    await recordEvent(
      tx,
      ctx,
      board.id,
      target ? "card.sprint" : "card.backlog",
      { key: `${board.key}-${card.number}`, title: card.title, sprint: target?.name ?? "" },
      {
        cardId: card.id,
        actor,
        undo: { kind: "card.sprint", cardId: card.id, sprintId: card.sprintId },
      },
    );
    moved += 1;
  }
  return moved;
}

/** A backlog card to a new position among the backlog cards. */
export async function reorderBacklog(
  tx: AppTransaction,
  cardId: string,
  index: number,
): Promise<boolean> {
  const [card] = await tx.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  if (!card || card.sprintId) return false;
  await placeCard(tx, laneFor("scrum", { ...card, sprintId: null }), card.id, index);
  return true;
}

export async function saveRetro(
  tx: AppTransaction,
  ctx: OrgContext,
  sprintId: string,
  retro: Retro,
): Promise<Sprint | null> {
  const sprint = await sprintInWorkspace(tx, sprintId);
  if (!sprint) return null;
  await tx.update(sprints).set({ retro }).where(eq(sprints.id, sprint.id));
  await recordEvent(tx, ctx, sprint.boardId, "sprint.retro", { name: sprint.name });
  return sprint;
}

export async function saveSummary(
  tx: AppTransaction,
  ctx: OrgContext,
  sprintId: string,
  summary: string,
  actor: ActorKind = "user",
): Promise<Sprint | null> {
  const sprint = await sprintInWorkspace(tx, sprintId);
  if (!sprint) return null;
  await tx.update(sprints).set({ summary }).where(eq(sprints.id, sprint.id));
  await recordEvent(tx, ctx, sprint.boardId, "sprint.summary", { name: sprint.name }, { actor });
  return sprint;
}

export { activeSprintOf, sprintCards, sprintInWorkspace };
