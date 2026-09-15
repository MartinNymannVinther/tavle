import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { LlmMessage } from "@/core/llm";
import { areas, backlogItems, cards, sprints } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { velocity } from "@/modules/boards/metrics/velocity";
import { boardInWorkspace } from "@/modules/boards/read";
import { itemInWorkspace } from "@/modules/boards/structure/items";
import { capText } from "./limits";
import { DATA_RULE, fenceUntrusted, languageRule } from "./prompting";
import { askForJson } from "./service";
import type { Proposal } from "./features";

/**
 * The quiet assists (docs/adr/0025): small proposals woven into the
 * moments where a person already stands — a done-when drafted where
 * rule 4 will one day bite, and a placement plus a duplicate glance
 * while a card title is still being typed. Same law as the big
 * proposals: fenced prose in, sanitized shapes out, nothing written
 * until a person says yes — and the invisible ones write nothing at all.
 */

const JSON_ONLY = "Answer with one JSON object and nothing else.";

export async function proposeDoneWhen(
  ctx: OrgContext,
  itemId: string,
  locale: string,
): Promise<Proposal<string> | null> {
  const gathered = await withOrgContext(ctx, async (tx) => {
    const item = await itemInWorkspace(tx, itemId);
    if (!item) return null;
    const board = await boardInWorkspace(tx, item.boardId);
    const parent = item.parentId
      ? (
          await tx
            .select({ title: backlogItems.title })
            .from(backlogItems)
            .where(eq(backlogItems.id, item.parentId))
            .limit(1)
        )[0]
      : undefined;
    const children =
      item.level === "epic"
        ? (
            await tx
              .select({ title: backlogItems.title })
              .from(backlogItems)
              .where(eq(backlogItems.parentId, item.id))
              .orderBy(asc(backlogItems.sort))
          ).map((row) => row.title)
        : (
            await tx
              .select({ title: cards.title })
              .from(cards)
              .where(and(eq(cards.featureId, item.id), isNull(cards.archivedAt)))
              .orderBy(asc(cards.sort))
          ).map((row) => row.title);
    return { item, boardName: board?.name ?? "", parentTitle: parent?.title ?? "", children };
  });
  if (!gathered) return null;
  const { item, boardName, parentTitle, children } = gathered;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You help a small team state when a backlog item is finished.",
        "Write one or two short sentences that make it checkable whether this item is done: observable outcomes, not activities. No lists, no headings.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"doneWhen": string}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Board: ${fenceUntrusted(boardName, 80)}`,
        `Item (${item.level}): ${fenceUntrusted(item.title, 200)}`,
        item.description ? `Description: ${fenceUntrusted(item.description)}` : "",
        parentTitle ? `Part of: ${fenceUntrusted(parentTitle, 200)}` : "",
        children.length > 0
          ? `Underneath it: ${fenceUntrusted(children.slice(0, 30).join("; "), 2000)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "doneWhen", messages);
  const proposal = sanitizeDoneWhen(answer.data);
  return proposal ? { proposal, engine: answer.engine } : null;
}

/** One checkable sentence or two, cut to the field's own cap. */
export function sanitizeDoneWhen(raw: unknown): string | null {
  const record = raw as Record<string, unknown> | null;
  const text = capText(record?.doneWhen, 500);
  return text.length > 0 ? text : null;
}

export async function proposeSprintGoal(
  ctx: OrgContext,
  sprintId: string,
  locale: string,
): Promise<Proposal<string> | null> {
  const gathered = await withOrgContext(ctx, async (tx) => {
    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
    if (!sprint || sprint.state === "closed") return null;
    const rows = await tx
      .select({ title: cards.title, estimate: cards.estimate, feature: backlogItems.title })
      .from(cards)
      .leftJoin(backlogItems, eq(backlogItems.id, cards.featureId))
      .where(and(eq(cards.sprintId, sprint.id), isNull(cards.archivedAt)))
      .orderBy(asc(cards.sort));
    if (rows.length === 0) return null;
    const all = await tx.select().from(sprints).where(eq(sprints.boardId, sprint.boardId));
    return { sprint, rows, average: velocity(all).average };
  });
  if (!gathered) return null;
  const { sprint, rows, average } = gathered;
  const points = rows.reduce((total, r) => total + (r.estimate ?? 0), 0);
  const line = (r: (typeof rows)[number]) =>
    `- ${r.title}${r.feature ? ` (${r.feature})` : ""}${r.estimate ? ` [${r.estimate}]` : ""}`;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You write a sprint goal for a small team: one sentence naming the outcome this sprint exists for — what is true at the end that was not at the start. Not a list of the cards.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"goal": string}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Sprint: ${fenceUntrusted(sprint.name, 80)} (${sprint.startDate} to ${sprint.endDate})`,
        `Planned points: ${points}${average !== null ? `; the team's recent average is ${average}` : ""}`,
        `Cards:\n${fenceUntrusted(rows.map(line).join("\n"), 4000)}`,
      ].join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "goal", messages);
  const proposal = sanitizeSprintGoal(answer.data);
  return proposal ? { proposal, engine: answer.engine } : null;
}

