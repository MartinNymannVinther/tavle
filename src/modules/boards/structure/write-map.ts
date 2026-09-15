import { and, asc, eq, isNotNull } from "drizzle-orm";
import { backlogItems, type BacklogItem } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "../events";
import { placeInLane, STEP, type Positioned } from "../ordering";
import { boardInWorkspace } from "../read";
import { itemInWorkspace } from "./items";
import { RuleViolation } from "./rules";

/**
 * The story map's backbone: which features stand on the map and in
 * what order, left to right in the story's order. It is the map's own
 * order, not the backlog's rank, because "what the user does first" and
 * "what we build first" are two different questions. A feature is on
 * the map when `map_sort` is set; taking it down clears it and moves
 * nothing else.
 */

/** The features on the board's map, left to right. */
export async function mapLane(tx: AppTransaction, boardId: string): Promise<Positioned[]> {
  const rows = await tx
    .select({ id: backlogItems.id, sort: backlogItems.mapSort })
    .from(backlogItems)
    .where(
      and(
        eq(backlogItems.boardId, boardId),
        eq(backlogItems.level, "feature"),
        isNotNull(backlogItems.mapSort),
      ),
    )
    .orderBy(asc(backlogItems.mapSort), asc(backlogItems.number));
  return rows.map((row) => ({ id: row.id, sort: row.sort ?? 0 }));
}

/**
 * Puts a feature on the map at `index` (the end when undefined), or
 * takes it down when `index` is null. Only a feature can stand on the
 * map, and only an open one goes up; a closed one may stay until
 * somebody takes it down.
 */
export async function placeOnMap(
  tx: AppTransaction,
  ctx: OrgContext,
  itemId: string,
  index: number | null | undefined,
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, itemId);
  if (!item) return null;
  if (item.level !== "feature") throw new RuleViolation("parentLevel");
  const board = (await boardInWorkspace(tx, item.boardId))!;
  const key = `${board.key}-${item.number}`;

  if (index === null) {
    if (item.mapSort === null) return item;
    await tx.update(backlogItems).set({ mapSort: null }).where(eq(backlogItems.id, item.id));
    await recordEvent(
      tx,
      ctx,
      board.id,
      "item.unmapped",
      { key, title: item.title },
      { itemId: item.id },
    );
    return item;
  }

  if (item.state === "closed") throw new RuleViolation("itemClosed");
  const wasOn = item.mapSort !== null;
  const changes = placeInLane(await mapLane(tx, board.id), item.id, index);
  for (const change of changes) {
    await tx
      .update(backlogItems)
      .set({ mapSort: change.sort })
      .where(eq(backlogItems.id, change.id));
  }
  if (!wasOn) {
    await recordEvent(
      tx,
      ctx,
      board.id,
      "item.mapped",
      { key, title: item.title },
      { itemId: item.id },
    );
  }
  return item;
}

/**
 * Rewrites the backlog's feature order so the mapped features stand in
 * the map's order, in the slots they already occupy — the unmapped
 * keep their places. The map stays untouched: the offer runs one way,
 * and only when a person asks (the drift notice on the map). Returns
 * how many rows moved, or null for a foreign board.
 */
export async function alignBacklogToMap(
  tx: AppTransaction,
  ctx: OrgContext,
  boardId: string,
): Promise<number | null> {
  const board = await boardInWorkspace(tx, boardId);
  if (!board) return null;
  const lane = await tx
    .select({
      id: backlogItems.id,
      sort: backlogItems.sort,
      mapSort: backlogItems.mapSort,
      number: backlogItems.number,
    })
    .from(backlogItems)
    .where(and(eq(backlogItems.boardId, boardId), eq(backlogItems.level, "feature")))
    .orderBy(asc(backlogItems.sort), asc(backlogItems.number));
  const mapped = lane
    .filter((f) => f.mapSort !== null)
    .sort((a, b) => a.mapSort! - b.mapSort! || a.number - b.number);
  const mappedIds = new Set(mapped.map((f) => f.id));
  let cursor = 0;
  const target = lane.map((f) => (mappedIds.has(f.id) ? mapped[cursor++]! : f));
  const changes: Array<{ id: string; sort: number }> = [];
  target.forEach((f, index) => {
    const sort = (index + 1) * STEP;
    if (f.sort !== sort) changes.push({ id: f.id, sort });
  });
  if (changes.length === 0) return 0;
  for (const change of changes) {
    await tx.update(backlogItems).set({ sort: change.sort }).where(eq(backlogItems.id, change.id));
  }
  await recordEvent(
    tx,
    ctx,
    board.id,
    "backlog.aligned",
    { count: changes.length },
    {
      undo: {
        kind: "items.order",
        boardId: board.id,
        level: "feature",
        order: lane.map((f) => f.id),
      },
    },
  );
  return changes.length;
}
