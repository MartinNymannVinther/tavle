import { and, eq } from "drizzle-orm";
import { backlogItems, boards, cards } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { boardInWorkspace } from "./read";

/**
 * Just the words for a browser tab. generateMetadata runs beside the
 * page on every request, so it must not pay for the whole board again —
 * each of these is one narrow query where the page loader runs a dozen.
 */

export async function boardTitle(ctx: OrgContext, boardId: string): Promise<string | null> {
  return withOrgContext(ctx, async (tx) => (await boardInWorkspace(tx, boardId))?.name ?? null);
}

export async function cardTitle(
  ctx: OrgContext,
  boardId: string,
  number: number,
): Promise<string | null> {
  return withOrgContext(ctx, async (tx) => {
    const [row] = await tx
      .select({ key: boards.key, number: cards.number, title: cards.title })
      .from(cards)
      .innerJoin(boards, eq(boards.id, cards.boardId))
      .where(and(eq(cards.boardId, boardId), eq(cards.number, number)))
      .limit(1);
    return row ? `${row.key}-${row.number} ${row.title}` : null;
  });
}

export async function itemTitle(
  ctx: OrgContext,
  boardId: string,
  number: number,
): Promise<string | null> {
  return withOrgContext(ctx, async (tx) => {
    const [row] = await tx
      .select({ key: boards.key, number: backlogItems.number, title: backlogItems.title })
      .from(backlogItems)
      .innerJoin(boards, eq(boards.id, backlogItems.boardId))
      .where(and(eq(backlogItems.boardId, boardId), eq(backlogItems.number, number)))
      .limit(1);
    return row ? `${row.key}-${row.number} ${row.title}` : null;
  });
}
