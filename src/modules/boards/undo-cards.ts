import { and, eq } from "drizzle-orm";
import { people } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { cardInWorkspace, columnInBoard } from "./lanes";
import { NotUndoable } from "./undo-failure";
import { applySwimlaneAssignment } from "./write-swimlanes";
import { archiveCard, deleteCard, restoreCard } from "./write-card-lifecycle";
import { moveCard, updateCard, type CardUpdate } from "./write-cards";
import { placeCardInStructure } from "./structure/write-card-placement";
import { enterColumn } from "./transitions";
import { unmoved, type UndoStep } from "./undo-steps";
import { setCardsRelease } from "./write-releases";
import { setCardsSprint } from "./write-sprints";

/**
 * The reverses of what happens to a card (docs/adr/0022): where it sits,
 * what it says, whether it is archived, and which sprint it is promised
 * to. Each runs through the ordinary service, so the rules that have
 * started to bind since refuse the reverse rather than letting it write
 * behind their backs.
 *
 * The board's own reverses — items, themes, areas, lanes, releases —
 * live next door in `undo-board.ts`; `undo.ts` is the door both are
 * reached through.
 */

/** A step that names a card. The kinds are the discriminant, so the narrowing is the type's. */
export type CardUndoStep = Extract<UndoStep, { kind: `card.${string}` }>;

export const isCardUndoStep = (step: UndoStep): step is CardUndoStep =>
  step.kind.startsWith("card.");

export async function applyCardUndo(
  tx: AppTransaction,
  ctx: OrgContext,
  step: CardUndoStep,
): Promise<void> {
  switch (step.kind) {
    case "card.move": {
      const card = await moveCard(tx, ctx, step.cardId, step.columnId, step.index);
      if (!card) throw new NotUndoable();
      return;
    }
    case "card.swimlane": {
      const card = await moveCardTarget(tx, step.cardId);
      await applySwimlaneAssignment(tx, ctx, card, {
        by: "manual",
        swimlaneId: step.swimlaneId,
      });
      return;
    }
    case "card.place":
      if (!(await placeCardInStructure(tx, ctx, { ...step }))) throw new NotUndoable();
      return;
    case "card.update": {
      const current = await cardInWorkspace(tx, step.cardId);
      if (!current) throw new NotUndoable();
      if (!unmoved(current as unknown as Record<string, unknown>, step.after)) {
        throw new NotUndoable();
      }
      // Steps written before docs/adr/0029 name the assignee by login;
      // the person that login stands behind is the same fact today. A
      // login that left no person means the world moved on: not undoable.
      const { assigneeUserId, ...fields } = step.fields;
      const update: CardUpdate = fields as CardUpdate;
      if (assigneeUserId !== undefined) {
        if (assigneeUserId === null) {
          update.assigneePersonId = null;
        } else {
          const [person] = await tx
            .select({ id: people.id })
            .from(people)
            .where(and(eq(people.orgId, ctx.orgId), eq(people.userId, assigneeUserId)))
            .limit(1);
          if (!person) throw new NotUndoable();
          update.assigneePersonId = person.id;
        }
      }
      if (!(await updateCard(tx, ctx, step.cardId, update))) {
        throw new NotUndoable();
      }
      return;
    }
    case "card.delete":
      if (!(await deleteCard(tx, ctx, step.cardId))) throw new NotUndoable();
      return;
    case "card.archive":
      if (!(await archiveCard(tx, ctx, step.cardId))) throw new NotUndoable();
      return;
    case "card.restore":
      if (!(await restoreCard(tx, ctx, step.cardId))) throw new NotUndoable();
      return;
    case "card.release":
      if ((await setCardsRelease(tx, ctx, [step.cardId], step.releaseId)) === 0) {
        throw new NotUndoable();
      }
      return;
    case "card.sprint": {
      if ((await setCardsSprint(tx, ctx, [step.cardId], step.sprintId)) === 0) {
        throw new NotUndoable();
      }
      // The move between backlog and a planned sprint reset the column
      // too; the reverse re-enters the one the card stood in, when it
      // still exists — the done clock restarts with the transition. The
      // rank is left where it was: an undo restores what a move changed,
      // and the move no longer changes the number (docs/adr/0033).
      if (step.columnId) {
        const card = await cardInWorkspace(tx, step.cardId);
        if (card && card.columnId !== step.columnId) {
          const to = await columnInBoard(tx, card.boardId, step.columnId);
          if (to) {
            const from = await columnInBoard(tx, card.boardId, card.columnId);
            await enterColumn(tx, ctx, card, from, to);
          }
        }
      }
      return;
    }
  }
}

async function moveCardTarget(tx: AppTransaction, cardId: string) {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) throw new NotUndoable();
  return card;
}
