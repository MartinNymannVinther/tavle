import { and, count, eq, sql } from "drizzle-orm";
import { cards, swimlanes, type Card, type Swimlane } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "./events";
import { boardInWorkspace, boardThemes } from "./read";
import { NameTaken } from "./structure/write-lists";
import { cardThemeIds, placeCardInStructure } from "./structure/write-card-placement";
import { laneKeyOf } from "./structure/swimlanes";
import type { SwimlaneAssignment } from "./validation";
import { updateCard } from "./write-cards";

/**
 * Manual swimlanes (docs/adr/0017): the rows a Kanban board names itself,
 * and what a drop across any lane writes on the card. Like the closed
 * lists, a lane is deactivated rather than deleted, so its name survives
 * in the history and the cards in it keep standing where they stood.
 */

export const MAX_ACTIVE_SWIMLANES = 12;

async function activeLaneCount(tx: AppTransaction, boardId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(swimlanes)
    .where(and(eq(swimlanes.boardId, boardId), eq(swimlanes.active, true)));
  return Number(row?.n ?? 0);
}

async function laneNameFree(
  tx: AppTransaction,
  boardId: string,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: swimlanes.id })
    .from(swimlanes)
    .where(and(eq(swimlanes.boardId, boardId), sql`lower(${swimlanes.name}) = lower(${name})`));
  return rows.every((row) => row.id === exceptId);
}

export async function createSwimlane(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; name: string },
): Promise<Swimlane> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) throw new Error("notFound");
  if (!(await laneNameFree(tx, board.id, input.name))) throw new NameTaken();
  if ((await activeLaneCount(tx, board.id)) >= MAX_ACTIVE_SWIMLANES) throw new Error("invalid");
  const [row] = await tx
    .insert(swimlanes)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      name: input.name,
      sort: await activeLaneCount(tx, board.id),
    })
    .returning();
  await recordEvent(
    tx,
    ctx,
    board.id,
    "swimlane.created",
    { name: input.name },
    { undo: { kind: "swimlane.active", swimlaneId: row!.id, active: false } },
  );
  return row!;
}

export async function updateSwimlane(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { swimlaneId: string; name: string; active: boolean },
): Promise<Swimlane | null> {
  const [lane] = await tx
    .select()
    .from(swimlanes)
    .where(eq(swimlanes.id, input.swimlaneId))
    .limit(1);
  if (!lane) return null;
  if (!(await laneNameFree(tx, lane.boardId, input.name, lane.id))) throw new NameTaken();
  if (input.active && !lane.active) {
    if ((await activeLaneCount(tx, lane.boardId)) >= MAX_ACTIVE_SWIMLANES) {
      throw new Error("invalid");
    }
  }
  await tx
    .update(swimlanes)
    .set({ name: input.name, active: input.active })
    .where(eq(swimlanes.id, lane.id));
  // A lane has only its name, so a change to it is a rename — and the
  // settings page promises a Fortryd on every change to the board's
  // shape. Without this line the rename had no event and no reverse.
  if (lane.name !== input.name) {
    await recordEvent(
      tx,
      ctx,
      lane.boardId,
      "swimlane.updated",
      { name: input.name, from: lane.name },
      { undo: { kind: "swimlane.update", swimlaneId: lane.id, name: lane.name } },
    );
  }
  if (lane.active !== input.active) {
    await recordEvent(
      tx,
      ctx,
      lane.boardId,
      input.active ? "swimlane.activated" : "swimlane.deactivated",
      { name: input.name },
      { undo: { kind: "swimlane.active", swimlaneId: lane.id, active: lane.active } },
    );
  }
  return lane;
}

/**
 * What a drop across swimlanes writes, refused unless it names the very
 * grouping the board runs with — a stale client cannot set a field the
 * board does not group by. Kind and placement go through the same
 * services every other page uses, so their rules and events hold here
 * too; only the manual lane is this module's own field.
 */
export async function applySwimlaneAssignment(
  tx: AppTransaction,
  ctx: OrgContext,
  card: Pick<Card, "id" | "boardId" | "number" | "title" | "kind" | "areaId" | "swimlaneId">,
  assignment: SwimlaneAssignment,
): Promise<void> {
  const board = await boardInWorkspace(tx, card.boardId);
  if (!board || board.mode !== "kanban" || board.swimlaneBy !== assignment.by) {
    throw new Error("invalid");
  }
  switch (assignment.by) {
    case "kind":
      await updateCard(tx, ctx, card.id, { kind: assignment.kind });
      return;
    case "area":
      await placeCardInStructure(tx, ctx, { cardId: card.id, areaId: assignment.areaId });
      return;
    case "theme": {
      const themes = await boardThemes(tx, board.id);
      const themeIds = await cardThemeIds(tx, card.id);
      const top = laneKeyOf({ ...card, themeIds }, "theme", themes);
      await placeCardInStructure(tx, ctx, {
        cardId: card.id,
        themeIds: [
          assignment.themeId,
          ...themeIds.filter((id) => id !== top && id !== assignment.themeId),
        ],
      });
      return;
    }
    case "manual": {
      let lane: Swimlane | null = null;
      if (assignment.swimlaneId) {
        const [row] = await tx
          .select()
          .from(swimlanes)
          .where(and(eq(swimlanes.id, assignment.swimlaneId), eq(swimlanes.boardId, board.id)))
          .limit(1);
        if (!row) throw new Error("notFound");
        if (!row.active) throw new Error("invalid");
        lane = row;
      }
      if (card.swimlaneId === assignment.swimlaneId) return;
      await tx
        .update(cards)
        .set({ swimlaneId: assignment.swimlaneId })
        .where(eq(cards.id, card.id));
      await recordEvent(
        tx,
        ctx,
        board.id,
        "card.swimlane",
        // "none" is the sentence's own sentinel for the lane-less row, not a name.
        { key: `${board.key}-${card.number}`, title: card.title, lane: lane?.name ?? "none" },
        {
          cardId: card.id,
          undo: { kind: "card.swimlane", cardId: card.id, swimlaneId: card.swimlaneId },
        },
      );
      return;
    }
  }
}
