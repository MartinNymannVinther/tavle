import { eq } from "drizzle-orm";
import { comments, type Comment } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "./events";
import { cardInWorkspace } from "./lanes";
import { canManage, roleOf } from "./members";
import { boardInWorkspace } from "./read";

/**
 * Comments on a card. Plain text, kept as written. A comment can be
 * removed by the person who wrote it or by an owner or admin of the
 * workspace; the audit log keeps the row image either way.
 */

export async function addComment(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  text: string,
): Promise<Comment | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  const [comment] = await tx
    .insert(comments)
    .values({ orgId: ctx.orgId, cardId: card.id, authorUserId: ctx.userId, text })
    .returning();
  const board = await boardInWorkspace(tx, card.boardId);
  await recordEvent(
    tx,
    ctx,
    card.boardId,
    "comment.added",
    { key: `${board?.key ?? ""}-${card.number}`, title: card.title },
    { cardId: card.id, undo: { kind: "comment.delete", commentId: comment!.id } },
  );
  return comment!;
}

export async function deleteComment(
  tx: AppTransaction,
  ctx: OrgContext,
  commentId: string,
): Promise<Comment | null> {
  const [comment] = await tx.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!comment) return null;
  if (comment.authorUserId !== ctx.userId && !canManage(await roleOf(tx, ctx))) {
    throw new Error("forbidden");
  }
  const card = await cardInWorkspace(tx, comment.cardId);
  await tx.delete(comments).where(eq(comments.id, comment.id));
  if (card) {
    const board = await boardInWorkspace(tx, card.boardId);
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "comment.deleted",
      { key: `${board?.key ?? ""}-${card.number}`, title: card.title },
      { cardId: card.id },
    );
  }
  return comment;
}
