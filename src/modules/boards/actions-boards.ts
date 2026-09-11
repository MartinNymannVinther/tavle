"use server";

import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import {
  BoardIdSchema,
  BoardMetaSchema,
  ColumnDeleteSchema,
  ColumnOrderSchema,
  ColumnUpdateSchema,
  LabelUpdateSchema,
  NewBoardSchema,
  NewColumnSchema,
  NewLabelSchema,
} from "./validation";
import {
  createBoard,
  createColumn,
  createLabel,
  deleteBoard,
  deleteColumn,
  deleteLabel,
  reorderColumns,
  setBoardArchived,
  updateBoard,
  updateColumn,
  updateLabel,
} from "./write-boards";
import { z } from "zod";

/**
 * Everything a person can do to a board itself. Each action is four
 * lines by design: the guard, the schema, the service, the refresh.
 * Creating a board is open to every member; changing its shape — columns,
 * labels, archiving, deleting — is for owners and admins, because it
 * changes what the whole team works inside.
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

export async function createLabelAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewLabelSchema,
    raw,
    async (tx, ctx, input) => found(await createLabel(tx, ctx, input)).id,
    { manage: true },
  );
}

export async function updateLabelAction(raw: unknown): Promise<Result<string>> {
  return action(
    LabelUpdateSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const label = found(await updateLabel(tx, input));
      touch(label.boardId);
      return label.id;
    },
    { manage: true },
  );
}

export async function deleteLabelAction(raw: unknown): Promise<Result<string>> {
  return action(
    z.object({ labelId: z.string().min(1).max(64) }),
    raw,
    async (tx, ctx, input, touch) => {
      const label = found(await deleteLabel(tx, ctx, input.labelId));
      touch(label.boardId);
      return label.id;
    },
    { manage: true },
  );
}
