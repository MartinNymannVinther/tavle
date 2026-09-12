"use server";

import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import {
  BoardIdSchema,
  BoardMetaSchema,
  BoardViewSchema,
  ColumnDeleteSchema,
  ColumnOrderSchema,
  ColumnUpdateSchema,
  NewBoardSchema,
  NewColumnSchema,
} from "./validation";
import {
  createBoard,
  createColumn,
  deleteBoard,
  deleteColumn,
  reorderColumns,
  setBoardArchived,
  updateBoard,
  updateColumn,
  updateStructureView,
} from "./write-boards";

/**
 * Everything a person can do to a board itself. Each action is four
 * lines by design: the guard, the schema, the service, the refresh.
 * Creating a board is open to every member; changing its shape — columns,
 * archiving, deleting — is for owners and admins, because it changes what
 * the whole team works inside. Themes and areas are in actions-structure.
 */

export async function createBoardAction(raw: unknown): Promise<Result<string>> {
  return action(NewBoardSchema, raw, async (tx, ctx, input, touch) => {
    const board = await createBoard(tx, ctx, input);
    touch(board.id);
    return board.id;
  });
}

export async function updateBoardAction(raw: unknown): Promise<Result<string>> {
  return action(
    BoardMetaSchema,
    raw,
    async (tx, ctx, input) => found(await updateBoard(tx, ctx, input.boardId, input)).id,
    { manage: true },
  );
}

export async function updateStructureViewAction(raw: unknown): Promise<Result<string>> {
  return action(
    BoardViewSchema,
    raw,
    async (tx, ctx, input) => found(await updateStructureView(tx, ctx, input.boardId, input)).id,
    { manage: true },
  );
}

export async function archiveBoardAction(raw: unknown): Promise<Result<string>> {
  return action(
    BoardIdSchema,
    raw,
    async (tx, ctx, input) => found(await setBoardArchived(tx, input.boardId, true)).id,
    { manage: true },
  );
}

export async function restoreBoardAction(raw: unknown): Promise<Result<string>> {
  return action(
    BoardIdSchema,
    raw,
    async (tx, ctx, input) => found(await setBoardArchived(tx, input.boardId, false)).id,
    { manage: true },
  );
}

export async function deleteBoardAction(raw: unknown): Promise<Result<string>> {
  return action(
    BoardIdSchema,
    raw,
    async (tx, ctx, input) => found(await deleteBoard(tx, input.boardId)).id,
    { manage: true },
  );
}

export async function createColumnAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewColumnSchema,
    raw,
    async (tx, ctx, input) => found(await createColumn(tx, ctx, input)).id,
    { manage: true },
  );
}

export async function updateColumnAction(raw: unknown): Promise<Result<string>> {
  return action(
    ColumnUpdateSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const column = found(await updateColumn(tx, ctx, input));
      touch(column.boardId);
      return column.id;
    },
    { manage: true },
  );
}

export async function reorderColumnsAction(raw: unknown): Promise<Result<boolean>> {
  return action(
    ColumnOrderSchema,
    raw,
    async (tx, ctx, input) =>
      found((await reorderColumns(tx, input.boardId, input.columnIds)) || null),
    { manage: true },
  );
}

export async function deleteColumnAction(raw: unknown): Promise<Result<string>> {
  return action(
    ColumnDeleteSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const column = found(await deleteColumn(tx, ctx, input.columnId, input.moveCardsTo));
      touch(column.boardId);
      return column.id;
    },
    { manage: true },
  );
}
