import type { LlmMessage } from "@/core/llm";
import type { OrgContext } from "@/core/db/tenant";
import { getCardFull } from "@/modules/boards/read";
import { listSprints } from "@/modules/boards/read";
import { withOrgContext } from "@/core/db/tenant";
import { and, eq, isNull } from "drizzle-orm";
import { cards, columns } from "@/core/db/schema";
import { DATA_RULE, fenceUntrusted, languageRule } from "./prompting";
import {
  sanitizeDraft,
  sanitizeSplit,
  sanitizeSummary,
  type CardDraft,
  type SplitProposal,
  type SprintSummary,
} from "./sanitize";
import { askForJson } from "./service";

/**
 * The three things the model does for a team, all of them proposals:
 * finish writing a card, split a card that is too big, and tell the
 * story of a sprint. Nothing here writes a row. The proposal goes back to
 * the person, and the apply actions in modules/boards write what they
 * said yes to, marked as the AI's work in the event log.
 */

export type Proposal<T> = { proposal: T; engine: string };

const JSON_ONLY = "Answer with one JSON object and nothing else.";

export async function proposeCardDraft(
  ctx: OrgContext,
  boardId: string,
  number: number,
  locale: string,
): Promise<Proposal<CardDraft> | null> {
  const full = await getCardFull(ctx, boardId, number);
  if (!full) return null;
  const { card, board } = full;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You help a small team write a clear work item for a Kanban or Scrum board.",
        "Given a card's title and whatever description exists, write a short description of what is to be done and why, a few acceptance criteria that can be checked, and a checklist of concrete steps.",
        "Keep what the team already wrote; add, do not replace their meaning.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"description": string, "acceptance": string[], "checklist": string[]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Board: ${fenceUntrusted(board.name, 80)}`,
        `Title: ${fenceUntrusted(card.title, 200)}`,
        `Existing description: ${fenceUntrusted(card.description)}`,
        card.checklist.length > 0
          ? `Existing checklist: ${fenceUntrusted(card.checklist.map((i) => i.title).join("; "), 1000)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "draft", messages);
  const proposal = sanitizeDraft(answer.data);
  return proposal ? { proposal, engine: answer.engine } : null;
}

export async function proposeCardSplit(
  ctx: OrgContext,
  boardId: string,
  number: number,
  locale: string,
): Promise<Proposal<SplitProposal[]> | null> {
  const full = await getCardFull(ctx, boardId, number);
  if (!full) return null;
  const { card } = full;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You help a small team break a work item that is too big into smaller ones that can each be finished in a day or two.",
        "Propose two to six cards. Each gets a title that says what is done when it is done, an optional estimate in story points (1, 2, 3, 5 or 8) and an optional one-line note.",
        "Do not repeat the original as one of the pieces.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"cards": [{"title": string, "estimate": number | null, "note": string}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Title: ${fenceUntrusted(card.title, 200)}`,
        `Description: ${fenceUntrusted(card.description)}`,
        card.estimate ? `Current estimate: ${card.estimate} points` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "split", messages);
  const proposal = sanitizeSplit(answer.data);
  return proposal.length > 0 ? { proposal, engine: answer.engine } : null;
}

export async function proposeSprintSummary(
  ctx: OrgContext,
  boardId: string,
  sprintId: string,
  locale: string,
): Promise<Proposal<SprintSummary> | null> {
  const sprints = await listSprints(ctx, boardId);
  const sprint = sprints.find((s) => s.id === sprintId);
  if (!sprint) return null;
  const rows = await withOrgContext(ctx, (tx) =>
    tx
      .select({
        title: cards.title,
        estimate: cards.estimate,
        category: columns.category,
        blocked: cards.blocked,
      })
      .from(cards)
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(and(eq(cards.sprintId, sprint.id), isNull(cards.archivedAt))),
  );
  const line = (r: (typeof rows)[number]) =>
    `- ${r.category === "done" ? "[done]" : r.blocked ? "[blocked]" : "[open]"} ${r.title}${r.estimate ? ` (${r.estimate})` : ""}`;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You write the short account of a sprint for a small team: what the team set out to do, what got done, what did not and why that might be, and what to watch next sprint.",
        "Be concrete and brief: one paragraph of summary, up to six highlights, up to six risks or open questions. Never invent work that is not in the list.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"summary": string, "highlights": string[], "risks": string[]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Sprint: ${fenceUntrusted(sprint.name, 80)} (${sprint.startDate} to ${sprint.endDate}, ${sprint.state})`,
        `Goal: ${fenceUntrusted(sprint.goal, 500)}`,
        `Committed points: ${sprint.committedPoints ?? "unknown"}; completed points: ${sprint.completedPoints ?? "not closed yet"}`,
        `Cards:\n${fenceUntrusted(rows.map(line).join("\n"), 5000)}`,
      ].join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "summary", messages, { maxTokens: 1500 });
  const proposal = sanitizeSummary(answer.data);
  return proposal ? { proposal, engine: answer.engine } : null;
}
