"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import type { Result } from "@/core/result";
import { action, found } from "@/modules/boards/action-helpers";
import { updateItem } from "@/modules/boards/structure/write-items";
import { id, shortText } from "@/modules/boards/validation";
import { proposeDoneWhen, proposeQuickAssist, type QuickAssist } from "./assists";
import type { ProposalResult } from "./actions";
import { classifyAiError, modelConfigured } from "./service";

/**
 * The quiet assists' actions (docs/adr/0025). The done-when follows the
 * house pair — propose, then apply through the ordinary service marked
 * as the AI's work. The quick assist has no apply at all: it moves a
 * select and shows a line, and creating the card stays the person's own
 * act through the ordinary create action.
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

const QuickAssistRef = z.object({ boardId: id, title: shortText(200).min(8) });

export async function proposeQuickAssistAction(raw: unknown): Promise<ProposalResult<QuickAssist>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = QuickAssistRef.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  // Honest and cheap: without a model the client learns it once and goes
  // quiet, instead of paying a model timeout per typed title.
  if (!(await modelConfigured(ctx))) return { ok: false, error: "noModel" };
  try {
    const result = await proposeQuickAssist(
      ctx,
      parsed.data.boardId,
      parsed.data.title,
      await getLocale(),
    );
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}
