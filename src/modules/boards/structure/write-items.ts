import { eq } from "drizzle-orm";
import { backlogItems, type BacklogItem, type EnablerType, type Kind } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "../events";
import { assertFresh, nextNumber } from "../lanes";
import { boardInWorkspace } from "../read";
import { inheritedFrom, resolveNew } from "./inherit";
import { itemInBoard, itemInWorkspace, levelLane, placeItem, setItemThemes } from "./items";
import { assertPlaced, compareQuarters, enablerTypeFor, RuleViolation } from "./rules";
import type { ItemUpdateInput, NewItemInput } from "./validation";
import { activeAreaInBoard, activeThemesInBoard, settleArea } from "./write-lists";

/**
 * Epics and features: created, edited and ranked. Their place in the
 * structure is in place-item.ts and closing in close.ts, because rule 10
 * is a conversation with the person rather than one write. Every
 * function resolves the item inside the active workspace first; an id
 * from elsewhere is not found.
 */

const keyOf = (board: { key: string }, item: { number: number }) => `${board.key}-${item.number}`;

export async function createItem(
  tx: AppTransaction,
  ctx: OrgContext,
  input: NewItemInput,
  actor: ActorKind = "user",
): Promise<BacklogItem> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) throw new Error("notFound");
  // Rule 4 has moved to the close (docs/adr/0018): an item may be jotted
  // down without its done-when and carries a mark until it is written.
  // Rule 1: a feature's parent is an epic; an epic has no parent at all.
  let parent: BacklogItem | null = null;
  if (input.level === "feature" && input.parentId) {
    parent = await itemInBoard(tx, board.id, "epic", input.parentId);
    if (!parent) throw new RuleViolation("parentLevel");
    if (parent.state === "closed") throw new RuleViolation("itemClosed");
  }
  const got = resolveNew(input, parent ? await inheritedFrom(tx, parent) : null);
  const area = await settleArea(
    tx,
    board,
    parent?.id ?? null,
    await activeAreaInBoard(tx, board.id, got.areaId),
  );
  const themes = await activeThemesInBoard(tx, board.id, got.themeIds);
  assertPlaced(parent?.id ?? null, area?.id ?? null);
  const number = await nextNumber(tx, board.id);
  const [item] = await tx
    .insert(backlogItems)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      level: input.level,
      parentId: parent?.id ?? null,
      number,
      title: input.title,
      description: input.description ?? "",
      doneWhen: input.doneWhen,
      kind: got.kind,
      enablerType: enablerTypeFor(got.kind, input.enablerType),
      areaId: area?.id ?? null,
      targetQuarter: input.level === "epic" ? (input.targetQuarter ?? null) : null,
      sort: 0,
      createdBy: ctx.userId,
    })
    .returning();
  await setItemThemes(
    tx,
    ctx.orgId,
    item!.id,
    themes.map((t) => t.id),
  );
  await placeItem(tx, board.id, input.level, item!.id, undefined);
  await recordEvent(
    tx,
    ctx,
    board.id,
    "item.created",
    { key: keyOf(board, item!), level: input.level, title: input.title },
    { itemId: item!.id, actor, undo: { kind: "item.delete", itemId: item!.id } },
  );
  return (await itemInWorkspace(tx, item!.id))!;
}

