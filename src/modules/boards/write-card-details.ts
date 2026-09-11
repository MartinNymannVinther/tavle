import { and, eq, inArray } from "drizzle-orm";
import { cardLabels, cards, labels, type Card, type ChecklistItem } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { cardInWorkspace } from "./lanes";
import { boardInWorkspace } from "./read";

/**
 * The parts of a card that are lists rather than fields: the checklist
 * and the labels. Both are replaced whole — the interface always sends
 * the complete list — and both leave one event that says what the list
 * now holds.
 */

/** Labels that belong to the board, in the order given; unknown ids are dropped. */
export async function labelsInBoard(tx: AppTransaction, boardId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await tx
    .select({ id: labels.id, name: labels.name })
    .from(labels)
    .where(and(eq(labels.boardId, boardId), inArray(labels.id, ids)));
  return rows;
}

export async function updateChecklist(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  checklist: ChecklistItem[],
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  await tx.update(cards).set({ checklist }).where(eq(cards.id, card.id));
  const board = await boardInWorkspace(tx, card.boardId);
  await recordEvent(
    tx,
    ctx,
    card.boardId,
    "card.checklist",
    {
      key: `${board?.key ?? ""}-${card.number}`,
      title: card.title,
      done: checklist.filter((item) => item.done).length,
      total: checklist.length,
    },
    { cardId: card.id, actor },
  );
  return card;
}

export async function setCardLabels(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  labelIds: string[],
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  const rows = await labelsInBoard(tx, card.boardId, labelIds);
  await tx.delete(cardLabels).where(eq(cardLabels.cardId, card.id));
  if (rows.length > 0) {
    await tx
      .insert(cardLabels)
      .values(rows.map((label) => ({ orgId: ctx.orgId, cardId: card.id, labelId: label.id })));
  }
  const board = await boardInWorkspace(tx, card.boardId);
  await recordEvent(
    tx,
    ctx,
    card.boardId,
    "card.labels",
    {
      key: `${board?.key ?? ""}-${card.number}`,
      title: card.title,
      labels: rows.map((label) => label.name),
    },
    { cardId: card.id, actor },
  );
  return card;
}
