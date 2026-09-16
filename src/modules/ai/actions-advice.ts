"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { id } from "@/modules/boards/validation";
import { proposeReviewBrief, type ReviewBrief } from "./advice";
import type { ProposalResult } from "./wire";
import { classifyAiError } from "./service";

/**
 * The counsel's actions (docs/adr/0026). The review brief is a read that
 * is never applied at all; it stays an action because the button that
 * asks for it waits for it and nothing else is in flight. The close
 * advice went the other way, onto `POST /api/ai/close-advice`, because a
 * dialog that is thinking must not hold back the close itself
 * (docs/adr/0034).
 */

const ItemRef = z.object({ itemId: id });

export async function proposeReviewBriefAction(raw: unknown): Promise<ProposalResult<ReviewBrief>> {
  return advise(raw, proposeReviewBrief);
}

async function advise<T>(
  raw: unknown,
  fn: (
    ctx: NonNullable<Awaited<ReturnType<typeof requireOrgContext>>>,
    itemId: string,
    locale: string,
  ) => Promise<{ proposal: T; engine: string } | null>,
): Promise<ProposalResult<T>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = ItemRef.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await fn(ctx, parsed.data.itemId, await getLocale());
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}
