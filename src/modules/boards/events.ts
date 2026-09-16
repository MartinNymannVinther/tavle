import { desc, eq } from "drizzle-orm";
import { events } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";

/**
 * The board's own history as structured facts. The type names what
 * happened and the payload carries the names a sentence needs;
 * `messages/*.json` under `events` turns them into a line in the reader's
 * language, and the same lines are what the AI reads when it summarises a
 * sprint.
 */
export type EventType =
  | "board.created"
  | "board.updated"
  | "board.view"
  | "column.created"
  | "column.updated"
  | "column.deleted"
  | "theme.created"
  | "theme.activated"
  | "theme.deactivated"
  | "area.created"
  | "area.activated"
  | "area.deactivated"
  | "item.created"
  | "item.updated"
  | "item.moved"
  | "item.placed"
  | "item.closed"
  | "item.reopened"
  | "item.reviewed"
  | "item.planned"
  | "item.cascaded"
  | "item.mapped"
  | "item.unmapped"
  | "backlog.aligned"
  | "board.estimateUnit"
  | "item.deleted"
  | "card.created"
  | "card.moved"
  | "card.updated"
  | "card.assigned"
  | "card.unassigned"
  | "card.estimated"
  | "card.blocked"
  | "card.unblocked"
  | "card.parent"
  | "card.placed"
  | "card.kind"
  | "card.bug"
  | "card.notBug"
  | "card.checklist"
  | "card.sprint"
  | "card.backlog"
  | "card.archived"
  | "card.restored"
  | "card.deleted"
  | "card.split"
  | "card.swimlane"
  | "ai.bootstrapped"
  | "undo.applied"
  | "swimlane.created"
  | "swimlane.activated"
  | "swimlane.deactivated"
  | "comment.added"
  | "comment.deleted"
  | "sprint.created"
  | "sprint.series"
  | "sprint.updated"
  | "sprint.started"
  | "sprint.closed"
  | "sprint.retro"
  | "sprint.summary"
  | "ai.drafted";

export type ActorKind = "user" | "ai" | "system";

export async function recordEvent(
  tx: AppTransaction,
  ctx: OrgContext,
  boardId: string,
  type: EventType,
  payload: Record<string, unknown> = {},
  options: {
    cardId?: string | null;
    itemId?: string | null;
    actor?: ActorKind;
    /** The action's own reverse (docs/adr/0022), named while the "before" is in hand. */
    undo?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await tx.insert(events).values({
    orgId: ctx.orgId,
    boardId,
    cardId: options.cardId ?? null,
    itemId: options.itemId ?? null,
    type,
    payload: options.undo ? { ...payload, undo: options.undo } : payload,
    actorKind: options.actor ?? "user",
    actorUserId: ctx.userId,
  });
}

export async function recentBoardEvents(tx: AppTransaction, boardId: string, limit = 20) {
  return tx
    .select()
    .from(events)
    .where(eq(events.boardId, boardId))
    .orderBy(desc(events.createdAt))
    .limit(limit);
}

export async function itemEvents(tx: AppTransaction, itemId: string, limit = 60) {
  return tx
    .select()
    .from(events)
    .where(eq(events.itemId, itemId))
    .orderBy(desc(events.createdAt))
    .limit(limit);
}

export async function cardEvents(tx: AppTransaction, cardId: string, limit = 60) {
  return tx
    .select()
    .from(events)
    .where(eq(events.cardId, cardId))
    .orderBy(desc(events.createdAt))
    .limit(limit);
}

/**
 * Renders an event with a translator. The catalogue holds one message per
 * type under `events`, nested on the dot in the type name — `card.moved`
 * lives at `events.card.moved` — because next-intl reads a dot as
 * nesting and refuses a flat key that contains one. Unknown payload keys
 * are passed through so a message can pick what it needs.
 *
 * The unit is defaulted rather than merely passed: a sentence about
 * points asks for it (docs/adr/0030), and every event written before
 * that decision carries none. Without a value the formatter refuses the
 * whole string, and an old sprint would read as "sprint.closed"; with
 * this one it reads as what it meant at the time, which was points.
 */
export function renderEvent(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  event: { type: string; payload: Record<string, unknown> },
): string {
  const values: Record<string, string | number | Date> = { unit: "points" };
  for (const [key, value] of Object.entries(event.payload)) {
    if (value === null || value === undefined) values[key] = "";
    else if (Array.isArray(value)) values[key] = value.map(String).join(", ");
    else if (typeof value === "number") values[key] = value;
    else values[key] = String(value);
  }
  try {
    return t(event.type, values);
  } catch {
    return event.type;
  }
}
