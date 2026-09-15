import { and, eq, sql } from "drizzle-orm";
import { events, swimlanes, themes as themesTable, areas as areasTable } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { applySwimlaneAssignment, updateSwimlane } from "./write-swimlanes";
import { archiveCard, deleteCard, restoreCard } from "./write-card-lifecycle";
import { moveCard, updateCard, type CardUpdate } from "./write-cards";
import { deleteComment } from "./comments";
import { cardInWorkspace, columnInBoard, joiningSort, laneFor } from "./lanes";
import { canManage, roleOf } from "./members";
import { people } from "@/core/db/schema";
import { closeItem, type CloseOutcome } from "./structure/close";
import { placeCardInStructure } from "./structure/write-card-placement";
import { placeItemInStructure, restoreSubtree } from "./structure/place-item";
import { planFeature } from "./structure/plan-feature";
import { deleteItem, reopenItem, updateItem } from "./structure/write-items";
import { updateArea, updateTheme } from "./structure/write-lists";
import { enterColumn } from "./transitions";
import { UndoStepSchema, type UndoStep } from "./undo-steps";
import { updateStructureView } from "./write-boards";
import { setCardsSprint } from "./write-sprints";
import { recordEvent } from "./events";
import type { StructureViewInput } from "./validation";

/**
 * Undo (docs/adr/0022): every event that can be taken back carries its
 * own reverse, written by the service that knew the "before". Undoing
 * runs that reverse through the same ordinary services — validated,
 * rule-checked, and logged as a new action; the history is never
 * rewritten. A rule that has started to bind since (a closed feature, a
 * full lane) refuses the reverse honestly.
 */

export { UndoStepSchema, type UndoStep } from "./undo-steps";

export class NotUndoable extends Error {
  constructor() {
    super("notUndoable");
    this.name = "NotUndoable";
  }
}

/** The reverses of owner/admin actions: undoing a board-shape change is a board-shape change. */
const MANAGE_KINDS = new Set<UndoStep["kind"]>([
  "item.delete",
  "board.view",
  "theme.active",
  "area.active",
  "swimlane.active",
]);

