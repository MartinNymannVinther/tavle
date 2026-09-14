import { asc, eq } from "drizzle-orm";
import {
  boards,
  cards,
  columns,
  type Board,
  type BoardMode,
  type Column,
  type ColumnCategory,
} from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { DEFAULT_COLUMNS, DEFAULT_SPRINT_LENGTH_DAYS } from "./defaults";
import { recordEvent } from "./events";
import { columnInBoard, columnsOf } from "./lanes";
import { boardInWorkspace } from "./read";
import { createArea } from "./structure/write-lists";
import { enterColumn } from "./transitions";
import type { StructureViewInput } from "./validation";

/**
 * Boards and their columns. A board starts with the columns its mode
 * needs and the one area the team named when creating it — never a
 * "Diverse" of the tool's own making — and all of it is the team's to
 * rename, reorder and remove afterwards.
 */

export class KeyTaken extends Error {
  constructor() {
    super("conflict");
    this.name = "KeyTaken";
  }
}

export async function createBoard(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    name: string;
    key: string;
    mode: BoardMode;
    description?: string;
    firstArea: string;
  } & Partial<StructureViewInput>,
): Promise<Board> {
  const [taken] = await tx
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.key, input.key))
    .limit(1);
  if (taken) throw new KeyTaken();
  const [board] = await tx
    .insert(boards)
    .values({
      orgId: ctx.orgId,
      name: input.name,
      key: input.key,
      mode: input.mode,
      description: input.description ?? "",
      sprintLengthDays: DEFAULT_SPRINT_LENGTH_DAYS,
      structureLevels: input.structureLevels ?? "epic",
      showKind: input.showKind ?? true,
      showThemes: input.showThemes ?? true,
      showAreas: input.showAreas ?? true,
      swimlaneBy: input.mode === "kanban" ? (input.swimlaneBy ?? "none") : "none",
      createdBy: ctx.userId,
    })
    .returning();
  await tx.insert(columns).values(
    DEFAULT_COLUMNS[input.mode].map((seed, i) => ({
      orgId: ctx.orgId,
      boardId: board!.id,
      name: seed.name,
      category: seed.category,
      wipLimit: seed.wipLimit,
      sort: i,
    })),
  );
  await recordEvent(tx, ctx, board!.id, "board.created", { name: input.name, mode: input.mode });
  await createArea(tx, ctx, { boardId: board!.id, name: input.firstArea });
  return board!;
}

export async function updateBoard(
  tx: AppTransaction,
  ctx: OrgContext,
  boardId: string,
  input: { name: string; description: string; sprintLengthDays: number; epicReviewDays: number },
): Promise<Board | null> {
  const board = await boardInWorkspace(tx, boardId);
  if (!board) return null;
  await tx.update(boards).set(input).where(eq(boards.id, boardId));
  await recordEvent(tx, ctx, boardId, "board.updated", { name: input.name });
  return board;
}

/**
 * How much of the structure the board shows. A way of looking, written
 * on the board and nowhere else: no item, theme or area is touched, so
 * what is switched off comes back whole when it is switched on.
 */
export async function updateStructureView(
  tx: AppTransaction,
  ctx: OrgContext,
  boardId: string,
  input: StructureViewInput,
): Promise<Board | null> {
  const board = await boardInWorkspace(tx, boardId);
  if (!board) return null;
  // Swimlanes are Kanban's, and a lane cannot group by a field the same
  // choice hides (docs/adr/0017).
  if (input.swimlaneBy !== "none") {
    if (board.mode !== "kanban") throw new Error("invalid");
    if (input.swimlaneBy === "kind" && !input.showKind) throw new Error("invalid");
    if (input.swimlaneBy === "theme" && !input.showThemes) throw new Error("invalid");
    if (input.swimlaneBy === "area" && !input.showAreas) throw new Error("invalid");
  }
  await tx.update(boards).set(input).where(eq(boards.id, boardId));
  await recordEvent(tx, ctx, boardId, "board.view", { levels: input.structureLevels });
  return board;
}

