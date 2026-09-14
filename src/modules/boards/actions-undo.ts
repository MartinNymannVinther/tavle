"use server";

import { z } from "zod";
import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import { undoEvent } from "./undo";
import { id } from "./validation";

/**
 * Undo as one action (docs/adr/0022): the event names its own reverse,
 * the service re-checks everything and refuses what can no longer hold,
 * and the undo is written down as a new event. Any member may undo their
 * board's everyday events; the reverses of owner/admin actions carry the
 * owner/admin gate with them, checked in the service.
 */

const UndoRef = z.object({ eventId: id });

export async function undoEventAction(raw: unknown): Promise<Result<string>> {
  return action(UndoRef, raw, async (tx, ctx, input, touch) => {
    const boardId = found(await undoEvent(tx, ctx, input.eventId));
    touch(boardId);
    return boardId;
  });
}
