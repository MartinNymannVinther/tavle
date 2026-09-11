import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  backlogItemThemes,
  backlogItems,
  cards,
  columns,
  type BacklogItem,
  type ItemLevel,
} from "@/core/db/schema";
import type { AppTransaction } from "@/core/db/tenant";
import { placeInLane, type Positioned } from "../ordering";

/**
 * The small lookups the structure's mutations are built from, in the
 * same spirit as lanes.ts for cards: each answers null rather than
 * throwing when the row is not where the caller says it is.
 */

export async function itemInWorkspace(
  tx: AppTransaction,
  itemId: string,
): Promise<BacklogItem | null> {
  const [row] = await tx.select().from(backlogItems).where(eq(backlogItems.id, itemId)).limit(1);
  return row ?? null;
}

/** An item of the given level on the board, or null. */
export async function itemInBoard(
  tx: AppTransaction,
  boardId: string,
  level: ItemLevel,
  itemId: string | null | undefined,
): Promise<BacklogItem | null> {
  if (!itemId) return null;
  const [row] = await tx
    .select()
    .from(backlogItems)
    .where(
      and(
        eq(backlogItems.id, itemId),
        eq(backlogItems.boardId, boardId),
        eq(backlogItems.level, level),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function themeIdsOf(tx: AppTransaction, itemId: string): Promise<string[]> {
  const rows = await tx
    .select({ themeId: backlogItemThemes.themeId })
    .from(backlogItemThemes)
    .where(eq(backlogItemThemes.itemId, itemId));
  return rows.map((row) => row.themeId);
}

/** Theme ids per item, for a list of items, in one query. */
export async function themeIdsByItem(
  tx: AppTransaction,
  itemIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (itemIds.length === 0) return map;
  const rows = await tx
    .select({ itemId: backlogItemThemes.itemId, themeId: backlogItemThemes.themeId })
    .from(backlogItemThemes)
    .where(inArray(backlogItemThemes.itemId, itemIds));
  for (const row of rows) map.set(row.itemId, [...(map.get(row.itemId) ?? []), row.themeId]);
  return map;
}

export async function setItemThemes(
  tx: AppTransaction,
  orgId: string,
  itemId: string,
  themeIds: string[],
): Promise<void> {
  await tx.delete(backlogItemThemes).where(eq(backlogItemThemes.itemId, itemId));
  if (themeIds.length > 0) {
    await tx
      .insert(backlogItemThemes)
      .values(themeIds.map((themeId) => ({ orgId, itemId, themeId })));
  }
}

/** The items of one level on a board, in rank order: one order per level, business and enabler alike. */
export async function levelLane(
  tx: AppTransaction,
  boardId: string,
  level: ItemLevel,
): Promise<Positioned[]> {
  return tx
    .select({ id: backlogItems.id, sort: backlogItems.sort })
    .from(backlogItems)
    .where(and(eq(backlogItems.boardId, boardId), eq(backlogItems.level, level)))
    .orderBy(asc(backlogItems.sort), asc(backlogItems.number));
}

/** Puts an item at `index` among its level and writes only the numbers that changed. */
export async function placeItem(
  tx: AppTransaction,
  boardId: string,
  level: ItemLevel,
  itemId: string,
  index: number | undefined,
): Promise<void> {
  const changes = placeInLane(await levelLane(tx, boardId, level), itemId, index);
  for (const change of changes) {
    await tx.update(backlogItems).set({ sort: change.sort }).where(eq(backlogItems.id, change.id));
  }
}

/** Open features of an epic. */
export async function openFeaturesOf(tx: AppTransaction, epicId: string): Promise<BacklogItem[]> {
  return tx
    .select()
    .from(backlogItems)
    .where(and(eq(backlogItems.parentId, epicId), eq(backlogItems.state, "open")))
    .orderBy(asc(backlogItems.sort));
}

export type OpenStory = {
  id: string;
  number: number;
  title: string;
  areaId: string | null;
  columnName: string;
};

/** Open stories of a feature: on the board, not archived, not in a done column. */
export async function openStoriesOf(tx: AppTransaction, featureId: string): Promise<OpenStory[]> {
  const rows = await tx
    .select({
      id: cards.id,
      number: cards.number,
      title: cards.title,
      areaId: cards.areaId,
      columnName: columns.name,
      category: columns.category,
    })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(and(eq(cards.featureId, featureId), isNull(cards.archivedAt)))
    .orderBy(asc(cards.sort), asc(cards.number));
  return rows
    .filter((row) => row.category !== "done")
    .map(({ id, number, title, areaId, columnName }) => ({
      id,
      number,
      title,
      areaId,
      columnName,
    }));
}
