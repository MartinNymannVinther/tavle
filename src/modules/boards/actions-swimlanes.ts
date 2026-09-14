"use server";

import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import { NewSwimlaneSchema, SwimlaneUpdateSchema } from "./validation";
import { createSwimlane, updateSwimlane } from "./write-swimlanes";

/**
 * The manual swimlanes, managed like the closed lists: naming, renaming
 * and deactivating a lane changes what the whole team works inside, so
 * both actions take an owner or an admin.
 */

export async function createSwimlaneAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewSwimlaneSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const lane = await createSwimlane(tx, ctx, input);
      touch(lane.boardId);
      return lane.id;
    },
    { manage: true },
  );
}

export async function updateSwimlaneAction(raw: unknown): Promise<Result<string>> {
  return action(
    SwimlaneUpdateSchema,
    raw,
    async (tx, ctx, input, touch) => {
      const lane = found(await updateSwimlane(tx, ctx, input));
      touch(lane.boardId);
      return lane.id;
    },
    { manage: true },
  );
}
