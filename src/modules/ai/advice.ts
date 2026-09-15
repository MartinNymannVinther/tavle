import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { LlmMessage } from "@/core/llm";
import { backlogItems, cards, columns } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { itemEvents } from "@/modules/boards/events";
import { boardInWorkspace } from "@/modules/boards/read";
import { openChildrenOf, type OpenChild } from "@/modules/boards/structure/close";
import { itemInWorkspace } from "@/modules/boards/structure/items";
import { capText } from "./limits";
import { DATA_RULE, fenceUntrusted, languageRule } from "./prompting";
import { askForJson } from "./service";
import type { Proposal } from "./features";

/**
 * The AI as counsel (docs/adr/0026): it reads the state of things and
 * says what it would do — a reasoned starting position for the close
 * conversation, and a brief for the epic review. Neither writes a row:
 * the close dialog only pre-sets its selects and the person confirms
 * through the ordinary action that re-validates everything; the brief
 * is a read and nothing more.
 */

const JSON_ONLY = "Answer with one JSON object and nothing else.";

export type CloseAdviceItem = {
  id: string;
  action: "close" | "archive" | "move" | "orphan";
  targetId?: string;
  reason: string;
};

type MoveTarget = { id: string; key: string; title: string };

export async function proposeCloseDecisions(
  ctx: OrgContext,
  itemId: string,
  locale: string,
): Promise<Proposal<CloseAdviceItem[]> | null> {
  const gathered = await withOrgContext(ctx, async (tx) => {
    const item = await itemInWorkspace(tx, itemId);
    if (!item || item.state === "closed") return null;
    const board = (await boardInWorkspace(tx, item.boardId))!;
    const children = await openChildrenOf(tx, board, item);
    if (children.length === 0) return null;
    // Move targets are the item's own level: another epic for a feature,
    // another feature for a story.
    const targetRows = await tx
      .select({ id: backlogItems.id, number: backlogItems.number, title: backlogItems.title })
      .from(backlogItems)
      .where(
        and(
          eq(backlogItems.boardId, board.id),
          eq(backlogItems.level, item.level),
          eq(backlogItems.state, "open"),
          ne(backlogItems.id, item.id),
        ),
      );
    const targets: MoveTarget[] = targetRows.map((row) => ({
      id: row.id,
      key: `${board.key}-${row.number}`,
      title: row.title,
    }));
    return { item, children, targets };
  });
  if (!gathered) return null;
  const { item, children, targets } = gathered;
  const childLine = (child: OpenChild) =>
    `- ${child.key} · ${child.title} · ${
      child.level === "feature" ? `feature, ${child.openStories} open stories` : "story"
    }${child.columnName ? ` · column: ${child.columnName}` : ""}`;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        `A team is closing a ${item.level} and must decide about each open child (rule 10).`,
        "The legal actions: a feature can be closed (only when it has zero open stories), moved to another epic, or kept without a parent; a story can be archived, moved to another feature, or kept without a parent.",
        "For each child answer its key, one legal action, the target's key when moving (from the targets list only), and a reason of at most ten words.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"decisions": [{"key": string, "action": "close" | "archive" | "move" | "orphan", "target": string | null, "reason": string}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Closing (${item.level}): ${fenceUntrusted(item.title, 200)}`,
        item.doneWhen ? `Its done-when: ${fenceUntrusted(item.doneWhen, 500)}` : "",
        `Open children:\n${fenceUntrusted(children.map(childLine).join("\n"), 4000)}`,
        targets.length > 0
          ? `Move targets:\n${fenceUntrusted(targets.map((t) => `- ${t.key} · ${t.title}`).join("\n"), 2000)}`
          : "There are no move targets.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "close", messages, { maxTokens: 1500 });
  const proposal = sanitizeCloseDecisions(answer.data, children, targets);
  return proposal.length > 0 ? { proposal, engine: answer.engine } : null;
}

/**
 * Keys and actions resolve against the real children and targets; a
 * child the model invented, an illegal action or an unknown target
 * drops that decision, and the dialog's own default stands for it.
 */
