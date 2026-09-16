import { and, eq, isNotNull } from "drizzle-orm";
import { cards, sprints } from "@/core/db/schema";
import { todayInCopenhagen } from "@/core/dates";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { boardAreas } from "@/modules/boards/read";
import { closeItem } from "@/modules/boards/structure/close";
import { nextQuarter, quarterOf } from "@/modules/boards/structure/rules";
import { createItem } from "@/modules/boards/structure/write-items";
import { planFeature } from "@/modules/boards/structure/plan-feature";
import { createArea, createTheme } from "@/modules/boards/structure/write-lists";
import { placeOnMap } from "@/modules/boards/structure/write-map";
import type { DemoStructure } from "./words";

/**
 * The structure above a demo board's cards: its areas and themes, its
 * epics with their features and the open features up on the story map,
 * all through the ordinary services so the demo cannot drift from what
 * the product does. Answers the lookups the
 * card seeding needs — a feature by its title, an area by its name —
 * and the epics to age afterwards, and closes what the words say is
 * closed once the cards are in.
 */
export type SeededStructure = {
  featureIdByTitle: Map<string, string>;
  areaIdByName: Map<string, string>;
  /** Epic ids and how many days older each should look, for the review mark. */
  aged: Array<{ id: string; days: number }>;
  /** Features, then epics, to close once their stories are done. */
  toClose: string[];
};

export async function seedStructure(
  tx: AppTransaction,
  ctx: OrgContext,
  boardId: string,
  structure: DemoStructure,
): Promise<SeededStructure> {
  const areaIdByName = new Map<string, string>();
  for (const area of await boardAreas(tx, boardId)) areaIdByName.set(area.name, area.id);
  for (const name of structure.areas) {
    if (!areaIdByName.has(name)) {
      const area = await createArea(tx, ctx, { boardId, name });
      areaIdByName.set(name, area.id);
    }
  }
  const themeIdByName = new Map<string, string>();
  for (const spec of structure.themes) {
    const theme = await createTheme(tx, ctx, { boardId, name: spec.name, color: spec.color });
    themeIdByName.set(spec.name, theme.id);
  }

  const current = quarterOf(todayInCopenhagen());
  const quarterAt = (offset: number) => {
    let q = current;
    for (let i = 0; i < offset; i += 1) q = nextQuarter(q);
    return q;
  };

  const featureIdByTitle = new Map<string, string>();
  const aged: SeededStructure["aged"] = [];
  const features: string[] = [];
  const epics: string[] = [];
  for (const spec of structure.epics) {
    const epic = await createItem(tx, ctx, {
      boardId,
      level: "epic",
      title: spec.title,
      description: spec.description,
      doneWhen: spec.doneWhen,
      kind: spec.enabler ? "enabler" : "business",
      enablerType: spec.enabler ?? null,
      areaId: areaIdByName.get(spec.area) ?? null,
      themeIds: spec.themes.map((name) => themeIdByName.get(name)!).filter(Boolean),
      targetQuarter: spec.quarterOffset === undefined ? null : quarterAt(spec.quarterOffset),
    });
    if (spec.agedDays) aged.push({ id: epic.id, days: spec.agedDays });
    if (spec.closed) epics.push(epic.id);
    for (const featureSpec of spec.features) {
      const feature = await createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: featureSpec.title,
        description: featureSpec.description,
        doneWhen: featureSpec.doneWhen,
        parentId: epic.id,
      });
      featureIdByTitle.set(featureSpec.title, feature.id);
      if (featureSpec.closed) features.push(feature.id);
      // Every feature stands on the wall in the words' order, the finished
      // ones included: a team leaves what it delivered up there, and a
      // closed note is exactly what the map's "show closed" is for. They
      // are all still open here — closeSeeded runs once the cards are in.
      await placeOnMap(tx, ctx, feature.id, undefined);
    }
  }
  return { featureIdByTitle, areaIdByName, aged, toClose: [...features, ...epics] };
}

/** Where a card goes: under its feature, or in its area with no parent. */
export function placement(
  seeded: SeededStructure,
  spec: { feature?: string; area?: string },
): { featureId?: string; areaId?: string } {
  if (spec.feature) {
    const featureId = seeded.featureIdByTitle.get(spec.feature);
    if (!featureId) throw new Error(`demo: unknown feature ${spec.feature}`);
    return { featureId };
  }
  const areaId = seeded.areaIdByName.get(spec.area ?? "");
  if (!areaId) throw new Error(`demo: unknown area ${spec.area}`);
  return { areaId };
}

/** Closes what the words say is closed; the stories under them are done by then. */
export async function closeSeeded(
  tx: AppTransaction,
  ctx: OrgContext,
  seeded: SeededStructure,
): Promise<void> {
  for (const itemId of seeded.toClose) {
    const outcome = await closeItem(tx, ctx, itemId, undefined);
    if (outcome && !outcome.closed) {
      throw new Error(`demo: ${itemId} still has open children and cannot be closed`);
    }
  }
}

/**
 * Gives every feature the sprints its own work actually ran in
 * (docs/adr/0023), rather than a span written down by hand that the
 * cards could then drift away from: the plan is the first and last
 * sprint holding one of the feature's cards. A feature whose work is
 * all still in the backlog stays unplanned, which is the honest answer
 * and what the roadmap's feature view is there to show.
 */
export async function planSeededFeatures(
  tx: AppTransaction,
  ctx: OrgContext,
  boardId: string,
): Promise<void> {
  const rows = await tx
    .select({
      featureId: cards.featureId,
      sprintId: cards.sprintId,
      number: sprints.number,
    })
    .from(cards)
    .innerJoin(sprints, eq(sprints.id, cards.sprintId))
    .where(and(eq(cards.boardId, boardId), isNotNull(cards.featureId)));

  const span = new Map<string, { first: string; last: string; from: number; to: number }>();
  for (const row of rows) {
    if (!row.featureId || !row.sprintId) continue;
    const current = span.get(row.featureId);
    if (!current) {
      span.set(row.featureId, {
        first: row.sprintId,
        last: row.sprintId,
        from: row.number,
        to: row.number,
      });
      continue;
    }
    if (row.number < current.from) {
      current.from = row.number;
      current.first = row.sprintId;
    }
    if (row.number > current.to) {
      current.to = row.number;
      current.last = row.sprintId;
    }
  }

  for (const [featureId, at] of span) {
    await planFeature(tx, ctx, {
      itemId: featureId,
      startSprintId: at.first,
      targetSprintId: at.last,
    });
  }
}