export async function setBoardArchived(
  tx: AppTransaction,
  boardId: string,
  archived: boolean,
): Promise<Board | null> {
  const board = await boardInWorkspace(tx, boardId);
  if (!board) return null;
  await tx
    .update(boards)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(boards.id, boardId));
  return board;
}

/** The whole board, every card and every line of its history. The audit log keeps the images. */
export async function deleteBoard(tx: AppTransaction, boardId: string): Promise<Board | null> {
  const board = await boardInWorkspace(tx, boardId);
  if (!board) return null;
  await tx.delete(boards).where(eq(boards.id, boardId));
  return board;
}

/* ------------------------------ Columns ------------------------------ */

export async function createColumn(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; name: string; category: ColumnCategory; wipLimit: number | null },
): Promise<Column | null> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) return null;
  const existing = await columnsOf(tx, board.id);
  if (existing.length >= 12) throw new Error("invalid");
  const [column] = await tx
    .insert(columns)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      name: input.name,
      category: input.category,
      wipLimit: input.wipLimit,
      sort: existing.length,
    })
    .returning();
  await recordEvent(tx, ctx, board.id, "column.created", { name: input.name });
  return column!;
}

/**
 * Renaming or re-categorising a column. Changing the category moves no
 * card, but it does change what the cards in it mean: the clocks are
 * recomputed for them so a column that becomes "done" finishes what is
 * in it, and one that stops being "done" reopens it.
 */
export async function updateColumn(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { columnId: string; name: string; category: ColumnCategory; wipLimit: number | null },
): Promise<Column | null> {
  const [column] = await tx.select().from(columns).where(eq(columns.id, input.columnId)).limit(1);
  if (!column) return null;
  await tx
    .update(columns)
    .set({ name: input.name, category: input.category, wipLimit: input.wipLimit })
    .where(eq(columns.id, column.id));
  if (input.category !== column.category) {
    const rows = await tx.select().from(cards).where(eq(cards.columnId, column.id));
    for (const card of rows) {
      await enterColumn(tx, ctx, card, column, { id: column.id, category: input.category });
    }
  }
  await recordEvent(tx, ctx, column.boardId, "column.updated", { name: input.name });
  return column;
}

export async function reorderColumns(
  tx: AppTransaction,
  boardId: string,
  columnIds: string[],
): Promise<boolean> {
  const existing = await columnsOf(tx, boardId);
  const known = new Set(existing.map((c) => c.id));
  if (columnIds.length !== existing.length || columnIds.some((id) => !known.has(id))) return false;
  for (const [i, id] of columnIds.entries()) {
    await tx.update(columns).set({ sort: i }).where(eq(columns.id, id));
  }
  return true;
}

/** Removes a column after moving its cards to another one on the same board. */
export async function deleteColumn(
  tx: AppTransaction,
  ctx: OrgContext,
  columnId: string,
  moveCardsTo: string,
): Promise<Column | null> {
  const [column] = await tx.select().from(columns).where(eq(columns.id, columnId)).limit(1);
  if (!column) return null;
  const target = await columnInBoard(tx, column.boardId, moveCardsTo);
  if (!target || target.id === column.id) return null;
  const remaining = await columnsOf(tx, column.boardId);
  if (remaining.length <= 2) throw new Error("invalid");
  const rows = await tx.select().from(cards).where(eq(cards.columnId, column.id));
  for (const card of rows) {
    await enterColumn(tx, ctx, card, column, target);
  }
  await tx.delete(columns).where(eq(columns.id, column.id));
  const rest = remaining.filter((c) => c.id !== column.id);
  for (const [i, c] of rest.entries()) {
    await tx.update(columns).set({ sort: i }).where(eq(columns.id, c.id));
  }
  await recordEvent(tx, ctx, column.boardId, "column.deleted", {
    name: column.name,
    into: target.name,
  });
  return column;
}

export async function boardColumns(tx: AppTransaction, boardId: string) {
  return tx.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.sort));
}