/** Runs one reverse through the ordinary services. Null means the thing is gone. */
async function applyUndo(tx: AppTransaction, ctx: OrgContext, step: UndoStep): Promise<void> {
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
    case "card.sprint": {
      if ((await setCardsSprint(tx, ctx, [step.cardId], step.sprintId)) === 0) {
        throw new NotUndoable();
      }
      // The move between backlog and a planned sprint reset the column
      // too; the reverse re-enters the one the card stood in, when it
      // still exists — the done clock restarts with the transition.
      if (step.columnId) {
        const card = await cardInWorkspace(tx, step.cardId);
        if (card && card.columnId !== step.columnId) {
          const to = await columnInBoard(tx, card.boardId, step.columnId);
          if (to) {
            const from = await columnInBoard(tx, card.boardId, card.columnId);
            const sort = await joiningSort(
              tx,
              laneFor("scrum", { boardId: card.boardId, columnId: to.id, sprintId: card.sprintId }),
            );
            await enterColumn(tx, ctx, card, from, to, { sort });
          }
        }
      }
      return;
    }
    case "item.delete":
      if (!(await deleteItem(tx, ctx, step.itemId))) throw new NotUndoable();
      return;
    case "item.update":
      if (!(await updateItem(tx, ctx, { itemId: step.itemId, ...step.fields }))) {
        throw new NotUndoable();
      }
      return;
    case "item.place":
      if (!(await placeItemInStructure(tx, ctx, { ...step }))) throw new NotUndoable();
      return;
    case "item.cascade":
      if (!(await restoreSubtree(tx, ctx, step.itemId, step.children))) throw new NotUndoable();
      return;
    case "item.plan":
      if (!(await planFeature(tx, ctx, { ...step }))) throw new NotUndoable();
      return;
    case "item.reopen":
      if (!(await reopenItem(tx, ctx, step.itemId))) throw new NotUndoable();
      return;
    case "item.close": {
      const outcome: CloseOutcome | null = await closeItem(tx, ctx, step.itemId, undefined);
      if (!outcome) throw new NotUndoable();
      // Children have appeared since; closing again is a conversation, not an undo.
      if (!outcome.closed) throw new NotUndoable();
      return;
    }
    case "board.view": {
      const view: StructureViewInput = {
        structureLevels: step.structureLevels,
        showKind: step.showKind,
        showThemes: step.showThemes,
        showAreas: step.showAreas,
        swimlaneBy: step.swimlaneBy,
      };
      if (!(await updateStructureView(tx, ctx, step.boardId, view))) throw new NotUndoable();
      return;
    }
    case "comment.delete":
      if (!(await deleteComment(tx, ctx, step.commentId))) throw new NotUndoable();
      return;
    case "theme.active": {
      const [row] = await tx
        .select()
        .from(themesTable)
        .where(eq(themesTable.id, step.themeId))
        .limit(1);
      if (!row) throw new NotUndoable();
      await updateTheme(tx, ctx, {
        themeId: row.id,
        name: row.name,
        color: row.color as never,
        ownerUserId: row.ownerUserId,
        active: step.active,
      });
      return;
    }
    case "area.active": {
      const [row] = await tx
        .select()
        .from(areasTable)
        .where(eq(areasTable.id, step.areaId))
        .limit(1);
      if (!row) throw new NotUndoable();
      await updateArea(tx, ctx, {
        areaId: row.id,
        name: row.name,
        ownerUserId: row.ownerUserId,
        active: step.active,
      });
      return;
    }
    case "swimlane.active": {
      const [row] = await tx
        .select()
        .from(swimlanes)
        .where(eq(swimlanes.id, step.swimlaneId))
        .limit(1);
      if (!row) throw new NotUndoable();
      await updateSwimlane(tx, ctx, { swimlaneId: row.id, name: row.name, active: step.active });
      return;
    }
  }
}

async function moveCardTarget(tx: AppTransaction, cardId: string) {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) throw new NotUndoable();
  return card;
}

/**
 * Undoes one event: the reverse it carries is validated, refused when
 * the event is already undone, run through the services, and written
 * down as its own `undo.applied` event in the same feeds.
 */
export async function undoEvent(
  tx: AppTransaction,
  ctx: OrgContext,
  eventId: string,
): Promise<string | null> {
  // The row lock serializes two people undoing the same event at once:
  // the second waits here and then sees the first one's `undo.applied`.
  const [row] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1).for("update");
  if (!row) return null;
  const parsed = UndoStepSchema.safeParse((row.payload as { undo?: unknown }).undo);
  if (!parsed.success) throw new NotUndoable();
  if (MANAGE_KINDS.has(parsed.data.kind) && !canManage(await roleOf(tx, ctx))) {
    throw new Error("forbidden");
  }
  const [already] = await tx
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        // The board narrows the walk to one feed's history; the partial
        // expression index on payload->>'of' answers the rest.
        eq(events.boardId, row.boardId),
        eq(events.type, "undo.applied"),
        sql`${events.payload}->>'of' = ${row.id}`,
      ),
    )
    .limit(1);
  if (already) throw new NotUndoable();
  await applyUndo(tx, ctx, parsed.data);
  // A reverse that removes the thing itself leaves nothing to link to;
  // the note then stands in the board's feed alone.
  const gone = parsed.data.kind === "card.delete" || parsed.data.kind === "item.delete";
  await recordEvent(
    tx,
    ctx,
    row.boardId,
    "undo.applied",
    { of: row.id, key: (row.payload as { key?: string }).key ?? "" },
    gone ? {} : { cardId: row.cardId, itemId: row.itemId },
  );
  return row.boardId;
}
