import { and, eq, inArray } from "drizzle-orm";
import { backlogItems, sprints, type BacklogItem, type Sprint } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "../events";
import { boardInWorkspace } from "../read";
import { itemInWorkspace } from "./items";

/**
 * A feature's planned span on the sprint axis (docs/adr/0023): from one
 * sprint to another, both the board's own, swapped quietly when drawn
 * the wrong way round — the same grace the epics' quarters get. Null is
 * unplanned; one end alone means one sprint. The plan is a marker for
 * the roadmap's feature view; it commits no card to anything.
 */
export async function planFeature(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { itemId: string; startSprintId: string | null; targetSprintId: string | null },
): Promise<BacklogItem | null> {
  const item = await itemInWorkspace(tx, input.itemId);
  if (!item) return null;
  if (item.level !== "feature") throw new Error("invalid");
  const board = (await boardInWorkspace(tx, item.boardId))!;

  let start = input.startSprintId ?? input.targetSprintId;
  let target = input.targetSprintId ?? input.startSprintId;
  let rows: Sprint[] = [];
  if (start && target) {
    const ids = [...new Set([start, target])];
    rows = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, board.id), inArray(sprints.id, ids)));
    if (rows.length !== ids.length) throw new Error("notFound");
    const of = new Map(rows.map((s) => [s.id, s]));
    if (of.get(start)!.startDate > of.get(target)!.startDate) [start, target] = [target, start];
  }

  if (item.startSprintId === start && item.targetSprintId === target) return item;
  await tx
    .update(backlogItems)
    .set({ startSprintId: start, targetSprintId: target })
    .where(eq(backlogItems.id, item.id));
  const nameOf = new Map(rows.map((s) => [s.id, s.name]));
  await recordEvent(
    tx,
    ctx,
    item.boardId,
    "item.planned",
    {
      key: `${board.key}-${item.number}`,
      title: item.title,
      from: start ? (nameOf.get(start) ?? "") : "none",
      to: target ? (nameOf.get(target) ?? "") : "none",
    },
    {
      itemId: item.id,
      undo: {
        kind: "item.plan",
        itemId: item.id,
        startSprintId: item.startSprintId,
        targetSprintId: item.targetSprintId,
      },
    },
  );
  return item;
}
