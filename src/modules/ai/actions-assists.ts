"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import type { Result } from "@/core/result";
import { action, found } from "@/modules/boards/action-helpers";
import { updateItem } from "@/modules/boards/structure/write-items";
import { id, isoDate, shortText } from "@/modules/boards/validation";
import { updateSprint } from "@/modules/boards/write-sprints";
import { proposeDoneWhen, proposeSprintGoal } from "./assists";
import type { ProposalResult } from "./wire";
import { classifyAiError } from "./service";

/**
 * The quiet assists' actions (docs/adr/0025). The done-when and the
 * sprint goal follow the house pair — propose, then apply through the
 * ordinary service marked as the AI's work; both are asked for by a
 * button the person then waits at. The quick assist is not here: it is
 * asked while the person is typing and must not queue behind anything,
 * so it went to `POST /api/ai/quick-assist` (docs/adr/0034).
 */

const DoneWhenRef = z.object({ itemId: id });

export async function proposeDoneWhenAction(raw: unknown): Promise<ProposalResult<string>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = DoneWhenRef.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await proposeDoneWhen(ctx, parsed.data.itemId, await getLocale());
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}

const ApplyDoneWhenSchema = z.object({ itemId: id, doneWhen: shortText(500).min(1) });

/** Writes the done-when the person kept, marked as the AI's work in the feed. */
export async function applyDoneWhenAction(raw: unknown): Promise<Result<string>> {
  return action(ApplyDoneWhenSchema, raw, async (tx, ctx, input, touch) => {
    const item = found(
      await updateItem(tx, ctx, { itemId: input.itemId, doneWhen: input.doneWhen }, "ai"),
    );
    touch(item.boardId);
    return item.boardId;
  });
}

const SprintGoalRef = z.object({ sprintId: id });

export async function proposeSprintGoalAction(raw: unknown): Promise<ProposalResult<string>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = SprintGoalRef.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await proposeSprintGoal(ctx, parsed.data.sprintId, await getLocale());
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}

const ApplySprintGoalSchema = z.object({
  sprintId: id,
  name: shortText(80).min(1),
  goal: shortText(500).min(1),
  startDate: isoDate,
  endDate: isoDate,
});

/** Saves the sprint with the goal the person kept, marked as the AI's work. */
export async function applySprintGoalAction(raw: unknown): Promise<Result<string>> {
  return action(ApplySprintGoalSchema, raw, async (tx, ctx, input, touch) => {
    const sprint = found(await updateSprint(tx, ctx, input, "ai"));
    touch(sprint.boardId);
    return sprint.boardId;
  });
}
