import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  areas,
  backlogItems,
  boards,
  cardThemes,
  cards,
  columns,
  comments,
  memberships,
  people,
  sprints,
  swimlanes,
  themes,
  users,
  type BacklogItem,
  type Board,
  type Card,
  type Sprint,
} from "@/core/db/schema";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import { cardEvents } from "./events";
import { releasesOf } from "./write-releases";
import { themeIdsByItem } from "./structure/items";
import type { BoardFull, CardFull, CardView, ItemView, Member, PersonRef } from "./types";

/**
 * Everything the pages read, through the workspace's own context. A board
 * or card id from another workspace is simply not there: the ownership
 * check and the row-level policy are the same thing.
 */

/** The people in the workspace, readable by the application role through the members policy. */
export async function membersOf(tx: AppTransaction, orgId: string): Promise<Member[]> {
  return tx
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, orgId))
    .orderBy(asc(users.name));
}

/** The roster as the pickers need it: id, name, and whether a login stands behind it. */
export async function rosterOf(tx: AppTransaction, orgId: string): Promise<PersonRef[]> {
  return tx
    .select({ id: people.id, name: people.name, userId: people.userId })
    .from(people)
    .where(eq(people.orgId, orgId))
    .orderBy(asc(people.name));
}

/** Resolves rows of cards into views: names, theme ids, checklist and comment counts. */
export async function toViews(tx: AppTransaction, rows: Card[]): Promise<CardView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.id);
  const themeRows = await tx
    .select({ cardId: cardThemes.cardId, themeId: cardThemes.themeId })
    .from(cardThemes)
    .where(inArray(cardThemes.cardId, ids));
  const commentRows = await tx
    .select({ cardId: comments.cardId, n: sql<number>`count(*)::int` })
    .from(comments)
    .where(inArray(comments.cardId, ids))
    .groupBy(comments.cardId);
  const assigneeIds = [...new Set(rows.map((c) => c.assigneePersonId).filter(Boolean))] as string[];
  const assignees =
    assigneeIds.length > 0
      ? await tx
          .select({ id: people.id, name: people.name })
          .from(people)
          .where(inArray(people.id, assigneeIds))
      : [];
  const nameOf = new Map(assignees.map((p) => [p.id, p.name]));
  const themesOf = new Map<string, string[]>();
  for (const row of themeRows) {
    themesOf.set(row.cardId, [...(themesOf.get(row.cardId) ?? []), row.themeId]);
  }
  const commentsOf = new Map(commentRows.map((r) => [r.cardId, Number(r.n)]));
  // The prose stays behind: six surfaces ship every card to the client,
  // and none of them renders a description or a checklist item.
  return rows.map(({ description, acceptance, blockedReason, checklist, ...card }) => ({
    ...card,
    descriptionPreview: description.replace(/\s+/g, " ").trim().slice(0, 200),
    assigneeName: card.assigneePersonId ? (nameOf.get(card.assigneePersonId) ?? null) : null,
    themeIds: themesOf.get(card.id) ?? [],
    checklistDone: checklist.filter((item) => item.done).length,
    checklistTotal: checklist.length,
    commentCount: commentsOf.get(card.id) ?? 0,
  }));
}

export async function boardInWorkspace(tx: AppTransaction, boardId: string): Promise<Board | null> {
  const [row] = await tx.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  return row ?? null;
}

/** Epics and features with their theme ids, in rank order within each level. */
export async function itemViews(tx: AppTransaction, rows: BacklogItem[]): Promise<ItemView[]> {
  const themesOf = await themeIdsByItem(
    tx,
    rows.map((r) => r.id),
  );
  return rows.map((item) => ({ ...item, themeIds: themesOf.get(item.id) ?? [] }));
}

export async function boardThemes(tx: AppTransaction, boardId: string) {
  return tx.select().from(themes).where(eq(themes.boardId, boardId)).orderBy(asc(themes.sort));
}

export async function boardAreas(tx: AppTransaction, boardId: string) {
  return tx.select().from(areas).where(eq(areas.boardId, boardId)).orderBy(asc(areas.sort));
}

export async function boardSwimlanes(tx: AppTransaction, boardId: string) {
  return tx
    .select()
    .from(swimlanes)
    .where(eq(swimlanes.boardId, boardId))
    .orderBy(asc(swimlanes.sort), asc(swimlanes.createdAt));
}

export async function boardItems(tx: AppTransaction, boardId: string): Promise<ItemView[]> {
  const rows = await tx
    .select()
    .from(backlogItems)
    .where(eq(backlogItems.boardId, boardId))
    .orderBy(asc(backlogItems.sort), asc(backlogItems.number));
  return itemViews(tx, rows);
}