export async function updateItem(
  tx: AppTransaction,
  ctx: OrgContext,
  input: ItemUpdateInput,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, input.itemId);
  if (!item) return null;
  assertFresh(item, input.expectedUpdatedAt);
  const board = (await boardInWorkspace(tx, item.boardId))!;
  const kind = (input.kind ?? item.kind) as Kind;
  const enablerType =
    input.enablerType !== undefined
      ? enablerTypeFor(kind, input.enablerType)
      : enablerTypeFor(kind, kind === "enabler" ? (item.enablerType as EnablerType | null) : null);
  const patch: Partial<typeof backlogItems.$inferInsert> = { kind, enablerType };
  const changed: string[] = [];
  if (input.title !== undefined && input.title !== item.title) {
    patch.title = input.title;
    changed.push("title");
  }
  if (input.description !== undefined && input.description !== item.description) {
    patch.description = input.description;
    changed.push("description");
  }
  if (input.doneWhen !== undefined && input.doneWhen !== item.doneWhen) {
    patch.doneWhen = input.doneWhen;
    changed.push("doneWhen");
  }
  if (kind !== item.kind || enablerType !== item.enablerType) changed.push("kind");
  if (item.level === "epic" && input.targetQuarter !== undefined) {
    if (input.targetQuarter !== item.targetQuarter) {
      patch.targetQuarter = input.targetQuarter;
      changed.push("targetQuarter");
    }
  }
  if (item.level === "epic" && input.startQuarter !== undefined) {
    if (input.startQuarter !== item.startQuarter) {
      patch.startQuarter = input.startQuarter;
      changed.push("startQuarter");
    }
  }
  // Quarters the wrong way round are swapped rather than refused; a bar
  // dragged past its own end means the span the person drew.
  const start = patch.startQuarter !== undefined ? patch.startQuarter : item.startQuarter;
  const target = patch.targetQuarter !== undefined ? patch.targetQuarter : item.targetQuarter;
  if (start && target && compareQuarters(start, target) > 0) {
    patch.startQuarter = target;
    patch.targetQuarter = start;
  }
  if (changed.length === 0) return item;
  await tx.update(backlogItems).set(patch).where(eq(backlogItems.id, item.id));
  await recordEvent(
    tx,
    ctx,
    item.boardId,
    "item.updated",
    { key: keyOf(board, item), title: patch.title ?? item.title, fields: changed },
    {
      itemId: item.id,
      undo: {
        kind: "item.update",
        itemId: item.id,
        fields: Object.fromEntries(
          changed.flatMap((field) =>
            field === "kind"
              ? [
                  ["kind", item.kind],
                  ["enablerType", item.enablerType],
                ]
              : [[field, item[field as keyof typeof item] ?? null]],
          ),
        ),
      },
    },
  );
  return item;
}

/**
 * Ranks an item next to a sibling: the lane is one order per level, and
 * the interface shows it split under epics, so "before this one" is the
 * move a person makes and the index is computed here from the whole lane.
 */
export async function reorderItem(
  tx: AppTransaction,
  itemId: string,
  siblingId: string,
  after: boolean,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, itemId);
  if (!item) return null;
  const level = item.level as "epic" | "feature";
  const lane = (await levelLane(tx, item.boardId, level)).filter((row) => row.id !== item.id);
  const at = lane.findIndex((row) => row.id === siblingId);
  if (at < 0) throw new Error("notFound");
  await placeItem(tx, item.boardId, level, item.id, after ? at + 1 : at);
  return item;
}

export async function reopenItem(
  tx: AppTransaction,
  ctx: OrgContext,
  itemId: string,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, itemId);
  if (!item) return null;
  if (item.state === "open") return item;
  const board = (await boardInWorkspace(tx, item.boardId))!;
  await tx
    .update(backlogItems)
    .set({ state: "open", closedAt: null, reviewConfirmedAt: new Date() })
    .where(eq(backlogItems.id, item.id));
  await recordEvent(
    tx,
    ctx,
    item.boardId,
    "item.reopened",
    { key: keyOf(board, item), title: item.title },
    { itemId: item.id, undo: { kind: "item.close", itemId: item.id } },
  );
  return item;
}

/** Rule 9: an owner says the epic is still a result, and the review clock starts over. */
export async function confirmReview(
  tx: AppTransaction,
  ctx: OrgContext,
  itemId: string,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, itemId);
  if (!item) return null;
  const board = (await boardInWorkspace(tx, item.boardId))!;
  await tx
    .update(backlogItems)
    .set({ reviewConfirmedAt: new Date() })
    .where(eq(backlogItems.id, item.id));
  await recordEvent(
    tx,
    ctx,
    item.boardId,
    "item.reviewed",
    { key: keyOf(board, item), title: item.title },
    { itemId: item.id },
  );
  return item;
}

/** Gone for good; children are left without a parent, never deleted with it. */
export async function deleteItem(
  tx: AppTransaction,
  ctx: OrgContext,
  itemId: string,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, itemId);
  if (!item) return null;
  const board = (await boardInWorkspace(tx, item.boardId))!;
  await tx.delete(backlogItems).where(eq(backlogItems.id, item.id));
  await recordEvent(tx, ctx, item.boardId, "item.deleted", {
    key: keyOf(board, item),
    title: item.title,
    level: item.level,
  });
  return item;
}
