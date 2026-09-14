import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { events, swimlanes, themes as themesTable, areas as areasTable } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { applySwimlaneAssignment, updateSwimlane } from "./write-swimlanes";
import { archiveCard, deleteCard, restoreCard } from "./write-card-lifecycle";
import { createCard, moveCard, updateCard, type CardUpdate } from "./write-cards";
import { deleteComment } from "./comments";
import { cardInWorkspace } from "./lanes";
import { closeItem, type CloseOutcome } from "./structure/close";
import { placeCardInStructure } from "./structure/write-card-placement";
import { placeItemInStructure } from "./structure/place-item";
import { deleteItem, reopenItem, updateItem } from "./structure/write-items";
import { updateArea, updateTheme } from "./structure/write-lists";
import { updateStructureView } from "./write-boards";
import { setCardsSprint } from "./write-sprints";
import { recordEvent } from "./events";
import { id } from "./validation";
import type { StructureViewInput } from "./validation";

/**
 * Undo (docs/adr/0022): every event that can be taken back carries its
 * own reverse, written by the service that knew the "before". Undoing
 * runs that reverse through the same ordinary services — validated,
 * rule-checked, and logged as a new action; the history is never
 * rewritten. A rule that has started to bind since (a closed feature, a
 * full lane) refuses the reverse honestly.
 */

const cardFields = z
  .object({
    title: z.string(),
    description: z.string(),
    acceptance: z.string(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    dueDate: z.string().nullable(),
    estimate: z.number().nullable(),
    assigneeUserId: z.string().nullable(),
    blocked: z.boolean(),
    blockedReason: z.string(),
    bug: z.boolean(),
    kind: z.enum(["business", "enabler"]),
    enablerType: z.enum(["architecture", "infrastructure", "exploration", "compliance"]).nullable(),
  })
  .partial();

const itemFields = z
  .object({
    title: z.string(),
    description: z.string(),
    doneWhen: z.string(),
    kind: z.enum(["business", "enabler"]),
    enablerType: z.enum(["architecture", "infrastructure", "exploration", "compliance"]).nullable(),
    targetQuarter: z.string().nullable(),
    startQuarter: z.string().nullable(),
  })
  .partial();

export const UndoStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("card.move"), cardId: id, columnId: id, index: z.number().int() }),
  z.object({ kind: z.literal("card.swimlane"), cardId: id, swimlaneId: id.nullable() }),
  z.object({
    kind: z.literal("card.place"),
    cardId: id,
    featureId: id.nullable(),
    areaId: id.nullable(),
    themeIds: z.array(id),
  }),
  z.object({ kind: z.literal("card.update"), cardId: id, fields: cardFields }),
  z.object({ kind: z.literal("card.delete"), cardId: id }),
  z.object({ kind: z.literal("card.archive"), cardId: id }),
  z.object({ kind: z.literal("card.restore"), cardId: id }),
  z.object({ kind: z.literal("card.sprint"), cardId: id, sprintId: id.nullable() }),
  z.object({ kind: z.literal("item.delete"), itemId: id }),
  z.object({ kind: z.literal("item.update"), itemId: id, fields: itemFields }),
  z.object({
    kind: z.literal("item.place"),
    itemId: id,
    parentId: id.nullable(),
    areaId: id.nullable(),
    themeIds: z.array(id),
  }),
  z.object({ kind: z.literal("item.reopen"), itemId: id }),
  z.object({ kind: z.literal("item.close"), itemId: id }),
  z.object({
    kind: z.literal("board.view"),
    boardId: id,
    structureLevels: z.enum(["epic", "feature", "card"]),
    showKind: z.boolean(),
    showThemes: z.boolean(),
    showAreas: z.boolean(),
    swimlaneBy: z.enum(["none", "kind", "theme", "area", "manual"]),
  }),
  z.object({ kind: z.literal("comment.delete"), commentId: id }),
  z.object({ kind: z.literal("theme.active"), themeId: id, active: z.boolean() }),
  z.object({ kind: z.literal("area.active"), areaId: id, active: z.boolean() }),
  z.object({ kind: z.literal("swimlane.active"), swimlaneId: id, active: z.boolean() }),
]);
export type UndoStep = z.infer<typeof UndoStepSchema>;

export class NotUndoable extends Error {
  constructor() {
    super("notUndoable");
    this.name = "NotUndoable";
  }
}

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
    case "card.update":
      if (!(await updateCard(tx, ctx, step.cardId, step.fields as CardUpdate))) {
        throw new NotUndoable();
      }
      return;
    case "card.delete":
      if (!(await deleteCard(tx, ctx, step.cardId))) throw new NotUndoable();
      return;
    case "card.archive":
      if (!(await archiveCard(tx, ctx, step.cardId))) throw new NotUndoable();
      return;
    case "card.restore":
      if (!(await restoreCard(tx, ctx, step.cardId))) throw new NotUndoable();
      return;
    case "card.sprint":
      if ((await setCardsSprint(tx, ctx, [step.cardId], step.sprintId)) === 0) {
        throw new NotUndoable();
      }
      return;
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
      const { kind: _, boardId, ...view } = step;
      if (!(await updateStructureView(tx, ctx, boardId, view as StructureViewInput))) {
        throw new NotUndoable();
      }
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
  const [row] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!row) return null;
  const parsed = UndoStepSchema.safeParse((row.payload as { undo?: unknown }).undo);
  if (!parsed.success) throw new NotUndoable();
  const [already] = await tx
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.type, "undo.applied"), sql`${events.payload}->>'of' = ${row.id}`))
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