export async function getBoardFull(ctx: OrgContext, boardId: string): Promise<BoardFull | null> {
  return withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const [
      columnRows,
      themeRows,
      areaRows,
      swimlaneRows,
      releaseRows,
      itemRows,
      sprintRows,
      cardRows,
      members,
      roster,
    ] = await Promise.all([
      tx.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.sort)),
      boardThemes(tx, boardId),
      boardAreas(tx, boardId),
      boardSwimlanes(tx, boardId),
      releasesOf(tx, boardId),
      boardItems(tx, boardId),
      tx.select().from(sprints).where(eq(sprints.boardId, boardId)).orderBy(desc(sprints.number)),
      tx
        .select()
        .from(cards)
        .where(and(eq(cards.boardId, boardId), isNull(cards.archivedAt)))
        .orderBy(asc(cards.sort), asc(cards.number)),
      membersOf(tx, ctx.orgId),
      rosterOf(tx, ctx.orgId),
    ]);
    return {
      board,
      columns: columnRows,
      themes: themeRows,
      areas: areaRows,
      swimlanes: swimlaneRows,
      releases: releaseRows,
      items: itemRows,
      cards: await toViews(tx, cardRows),
      sprints: sprintRows,
      activeSprint: sprintRows.find((s) => s.state === "active") ?? null,
      members,
      people: roster,
    };
  });
}

/** A card by its board and number, the way it is written on the board: WEB-12. */
export async function getCardFull(
  ctx: OrgContext,
  boardId: string,
  number: number,
): Promise<CardFull | null> {
  return withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const [row] = await tx
      .select()
      .from(cards)
      .where(and(eq(cards.boardId, boardId), eq(cards.number, number)))
      .limit(1);
    if (!row) return null;
    const [view] = await toViews(tx, [row]);
    const [
      columnRows,
      themeRows,
      areaRows,
      featureRows,
      sprintRows,
      roster,
      commentRows,
      eventRows,
    ] = await Promise.all([
      tx.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.sort)),
      boardThemes(tx, boardId),
      boardAreas(tx, boardId),
      tx
        .select()
        .from(backlogItems)
        .where(and(eq(backlogItems.boardId, boardId), eq(backlogItems.level, "feature")))
        .orderBy(asc(backlogItems.sort), asc(backlogItems.number)),
      tx
        .select()
        .from(sprints)
        .where(and(eq(sprints.boardId, boardId), inArray(sprints.state, ["planned", "active"])))
        .orderBy(asc(sprints.number)),
      rosterOf(tx, ctx.orgId),
      tx
        .select({
          id: comments.id,
          orgId: comments.orgId,
          cardId: comments.cardId,
          authorUserId: comments.authorUserId,
          text: comments.text,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          authorName: users.name,
        })
        .from(comments)
        .leftJoin(users, eq(users.id, comments.authorUserId))
        .where(eq(comments.cardId, row.id))
        .orderBy(asc(comments.createdAt)),
      cardEvents(tx, row.id),
    ]);
    return {
      card: {
        ...view!,
        description: row.description,
        acceptance: row.acceptance,
        checklist: row.checklist,
        blockedReason: row.blockedReason,
      },
      board,
      columns: columnRows,
      themes: themeRows,
      areas: areaRows,
      features: await itemViews(
        tx,
        featureRows.filter((f) => f.state === "open" || f.id === row.featureId),
      ),
      sprints: sprintRows,
      people: roster,
      comments: commentRows,
      events: eventRows,
    };
  });
}

/** Sprints of a board, newest first, with the cards on each for the sprint pages. */
export async function listSprints(ctx: OrgContext, boardId: string): Promise<Sprint[]> {
  return withOrgContext(ctx, (tx) =>
    tx.select().from(sprints).where(eq(sprints.boardId, boardId)).orderBy(desc(sprints.number)),
  );
}

/** What the board's own layout needs on every page under it: the board and its active sprint. */
export async function getBoardHeader(
  ctx: OrgContext,
  boardId: string,
): Promise<{ board: Board; activeSprint: Sprint | null; role: string } | null> {
  return withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const [active] = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, boardId), eq(sprints.state, "active")))
      .limit(1);
    const [membership] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, ctx.userId), eq(memberships.organizationId, ctx.orgId)))
      .limit(1);
    return { board, activeSprint: active ?? null, role: membership?.role ?? "member" };
  });
}