export function sanitizeCloseDecisions(
  raw: unknown,
  children: Array<Pick<OpenChild, "id" | "key" | "level" | "openStories">>,
  targets: MoveTarget[],
): CloseAdviceItem[] {
  const record = (raw ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(record.decisions) ? record.decisions : [];
  const childOf = new Map(children.map((c) => [c.key.toLowerCase(), c]));
  const targetOf = new Map(targets.map((t) => [t.key.toLowerCase(), t]));
  const out: CloseAdviceItem[] = [];
  const seen = new Set<string>();
  for (const row of rows.slice(0, 500)) {
    const entry = (row ?? {}) as Record<string, unknown>;
    const child = childOf.get(capText(entry.key, 40).toLowerCase());
    if (!child || seen.has(child.id)) continue;
    const action = capText(entry.action, 20);
    const legal =
      child.level === "feature"
        ? action === "move" ||
          action === "orphan" ||
          (action === "close" && child.openStories === 0)
        : action === "archive" || action === "move" || action === "orphan";
    if (!legal) continue;
    const target = action === "move" ? targetOf.get(capText(entry.target, 40).toLowerCase()) : null;
    if (action === "move" && !target) continue;
    seen.add(child.id);
    out.push({
      id: child.id,
      action: action as CloseAdviceItem["action"],
      ...(target ? { targetId: target.id } : {}),
      reason: capText(entry.reason, 200),
    });
  }
  return out;
}

export type ReviewBrief = { summary: string; observations: string[] };

export async function proposeReviewBrief(
  ctx: OrgContext,
  itemId: string,
  locale: string,
): Promise<Proposal<ReviewBrief> | null> {
  const gathered = await withOrgContext(ctx, async (tx) => {
    const item = await itemInWorkspace(tx, itemId);
    if (!item) return null;
    const board = (await boardInWorkspace(tx, item.boardId))!;
    const lines: string[] = [];
    if (item.level === "epic") {
      const features = await tx
        .select({ id: backlogItems.id, title: backlogItems.title, state: backlogItems.state })
        .from(backlogItems)
        .where(eq(backlogItems.parentId, item.id));
      const counts = await tx
        .select({
          featureId: cards.featureId,
          category: columns.category,
          n: sql<number>`count(*)::int`,
        })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt)))
        .groupBy(cards.featureId, columns.category);
      for (const feature of features) {
        const mine = counts.filter((c) => c.featureId === feature.id);
        const done = mine.filter((c) => c.category === "done").reduce((t, c) => t + Number(c.n), 0);
        const total = mine.reduce((t, c) => t + Number(c.n), 0);
        lines.push(`- ${feature.title} · ${feature.state} · ${done}/${total} stories done`);
      }
    } else {
      const stories = await tx
        .select({ title: cards.title, category: columns.category, column: columns.name })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.featureId, item.id), isNull(cards.archivedAt)));
      for (const story of stories) {
        lines.push(`- ${story.title} · ${story.column} (${story.category})`);
      }
    }
    const events = await itemEvents(tx, item.id, 30);
    const eventLines = events.map((event) => {
      const payload = event.payload as { title?: string; key?: string };
      const day = event.createdAt.toISOString().slice(0, 10);
      return `- ${day} ${event.type}${payload.title ? `: ${payload.title}` : ""}`;
    });
    return { item, lines, eventLines };
  });
  if (!gathered) return null;
  const { item, lines, eventLines } = gathered;
  const since = (item.reviewConfirmedAt ?? item.createdAt).toISOString().slice(0, 10);
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        `You brief an owner reviewing a backlog ${item.level} (rule 9: is it still a result worth pursuing?).`,
        "Say what has moved since the last confirmation, what stands open and where, and whether the done-when still reads true against what is underneath — when it seems overtaken, say so plainly.",
        "One short paragraph and up to six observations. Never invent work that is not in the lists.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"summary": string, "observations": string[]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Item (${item.level}): ${fenceUntrusted(item.title, 200)}`,
        `Done when: ${fenceUntrusted(item.doneWhen, 500)}`,
        `Last confirmed as still a result: ${since}`,
        lines.length > 0
          ? `Underneath it:\n${fenceUntrusted(lines.join("\n"), 4000)}`
          : "Nothing underneath it.",
        eventLines.length > 0
          ? `Recent activity, newest first:\n${fenceUntrusted(eventLines.join("\n"), 3000)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "review", messages, { maxTokens: 1500 });
  const proposal = sanitizeReviewBrief(answer.data);
  return proposal ? { proposal, engine: answer.engine } : null;
}

/** One capped paragraph and at most six capped observations. */
export function sanitizeReviewBrief(raw: unknown): ReviewBrief | null {
  const record = (raw ?? {}) as Record<string, unknown>;
  const summary = capText(record.summary, 2000);
  if (!summary) return null;
  const observations = (Array.isArray(record.observations) ? record.observations : [])
    .map((entry) => capText(entry, 300))
    .filter(Boolean)
    .slice(0, 6);
  return { summary, observations };
}
