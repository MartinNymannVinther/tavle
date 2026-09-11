import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  boards,
  cardLabels,
  cards,
  columns,
  comments,
  labels,
  memberships,
  sprints,
  users,
  type Board,
  type BoardMode,
  type Card,
  type Sprint,
} from "@/core/db/schema";
import { withOrgContext, type AppTransaction, type OrgContext } from "@/core/db/tenant";
import { cardEvents } from "./events";
import type { BoardFull, BoardSummary, CardFull, CardView, Member, MyCard } from "./types";

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

/** Resolves rows of cards into views: names, label ids, checklist and comment counts. */
async function toViews(tx: AppTransaction, rows: Card[]): Promise<CardView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.id);
  const labelRows = await tx
    .select({ cardId: cardLabels.cardId, labelId: cardLabels.labelId })
    .from(cardLabels)
    .where(inArray(cardLabels.cardId, ids));
  const commentRows = await tx
    .select({ cardId: comments.cardId, n: sql<number>`count(*)::int` })
    .from(comments)
    .where(inArray(comments.cardId, ids))
    .groupBy(comments.cardId);
  const assigneeIds = [...new Set(rows.map((c) => c.assigneeUserId).filter(Boolean))] as string[];
  const people =
    assigneeIds.length > 0
      ? await tx
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, assigneeIds))
      : [];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const labelsOf = new Map<string, string[]>();
  for (const row of labelRows) {
    labelsOf.set(row.cardId, [...(labelsOf.get(row.cardId) ?? []), row.labelId]);
  }
  const commentsOf = new Map(commentRows.map((r) => [r.cardId, Number(r.n)]));
  return rows.map((card) => ({
    ...card,
    assigneeName: card.assigneeUserId ? (nameOf.get(card.assigneeUserId) ?? null) : null,
    labelIds: labelsOf.get(card.id) ?? [],
    checklistDone: card.checklist.filter((item) => item.done).length,
    checklistTotal: card.checklist.length,
    commentCount: commentsOf.get(card.id) ?? 0,
  }));
}

export async function boardInWorkspace(tx: AppTransaction, boardId: string): Promise<Board | null> {
  const [row] = await tx.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  return row ?? null;
}

export async function listBoards(ctx: OrgContext): Promise<BoardSummary[]> {
  return withOrgContext(ctx, async (tx) => {
    const rows = await tx.select().from(boards).orderBy(asc(boards.name));
    if (rows.length === 0) return [];
    const boardIds = rows.map((b) => b.id);
    const counts = await tx
      .select({
        boardId: cards.boardId,
        category: columns.category,
        n: sql<number>`count(*)::int`,
      })
      .from(cards)
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(and(inArray(cards.boardId, boardIds), isNull(cards.archivedAt)))
      .groupBy(cards.boardId, columns.category);
    const active = await tx
      .select({
        id: sprints.id,
        boardId: sprints.boardId,
        name: sprints.name,
        endDate: sprints.endDate,
      })
      .from(sprints)
      .where(and(inArray(sprints.boardId, boardIds), eq(sprints.state, "active")));
    const activeOf = new Map(active.map((s) => [s.boardId, s]));

    return rows.map((board) => {
      const mine = counts.filter((c) => c.boardId === board.id);
      const sum = (pick: (category: string) => boolean) =>
        mine.filter((c) => pick(c.category)).reduce((total, c) => total + Number(c.n), 0);
      const sprint = activeOf.get(board.id);
      return {
        id: board.id,
        name: board.name,
        key: board.key,
        mode: board.mode as BoardMode,
        description: board.description,
        archivedAt: board.archivedAt,
        updatedAt: board.updatedAt,
        openCount: sum((c) => c !== "done"),
        doneCount: sum((c) => c === "done"),
        inProgressCount: sum((c) => c === "doing"),
        activeSprint: sprint ? { id: sprint.id, name: sprint.name, endDate: sprint.endDate } : null,
      };
    });
  });
}

export async function getBoardFull(ctx: OrgContext, boardId: string): Promise<BoardFull | null> {
  return withOrgContext(ctx, async (tx) => {
    const board = await boardInWorkspace(tx, boardId);
    if (!board) return null;
    const [columnRows, labelRows, sprintRows, cardRows, members] = await Promise.all([
      tx.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.sort)),
      tx.select().from(labels).where(eq(labels.boardId, boardId)).orderBy(asc(labels.sort)),
      tx.select().from(sprints).where(eq(sprints.boardId, boardId)).orderBy(desc(sprints.number)),
      tx
        .select()
        .from(cards)
        .where(and(eq(cards.boardId, boardId), isNull(cards.archivedAt)))
        .orderBy(asc(cards.sort), asc(cards.number)),
      membersOf(tx, ctx.orgId),
    ]);
    return {
      board,
      columns: columnRows,
      labels: labelRows,
      cards: await toViews(tx, cardRows),
      sprints: sprintRows,
      activeSprint: sprintRows.find((s) => s.state === "active") ?? null,
      members,
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
    const [columnRows, labelRows, sprintRows, members, commentRows, eventRows] = await Promise.all([
      tx.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.sort)),
      tx.select().from(labels).where(eq(labels.boardId, boardId)).orderBy(asc(labels.sort)),
      tx
        .select()
        .from(sprints)
        .where(and(eq(sprints.boardId, boardId), inArray(sprints.state, ["planned", "active"])))
        .orderBy(asc(sprints.number)),
      membersOf(tx, ctx.orgId),
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
      card: view!,
      board,
      columns: columnRows,
      labels: labelRows,
      sprints: sprintRows,
      members,
      comments: commentRows,
      events: eventRows,
    };
  });
}

/** The caller's own open cards across every board, for the "my cards" page. */
export async function listMyCards(ctx: OrgContext): Promise<MyCard[]> {
  return withOrgContext(ctx, async (tx) => {
    const rows = await tx
      .select({
        card: cards,
        boardName: boards.name,
        boardKey: boards.key,
        columnName: columns.name,
        columnCategory: columns.category,
      })
      .from(cards)
      .innerJoin(boards, eq(boards.id, cards.boardId))
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(
        and(
          eq(cards.assigneeUserId, ctx.userId),
          isNull(cards.archivedAt),
          isNull(boards.archivedAt),
          sql`${columns.category} <> 'done'`,
        ),
      )
      .orderBy(asc(boards.name), asc(columns.sort), asc(cards.sort));
    const views = await toViews(
      tx,
      rows.map((r) => r.card),
    );
    return views.map((view, i) => ({
      ...view,
      boardName: rows[i]!.boardName,
      boardKey: rows[i]!.boardKey,
      columnName: rows[i]!.columnName,
      columnCategory: rows[i]!.columnCategory,
    }));
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
