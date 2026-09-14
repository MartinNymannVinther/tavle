"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import type { Result } from "@/core/result";
import { action, found } from "@/modules/boards/action-helpers";
import { id, shortText } from "@/modules/boards/validation";
import { QUARTER_PATTERN } from "@/core/db/schema";
import type { ProposalResult } from "./actions";
import { proposeBootstrap, type BootstrapProposal } from "./bootstrap";
import { applyBootstrap } from "./bootstrap-apply";
import { classifyAiError } from "./service";

/**
 * The starting point, as propose and apply (docs/adr/0021). The propose
 * action carries the team's prose to the model; the apply action writes
 * the tree the person pruned, through the ordinary services, and takes
 * an owner or admin because it shapes the whole board's structure.
 */

const ProposeSchema = z.object({
  boardId: id,
  description: shortText(4000).min(20),
  horizonQuarters: z.number().int().min(1).max(8),
  focus: shortText(300),
});

export async function proposeBootstrapAction(
  raw: unknown,
): Promise<ProposalResult<BootstrapProposal>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = ProposeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const { boardId, ...input } = parsed.data;
    const result = await proposeBootstrap(ctx, boardId, input, await getLocale());
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}

const quarter = z.string().regex(QUARTER_PATTERN);

const ApplySchema = z.object({
  boardId: id,
  engine: shortText(80),
  areas: z.array(shortText(40).min(1)).max(5),
  themes: z.array(shortText(40).min(1)).max(5),
  epics: z
    .array(
      z.object({
        title: shortText(160).min(1),
        doneWhen: shortText(500),
        targetQuarter: quarter.nullable(),
        area: shortText(40),
        themes: z.array(shortText(40)).max(5),
        features: z
          .array(
            z.object({
              title: shortText(160).min(1),
              doneWhen: shortText(500),
              cards: z.array(z.object({ title: shortText(160).min(1) })).max(5),
            }),
          )
          .max(4),
      }),
    )
    .min(1)
    .max(5),
});

export async function applyBootstrapAction(raw: unknown): Promise<Result<string>> {
  return action(
    ApplySchema,
    raw,
    async (tx, ctx, input, touch) => {
      const done = found(await applyBootstrap(tx, ctx, input));
      touch(done.boardId);
      return done.boardId;
    },
    { manage: true },
  );
}
