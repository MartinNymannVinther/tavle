import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { areas, themes, type Area, type Theme, type ThemeColor } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "../events";
import { memberInWorkspace } from "../members";
import { boardInWorkspace } from "../read";
import { MAX_ACTIVE_AREAS, MAX_ACTIVE_THEMES, RuleViolation } from "./rules";

/**
 * The two closed lists: themes (why) and areas (where). Both have a named
 * owner, both are deactivated rather than deleted so history keeps its
 * names, and neither has a status or ever finishes. A theme carries a
 * colour for the roadmap; an area does not need one.
 */

export class NameTaken extends Error {
  constructor() {
    super("conflict");
    this.name = "NameTaken";
  }
}

async function nameFree(
  tx: AppTransaction,
  table: typeof themes | typeof areas,
  boardId: string,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.boardId, boardId), sql`lower(${table.name}) = lower(${name})`));
  return rows.every((row) => row.id === exceptId);
}

async function activeCount(
  tx: AppTransaction,
  table: typeof themes | typeof areas,
  boardId: string,
): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(table)
    .where(and(eq(table.boardId, boardId), eq(table.active, true)));
  return Number(row?.n ?? 0);
}

async function ownerId(tx: AppTransaction, userId: string | null | undefined) {
  const member = await memberInWorkspace(tx, userId);
  return member?.id ?? null;
}

export async function createTheme(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; name: string; color: ThemeColor; ownerUserId?: string | null },
): Promise<Theme> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) throw new Error("notFound");
  if (!(await nameFree(tx, themes, board.id, input.name))) throw new NameTaken();
  if ((await activeCount(tx, themes, board.id)) >= MAX_ACTIVE_THEMES) {
    throw new RuleViolation("themeLimit");
  }
  const [row] = await tx
    .insert(themes)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      name: input.name,
      color: input.color,
      ownerUserId: await ownerId(tx, input.ownerUserId),
      sort: await activeCount(tx, themes, board.id),
    })
    .returning();
  await recordEvent(
    tx,
    ctx,
    board.id,
    "theme.created",
    { name: input.name },
    { undo: { kind: "theme.active", themeId: row!.id, active: false } },
  );
  return row!;
}

export async function updateTheme(
  tx: AppTransaction,
  ctx: OrgContext,
  input: {
    themeId: string;
    name: string;
    color: ThemeColor;
    ownerUserId: string | null;
    active: boolean;
  },
): Promise<Theme | null> {
  const [theme] = await tx.select().from(themes).where(eq(themes.id, input.themeId)).limit(1);
  if (!theme) return null;
  if (!(await nameFree(tx, themes, theme.boardId, input.name, theme.id))) throw new NameTaken();
  if (input.active && !theme.active) {
    if ((await activeCount(tx, themes, theme.boardId)) >= MAX_ACTIVE_THEMES) {
      throw new RuleViolation("themeLimit");
    }
  }
  const owner = await ownerId(tx, input.ownerUserId);
  await tx
    .update(themes)
    .set({
      name: input.name,
      color: input.color,
      ownerUserId: owner,
      active: input.active,
    })
    .where(eq(themes.id, theme.id));
  // A rename, a recolour or a new owner is a change to the shape of the
  // board like any other, and the settings page promises a Fortryd on
  // it. Without a line of its own it had neither: the audit trigger saw
  // it, but no feed did, and nothing carried its reverse.
  if (theme.name !== input.name || theme.color !== input.color || theme.ownerUserId !== owner) {
    await recordEvent(
      tx,
      ctx,
      theme.boardId,
      "theme.updated",
      { name: input.name, from: theme.name },
      {
        undo: {
          kind: "theme.update",
          themeId: theme.id,
          name: theme.name,
          color: theme.color,
          ownerUserId: theme.ownerUserId,
        },
      },
    );
  }
  if (theme.active !== input.active) {
    await recordEvent(
      tx,
      ctx,
      theme.boardId,
      input.active ? "theme.activated" : "theme.deactivated",
      { name: input.name },
      { undo: { kind: "theme.active", themeId: theme.id, active: theme.active } },
    );
  }
  return theme;
}

