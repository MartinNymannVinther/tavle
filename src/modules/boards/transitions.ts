import { eq } from "drizzle-orm";
import { cardTransitions, cards, type Card, type Column } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";

/**
 * A card entering a column, written down as it happens. The row is what
 * the metrics read; the card's own `startedAt` and `doneAt` are the same
 * fact kept where the board can read it without a query.
 *
 * `to` is null when the card leaves the board (archived): the flow diagram
 * stops counting it from that day, and its clock, if running, is left as
 * it was — an archived card is not a finished one.
 */
export async function recordTransition(
  tx: AppTransaction,
  ctx: OrgContext,
  card: Pick<Card, "id" | "boardId" | "estimate">,
  from: Pick<Column, "id" | "category"> | null,
  to: Pick<Column, "id" | "category"> | null,
): Promise<void> {
  await tx.insert(cardTransitions).values({
    orgId: ctx.orgId,
    boardId: card.boardId,
    cardId: card.id,
    fromColumnId: from?.id ?? null,
    toColumnId: to?.id ?? null,
    fromCategory: from?.category ?? null,
    toCategory: to?.category ?? "archived",
    points: card.estimate,
    actorUserId: ctx.userId,
  });
}

/**
 * The clocks a category change starts or stops. `startedAt` is set the
 * first time a card is worked on and never cleared, so a card sent back
 * to the backlog keeps the day it was first touched; `doneAt` is set
 * while the card is done and cleared the moment it is reopened.
 */
export function clocksFor(
  card: Pick<Card, "startedAt" | "doneAt">,
  toCategory: string,
  now = new Date(),
): { startedAt: Date | null; doneAt: Date | null } {
  return {
    startedAt: card.startedAt ?? (toCategory === "doing" || toCategory === "done" ? now : null),
    doneAt: toCategory === "done" ? (card.doneAt ?? now) : null,
  };
}

/** Moves the card into `to`, recording the transition and updating the clocks. */
export async function enterColumn(
  tx: AppTransaction,
  ctx: OrgContext,
  card: Card,
  from: Pick<Column, "id" | "category"> | null,
  to: Pick<Column, "id" | "category">,
  extra: Partial<typeof cards.$inferInsert> = {},
): Promise<void> {
  await tx
    .update(cards)
    .set({ columnId: to.id, ...clocksFor(card, to.category), ...extra })
    .where(eq(cards.id, card.id));
  await recordTransition(tx, ctx, card, from, to);
}
