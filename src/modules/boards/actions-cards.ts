"use server";

import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import { addComment, deleteComment } from "./comments";
import { cardInWorkspace } from "./lanes";
import {
  CardIdSchema,
  CardLabelsSchema,
  CardMoveSchema,
  CardUpdateSchema,
  ChecklistSchema,
  CommentIdSchema,
  NewCardSchema,
  NewCommentSchema,
} from "./validation";
import { setCardLabels, updateChecklist } from "./write-card-details";
import { archiveCard, deleteCard, restoreCard } from "./write-card-lifecycle";
import { createCard, moveCard, updateCard } from "./write-cards";

/**
 * Everything a person can do to a card. The services answer null when a
 * row is not in the caller's workspace, which becomes "notFound" rather
 * than a silent success. Every action answers with the board id so the
 * page can refresh what it shows.
 */

export type CreatedCard = { id: string; number: number; boardId: string };

export async function createCardAction(raw: unknown): Promise<Result<CreatedCard>> {
  return action(NewCardSchema, raw, async (tx, ctx, input) => {
    const card = await createCard(tx, ctx, input);
    return { id: card.id, number: card.number, boardId: card.boardId };
  });
}

export async function moveCardAction(raw: unknown): Promise<Result<string>> {
  return action(CardMoveSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await moveCard(tx, ctx, input.cardId, input.columnId, input.index));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function updateCardAction(raw: unknown): Promise<Result<string>> {
  return action(CardUpdateSchema, raw, async (tx, ctx, input, touch) => {
    const { cardId, ...fields } = input;
    const card = found(await updateCard(tx, ctx, cardId, fields));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function updateChecklistAction(raw: unknown): Promise<Result<string>> {
  return action(ChecklistSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await updateChecklist(tx, ctx, input.cardId, input.checklist));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function setCardLabelsAction(raw: unknown): Promise<Result<string>> {
  return action(CardLabelsSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await setCardLabels(tx, ctx, input.cardId, input.labelIds));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function archiveCardAction(raw: unknown): Promise<Result<string>> {
  return action(CardIdSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await archiveCard(tx, ctx, input.cardId));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function restoreCardAction(raw: unknown): Promise<Result<string>> {
  return action(CardIdSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await restoreCard(tx, ctx, input.cardId));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function deleteCardAction(raw: unknown): Promise<Result<string>> {
  return action(CardIdSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await deleteCard(tx, ctx, input.cardId));
    touch(card.boardId);
    return card.boardId;
  });
}

export async function addCommentAction(raw: unknown): Promise<Result<string>> {
  return action(NewCommentSchema, raw, async (tx, ctx, input, touch) => {
    const comment = found(await addComment(tx, ctx, input.cardId, input.text));
    touch((await cardInWorkspace(tx, input.cardId))?.boardId);
    return comment.id;
  });
}

export async function deleteCommentAction(raw: unknown): Promise<Result<string>> {
  return action(CommentIdSchema, raw, async (tx, ctx, input, touch) => {
    const comment = found(await deleteComment(tx, ctx, input.commentId));
    touch((await cardInWorkspace(tx, comment.cardId))?.boardId);
    return comment.id;
  });
}
