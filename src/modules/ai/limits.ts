import { and, count, eq, gt, sql } from "drizzle-orm";
import { aiCalls } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";

/**
 * Ceilings on the AI surface. A model call costs money on a hosted
 * installation and minutes on a local one, and a prompt built from a
 * card is a prompt that will one day be built from a card holding a
 * novel. The numbers are generous for a person and mean for a script.
 */
export const MAX_INPUT_CHARS = 6000;
export const MAX_CALLS_PER_USER_PER_HOUR = 60;
export const MAX_CALLS_PER_WORKSPACE_PER_DAY = 600;

export type AiKind = "draft" | "split" | "summary" | "test";

export class RateLimited extends Error {
  constructor() {
    super("rate limited");
    this.name = "RateLimited";
  }
}

/** Counts the call, or refuses it when the caller or the workspace is over the line. */
export async function reserveAiCall(
  tx: AppTransaction,
  ctx: OrgContext,
  kind: AiKind,
  engine: string,
): Promise<void> {
  const [perUser] = await tx
    .select({ n: count() })
    .from(aiCalls)
    .where(
      and(eq(aiCalls.userId, ctx.userId), gt(aiCalls.createdAt, sql`now() - interval '1 hour'`)),
    );
  if (Number(perUser?.n ?? 0) >= MAX_CALLS_PER_USER_PER_HOUR) throw new RateLimited();
  const [perOrg] = await tx
    .select({ n: count() })
    .from(aiCalls)
    .where(and(eq(aiCalls.orgId, ctx.orgId), gt(aiCalls.createdAt, sql`now() - interval '1 day'`)));
  if (Number(perOrg?.n ?? 0) >= MAX_CALLS_PER_WORKSPACE_PER_DAY) throw new RateLimited();
  await tx.insert(aiCalls).values({ orgId: ctx.orgId, userId: ctx.userId, kind, engine });
}

/** Trims and caps user text before it goes anywhere near a prompt. */
export function capText(text: unknown, max: number): string {
  return typeof text === "string" ? text.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}