/** One sentence, cut to the goal field's own cap. */
export function sanitizeSprintGoal(raw: unknown): string | null {
  const record = raw as Record<string, unknown> | null;
  const text = capText(record?.goal, 500);
  return text.length > 0 ? text : null;
}

export type QuickAssist = {
  place: { featureId: string } | { areaId: string } | null;
  duplicates: Array<{ number: number; title: string }>;
};

type QuickPools = {
  features: Array<{ id: string; title: string }>;
  areas: Array<{ id: string; name: string }>;
  cards: Array<{ number: number; title: string }>;
};

export async function proposeQuickAssist(
  ctx: OrgContext,
  boardId: string,
  title: string,
  locale: string,
): Promise<Proposal<QuickAssist> | null> {
  const pools = await withOrgContext(ctx, async (tx): Promise<QuickPools | null> => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    return {
      features: await tx
        .select({ id: backlogItems.id, title: backlogItems.title })
        .from(backlogItems)
        .where(
          and(
            eq(backlogItems.boardId, board.id),
            eq(backlogItems.level, "feature"),
            eq(backlogItems.state, "open"),
          ),
        )
        .orderBy(asc(backlogItems.sort)),
      areas: await tx
        .select({ id: areas.id, name: areas.name })
        .from(areas)
        .where(and(eq(areas.boardId, board.id), eq(areas.active, true)))
        .orderBy(asc(areas.sort)),
      // The newest first: on a big board the recent cards are the ones a
      // duplicate is most likely to collide with.
      cards: await tx
        .select({ number: cards.number, title: cards.title })
        .from(cards)
        .where(and(eq(cards.boardId, board.id), isNull(cards.archivedAt)))
        .orderBy(desc(cards.number))
        .limit(200),
    };
  });
  if (!pools) return null;
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You place a new card in a small team's backlog structure, and you notice near-duplicates.",
        "Pick the one feature the card clearly belongs to, by its exact name; when none clearly fits, pick an area by its exact name; when unsure, answer null for both.",
        "List the numbers of at most three existing cards that describe the same work — only real duplicates, not merely related work. Usually there are none.",
        DATA_RULE,
        languageRule(locale),
        JSON_ONLY,
        'Shape: {"feature": string | null, "area": string | null, "duplicates": number[]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `New card title: ${fenceUntrusted(title, 200)}`,
        pools.features.length > 0
          ? `Features: ${fenceUntrusted(pools.features.map((f) => f.title).join("; "), 2000)}`
          : "",
        pools.areas.length > 0
          ? `Areas: ${fenceUntrusted(pools.areas.map((a) => a.name).join("; "), 500)}`
          : "",
        pools.cards.length > 0
          ? `Existing cards:\n${fenceUntrusted(pools.cards.map((c) => `${c.number}: ${c.title}`).join("\n"), 5000)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "assist", messages);
  return { proposal: sanitizeQuickAssist(answer.data, pools), engine: answer.engine };
}

/**
 * The model answers in names and numbers; only what resolves against the
 * board's own rows survives, so a confused model can never point at
 * another workspace's card or invent a feature.
 */
export function sanitizeQuickAssist(raw: unknown, pools: QuickPools): QuickAssist {
  const record = (raw ?? {}) as Record<string, unknown>;
  const norm = (value: unknown) => capText(value, 200).toLowerCase();
  const feature = pools.features.find((f) => f.title.toLowerCase() === norm(record.feature));
  const area = feature
    ? undefined
    : pools.areas.find((a) => a.name.toLowerCase() === norm(record.area));
  const known = new Map(pools.cards.map((c) => [c.number, c.title]));
  const duplicates = [
    ...new Set(
      (Array.isArray(record.duplicates) ? record.duplicates : []).filter(
        (n): n is number => Number.isInteger(n) && known.has(n as number),
      ),
    ),
  ]
    .slice(0, 3)
    .map((number) => ({ number, title: known.get(number)! }));
  return {
    place: feature ? { featureId: feature.id } : area ? { areaId: area.id } : null,
    duplicates,
  };
}
