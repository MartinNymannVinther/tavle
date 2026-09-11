import { eq } from "drizzle-orm";
import { cards, type Card, type ChecklistItem } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { cardInWorkspace } from "./lanes";
import { boardInWorkspace } from "./read";

/**
 * The checklist: the one part of a card that is a list rather than a
 * field. Replaced whole — the interface always sends the complete list —
 * and one event says what the list now holds. The card's themes are a
 * list too, but they belong to its place in the structure
 * (structure/write-card-placement).
 */

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
