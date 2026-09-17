import { and, asc, eq } from "drizzle-orm";
import { backlogItems } from "@/core/db/schema";
import type { LlmMessage } from "@/core/llm";
import type { OrgContext } from "@/core/db/tenant";
import { withOrgContext } from "@/core/db/tenant";
import { boardAreas, boardInWorkspace, boardThemes } from "@/modules/boards/read";
import { themeIdsByItem } from "@/modules/boards/structure/items";
import { quarterOf, quartersBetween } from "@/modules/boards/structure/rules";
import { shiftQuarter } from "@/modules/boards/structure/roadmap";
import { todayInCopenhagen } from "@/core/dates";
import { DATA_RULE, fenceUntrusted, languageRule } from "./prompting";
import { asString, list, present, rec } from "./sanitize-helpers";
import { askForJson } from "./service";
import type { Proposal } from "./features";
import { MAX_INSTRUCTION_CHARS } from "./wire";

/**
 * The fifth proposal (docs/adr/0037): an assistant for a backlog that
 * already exists. The person writes what they want done — "split the
 * payment epic", "we are missing everything about returns" — and the
 * model reads the decomposition as it stands and answers with four
 * kinds of thing and no others: new epics, new features under an epic
 * that exists, new cards under a feature that exists, and text edits to
 * a title or a done-when.
 *
 * What is missing from that list is the decision, not an oversight. It
 * cannot delete, close, move a card or re-rank anything — the
 * constitution's own line — and it cannot propose a new area or theme,
 * because those are the board's shape and take an owner or an admin.
 * Leaving them out is what lets the whole team use the assistant.
 *
 * Nothing here writes a row.
 */

export type AssistEpic = {
  title: string;
  doneWhen: string;
  area: string;
  themes: string[];
  targetQuarter: string | null;
};
export type AssistFeature = {
  title: string;
  doneWhen: string;
  /** The existing epic it goes under, by board key; the title rides along for the review. */
  parentKey: string;
  parentTitle: string;
};
export type AssistCard = { title: string; parentKey: string; parentTitle: string };
export type AssistEdit = {
  key: string;
  level: "epic" | "feature";
  /** Null where this edit leaves the field alone. */
  title: string | null;
  doneWhen: string | null;
  currentTitle: string;
  currentDoneWhen: string;
  why: string;
};
export type AssistProposal = {
  epics: AssistEpic[];
  features: AssistFeature[];
  cards: AssistCard[];
  edits: AssistEdit[];
};

/** What the model is allowed to have said, resolved from the board's own rows. */
export type AssistKnown = {
  quarters: string[];
  areas: string[];
  themes: string[];
  epics: Array<{ key: string; title: string }>;
  features: Array<{ key: string; title: string }>;
  editable: Array<{ key: string; level: "epic" | "feature"; title: string; doneWhen: string }>;
};

export const ASSIST_LIMITS = { epics: 3, features: 6, cards: 12, edits: 10 };

/** How far ahead an epic may be aimed; the roadmap is quarters and so is this. */
const HORIZON_QUARTERS = 8;

