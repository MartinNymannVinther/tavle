import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { boards, cards, columns, type Card, type Column } from "@/core/db/schema";
import type { AppTransaction } from "@/core/db/tenant";
import { placeInLane, sortAtEnd, sortAtTop, type Positioned } from "./ordering";

/**
 * The small lookups every card mutation is built from: the card inside
 * the workspace, the column inside the board, and the lane a card is
 * ordered in. Each answers null rather than throwing when the row is not
 * where the caller says it is, so a stolen id becomes "not found".
 */

export class Conflict extends Error {
  constructor() {
    super("conflict");
    this.name = "Conflict";
  }
}

/** Optimistic lock: the row must be the one the caller looked at. */
export function assertFresh(row: { updatedAt: Date }, expectedUpdatedAt?: string) {
  if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new Conflict();
}

/**
 * The next number on the board, taken inside the transaction so it is
 * gapless and never repeats. Cards, features and epics draw from the same
 * counter: WEB-12 means one thing on the board, whatever its level.
 */
export async function nextNumber(tx: AppTransaction, boardId: string): Promise<number> {
  const [row] = await tx
    .update(boards)
    .set({ nextCardNumber: sql`${boards.nextCardNumber} + 1` })
    .where(eq(boards.id, boardId))
    .returning({ next: boards.nextCardNumber });
  if (!row) throw new Error("notFound");
  return row.next - 1;
}

export async function cardInWorkspace(tx: AppTransaction, cardId: string): Promise<Card | null> {
  const [row] = await tx.select().from(cards).where(eq(cards.id, cardId)).limit(1);
  return row ?? null;
}

export async function cardsInBoard(
  tx: AppTransaction,
  boardId: string,
  cardIds: string[],
): Promise<Card[]> {
  if (cardIds.length === 0) return [];
  return tx
    .select()
    .from(cards)
    .where(and(eq(cards.boardId, boardId), inArray(cards.id, cardIds)));
}

export async function columnInBoard(
  tx: AppTransaction,
  boardId: string,
  columnId: string,
): Promise<Column | null> {
  const [row] = await tx
    .select()
    .from(columns)
    .where(and(eq(columns.id, columnId), eq(columns.boardId, boardId)))
    .limit(1);
  return row ?? null;
}

export async function columnsOf(tx: AppTransaction, boardId: string): Promise<Column[]> {
  return tx.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.sort));
}

/** The first column of the board, where new and returning cards land. */
export async function firstColumn(tx: AppTransaction, boardId: string): Promise<Column | null> {
  const [row] = await tx
    .select()
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(asc(columns.sort))
    .limit(1);
  return row ?? null;
}

/**
 * The cards a card is ordered against. On the board that is the column
 * within the same sprint (null on Kanban); in the backlog it is every
 * uncommitted card of the board, whatever column it nominally sits in.
 */
export type Lane = { boardId: string; columnId: string | null; sprintId: string | null };

export async function laneCards(tx: AppTransaction, lane: Lane): Promise<Positioned[]> {
  const conditions = [eq(cards.boardId, lane.boardId), isNull(cards.archivedAt)];
  if (lane.columnId) conditions.push(eq(cards.columnId, lane.columnId));
  conditions.push(lane.sprintId ? eq(cards.sprintId, lane.sprintId) : isNull(cards.sprintId));
  return tx
    .select({ id: cards.id, sort: cards.sort })
    .from(cards)
    .where(and(...conditions))
    .orderBy(asc(cards.sort), asc(cards.number));
}

/** The sort value for a card joining the lane at the end (or the top). */
export async function joiningSort(tx: AppTransaction, lane: Lane, atTop = false): Promise<number> {
  const others = await laneCards(tx, lane);
  return atTop ? sortAtTop(others) : sortAtEnd(others);
}

/** Puts `cardId` at `index` in the lane and writes only the numbers that changed. */
export async function placeCard(
  tx: AppTransaction,
  lane: Lane,
  cardId: string,
  index: number | undefined,
): Promise<void> {
  const others = await laneCards(tx, lane);
  const changes = placeInLane(others, cardId, index);
  for (const change of changes) {
    await tx.update(cards).set({ sort: change.sort }).where(eq(cards.id, change.id));
  }
}

/**
 * The lane a card is ordered in. On a Kanban board, and for a card
 * committed to a sprint, that is its column; a Scrum card without a
 * sprint is in the backlog, where the column it nominally sits in does
 * not matter.
 */
export function laneFor(mode: string, card: Pick<Card, "boardId" | "columnId" | "sprintId">): Lane {
  return mode === "kanban" || card.sprintId
    ? { boardId: card.boardId, columnId: card.columnId, sprintId: card.sprintId }
    : { boardId: card.boardId, columnId: null, sprintId: null };
}

/** Points on a set of cards; unestimated cards count nothing. */
export function sumPoints(rows: Array<Pick<Card, "estimate">>): number {
  return rows.reduce((total, card) => total + (card.estimate ?? 0), 0);
}
