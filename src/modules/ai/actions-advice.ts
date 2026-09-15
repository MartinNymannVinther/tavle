"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import { id } from "@/modules/boards/validation";
import {
  proposeCloseDecisions,
  proposeReviewBrief,
  type CloseAdviceItem,
  type ReviewBrief,
} from "./advice";
import type { ProposalResult } from "./actions";
import { classifyAiError } from "./service";

/**
 * The counsel's actions (docs/adr/0026): both are pure reads. The close
 * advice only pre-sets a dialog the person still confirms through the
 * ordinary close action, and the review brief is never applied at all.
 */

const ItemRef = z.object({ itemId: id });

export async function proposeCloseAdviceAction(
  raw: unknown,
): Promise<ProposalResult<CloseAdviceItem[]>> {
  return advise(raw, proposeCloseDecisions);
}

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
