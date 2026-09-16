import { and, asc, eq, inArray } from "drizzle-orm";
import { cards, releases, type Release } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "./events";
import { NameTaken } from "./structure/write-lists";
import { placeInLane, sortAtEnd, type Positioned } from "./ordering";
import { boardInWorkspace } from "./read";

/**
 * Releases (docs/adr/0032): the bands a story map is divided into, and
 * the one thing on a board that answers "what ships together". A card
 * belongs to at most one, the same rule its feature and its sprint
 * follow, so a release's weight is a sum nobody has to qualify.
 *
 * Deleting a release frees its cards rather than taking them with it.
 * A band is a way of grouping work, and removing the grouping must
 * never remove the work — the same promise a deactivated theme makes.
 */

export async function releasesOf(tx: AppTransaction, boardId: string): Promise<Release[]> {
  return tx
    .select()
    .from(releases)
    .where(eq(releases.boardId, boardId))
    .orderBy(asc(releases.sort), asc(releases.createdAt));
}

async function lane(tx: AppTransaction, boardId: string): Promise<Positioned[]> {
  return (await releasesOf(tx, boardId)).map((r) => ({ id: r.id, sort: r.sort }));
}

export async function createRelease(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; name: string; targetDate?: string | null },
): Promise<Release | null> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) return null;
  const name = input.name.trim();
  const existing = await releasesOf(tx, board.id);
  if (existing.some((r) => r.name.toLowerCase() === name.toLowerCase())) throw new NameTaken();
  const [row] = await tx
    .insert(releases)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      name,
      targetDate: input.targetDate ?? null,
      sort: sortAtEnd(await lane(tx, board.id)),
    })
    .returning();
  await recordEvent(tx, ctx, board.id, "release.created", { name });
  return row!;
}

export async function updateRelease(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { releaseId: string; name: string; targetDate: string | null },
): Promise<Release | null> {
  const [release] = await tx
    .select()
    .from(releases)
    .where(eq(releases.id, input.releaseId))
    .limit(1);
  if (!release) return null;
  const name = input.name.trim();
  const others = (await releasesOf(tx, release.boardId)).filter((r) => r.id !== release.id);
  if (others.some((r) => r.name.toLowerCase() === name.toLowerCase())) throw new NameTaken();
  const [row] = await tx
    .update(releases)
    .set({ name, targetDate: input.targetDate })
    .where(eq(releases.id, release.id))
    .returning();
  await recordEvent(
    tx,
    ctx,
    release.boardId,
    "release.updated",
    { name, date: input.targetDate ?? "" },
    {
      undo: {
        kind: "release.update",
        releaseId: release.id,
        name: release.name,
        targetDate: release.targetDate,
      },
    },
  );
  return row ?? null;
}

/** Nearest release first; the order the map's bands are drawn in. */
export async function reorderRelease(
  tx: AppTransaction,
  ctx: OrgContext,
  releaseId: string,
  index: number,
): Promise<Release | null> {
  const [release] = await tx.select().from(releases).where(eq(releases.id, releaseId)).limit(1);
  if (!release) return null;
  const before = await lane(tx, release.boardId);
  for (const change of placeInLane(before, release.id, index)) {
    await tx.update(releases).set({ sort: change.sort }).where(eq(releases.id, change.id));
  }
  await recordEvent(
    tx,
    ctx,
    release.boardId,
    "release.reordered",
    { name: release.name },
    { undo: { kind: "releases.order", boardId: release.boardId, order: before.map((r) => r.id) } },
  );
  return release;
}

/**
 * The band goes; the work stays. The cards' `release_id` is cleared by
 * the foreign key, so they fall back into the unreleased band where
 * somebody can place them again.
 */
export async function deleteRelease(
  tx: AppTransaction,
  ctx: OrgContext,
  releaseId: string,
): Promise<Release | null> {
  const [release] = await tx.select().from(releases).where(eq(releases.id, releaseId)).limit(1);
  if (!release) return null;
  const freed = await tx
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.releaseId, release.id));
  await tx.delete(releases).where(eq(releases.id, release.id));
  await recordEvent(tx, ctx, release.boardId, "release.deleted", {
    name: release.name,
    cards: freed.length,
  });
  return release;
}

/** Puts cards in a release, or takes them out of one. */
export async function setCardsRelease(
  tx: AppTransaction,
  ctx: OrgContext,
  cardIds: string[],
  releaseId: string | null,
): Promise<number> {
  if (cardIds.length === 0) return 0;
  const rows = await tx.select().from(cards).where(inArray(cards.id, cardIds));
  if (rows.length === 0) return 0;
  const board = await boardInWorkspace(tx, rows[0]!.boardId);
  if (!board) return 0;

  let release: Release | null = null;
  if (releaseId) {
    const [found] = await tx
      .select()
      .from(releases)
      .where(and(eq(releases.id, releaseId), eq(releases.boardId, board.id)))
      .limit(1);
    // A release from another board is not a placement this board can make.
    if (!found) return 0;
    release = found;
  }

  let moved = 0;
  for (const card of rows) {
    if (card.boardId !== board.id || card.releaseId === (release?.id ?? null)) continue;
    await tx
      .update(cards)
      .set({ releaseId: release?.id ?? null })
      .where(eq(cards.id, card.id));
    await recordEvent(
      tx,
      ctx,
      board.id,
      release ? "card.released" : "card.unreleased",
      { key: `${board.key}-${card.number}`, title: card.title, name: release?.name ?? "" },
      {
        cardId: card.id,
        undo: { kind: "card.release", cardId: card.id, releaseId: card.releaseId },
      },
    );
    moved += 1;
  }
  return moved;
}