export async function createArea(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; name: string; ownerUserId?: string | null },
): Promise<Area> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) throw new Error("notFound");
  if (!(await nameFree(tx, areas, board.id, input.name))) throw new NameTaken();
  if ((await activeCount(tx, areas, board.id)) >= MAX_ACTIVE_AREAS) throw new Error("invalid");
  const [row] = await tx
    .insert(areas)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      name: input.name,
      ownerUserId: await ownerId(tx, input.ownerUserId),
      sort: await activeCount(tx, areas, board.id),
    })
    .returning();
  await recordEvent(
    tx,
    ctx,
    board.id,
    "area.created",
    { name: input.name },
    { undo: { kind: "area.active", areaId: row!.id, active: false } },
  );
  return row!;
}

export async function updateArea(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { areaId: string; name: string; ownerUserId: string | null; active: boolean },
): Promise<Area | null> {
  const [area] = await tx.select().from(areas).where(eq(areas.id, input.areaId)).limit(1);
  if (!area) return null;
  if (!(await nameFree(tx, areas, area.boardId, input.name, area.id))) throw new NameTaken();
  const owner = await ownerId(tx, input.ownerUserId);
  await tx
    .update(areas)
    .set({
      name: input.name,
      ownerUserId: owner,
      active: input.active,
    })
    .where(eq(areas.id, area.id));
  // As for a theme: the rename and the new owner are their own fact,
  // with their own reverse.
  if (area.name !== input.name || area.ownerUserId !== owner) {
    await recordEvent(
      tx,
      ctx,
      area.boardId,
      "area.updated",
      { name: input.name, from: area.name },
      {
        undo: {
          kind: "area.update",
          areaId: area.id,
          name: area.name,
          ownerUserId: area.ownerUserId,
        },
      },
    );
  }
  if (area.active !== input.active) {
    await recordEvent(
      tx,
      ctx,
      area.boardId,
      input.active ? "area.activated" : "area.deactivated",
      { name: input.name },
      { undo: { kind: "area.active", areaId: area.id, active: area.active } },
    );
  }
  return area;
}

/**
 * Rule 3 on a board that hides areas: nobody can choose one, so a thing
 * with no parent takes the board's first active area, quietly. It is
 * still a real area on a real row, and it shows the day the field is
 * switched on again. On a board that shows areas the choice stays with
 * the person, and the rule refuses as before.
 */
export async function settleArea(
  tx: AppTransaction,
  board: { id: string; showAreas: boolean },
  parentId: string | null,
  area: Area | null,
): Promise<Area | null> {
  if (area || parentId || board.showAreas) return area;
  const [first] = await tx
    .select()
    .from(areas)
    .where(and(eq(areas.boardId, board.id), eq(areas.active, true)))
    .orderBy(asc(areas.sort), asc(areas.createdAt))
    .limit(1);
  return first ?? null;
}

/** An active area of the board, or null; a deactivated one cannot be set on anything new. */
export async function activeAreaInBoard(
  tx: AppTransaction,
  boardId: string,
  areaId: string | null | undefined,
): Promise<Area | null> {
  if (!areaId) return null;
  const [row] = await tx
    .select()
    .from(areas)
    .where(and(eq(areas.id, areaId), eq(areas.boardId, boardId)))
    .limit(1);
  if (!row) throw new Error("notFound");
  if (!row.active) throw new RuleViolation("inactiveCategory");
  return row;
}

/** The board's themes among the ids given, active only; unknown ids are refused, not dropped. */
export async function activeThemesInBoard(
  tx: AppTransaction,
  boardId: string,
  themeIds: string[],
): Promise<Theme[]> {
  if (themeIds.length === 0) return [];
  const unique = [...new Set(themeIds)];
  const rows = await tx
    .select()
    .from(themes)
    .where(and(eq(themes.boardId, boardId), inArray(themes.id, unique)));
  if (rows.length !== unique.length) throw new Error("notFound");
  if (rows.some((row) => !row.active)) throw new RuleViolation("inactiveCategory");
  return unique.map((themeId) => rows.find((row) => row.id === themeId)!);
}
