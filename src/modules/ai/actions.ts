"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireOrgContext } from "@/core/auth/guard";
import type { EnablerType } from "@/core/db/schema";
import { fail, ok, type Result } from "@/core/result";
import { action, found } from "@/modules/boards/action-helpers";
import { recordEvent } from "@/modules/boards/events";
import { cardInWorkspace, laneCards, laneFor, placeCard } from "@/modules/boards/lanes";
import { boardInWorkspace } from "@/modules/boards/read";
import { id, shortText } from "@/modules/boards/validation";
import { updateChecklist } from "@/modules/boards/write-card-details";
import { cardThemeIds } from "@/modules/boards/structure/write-card-placement";
import { createCard, updateCard } from "@/modules/boards/write-cards";
import { saveSummary } from "@/modules/boards/write-sprints";
import { proposeCardDraft, proposeCardSplit, proposeSprintSummary } from "./features";
import type { CardDraft, SplitProposal, SprintSummary } from "./sanitize";
import { classifyAiError, modelConfigured, type AiFailure } from "./service";

/**
 * Proposals and their acceptance, as two separate actions each. The
 * propose action calls the model and answers with what it suggested; the
 * apply action writes what the person kept, through the ordinary services,
 * marked as the AI's work in the event log. Between the two the person
 * can edit every word.
 */

export type ProposalResult<T> =
  | { ok: true; proposal: T; engine: string }
  | { ok: false; error: AiFailure | "unauthorized" | "invalid" | "notFound" };

const CardRef = z.object({ boardId: id, number: z.number().int().min(1) });

export async function proposeDraftAction(raw: unknown): Promise<ProposalResult<CardDraft>> {
  return propose(raw, (ctx, input, locale) =>
    proposeCardDraft(ctx, input.boardId, input.number, locale),
  );
}

export async function proposeSplitAction(raw: unknown): Promise<ProposalResult<SplitProposal[]>> {
  return propose(raw, (ctx, input, locale) =>
    proposeCardSplit(ctx, input.boardId, input.number, locale),
  );
}

const SprintRef = z.object({
  boardId: id,
  sprintId: id,
  number: z.number().int().min(0).optional(),
});

export async function proposeSummaryAction(raw: unknown): Promise<ProposalResult<SprintSummary>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = SprintRef.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await proposeSprintSummary(
      ctx,
      parsed.data.boardId,
      parsed.data.sprintId,
      await getLocale(),
    );
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}

async function propose<T>(
  raw: unknown,
  fn: (
    ctx: NonNullable<Awaited<ReturnType<typeof requireOrgContext>>>,
    input: z.infer<typeof CardRef>,
    locale: string,
  ) => Promise<{ proposal: T; engine: string } | null>,
): Promise<ProposalResult<T>> {
  const ctx = await requireOrgContext();
  if (!ctx) return { ok: false, error: "unauthorized" };
  const parsed = CardRef.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  try {
    const result = await fn(ctx, parsed.data, await getLocale());
    if (!result) return { ok: false, error: "notFound" };
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: classifyAiError(error) };
  }
}

const ApplyDraftSchema = z.object({
  cardId: id,
  description: shortText(8000),
  checklist: z.array(shortText(200).min(1)).max(30),
  engine: shortText(80),
});

/** Writes the draft the person kept: the description as edited, the checklist items appended. */
export async function applyDraftAction(raw: unknown): Promise<Result<string>> {
  return action(ApplyDraftSchema, raw, async (tx, ctx, input, touch) => {
    const card = found(await cardInWorkspace(tx, input.cardId));
    await updateCard(tx, ctx, card.id, { description: input.description }, "ai");
    if (input.checklist.length > 0) {
      const existing = card.checklist;
      const added = input.checklist.map((title, i) => ({
        id: `${Date.now().toString(36)}-${i}`,
        title,
        done: false,
      }));
      await updateChecklist(tx, ctx, card.id, [...existing, ...added].slice(0, 50), "ai");
    }
    const board = await boardInWorkspace(tx, card.boardId);
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "ai.drafted",
      { key: `${board?.key ?? ""}-${card.number}`, title: card.title, engine: input.engine },
      { cardId: card.id, actor: "ai" },
    );
    touch(card.boardId);
    return card.boardId;
  });
}

const ApplySplitSchema = z.object({
  cardId: id,
  cards: z
    .array(
      z.object({
        title: shortText(160).min(1),
        estimate: z.number().int().min(0).max(100).nullable(),
      }),
    )
    .min(1)
    .max(8),
  engine: shortText(80),
});

/** Creates the pieces the person kept, right after the original in its lane. */
export async function applySplitAction(raw: unknown): Promise<Result<string>> {
  return action(ApplySplitSchema, raw, async (tx, ctx, input, touch) => {
    const original = found(await cardInWorkspace(tx, input.cardId));
    const board = found(await boardInWorkspace(tx, original.boardId));
    const lane = laneFor(board.mode, original);
    let index: number | undefined;
    const created: string[] = [];
    for (const piece of input.cards) {
      const card = await createCard(
        tx,
        ctx,
        {
          boardId: board.id,
          title: piece.title,
          columnId: original.columnId,
          sprintId: original.sprintId,
          estimate: piece.estimate,
          priority: original.priority as "low" | "normal" | "high" | "urgent",
          assigneePersonId: original.assigneePersonId,
          // The pieces stay where the original belongs: same feature, same
          // area, same themes, same kind. A split changes the size, not the place.
          featureId: original.featureId,
          areaId: original.areaId,
          themeIds: await cardThemeIds(tx, original.id),
          kind: original.kind as "business" | "enabler",
          enablerType: original.enablerType as EnablerType | null,
          bug: original.bug,
        },
        "ai",
      );
      created.push(`${board.key}-${card.number}`);
      // Behind the original, in the order proposed.
      if (index === undefined) {
        const position = (await laneCards(tx, lane)).findIndex((c) => c.id === original.id);
        index = position + 1;
      } else {
        index += 1;
      }
      await placeCard(tx, lane, card.id, index);
    }
    await recordEvent(
      tx,
      ctx,
      board.id,
      "card.split",
      {
        key: `${board.key}-${original.number}`,
        title: original.title,
        into: created,
        engine: input.engine,
      },
      { cardId: original.id, actor: "ai" },
    );
    touch(board.id);
    return board.id;
  });
}

const ApplySummarySchema = z.object({
  sprintId: id,
  summary: shortText(6000).min(1),
  engine: shortText(80),
});

export async function applySummaryAction(raw: unknown): Promise<Result<string>> {
  return action(ApplySummarySchema, raw, async (tx, ctx, input, touch) => {
    const sprint = found(await saveSummary(tx, ctx, input.sprintId, input.summary, "ai"));
    touch(sprint.boardId);
    return sprint.id;
  });
}

export async function aiAvailableAction(): Promise<Result<boolean>> {
  const ctx = await requireOrgContext();
  if (!ctx) return fail("unauthorized");
  return ok(await modelConfigured(ctx));
}
