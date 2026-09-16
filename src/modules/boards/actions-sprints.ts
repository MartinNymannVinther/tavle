"use server";

import type { Result } from "@/core/result";
import { createSprintSeries } from "./write-sprint-series";
import { planFeature } from "./structure/plan-feature";
import { action, found, NotFound } from "./action-helpers";
import { cardInWorkspace } from "./lanes";
import {
  BacklogOrderSchema,
  CardSprintSchema,
  CloseSprintSchema,
  ItemPlanSchema,
  NewSprintSchema,
  SprintSeriesSchema,
  RetroSchema,
  SprintIdSchema,
  SprintSummarySchema,
  SprintUpdateSchema,
} from "./validation";
import {
  closeSprint,
  createSprint,
  reorderBacklog,
  saveRetro,
  saveSummary,
  setCardsSprint,
  startSprint,
  updateSprint,
} from "./write-sprints";

/**
 * The sprint's life: planned, started, closed; and the backlog that feeds
 * it. Any member may plan and run a sprint — that is the team's job, not
 * an administrator's.
 */

export async function createSprintSeriesAction(raw: unknown): Promise<Result<number>> {
  return action(SprintSeriesSchema, raw, async (tx, ctx, input) => {
    const created = await createSprintSeries(tx, ctx, input);
    if (created.length === 0) throw new NotFound();
    return created.length;
  });
}

/** The feature's planned span, from the roadmap's feature view. */
export async function planFeatureAction(raw: unknown): Promise<Result<string>> {
  return action(ItemPlanSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(await planFeature(tx, ctx, input));
    touch(item.boardId);
    return item.id;
  });
}

export async function createSprintAction(raw: unknown): Promise<Result<string>> {
  return action(
    NewSprintSchema,
    raw,
    async (tx, ctx, input) => found(await createSprint(tx, ctx, input)).id,
  );
}

export async function updateSprintAction(raw: unknown): Promise<Result<string>> {
  return action(SprintUpdateSchema, raw, async (tx, ctx, input, touch) => {
    const sprint = found(await updateSprint(tx, ctx, input));
    touch(sprint.boardId);
    return sprint.id;
  });
}

export async function startSprintAction(raw: unknown): Promise<Result<string>> {
  return action(SprintIdSchema, raw, async (tx, ctx, input, touch) => {
    const sprint = found(await startSprint(tx, ctx, input.sprintId));
    touch(sprint.boardId);
    return sprint.id;
  });
}

export async function closeSprintAction(raw: unknown): Promise<Result<string>> {
  return action(CloseSprintSchema, raw, async (tx, ctx, input, touch) => {
    const sprint = found(await closeSprint(tx, ctx, input.sprintId, input.moveUnfinishedTo));
    touch(sprint.boardId);
    return sprint.id;
  });
}

export async function setCardsSprintAction(raw: unknown): Promise<Result<number>> {
  return action(CardSprintSchema, raw, async (tx, ctx, input, touch) => {
    const moved = await setCardsSprint(tx, ctx, input.cardIds, input.sprintId);
    touch((await cardInWorkspace(tx, input.cardIds[0]!))?.boardId);
    return moved;
  });
}

export async function reorderBacklogAction(raw: unknown): Promise<Result<boolean>> {
  return action(BacklogOrderSchema, raw, async (tx, ctx, input, touch) => {
    touch((await cardInWorkspace(tx, input.cardId))?.boardId);
    return found((await reorderBacklog(tx, input.cardId, input.siblingId, input.after)) || null);
  });
}

export async function saveRetroAction(raw: unknown): Promise<Result<string>> {
  return action(RetroSchema, raw, async (tx, ctx, input, touch) => {
    const { sprintId, ...retro } = input;
    const sprint = found(await saveRetro(tx, ctx, sprintId, retro));
    touch(sprint.boardId);
    return sprint.id;
  });
}

export async function saveSummaryAction(raw: unknown): Promise<Result<string>> {
  return action(SprintSummarySchema, raw, async (tx, ctx, input, touch) => {
    const sprint = found(await saveSummary(tx, ctx, input.sprintId, input.summary));
    touch(sprint.boardId);
    return sprint.id;
  });
}
