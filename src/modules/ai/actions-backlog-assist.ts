"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { QUARTER_PATTERN } from "@/core/db/schema";
import type { Result } from "@/core/result";
import { action, found } from "@/modules/boards/action-helpers";
import { id, shortText } from "@/modules/boards/validation";
import { MAX_INSTRUCTION_CHARS, type ProposalResult } from "./wire";
import { proposeBacklogAssist, ASSIST_LIMITS, type AssistProposal } from "./backlog-assist";
import { applyBacklogAssist } from "./backlog-assist-apply";
import { classifyAiError } from "./service";

/**
 * The assistant, as propose and apply (docs/adr/0037). Unlike the
 * starting point's apply this one takes no manage right: it writes epics,
 * features, cards and text, all of which any member may write by hand,
 * and it cannot touch the board's shape. That is the whole reason the
 * vocabulary stops where it does.
 */

const ProposeSchema = z.object({
  boardId: id,
  instruction: shortText(MAX_INSTRUCTION_CHARS).min(3),
});

export async function proposeBacklogAssistAction(
  raw: unknown,
): Promise<ProposalResult<AssistProposal>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = ProposeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await proposeBacklogAssist(
      ctx,
      parsed.data.boardId,
      parsed.data.instruction,
      await getLocale(),
    );
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}

const itemKey = shortText(40).min(1);
const title = shortText(160).min(1);

const ApplySchema = z.object({
  boardId: id,
  engine: shortText(80),
  epics: z
    .array(
      z.object({
        title,
        doneWhen: shortText(500),
        area: shortText(40),
        themes: z.array(shortText(40)).max(8),
        targetQuarter: z.string().regex(QUARTER_PATTERN).nullable(),
      }),
    )
    .max(ASSIST_LIMITS.epics),
  features: z
    .array(
      z.object({
        title,
        doneWhen: shortText(500),
        parentKey: itemKey,
        parentTitle: shortText(160),
      }),
    )
    .max(ASSIST_LIMITS.features),
  cards: z
    .array(z.object({ title, parentKey: itemKey, parentTitle: shortText(160) }))
    .max(ASSIST_LIMITS.cards),
  edits: z
    .array(
      z.object({
        key: itemKey,
        level: z.enum(["epic", "feature"]),
        title: shortText(160).min(1).nullable(),
        doneWhen: shortText(500).min(1).nullable(),
        currentTitle: shortText(160),
        currentDoneWhen: shortText(500),
        why: shortText(200),
      }),
    )
    .max(ASSIST_LIMITS.edits),
});

export async function applyBacklogAssistAction(raw: unknown): Promise<Result<string>> {
  return action(ApplySchema, raw, async (tx, ctx, input, touch) => {
    const done = found(await applyBacklogAssist(tx, ctx, input));
    touch(done.boardId);
    return done.boardId;
  });
}
