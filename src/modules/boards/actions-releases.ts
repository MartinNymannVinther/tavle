"use server";

import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import {
  createRelease,
  deleteRelease,
  reorderRelease,
  setCardsRelease,
  updateRelease,
} from "./write-releases";
import {
  CardsReleaseSchema,
  NewReleaseSchema,
  ReleaseIdSchema,
  ReleaseOrderSchema,
  ReleaseUpdateSchema,
} from "./validation";

/**
 * The releases' actions (docs/adr/0032). Making, naming, ordering and
 * removing a band changes the shape of the board, so those take an
 * owner or an admin like every other shape change. Putting a card in a
 * release is ordinary work and takes anybody on the team — it is the
 * same move as dragging it into a sprint.
 */

export async function createReleaseAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewReleaseSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const release = found(await createRelease(tx, ctx, input));
      touch(input.boardId);
      return release.id;
    },
    { manage: true },
  );
}

export async function updateReleaseAction(raw: unknown): Promise<Result<string>> {
  return action(
    ReleaseUpdateSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const release = found(await updateRelease(tx, ctx, input));
      touch(release.boardId);
      return release.id;
    },
    { manage: true },
  );
}

export async function reorderReleaseAction(raw: unknown): Promise<Result<string>> {
  return action(
    ReleaseOrderSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const release = found(await reorderRelease(tx, ctx, input.releaseId, input.index));
      touch(release.boardId);
      return release.id;
    },
    { manage: true },
  );
}

export async function deleteReleaseAction(raw: unknown): Promise<Result<string>> {
  return action(
    ReleaseIdSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const release = found(await deleteRelease(tx, ctx, input.releaseId));
      touch(release.boardId);
      return release.id;
    },
    { manage: true },
  );
}

/** A card into a release, or out of one; the map's own drag. */
export async function setCardsReleaseAction(raw: unknown): Promise<Result<number>> {
  return action(CardsReleaseSchema, raw, async (tx, ctx, input) =>
    setCardsRelease(tx, ctx, input.cardIds, input.releaseId),
  );
}
