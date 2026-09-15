import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { boards, cards, columns, people, sprints, type BoardMode } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { toViews } from "./read";
import type { BoardSummary, MyCard } from "./types";

/**
 * The two lists across boards: every board of the workspace with its
 * counts, and the caller's own open cards. Read through the workspace's
 * own context like everything in read.ts.
 */

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
      // "Mine" means the person my login stands behind (docs/adr/0029).
      .innerJoin(people, eq(people.id, cards.assigneePersonId))
      .where(
        and(
          eq(people.userId, ctx.userId),
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
