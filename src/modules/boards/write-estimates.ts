import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { boards, cards, sprints, type Board, type EstimateUnit } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "./events";
import { boardInWorkspace } from "./read";
import { conversionTable, convert, convertTotal, scaleOf, type EstimateChange } from "./estimates";

/**
 * Changing what a board counts in (docs/adr/0030). The unit is written
 * on the board; the numbers on the cards are rewritten only when the
 * scale actually changes, and then through a table the person has seen
 * and said yes to. The whole "before" travels in the event's reverse,
 * so one Fortryd puts every estimate back.
 *
 * Closed sprints carry their commitment and velocity as frozen numbers.
 * Crossing between points and hours scales those too — otherwise the
 * velocity chart would draw two units on one axis — while a move
 * between points and sizes leaves them alone, because a size is a
 * label on the very weight they already hold.
 */

export type EstimatePlan = {
  boardId: string;
  unit: EstimateUnit;
  /** Hours one point stands for; only read when the change crosses scales. */
  hoursPerPoint: number;
};

export type EstimatePreview = {
  board: Board;
  table: EstimateChange[];
  /** True when the switch rewrites numbers rather than only the words on them. */
  rewrites: boolean;
};

/** What the switch would do, computed from the board's own cards. Writes nothing. */
export async function previewEstimateUnit(
  tx: AppTransaction,
  boardId: string,
  unit: EstimateUnit,
  hoursPerPoint: number,
): Promise<EstimatePreview | null> {
  const board = await boardInWorkspace(tx, boardId);
  if (!board) return null;
  const rows = await tx
    .select({ estimate: cards.estimate })
    .from(cards)
    .where(and(eq(cards.boardId, boardId), isNotNull(cards.estimate)));
  const from = board.estimateUnit as EstimateUnit;
  const table = conversionTable(
    rows.map((r) => r.estimate),
    from,
    unit,
    hoursPerPoint,
  );
  return { board, table, rewrites: scaleOf(from) !== scaleOf(unit) || unit === "tshirt" };
}

export async function setEstimateUnit(
  tx: AppTransaction,
  ctx: OrgContext,
  plan: EstimatePlan,
): Promise<Board | null> {
  const board = await boardInWorkspace(tx, plan.boardId);
  if (!board) return null;
  const from = board.estimateUnit as EstimateUnit;
  if (from === plan.unit) return board;

  const cardRows = await tx
    .select({ id: cards.id, estimate: cards.estimate })
    .from(cards)
    .where(and(eq(cards.boardId, plan.boardId), isNotNull(cards.estimate)));

  // The reverse is written before anything moves, from what is still true.
  const before = cardRows.map((row) => ({ cardId: row.id, estimate: row.estimate }));
  const crossesScales = scaleOf(from) !== scaleOf(plan.unit);

  let moved = 0;
  for (const row of cardRows) {
    const next = convert(row.estimate!, from, plan.unit, plan.hoursPerPoint);
    if (next === row.estimate) continue;
    await tx.update(cards).set({ estimate: next }).where(eq(cards.id, row.id));
    moved += 1;
  }

  // A closed sprint's written-down numbers are the velocity record; they
  // follow only when the scale itself moves under them.
  const sprintRows = crossesScales
    ? await tx
        .select({
          id: sprints.id,
          committedPoints: sprints.committedPoints,
          completedPoints: sprints.completedPoints,
        })
        .from(sprints)
        .where(and(eq(sprints.boardId, plan.boardId), inArray(sprints.state, ["active", "closed"])))
    : [];
  const sprintsBefore = sprintRows.map((row) => ({
    sprintId: row.id,
    committedPoints: row.committedPoints,
    completedPoints: row.completedPoints,
  }));
  for (const row of sprintRows) {
    // A total scales; it is never snapped onto the card ladder.
    const committedPoints =
      row.committedPoints === null
        ? null
        : convertTotal(row.committedPoints, from, plan.unit, plan.hoursPerPoint);
    const completedPoints =
      row.completedPoints === null
        ? null
        : convertTotal(row.completedPoints, from, plan.unit, plan.hoursPerPoint);
    if (committedPoints === row.committedPoints && completedPoints === row.completedPoints)
      continue;
    await tx
      .update(sprints)
      .set({ committedPoints, completedPoints })
      .where(eq(sprints.id, row.id));
  }

  await tx.update(boards).set({ estimateUnit: plan.unit }).where(eq(boards.id, plan.boardId));
  await recordEvent(
    tx,
    ctx,
    plan.boardId,
    "board.estimateUnit",
    { unit: plan.unit, cards: moved },
    {
      undo: {
        kind: "board.estimates",
        boardId: plan.boardId,
        unit: from,
        cards: before,
        sprints: sprintsBefore,
      },
    },
  );
  return board;
}

/** Puts the unit and every number back exactly as the reverse recorded them. */
export async function restoreEstimates(
  tx: AppTransaction,
  ctx: OrgContext,
  step: {
    boardId: string;
    unit: EstimateUnit;
    cards: Array<{ cardId: string; estimate: number | null }>;
    sprints: Array<{
      sprintId: string;
      committedPoints: number | null;
      completedPoints: number | null;
    }>;
  },
): Promise<Board | null> {
  const board = await boardInWorkspace(tx, step.boardId);
  if (!board) return null;
  for (const row of step.cards) {
    await tx.update(cards).set({ estimate: row.estimate }).where(eq(cards.id, row.cardId));
  }
  for (const row of step.sprints) {
    await tx
      .update(sprints)
      .set({ committedPoints: row.committedPoints, completedPoints: row.completedPoints })
      .where(eq(sprints.id, row.sprintId));
  }
  await tx.update(boards).set({ estimateUnit: step.unit }).where(eq(boards.id, step.boardId));
  await recordEvent(tx, ctx, step.boardId, "board.estimateUnit", {
    unit: step.unit,
    cards: step.cards.length,
  });
  return board;
}
