import { and, count, eq, sql } from "drizzle-orm";
import {
  backlogItems as backlogItemsTable,
  cards as cardsTable,
  events,
  swimlanes,
  themes as themesTable,
  areas as areasTable,
} from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { itemInWorkspace } from "./structure/items";
import { updateSwimlane } from "./write-swimlanes";
import { deleteComment } from "./comments";
import { canManage, roleOf } from "./members";
import { closeItem, type CloseOutcome } from "./structure/close";
import { levelLane } from "./structure/items";
import { STEP } from "./ordering";
import { placeItemInStructure, restoreSubtree } from "./structure/place-item";
import { planFeature } from "./structure/plan-feature";
import { deleteItem, reopenItem, updateItem } from "./structure/write-items";
import { updateArea, updateTheme } from "./structure/write-lists";
import { unmoved, UndoStepSchema, type UndoStep } from "./undo-steps";
import { applyCardUndo, isCardUndoStep } from "./undo-cards";
import { NotUndoable } from "./undo-failure";
import { updateStructureView } from "./write-boards";
import { restoreEstimates } from "./write-estimates";
import { reorderRelease, updateRelease } from "./write-releases";
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

export { NotUndoable } from "./undo-failure";

/** The reverses of owner/admin actions: undoing a board-shape change is a board-shape change. */
const MANAGE_KINDS = new Set<UndoStep["kind"]>([
  "item.delete",
  "board.view",
  "release.update",
  "releases.order",
  "theme.active",
  "area.active",
  "swimlane.active",
  "theme.update",
  "area.update",
  "swimlane.update",
]);

/** Runs one reverse through the ordinary services. Null means the thing is gone. */
async function applyUndo(tx: AppTransaction, ctx: OrgContext, step: UndoStep): Promise<void> {
  // What happens to a card is its own subject and its own file; what is
  // left here is the shape of the board — the structure, the lists, the
  // lanes, the releases and the board's own settings.
  if (isCardUndoStep(step)) return applyCardUndo(tx, ctx, step);
  switch (step.kind) {
    case "item.delete": {
      // Undoing a creation deletes the thing again — but children have
      // arrived under it since, and the foreign key would quietly drop
      // them to no parent at all, with nothing to take that back. The
      // structure refuses rather than guesses everywhere else, and so
      // here: empty it first, or delete it deliberately from its own
      // page, where the conversation belongs.
      if (await hasChildren(tx, step.itemId)) throw new NotUndoable();
      if (!(await deleteItem(tx, ctx, step.itemId))) throw new NotUndoable();
      return;
    }
    case "item.update": {
      const current = await itemInWorkspace(tx, step.itemId);
      if (!current) throw new NotUndoable();
      if (!unmoved(current as unknown as Record<string, unknown>, step.after)) {
        throw new NotUndoable();
      }
      if (!(await updateItem(tx, ctx, { itemId: step.itemId, ...step.fields }))) {
        throw new NotUndoable();
      }
      return;
    }
    case "item.place":
      if (!(await placeItemInStructure(tx, ctx, { ...step }))) throw new NotUndoable();
      return;
    case "item.cascade":
      if (!(await restoreSubtree(tx, ctx, step.itemId, step.children))) throw new NotUndoable();
      return;
    case "item.plan":
      if (!(await planFeature(tx, ctx, { ...step }))) throw new NotUndoable();
      return;
    case "items.order": {
      // Back to the order that held: saved ids first, in their saved
      // order; whatever has arrived since keeps its place after them.
      const lane = await levelLane(tx, step.boardId, step.level);
      const rank = new Map(step.order.map((itemId, index) => [itemId, index]));
      const sorted = [...lane].sort(
        (a, b) =>
          (rank.get(a.id) ?? step.order.length + lane.indexOf(a)) -
          (rank.get(b.id) ?? step.order.length + lane.indexOf(b)),
      );
      for (const [index, row] of sorted.entries()) {
        const sort = (index + 1) * STEP;
        if (row.sort !== sort) {
          await tx.update(backlogItemsTable).set({ sort }).where(eq(backlogItemsTable.id, row.id));
        }
      }
      return;
    }
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
    case "release.update":
      if (
        !(await updateRelease(tx, ctx, {
          releaseId: step.releaseId,
          name: step.name,
          targetDate: step.targetDate,
        }))
      ) {
        throw new NotUndoable();
      }
      return;
    case "releases.order": {
      // Back to the order that held, one placement per band.
      for (const [index, releaseId] of step.order.entries()) {
        await reorderRelease(tx, ctx, releaseId, index);
      }
      return;
    }
    case "board.estimates":
      if (!(await restoreEstimates(tx, ctx, step))) throw new NotUndoable();
      return;
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
    // The names, colours and owners of the closed lists and the lanes.
    // The active flag is read off the row rather than carried, so
    // putting a name back never puts a deactivated entry back in use.
    case "theme.update": {
      const [row] = await tx
        .select()
        .from(themesTable)
        .where(eq(themesTable.id, step.themeId))
        .limit(1);
      if (!row) throw new NotUndoable();
      await updateTheme(tx, ctx, {
        themeId: row.id,
        name: step.name,
        color: step.color,
        ownerUserId: step.ownerUserId,
        active: row.active,
      });
      return;
    }
    case "area.update": {
      const [row] = await tx
        .select()
        .from(areasTable)
        .where(eq(areasTable.id, step.areaId))
        .limit(1);
      if (!row) throw new NotUndoable();
      await updateArea(tx, ctx, {
        areaId: row.id,
        name: step.name,
        ownerUserId: step.ownerUserId,
        active: row.active,
      });
      return;
    }
    case "swimlane.update": {
      const [row] = await tx
        .select()
        .from(swimlanes)
        .where(eq(swimlanes.id, step.swimlaneId))
        .limit(1);
      if (!row) throw new NotUndoable();
      await updateSwimlane(tx, ctx, { swimlaneId: row.id, name: step.name, active: row.active });
      return;
    }
  }
}

/** Features under an epic, or cards under a feature: anything the delete would orphan. */
async function hasChildren(tx: AppTransaction, itemId: string): Promise<boolean> {
  const [items] = await tx
    .select({ n: count() })
    .from(backlogItemsTable)
    .where(eq(backlogItemsTable.parentId, itemId));
  if (Number(items?.n ?? 0) > 0) return true;
  const [cards] = await tx
    .select({ n: count() })
    .from(cardsTable)
    .where(eq(cardsTable.featureId, itemId));
  return Number(cards?.n ?? 0) > 0;
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
