import { eq, sql } from "drizzle-orm";
import { boards, cardLabels, cards, users, type Card, type Priority } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import {
  assertFresh,
  cardInWorkspace,
  columnInBoard,
  firstColumn,
  joiningSort,
  laneFor,
  placeCard,
} from "./lanes";
import { boardInWorkspace } from "./read";
import { clocksFor, enterColumn, recordTransition } from "./transitions";
import { labelsInBoard } from "./write-card-details";

/**
 * Card mutations, one transaction each when called from an action and
 * composable inside a larger one (the demo seed and the AI apply several
 * in one). Every function resolves the card inside the active workspace
 * first; a card id from another workspace is simply not found. The
 * checklist and labels live in write-card-details, archiving and
 * deleting in write-card-lifecycle.
 */

export type NewCardInput = {
  boardId: string;
  title: string;
  columnId?: string | null;
  sprintId?: string | null;
  description?: string;
  estimate?: number | null;
  priority?: Priority;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  labelIds?: string[];
  atTop?: boolean;
};

/** A member of the workspace, or null; the members policy makes anyone else invisible. */
async function memberName(tx: AppTransaction, userId: string | null | undefined) {
  if (!userId) return null;
  const [row] = await tx
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/** The next number on the board, taken inside the transaction so it is gapless. */
async function nextCardNumber(tx: AppTransaction, boardId: string): Promise<number> {
  const [row] = await tx
    .update(boards)
    .set({ nextCardNumber: sql`${boards.nextCardNumber} + 1` })
    .where(eq(boards.id, boardId))
    .returning({ next: boards.nextCardNumber });
  if (!row) throw new Error("notFound");
  return row.next - 1;
}

export async function createCard(
  tx: AppTransaction,
  ctx: OrgContext,
  input: NewCardInput,
  actor: ActorKind = "user",
): Promise<Card> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) throw new Error("notFound");
  const column = input.columnId
    ? await columnInBoard(tx, board.id, input.columnId)
    : await firstColumn(tx, board.id);
  if (!column) throw new Error("notFound");
  const sprintId = board.mode === "scrum" ? (input.sprintId ?? null) : null;
  const assignee = await memberName(tx, input.assigneeUserId);
  const number = await nextCardNumber(tx, board.id);
  const sort = await joiningSort(
    tx,
    laneFor(board.mode, { boardId: board.id, columnId: column.id, sprintId }),
    input.atTop,
  );
  const clocks = clocksFor({ startedAt: null, doneAt: null }, column.category);
  const [card] = await tx
    .insert(cards)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      columnId: column.id,
      sprintId,
      number,
      title: input.title,
      description: input.description ?? "",
      sort,
      assigneeUserId: assignee?.id ?? null,
      estimate: input.estimate ?? null,
      priority: input.priority ?? "normal",
      dueDate: input.dueDate ?? null,
      createdBy: ctx.userId,
      ...clocks,
    })
    .returning();
  const labelRows = await labelsInBoard(tx, board.id, input.labelIds ?? []);
  if (labelRows.length > 0) {
    await tx
      .insert(cardLabels)
      .values(
        labelRows.map((label) => ({ orgId: ctx.orgId, cardId: card!.id, labelId: label.id })),
      );
  }
  await recordTransition(tx, ctx, card!, null, column);
  await recordEvent(
    tx,
    ctx,
    board.id,
    "card.created",
    { key: `${board.key}-${number}`, title: input.title, column: column.name },
    { cardId: card!.id, actor },
  );
  return card!;
}

/**
 * Moves a card to a column and a position. The lane it leaves is not
 * renumbered — gaps are fine — and the lane it joins is rewritten from
 * the top. Entering a column of another category records a transition
 * and sets or clears the clocks.
 */
export async function moveCard(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  columnId: string,
  index: number | undefined,
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  const target = await columnInBoard(tx, card.boardId, columnId);
  if (!target) return null;
  const from = await columnInBoard(tx, card.boardId, card.columnId);
  const board = await boardInWorkspace(tx, card.boardId);
  if (target.id !== card.columnId) {
    await enterColumn(tx, ctx, card, from, target);
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.moved",
      { key: `${board?.key ?? ""}-${card.number}`, title: card.title, column: target.name },
      { cardId: card.id, actor },
    );
  }
  await placeCard(
    tx,
    laneFor(board?.mode ?? "kanban", { ...card, columnId: target.id }),
    card.id,
    index,
  );
  return card;
}

export type CardUpdate = {
  title?: string;
  description?: string;
  estimate?: number | null;
  priority?: Priority;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  blocked?: boolean;
  blockedReason?: string;
  expectedUpdatedAt?: string;
};

/**
 * Every plain field of a card in one place. The events name the changes
 * a team cares to see in a feed — who got it, how big it is, that it is
 * stuck — and fold the rest into one "updated" line.
 */
export async function updateCard(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  input: CardUpdate,
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  assertFresh(card, input.expectedUpdatedAt);
  const board = await boardInWorkspace(tx, card.boardId);
  const key = `${board?.key ?? ""}-${card.number}`;
  const patch: Partial<typeof cards.$inferInsert> = {};
  const changed: string[] = [];

  if (input.title !== undefined && input.title !== card.title) {
    patch.title = input.title;
    changed.push("title");
  }
  if (input.description !== undefined && input.description !== card.description) {
    patch.description = input.description;
    changed.push("description");
  }
  if (input.priority !== undefined && input.priority !== card.priority) {
    patch.priority = input.priority;
    changed.push("priority");
  }
  if (input.dueDate !== undefined && input.dueDate !== card.dueDate) {
    patch.dueDate = input.dueDate;
    changed.push("dueDate");
  }
  if (input.estimate !== undefined && input.estimate !== card.estimate) {
    patch.estimate = input.estimate;
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.estimated",
      { key, title: card.title, points: input.estimate ?? 0 },
      { cardId: card.id, actor },
    );
  }
  if (input.assigneeUserId !== undefined && input.assigneeUserId !== card.assigneeUserId) {
    const member = await memberName(tx, input.assigneeUserId);
    if (input.assigneeUserId && !member) return null;
    patch.assigneeUserId = member?.id ?? null;
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      member ? "card.assigned" : "card.unassigned",
      { key, title: card.title, name: member?.name ?? "" },
      { cardId: card.id, actor },
    );
  }
  if (input.blocked !== undefined && input.blocked !== card.blocked) {
    patch.blocked = input.blocked;
    patch.blockedReason = input.blocked ? (input.blockedReason ?? "") : "";
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      input.blocked ? "card.blocked" : "card.unblocked",
      { key, title: card.title, reason: patch.blockedReason },
      { cardId: card.id, actor },
    );
  } else if (input.blockedReason !== undefined && card.blocked) {
    patch.blockedReason = input.blockedReason;
  }

  if (Object.keys(patch).length === 0) return card;
  await tx.update(cards).set(patch).where(eq(cards.id, card.id));
  if (changed.length > 0) {
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.updated",
      { key, title: patch.title ?? card.title, fields: changed },
      { cardId: card.id, actor },
    );
  }
  return card;
}
