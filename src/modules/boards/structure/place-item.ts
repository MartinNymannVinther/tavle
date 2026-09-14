import { eq } from "drizzle-orm";
import { backlogItems, cardThemes, cards, type BacklogItem } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "../events";
import { boardInWorkspace } from "../read";
import { inheritedFrom } from "./inherit";
import { itemInBoard, itemInWorkspace, setItemThemes, themeIdsOf } from "./items";
import { assertPlaced, RuleViolation } from "./rules";
import type { ItemPlacementInput } from "./validation";
import { activeAreaInBoard, activeThemesInBoard, settleArea } from "./write-lists";

const keyOf = (board: { key: string }, item: { number: number }) => `${board.key}-${item.number}`;

/**
 * Where the item sits: its parent (rule 1: one level up, same board), its
 * area and its themes. A move to a new parent inherits the parent's area
 * and themes; a change of area or themes reaches the children only when
 * asked (rule 11). An item left without a parent keeps its own area and
 * must have one (rule 3).
 */
export async function placeItemInStructure(
  tx: AppTransaction,
  ctx: OrgContext,
  input: ItemPlacementInput,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, input.itemId);
  if (!item) return null;
  const board = (await boardInWorkspace(tx, item.boardId))!;
  let areaId = item.areaId;
  let themeIds = await themeIdsOf(tx, item.id);
  let parentId = item.parentId;
  const undo = {
    kind: "item.place",
    itemId: item.id,
    parentId: item.parentId,
    areaId: item.areaId,
    themeIds: [...themeIds],
  };
  let moved = false;

  if (input.parentId !== undefined && input.parentId !== item.parentId) {
    if (item.level === "epic" && input.parentId) throw new RuleViolation("parentLevel");
    if (input.parentId) {
      const parent = await itemInBoard(tx, board.id, "epic", input.parentId);
      if (!parent) throw new RuleViolation("parentLevel");
      if (parent.state === "closed") throw new RuleViolation("itemClosed");
      const inherited = await inheritedFrom(tx, parent);
      areaId = inherited.areaId;
      themeIds = inherited.themeIds;
    }
    parentId = input.parentId;
    moved = true;
  }
  if (input.areaId !== undefined) areaId = input.areaId;
  if (input.themeIds !== undefined) themeIds = input.themeIds;

  const area = await settleArea(tx, board, parentId, await activeAreaInBoard(tx, board.id, areaId));
  const themes = await activeThemesInBoard(tx, board.id, themeIds);
  assertPlaced(parentId, area?.id ?? null);

  await tx
    .update(backlogItems)
    .set({ parentId, areaId: area?.id ?? null })
    .where(eq(backlogItems.id, item.id));
  await setItemThemes(
    tx,
    ctx.orgId,
    item.id,
    themes.map((t) => t.id),
  );
  if (moved) {
    await recordEvent(
      tx,
      ctx,
      item.boardId,
      "item.moved",
      {
        key: keyOf(board, item),
        title: item.title,
        parent: parentId ? keyOf(board, (await itemInWorkspace(tx, parentId))!) : "",
      },
      { itemId: item.id, undo },
    );
  } else {
    await recordEvent(
      tx,
      ctx,
      item.boardId,
      "item.placed",
      {
        key: keyOf(board, item),
        title: item.title,
        area: area?.name ?? "",
        themes: themes.map((t) => t.name),
      },
      { itemId: item.id, undo },
    );
  }
  if (input.applyToChildren) {
    await applyToSubtree(
      tx,
      ctx,
      item,
      area?.id ?? null,
      themes.map((t) => t.id),
    );
  }
  return item;
}

/** Rule 11, when asked for: the area and themes go down to every feature and card under the item. */
async function applyToSubtree(
  tx: AppTransaction,
  ctx: OrgContext,
  item: BacklogItem,
  areaId: string | null,
  themeIds: string[],
): Promise<void> {
  const featureIds =
    item.level === "epic"
      ? (
          await tx
            .select({ id: backlogItems.id })
            .from(backlogItems)
            .where(eq(backlogItems.parentId, item.id))
        ).map((row) => row.id)
      : [item.id];
  for (const featureId of featureIds) {
    if (featureId !== item.id) {
      await tx.update(backlogItems).set({ areaId }).where(eq(backlogItems.id, featureId));
      await setItemThemes(tx, ctx.orgId, featureId, themeIds);
    }
    const storyRows = await tx
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.featureId, featureId));
    for (const story of storyRows) {
      await tx.update(cards).set({ areaId }).where(eq(cards.id, story.id));
      await tx.delete(cardThemes).where(eq(cardThemes.cardId, story.id));
      if (themeIds.length > 0) {
        await tx
          .insert(cardThemes)
          .values(themeIds.map((themeId) => ({ orgId: ctx.orgId, cardId: story.id, themeId })));
      }
    }
  }
}
