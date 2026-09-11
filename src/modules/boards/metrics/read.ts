import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { cardTransitions, cards, columns, sprints } from "@/core/db/schema";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { boardInWorkspace } from "../read";
import { burndown, type Burndown } from "./burndown";
import {
  cumulativeFlow,
  cycleTime,
  throughput,
  type CycleTime,
  type FlowDay,
  type WeekCount,
} from "./flow";
import { velocity, type Velocity } from "./velocity";

/**
 * The insight page's data, computed on request from the record. Nothing
 * here is cached or pre-aggregated: a board has hundreds of cards at most,
 * and a number that can be recomputed from its source is a number nobody
 * has to doubt.
 */

export type BoardInsight = {
  today: string;
  wip: number;
  throughput: WeekCount[];
  cycle: CycleTime;
  flow: FlowDay[];
  velocity: Velocity;
  activeBurndown: (Burndown & { sprint: { id: string; name: string; endDate: string } }) | null;
};

export async function boardInsight(ctx: OrgContext, boardId: string): Promise<BoardInsight | null> {
  return withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const today = todayInCopenhagen();
    const cardRows = await tx
      .select({
        id: cards.id,
        createdAt: cards.createdAt,
        startedAt: cards.startedAt,
        doneAt: cards.doneAt,
        archivedAt: cards.archivedAt,
        category: columns.category,
      })
      .from(cards)
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(eq(cards.boardId, boardId));
    const since = new Date(`${addDaysIso(today, -35)}T00:00:00Z`);
    const transitionRows = await tx
      .select({
        cardId: cardTransitions.cardId,
        toCategory: cardTransitions.toCategory,
        at: cardTransitions.at,
      })
      .from(cardTransitions)
      .where(and(eq(cardTransitions.boardId, boardId), gt(cardTransitions.at, since)));
    // Cards that already had a state before the window opened: their
    // last transition before it seeds the replay, so day one is not empty.
    const seedRows = await tx
      .select({
        cardId: cardTransitions.cardId,
        toCategory: cardTransitions.toCategory,
        at: sql<Date>`max(${cardTransitions.at})`,
      })
      .from(cardTransitions)
      .where(and(eq(cardTransitions.boardId, boardId), sql`${cardTransitions.at} <= ${since}`))
      .groupBy(cardTransitions.cardId, cardTransitions.toCategory);
    const sprintRows = await tx
      .select()
      .from(sprints)
      .where(eq(sprints.boardId, boardId))
      .orderBy(desc(sprints.number));
    const active = sprintRows.find((s) => s.state === "active") ?? null;
    let activeBurndown: BoardInsight["activeBurndown"] = null;
    if (active) {
      const sprintCards = await tx
        .select({ estimate: cards.estimate, doneAt: cards.doneAt, createdAt: cards.createdAt })
        .from(cards)
        .where(and(eq(cards.sprintId, active.id), isNull(cards.archivedAt)));
      activeBurndown = {
        ...burndown(active, sprintCards, today),
        sprint: { id: active.id, name: active.name, endDate: active.endDate },
      };
    }
    const flowCards = cardRows.filter((c) => !c.archivedAt || c.doneAt);
    const seeds = latestPerCard(seedRows.map((r) => ({ ...r, at: new Date(r.at) })));
    return {
      today,
      wip: cardRows.filter((c) => !c.archivedAt && c.category === "doing").length,
      throughput: throughput(flowCards, today),
      cycle: cycleTime(flowCards, today),
      flow: cumulativeFlow([...seeds, ...transitionRows], today),
      velocity: velocity(sprintRows),
      activeBurndown,
    };
  });
}

/** One row per card: the transition with the latest timestamp. */
function latestPerCard<T extends { cardId: string; at: Date }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(row.cardId);
    if (!current || current.at.getTime() < row.at.getTime()) latest.set(row.cardId, row);
  }
  return [...latest.values()];
}

/** The burndown of one sprint, closed ones included, for the sprint page. */
export async function sprintBurndown(ctx: OrgContext, sprintId: string): Promise<Burndown | null> {
  return withOrgContext(ctx, async (tx) => {
    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, sprintId)).limit(1);
    if (!sprint) return null;
    const rows = await tx
      .select({ estimate: cards.estimate, doneAt: cards.doneAt, createdAt: cards.createdAt })
      .from(cards)
      .where(and(eq(cards.sprintId, sprint.id), isNull(cards.archivedAt)));
    const today = todayInCopenhagen();
    // A closed sprint is drawn to its end, whatever today is.
    return burndown(sprint, rows, sprint.state === "closed" ? sprint.endDate : today);
  });
}
