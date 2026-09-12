"use server";

import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import { closeItem, type CloseOutcome } from "./structure/close";
import {
  AreaUpdateSchema,
  CloseItemSchema,
  ItemIdSchema,
  ItemOrderSchema,
  MapPlaceSchema,
  ItemPlacementSchema,
  ItemUpdateSchema,
  NewAreaSchema,
  NewItemSchema,
  NewThemeSchema,
  ThemeUpdateSchema,
} from "./structure/validation";
import { placeItemInStructure } from "./structure/place-item";
import {
  confirmReview,
  createItem,
  deleteItem,
  reopenItem,
  reorderItem,
  updateItem,
} from "./structure/write-items";
import { createArea, createTheme, updateArea, updateTheme } from "./structure/write-lists";
import { placeOnMap } from "./structure/write-map";

/**
 * Everything a person can do to the backlog structure: epics and
 * features, and the two closed lists. Items are every member's to write;
 * the lists are the shape of the board and take an owner or an admin,
 * like columns. A refused rule comes back as `invalid` with the rule's
 * code in `detail`, so the form can say which field.
 */

export type CreatedItem = { id: string; number: number; boardId: string };

export async function createItemAction(raw: unknown): Promise<Result<CreatedItem>> {
  return action(NewItemSchema, raw, async (tx, ctx, input) => {
    const item = await createItem(tx, ctx, input);
    return { id: item.id, number: item.number, boardId: item.boardId };
  });
}

export async function updateItemAction(raw: unknown): Promise<Result<string>> {
  return action(ItemUpdateSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await updateItem(tx, ctx, input));
    touch(item.boardId);
    return item.boardId;
  });
}

export async function placeItemAction(raw: unknown): Promise<Result<string>> {
  return action(ItemPlacementSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await placeItemInStructure(tx, ctx, input));
    touch(item.boardId);
    return item.boardId;
  });
}

export async function reorderItemAction(raw: unknown): Promise<Result<string>> {
  return action(ItemOrderSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await reorderItem(tx, input.itemId, input.siblingId, input.after));
    touch(item.boardId);
    return item.boardId;
  });
}

/** A feature up on the story map at a place, or down from it. */
export async function placeOnMapAction(raw: unknown): Promise<Result<string>> {
  return action(MapPlaceSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await placeOnMap(tx, ctx, input.itemId, input.index));
    touch(item.boardId);
    return item.boardId;
  });
}

/** Without a plan: the open children, if any. With one: closed, or `invalid` with `openChildren`. */
export async function closeItemAction(raw: unknown): Promise<Result<CloseOutcome>> {
  return action(CloseItemSchema, raw, async (tx, ctx, input) =>
    found(await closeItem(tx, ctx, input.itemId, input.plan)),
  );
}

export async function reopenItemAction(raw: unknown): Promise<Result<string>> {
  return action(ItemIdSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await reopenItem(tx, ctx, input.itemId));
    touch(item.boardId);
    return item.boardId;
  });
}

export async function confirmReviewAction(raw: unknown): Promise<Result<string>> {
  return action(ItemIdSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await confirmReview(tx, ctx, input.itemId));
    touch(item.boardId);
    return item.boardId;
  });
}

export async function deleteItemAction(raw: unknown): Promise<Result<string>> {
  return action(
    ItemIdSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const item = found(await deleteItem(tx, ctx, input.itemId));
      touch(item.boardId);
      return item.boardId;
    },
    { manage: true },
  );
}

export async function createThemeAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewThemeSchema,
    raw,
    async (tx, ctx, input) => (await createTheme(tx, ctx, input)).id,
    { manage: true },
  );
}

export async function updateThemeAction(raw: unknown): Promise<Result<string>> {
  return action(
    ThemeUpdateSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const theme = found(await updateTheme(tx, ctx, input));
      touch(theme.boardId);
      return theme.id;
    },
    { manage: true },
  );
}

export async function createAreaAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewAreaSchema,
    raw,
    async (tx, ctx, input) => (await createArea(tx, ctx, input)).id,
    { manage: true },
  );
}

export async function updateAreaAction(raw: unknown): Promise<Result<string>> {
  return action(
    AreaUpdateSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const area = found(await updateArea(tx, ctx, input));
      touch(area.boardId);
      return area.id;
    },
    { manage: true },
  );
}
