import { and, desc, eq } from "drizzle-orm";
import { events, type EstimateUnit } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { scaleOf, sizeOf } from "./estimates";

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
  | "theme.updated"
  | "theme.activated"
  | "theme.deactivated"
  | "area.created"
  | "area.updated"
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
  | "release.created"
  | "release.updated"
  | "release.reordered"
  | "release.deleted"
  | "card.released"
  | "card.unreleased"
  | "board.estimateUnit"
  | "item.deleted"
  | "card.created"
  | "card.moved"
  | "card.updated"
  | "card.assigned"
  | "card.unassigned"
  | "card.estimated"
  /** Unestimated is a state, not a zero (docs/adr/0030), so losing an estimate is its own fact. */
  | "card.unestimated"
  | "card.blocked"
  /** What a blocked card is waiting for, written down after the block itself. */
  | "card.waiting"
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
  | "swimlane.updated"
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

/**
 * The most recent event of one kind on a board, when it still carries a
 * reverse nobody has used. Board-level changes have no activity feed of
 * their own, so the surface that made the change is the honest place to
 * offer the undo — and the promise that it can be undone is only true
 * if some surface does.
 */
export async function lastUndoableBoardEvent(
  tx: AppTransaction,
  boardId: string,
  type: EventType,
): Promise<{ id: string; payload: Record<string, unknown> } | null> {
  const rows = await tx
    .select()
    .from(events)
    .where(and(eq(events.boardId, boardId), eq(events.type, type)))
    .orderBy(desc(events.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const payload = row.payload as Record<string, unknown>;
  if (!payload.undo) return null;
  // An event already taken back is not offered again.
  const applied = await tx
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.boardId, boardId), eq(events.type, "undo.applied")));
  if (applied.some((a) => (a.payload as { of?: string }).of === row.id)) return null;
  return { id: row.id, payload };
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

/** The translator the feed hands in; next-intl's own answers `has` as well. */
export type EventTranslator = ((
  key: string,
  values?: Record<string, string | number | Date>,
) => string) & { has?: (key: string) => boolean };

type EventValues = Record<string, string | number | Date>;

/** `targetQuarter` as words, for a field name nobody has translated yet. */
const spaced = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/**
 * One word from a catalogue, degrading to its own words rather than
 * breaking the line it sits in when the catalogue has not caught up.
 */
function labelled(t: EventTranslator, key: string, fallback: string): string {
  if (t.has && !t.has(key)) return fallback;
  try {
    // A missing message answers with its own path rather than throwing.
    const label = t(key);
    return label.includes(key) ? fallback : label;
  } catch {
    return fallback;
  }
}

/**
 * The name of a field, in the reader's language. The event stores the
 * column's own identifier, because that is the fact; a log is read by
 * people, so `dueDate` becomes "deadline" here under `events.field`.
 */
const fieldLabel = (t: EventTranslator, name: string) => labelled(t, `field.${name}`, spaced(name));

/**
 * The same for a value out of a database enum. `kind` and `enablerType`
 * are stored as the enum, because that is the fact and that is what the
 * reverse and the AI read; nobody outside the database calls a card
 * "enabler infrastructure", so the words are put on here, at render
 * time, under `events.kind` and `events.enablerType`.
 */
const enumLabel = (t: EventTranslator, group: string, value: string) =>
  labelled(t, `${group}.${value}`, spaced(value));

const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/**
 * What the sentence needs and the event does not carry: which of the
 * optional halves actually have a value, so a message can leave out the
 * ones that do not and never end mid-air, the word this board puts on a
 * weight, and the words a database enum is read in.
 */
function derive(t: EventTranslator, type: string, values: EventValues): void {
  if (type === "card.placed" || type === "item.placed") {
    values.placed = filled(values.area)
      ? filled(values.themes)
        ? "both"
        : "area"
      : filled(values.themes)
        ? "themes"
        : "none";
  }
  if (type === "card.blocked") values.why = filled(values.reason) ? "reason" : "none";
  if (type === "card.estimated" && typeof values.points === "number") {
    values.size = sizeOf(values.points);
  }
  if (type === "card.kind") {
    // Business work has no subtype at all, and an enabler need not have
    // named one yet; without this the sentence ended in a space.
    const subtype = filled(values.enablerType);
    values.subtype = subtype ? "some" : "none";
    values.kind = filled(values.kind) ? enumLabel(t, "kind", String(values.kind)) : "";
    values.enablerType = subtype ? enumLabel(t, "enablerType", String(values.enablerType)) : "";
  }
  if (type === "theme.updated" || type === "area.updated") {
    // A rename is the change worth naming both ends of; a recolour or a
    // new owner is not, and would read as "X was renamed to X".
    values.renamed = filled(values.from) && values.from !== values.name ? "renamed" : "same";
  }
}

/**
 * Which unit's words an old sentence is read in. One integer carries
 * points, hours and sizes (docs/adr/0030), but only within a scale: a
 * board that moved between points and sizes changed the words and not
 * the numbers, so its whole history is read in the words the team uses
 * today. A board that crossed to or from hours had its cards' numbers
 * rewritten and its events' numbers left alone, so those sentences keep
 * the unit they were written under — today's word on yesterday's number
 * would misstate what the team said. Events from before the decision
 * carry no unit at all, and points is what they meant; without one the
 * formatter would refuse the whole string and the line would vanish.
 */
function unitFor(payload: Record<string, unknown>, board?: EstimateUnit): EstimateUnit {
  const written = (typeof payload.unit === "string" ? payload.unit : "points") as EstimateUnit;
  if (!board) return written;
  return scaleOf(board) === scaleOf(written) ? board : written;
}

/**
 * Renders an event with a translator. The catalogue holds one message per
 * type under `events`, nested on the dot in the type name — `card.moved`
 * lives at `events.card.moved` — because next-intl reads a dot as
 * nesting and refuses a flat key that contains one. Unknown payload keys
 * are passed through so a message can pick what it needs.
 *
 * `unit` is the board's unit as it stands now, for the sentences that
 * name a size or an hour; left out, the event is read in the unit it was
 * written under.
 */
export function renderEvent(
  t: EventTranslator,
  event: { type: string; payload: Record<string, unknown> },
  options: { unit?: EstimateUnit } = {},
): string {
  const values: EventValues = {};
  for (const [key, value] of Object.entries(event.payload)) {
    if (value === null || value === undefined) values[key] = "";
    else if (Array.isArray(value))
      values[key] = value
        .map((entry) => (key === "fields" ? fieldLabel(t, String(entry)) : String(entry)))
        .join(", ");
    else if (typeof value === "number") values[key] = value;
    else values[key] = String(value);
  }
  values.unit = unitFor(event.payload, options.unit);
  derive(t, event.type, values);
  if (t.has && !t.has(event.type)) return event.type;
  try {
    return t(event.type, values);
  } catch {
    return event.type;
  }
}
