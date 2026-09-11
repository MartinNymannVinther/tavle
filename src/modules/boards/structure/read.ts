import { and, asc, eq, isNull } from "drizzle-orm";
import { backlogItems, cards, columns, type Area, type Board, type Theme } from "@/core/db/schema";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import { itemEvents } from "../events";
import { boardAreas, boardInWorkspace, boardThemes, itemViews, membersOf } from "../read";
import type { BoardEvent } from "@/core/db/schema";
import type { ItemView, Member } from "../types";
import { reviewDue } from "./rules";

/**
 * What the epic and feature pages read. The children come with the
 * counts the page shows against them, the open epics come along for the
 * parent select, and the review flag is computed here from the board's
 * setting rather than stored anywhere.
 */

export type ChildFeature = ItemView & { openStories: number; doneStories: number };

export type ChildStory = {
  id: string;
  number: number;
  title: string;
  estimate: number | null;
  bug: boolean;
  blocked: boolean;
  areaId: string | null;
  columnName: string;
  category: string;
  sprintId: string | null;
  assigneeName: string | null;
};

export type ItemFull = {
  item: ItemView;
  board: Board;
  parent: ItemView | null;
  /** An epic's features, in rank order. */
  features: ChildFeature[];
  /** A feature's stories, in board order; done and archived ones are counted, open ones listed. */
  stories: ChildStory[];
  doneStories: number;
  /** Open epics, for moving a feature; open features, for moving a story. */
  epics: ItemView[];
  openFeatures: ItemView[];
  themes: Theme[];
  areas: Area[];
  members: Member[];
  events: BoardEvent[];
  reviewDue: boolean;
};

export async function getItemFull(
  ctx: OrgContext,
  boardId: string,
  number: number,
): Promise<ItemFull | null> {
  return withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const [row] = await tx
      .select()
      .from(backlogItems)
      .where(and(eq(backlogItems.boardId, boardId), eq(backlogItems.number, number)))
      .limit(1);
    if (!row) return null;
    const [item] = await itemViews(tx, [row]);
    const parentRow = row.parentId
      ? (await tx.select().from(backlogItems).where(eq(backlogItems.id, row.parentId)).limit(1))[0]
      : undefined;
    const [parent] = parentRow ? await itemViews(tx, [parentRow]) : [null];

    const features: ChildFeature[] = [];
    const stories: ChildStory[] = [];
    let doneStories = 0;
    if (row.level === "epic") {
      const featureRows = await tx
        .select()
        .from(backlogItems)
        .where(eq(backlogItems.parentId, row.id))
        .orderBy(asc(backlogItems.sort), asc(backlogItems.number));
      const views = await itemViews(tx, featureRows);
      for (const view of views) {
        const counts = await storyCounts(tx, view.id);
        features.push({ ...view, ...counts });
      }
    } else {
      const storyRows = await tx
        .select({
          id: cards.id,
          number: cards.number,
          title: cards.title,
          estimate: cards.estimate,
          bug: cards.bug,
          blocked: cards.blocked,
          areaId: cards.areaId,
          sprintId: cards.sprintId,
          assigneeUserId: cards.assigneeUserId,
          columnName: columns.name,
          category: columns.category,
        })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.featureId, row.id), isNull(cards.archivedAt)))
        .orderBy(asc(columns.sort), asc(cards.sort), asc(cards.number));
      const members = await membersOf(tx, ctx.orgId);
      const nameOf = new Map(members.map((m) => [m.userId, m.name]));
      for (const story of storyRows) {
        if (story.category === "done") doneStories += 1;
        const { assigneeUserId, ...rest } = story;
        stories.push({
          ...rest,
          assigneeName: assigneeUserId ? (nameOf.get(assigneeUserId) ?? null) : null,
        });
      }
    }

    const openRows = await tx
      .select()
      .from(backlogItems)
      .where(and(eq(backlogItems.boardId, boardId), eq(backlogItems.state, "open")))
      .orderBy(asc(backlogItems.sort), asc(backlogItems.number));
    const openViews = await itemViews(tx, openRows);

    return {
      item: item!,
      board,
      parent: parent ?? null,
      features,
      stories,
      doneStories,
      epics: openViews.filter((i) => i.level === "epic"),
      openFeatures: openViews.filter((i) => i.level === "feature"),
      themes: await boardThemes(tx, boardId),
      areas: await boardAreas(tx, boardId),
      members: await membersOf(tx, ctx.orgId),
      events: await itemEvents(tx, row.id),
      reviewDue: reviewDue(row, board.epicReviewDays),
    };
  });
}

/** Open and done stories under a feature; archived ones are neither. */
export async function storyCounts(
  tx: AppTransaction,
  featureId: string,
): Promise<{ openStories: number; doneStories: number }> {
  const rows = await tx
    .select({ category: columns.category })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(and(eq(cards.featureId, featureId), isNull(cards.archivedAt)));
  const done = rows.filter((r) => r.category === "done").length;
  return { openStories: rows.length - done, doneStories: done };
}