export async function proposeBacklogAssist(
  ctx: OrgContext,
  boardId: string,
  instruction: string,
  locale: string,
): Promise<Proposal<AssistProposal> | null> {
  const found = await withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const rows = await tx
      .select()
      .from(backlogItems)
      .where(and(eq(backlogItems.boardId, board.id), eq(backlogItems.state, "open")))
      .orderBy(asc(backlogItems.sort), asc(backlogItems.number));
    const themesOf = await themeIdsByItem(
      tx,
      rows.map((row) => row.id),
    );
    return {
      board,
      rows,
      themesOf,
      areas: await boardAreas(tx, board.id),
      themes: await boardThemes(tx, board.id),
    };
  });
  if (!found) return null;

  const { board, rows } = found;
  const areaName = new Map(found.areas.map((a) => [a.id, a.name]));
  const themeName = new Map(found.themes.map((t) => [t.id, t.name]));
  const key = (item: { number: number }) => `${board.key}-${item.number}`;
  const known: AssistKnown = {
    quarters: quartersBetween(
      quarterOf(todayInCopenhagen()),
      shiftQuarter(quarterOf(todayInCopenhagen()), HORIZON_QUARTERS - 1),
    ),
    areas: found.areas.filter((a) => a.active).map((a) => a.name),
    themes: found.themes.filter((t) => t.active).map((t) => t.name),
    epics: rows.filter((r) => r.level === "epic").map((r) => ({ key: key(r), title: r.title })),
    features: rows
      .filter((r) => r.level === "feature")
      .map((r) => ({ key: key(r), title: r.title })),
    editable: rows.map((r) => ({
      key: key(r),
      level: r.level as "epic" | "feature",
      title: r.title,
      doneWhen: r.doneWhen,
    })),
  };

  const line = (item: (typeof rows)[number]) => {
    const parent = item.parentId ? rows.find((r) => r.id === item.parentId) : null;
    const themes = (found.themesOf.get(item.id) ?? [])
      .map((id) => themeName.get(id))
      .filter(Boolean);
    return [
      `- ${key(item)} · ${item.level} · ${item.title}`,
      item.level === "feature" ? `under: ${parent ? key(parent) : "no epic"}` : "",
      item.areaId ? `area: ${areaName.get(item.areaId) ?? ""}` : "",
      themes.length > 0 ? `themes: ${themes.join(", ")}` : "",
      item.targetQuarter ? `target: ${item.targetQuarter}` : "",
      item.doneWhen.trim() ? "" : "done-when: MISSING",
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You help a product owner adjust and extend a backlog that already exists. Do what the task asks and nothing beyond it; propose little rather than much.",
        `You may propose exactly four things: up to ${ASSIST_LIMITS.epics} new epics, up to ${ASSIST_LIMITS.features} new features under an epic that already exists, up to ${ASSIST_LIMITS.cards} new cards under a feature that already exists, and up to ${ASSIST_LIMITS.edits} text edits to an existing item's title or done-when.`,
        "You may not delete, close, archive or move anything, and you may not reorder the backlog. There is no way to say those things and no reason to try.",
        "You may not invent areas or themes: name only the ones listed, exactly as they are written. An epic names exactly one area.",
        'A "doneWhen" is one sentence that makes the item checkable when it is finished. Items marked done-when: MISSING are the ones worth writing one for.',
        `A new epic may name a target quarter from: ${known.quarters.join(", ")}.`,
        "Refer to an existing item only by the key it is listed under. An edit names the one field it changes and leaves the other out.",
        DATA_RULE,
        languageRule(locale),
        "Answer with one JSON object and nothing else.",
        'Shape: {"epics": [{"title": string, "doneWhen": string, "area": string, "themes": string[], "targetQuarter": string | null}], "features": [{"title": string, "doneWhen": string, "parent": string}], "cards": [{"title": string, "parent": string}], "edits": [{"key": string, "title": string | null, "doneWhen": string | null, "why": string}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Board: ${fenceUntrusted(board.name, 80)}`,
        known.areas.length > 0 ? `Areas: ${fenceUntrusted(known.areas.join("; "), 400)}` : "",
        known.themes.length > 0 ? `Themes: ${fenceUntrusted(known.themes.join("; "), 400)}` : "",
        rows.length > 0
          ? `The backlog as it stands:\n${fenceUntrusted(rows.map(line).join("\n"), 6000)}`
          : // Only open rows are read, so this is not the same as an empty
            // board: a team whose first epics are all closed lands here.
            // Saying there are none would be untrue and would invite the
            // model to propose work under parents it was never shown.
            "The backlog has no open epics or features to build on; propose new epics only.",
        `The task: ${fenceUntrusted(instruction, MAX_INSTRUCTION_CHARS)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "assist", messages, { maxTokens: 2500 });
  const proposal = sanitizeBacklogAssist(answer.data, known);
  return proposal ? { proposal, engine: answer.engine } : null;
}

/**
 * The model's answer cut to shape: bounded counts, capped strings, every
 * parent resolved to a real epic or feature of this board, areas and
 * themes to names that already exist, quarters to the horizon. An edit
 * that would change nothing is dropped, so the review never shows a row
 * that does nothing. Anything the model said that is not one of the four
 * kinds simply has nowhere to land.
 */
export function sanitizeBacklogAssist(raw: unknown, known: AssistKnown): AssistProposal | null {
  const r = rec(raw);
  const lookup = <T extends { key: string }>(pool: T[]) =>
    new Map(pool.map((row) => [row.key.toLowerCase(), row]));
  const epicOf = lookup(known.epics);
  const featureOf = lookup(known.features);
  const editableOf = lookup(known.editable);
  const themePool = new Set(known.themes.map((n) => n.toLowerCase()));

  // Rule 3: an epic has no parent, so it must land in an area. A board
  // without one has nowhere to put a new epic, and proposing it would
  // only be refused at the write boundary.
  const epics = known.areas[0]
    ? present(
        list(r.epics).map((e): AssistEpic | null => {
          const title = asString(e.title, "", 160);
          if (!title) return null;
          const area = asString(e.area, "", 40).toLowerCase();
          const quarter = asString(e.targetQuarter, "", 7);
          return {
            title,
            doneWhen: asString(e.doneWhen, "", 500),
            area: known.areas.find((a) => a.toLowerCase() === area) ?? known.areas[0]!,
            themes: present(
              list(e.themes).map(
                (t) => asString(typeof t === "string" ? t : t.name, "", 40) || null,
              ),
            ).filter((n) => themePool.has(n.toLowerCase())),
            targetQuarter: known.quarters.includes(quarter) ? quarter : null,
          };
        }),
      ).slice(0, ASSIST_LIMITS.epics)
    : [];

  const features = present(
    list(r.features).map((f): AssistFeature | null => {
      const title = asString(f.title, "", 160);
      // A feature hangs under an epic and nothing else; a key pointing at
      // a feature, or at nothing, drops the row rather than guessing.
      const parent = epicOf.get(asString(f.parent, "", 40).toLowerCase());
      if (!title || !parent) return null;
      return {
        title,
        doneWhen: asString(f.doneWhen, "", 500),
        parentKey: parent.key,
        parentTitle: parent.title,
      };
    }),
  ).slice(0, ASSIST_LIMITS.features);

  const cards = present(
    list(r.cards).map((c): AssistCard | null => {
      const title = asString(c.title, "", 160);
      const parent = featureOf.get(asString(c.parent, "", 40).toLowerCase());
      if (!title || !parent) return null;
      return { title, parentKey: parent.key, parentTitle: parent.title };
    }),
  ).slice(0, ASSIST_LIMITS.cards);

  const edits = present(
    list(r.edits).map((e): AssistEdit | null => {
      const item = editableOf.get(asString(e.key, "", 40).toLowerCase());
      if (!item) return null;
      const title = asString(e.title, "", 160);
      const doneWhen = asString(e.doneWhen, "", 500);
      const changedTitle = title && title !== item.title ? title : null;
      const changedDoneWhen = doneWhen && doneWhen !== item.doneWhen ? doneWhen : null;
      if (!changedTitle && !changedDoneWhen) return null;
      return {
        key: item.key,
        level: item.level,
        title: changedTitle,
        doneWhen: changedDoneWhen,
        currentTitle: item.title,
        currentDoneWhen: item.doneWhen,
        why: asString(e.why, "", 200),
      };
    }),
  ).slice(0, ASSIST_LIMITS.edits);

  const total = epics.length + features.length + cards.length + edits.length;
  return total > 0 ? { epics, features, cards, edits } : null;
}
