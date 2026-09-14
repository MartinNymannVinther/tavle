import type { LlmMessage } from "@/core/llm";
import type { OrgContext } from "@/core/db/tenant";
import { withOrgContext } from "@/core/db/tenant";
import { boardAreas, boardInWorkspace, boardThemes } from "@/modules/boards/read";
import { quarterOf, quartersBetween } from "@/modules/boards/structure/rules";
import { shiftQuarter } from "@/modules/boards/structure/roadmap";
import { todayInCopenhagen } from "@/core/dates";
import { DATA_RULE, fenceUntrusted, languageRule } from "./prompting";
import { asString, list, present, rec } from "./sanitize-helpers";
import { askForJson } from "./service";
import type { Proposal } from "./features";

/**
 * The fourth proposal (docs/adr/0021): a starting point for a backlog
 * and a roadmap, drawn from the team's own prose. The model proposes
 * areas, themes and a small tree of epics, features and cards with
 * quarters; the person prunes and edits every node before anything is
 * written. Nothing here writes a row.
 */

export type BootstrapCard = { title: string };
export type BootstrapFeature = { title: string; doneWhen: string; cards: BootstrapCard[] };
export type BootstrapEpic = {
  title: string;
  doneWhen: string;
  targetQuarter: string | null;
  area: string;
  themes: string[];
  features: BootstrapFeature[];
};
export type BootstrapProposal = { areas: string[]; themes: string[]; epics: BootstrapEpic[] };

export type BootstrapInput = { description: string; horizonQuarters: number; focus: string };

const LIMITS = { areas: 5, themes: 5, epics: 5, features: 4, cards: 5 };

export async function proposeBootstrap(
  ctx: OrgContext,
  boardId: string,
  input: BootstrapInput,
  locale: string,
): Promise<Proposal<BootstrapProposal> | null> {
  const found = await withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    return {
      board,
      areas: (await boardAreas(tx, boardId)).filter((a) => a.active).map((a) => a.name),
      themes: (await boardThemes(tx, boardId)).filter((t) => t.active).map((t) => t.name),
    };
  });
  if (!found) return null;
  const current = quarterOf(todayInCopenhagen());
  const quarters = quartersBetween(current, shiftQuarter(current, input.horizonQuarters - 1));
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: [
        "You help a small team turn a prose description of their product or project into a first backlog and roadmap.",
        `Propose: up to ${LIMITS.areas} areas (parts of the product, nouns), up to ${LIMITS.themes} themes (why the work matters), and up to ${LIMITS.epics} epics.`,
        'Every epic and feature gets a "doneWhen": one sentence that makes it checkable when it is finished. An epic or feature that cannot finish is a theme or an area instead.',
        `Every epic names exactly one area from your list (or from the existing ones), any themes from your list, and a target quarter from: ${quarters.join(", ")} — spread the epics across the horizon, the most pressing first.`,
        `Under each epic up to ${LIMITS.features} features, and under each feature up to ${LIMITS.cards} cards: short concrete titles a team can pick up.`,
        DATA_RULE,
        languageRule(locale),
        "Answer with one JSON object and nothing else.",
        'Shape: {"areas": string[], "themes": string[], "epics": [{"title": string, "doneWhen": string, "area": string, "themes": string[], "targetQuarter": string, "features": [{"title": string, "doneWhen": string, "cards": [{"title": string}]}]}]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Board: ${fenceUntrusted(found.board.name, 80)}`,
        found.areas.length > 0
          ? `Existing areas: ${fenceUntrusted(found.areas.join("; "), 400)}`
          : "",
        found.themes.length > 0
          ? `Existing themes: ${fenceUntrusted(found.themes.join("; "), 400)}`
          : "",
        `The team's description of the product/project: ${fenceUntrusted(input.description, 4000)}`,
        input.focus ? `What should come first: ${fenceUntrusted(input.focus, 300)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
  const answer = await askForJson(ctx, "bootstrap", messages, { maxTokens: 3500 });
  const proposal = sanitizeBootstrap(answer.data, {
    quarters,
    existingAreas: found.areas,
    existingThemes: found.themes,
  });
  return proposal ? { proposal, engine: answer.engine } : null;
}

/**
 * The model's tree, cut to shape: bounded counts, capped strings, every
 * epic's area resolved to a proposed or existing name, themes filtered
 * to known ones, quarters only from the horizon.
 */
export function sanitizeBootstrap(
  raw: unknown,
  known: { quarters: string[]; existingAreas: string[]; existingThemes: string[] },
): BootstrapProposal | null {
  const r = rec(raw);
  const names = (v: unknown, max: number) =>
    present(list(v).map((x) => asString(typeof x === "string" ? x : x.name, "", 40) || null))
      .slice(0, max)
      .filter((n, i, all) => all.findIndex((o) => o.toLowerCase() === n.toLowerCase()) === i);
  const areas = names(r.areas, LIMITS.areas);
  const themes = names(r.themes, LIMITS.themes);
  const areaPool = [...areas, ...known.existingAreas];
  const themePool = new Set([...themes, ...known.existingThemes].map((n) => n.toLowerCase()));

  const epics = present(
    list(r.epics).map((e): BootstrapEpic | null => {
      const title = asString(e.title, "", 160);
      if (!title) return null;
      const area = asString(e.area, "", 40);
      const quarter = asString(e.targetQuarter, "", 7);
      return {
        title,
        doneWhen: asString(e.doneWhen, "", 500),
        // Rule 3 from the first node: an epic must land in a real area.
        area: areaPool.find((a) => a.toLowerCase() === area.toLowerCase()) ?? areaPool[0] ?? "",
        themes: names(e.themes, LIMITS.themes).filter((n) => themePool.has(n.toLowerCase())),
        targetQuarter: known.quarters.includes(quarter) ? quarter : null,
        features: present(
          list(e.features).map((f): BootstrapFeature | null => {
            const featureTitle = asString(f.title, "", 160);
            if (!featureTitle) return null;
            return {
              title: featureTitle,
              doneWhen: asString(f.doneWhen, "", 500),
              cards: present(
                list(f.cards).map((c) => {
                  const cardTitle = asString(typeof c === "string" ? c : (c.title ?? c), "", 160);
                  return cardTitle ? { title: cardTitle } : null;
                }),
              ).slice(0, LIMITS.cards),
            };
          }),
        ).slice(0, LIMITS.features),
      };
    }),
  ).slice(0, LIMITS.epics);

  if (epics.length === 0) return null;
  return { areas, themes, epics };
}
