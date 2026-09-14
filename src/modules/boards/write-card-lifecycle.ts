import { eq } from "drizzle-orm";
import { cards } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "./events";
import { cardInWorkspace, columnInBoard, firstColumn, joiningSort, laneFor } from "./lanes";
import { boardInWorkspace } from "./read";
import { recordTransition } from "./transitions";

/**
 * How a card leaves the board and how it comes back. Archiving is the
 * ordinary way out — the number and the history stay, and the numbers
 * stop counting the card from that day — and deleting is the rare one,
 * with the audit log keeping the row image. Neither is something the AI
 * can do: these take a person, so they carry no actor parameter.
 */

/** Off the board, but not gone: an archived card keeps its number and its history. */
export async function archiveCard(tx: AppTransaction, ctx: OrgContext, cardId: string) {
  const card = await cardInWorkspace(tx, cardId);
  if (!card || card.archivedAt) return card;
  await tx.update(cards).set({ archivedAt: new Date() }).where(eq(cards.id, card.id));
  const from = await columnInBoard(tx, card.boardId, card.columnId);
  await recordTransition(tx, ctx, card, from, null);
  const board = await boardInWorkspace(tx, card.boardId);
  await recordEvent(
    tx,
    ctx,
    card.boardId,
    "card.archived",
    { key: `${board?.key ?? ""}-${card.number}`, title: card.title },
    { cardId: card.id, undo: { kind: "card.restore", cardId: card.id } },
  );
  return card;
}

export async function restoreCard(tx: AppTransaction, ctx: OrgContext, cardId: string) {
  const card = await cardInWorkspace(tx, cardId);
  if (!card || !card.archivedAt) return card;
  const column =
    (await columnInBoard(tx, card.boardId, card.columnId)) ?? (await firstColumn(tx, card.boardId));
  if (!column) return null;
  const board = await boardInWorkspace(tx, card.boardId);
  const sort = await joiningSort(
    tx,
    laneFor(board?.mode ?? "kanban", { ...card, columnId: column.id }),
  );
  await tx
    .update(cards)
    .set({ archivedAt: null, columnId: column.id, sort })
    .where(eq(cards.id, card.id));
  await recordTransition(tx, ctx, card, null, column);
  await recordEvent(
    tx,
    ctx,
    card.boardId,
    "card.restored",
    { key: `${board?.key ?? ""}-${card.number}`, title: card.title },
    { cardId: card.id, undo: { kind: "card.archive", cardId: card.id } },
  );
  return card;
}

/** Gone for good, history included; the audit log keeps the row image. */
export async function deleteCard(tx: AppTransaction, ctx: OrgContext, cardId: string) {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  const board = await boardInWorkspace(tx, card.boardId);
  await tx.delete(cards).where(eq(cards.id, card.id));
  await recordEvent(tx, ctx, card.boardId, "card.deleted", {
    key: `${board?.key ?? ""}-${card.number}`,
    title: card.title,
  });
  return card;
}
