import { eq } from "drizzle-orm";
import { cards, type Card, type EnablerType, type Kind, type Priority } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import { assertFresh, cardInWorkspace } from "./lanes";
import { personInWorkspace } from "./people";
import { assertPlannableDate } from "./plan-dates";
import { boardInWorkspace } from "./read";
import { enablerTypeFor } from "./structure/rules";

/**
 * Every plain field of a card in one place. The events name the changes
 * a team cares to see in a feed — who got it, how big it is, that it is
 * stuck and what it waits for — and fold the rest into one "updated"
 * line that carries the field names as they stand in the database. The
 * feed translates them; the record keeps the facts (docs/adr/0022).
 */

export type CardUpdate = {
  title?: string;
  description?: string;
  acceptance?: string;
  estimate?: number | null;
  priority?: Priority;
  dueDate?: string | null;
  assigneePersonId?: string | null;
  blocked?: boolean;
  blockedReason?: string;
  bug?: boolean;
  kind?: Kind;
  enablerType?: EnablerType | null;
  expectedUpdatedAt?: string;
};

export async function updateCard(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  input: CardUpdate,
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  assertFresh(card, input.expectedUpdatedAt);
  const board = await boardInWorkspace(tx, card.boardId);
  const key = `${board?.key ?? ""}-${card.number}`;
  const patch: Partial<typeof cards.$inferInsert> = {};
  const changed: string[] = [];

  if (input.title !== undefined && input.title !== card.title) {
    patch.title = input.title;
    changed.push("title");
  }
  if (input.description !== undefined && input.description !== card.description) {
    patch.description = input.description;
    changed.push("description");
  }
  if (input.acceptance !== undefined && input.acceptance !== card.acceptance) {
    patch.acceptance = input.acceptance;
    changed.push("acceptance");
  }
  if (input.kind !== undefined || input.enablerType !== undefined) {
    const kind = input.kind ?? (card.kind as Kind);
    const enablerType =
      input.enablerType !== undefined
        ? enablerTypeFor(kind, input.enablerType)
        : enablerTypeFor(
            kind,
            kind === "enabler" ? (card.enablerType as EnablerType | null) : null,
          );
    if (kind !== card.kind || enablerType !== card.enablerType) {
      patch.kind = kind;
      patch.enablerType = enablerType;
      await recordEvent(
        tx,
        ctx,
        card.boardId,
        "card.kind",
        { key, title: card.title, kind, enablerType: enablerType ?? "" },
        {
          cardId: card.id,
          actor,
          undo: {
            kind: "card.update",
            cardId: card.id,
            fields: { kind: card.kind, enablerType: card.enablerType },
          },
        },
      );
    }
  }
  if (input.bug !== undefined && input.bug !== card.bug) {
    patch.bug = input.bug;
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      input.bug ? "card.bug" : "card.notBug",
      { key, title: card.title },
      {
        cardId: card.id,
        actor,
        undo: { kind: "card.update", cardId: card.id, fields: { bug: card.bug } },
      },
    );
  }
  if (input.priority !== undefined && input.priority !== card.priority) {
    patch.priority = input.priority;
    changed.push("priority");
  }
  if (input.dueDate !== undefined && input.dueDate !== card.dueDate) {
    assertPlannableDate(input.dueDate);
    patch.dueDate = input.dueDate;
    changed.push("dueDate");
  }
  if (input.estimate !== undefined && input.estimate !== card.estimate) {
    patch.estimate = input.estimate;
    // Unestimated is a state, not a zero (docs/adr/0030): a card whose
    // estimate is taken away is not a card estimated at nothing.
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      input.estimate === null ? "card.unestimated" : "card.estimated",
      input.estimate === null
        ? { key, title: card.title }
        : { key, title: card.title, points: input.estimate, unit: board?.estimateUnit },
      {
        cardId: card.id,
        actor,
        undo: { kind: "card.update", cardId: card.id, fields: { estimate: card.estimate } },
      },
    );
  }
  if (input.assigneePersonId !== undefined && input.assigneePersonId !== card.assigneePersonId) {
    const person = await personInWorkspace(tx, input.assigneePersonId);
    if (input.assigneePersonId && !person) return null;
    patch.assigneePersonId = person?.id ?? null;
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      person ? "card.assigned" : "card.unassigned",
      { key, title: card.title, name: person?.name ?? "" },
      {
        cardId: card.id,
        actor,
        undo: {
          kind: "card.update",
          cardId: card.id,
          fields: { assigneePersonId: card.assigneePersonId },
        },
      },
    );
  }
  if (input.blocked !== undefined && input.blocked !== card.blocked) {
    patch.blocked = input.blocked;
    patch.blockedReason = input.blocked ? (input.blockedReason ?? "") : "";
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      input.blocked ? "card.blocked" : "card.unblocked",
      { key, title: card.title, reason: patch.blockedReason },
      {
        cardId: card.id,
        actor,
        undo: {
          kind: "card.update",
          cardId: card.id,
          fields: { blocked: card.blocked, blockedReason: card.blockedReason },
        },
      },
    );
  } else if (
    input.blockedReason !== undefined &&
    card.blocked &&
    input.blockedReason !== card.blockedReason
  ) {
    // The reason box only appears once the card is marked blocked, so the
    // reason always arrives after the block. Without a line of its own the
    // feed would say a card is stuck and never say what it waits for —
    // which is exactly what the rest of the team needs to read. A reason
    // blanked again is the one case with nothing to say: the sentence
    // would end in the colon the block's own line no longer has.
    patch.blockedReason = input.blockedReason;
    if (input.blockedReason.trim()) {
      await recordEvent(
        tx,
        ctx,
        card.boardId,
        "card.waiting",
        { key, title: card.title, reason: input.blockedReason },
        {
          cardId: card.id,
          actor,
          undo: {
            kind: "card.update",
            cardId: card.id,
            fields: { blockedReason: card.blockedReason },
          },
        },
      );
    }
  }

  if (Object.keys(patch).length === 0) return card;
  await tx.update(cards).set(patch).where(eq(cards.id, card.id));
  if (changed.length > 0) {
    const oldFields = Object.fromEntries(
      changed.map((field) => [field, card[field as keyof typeof card] ?? null]),
    );
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.updated",
      { key, title: patch.title ?? card.title, fields: changed },
      {
        cardId: card.id,
        actor,
        undo: { kind: "card.update", cardId: card.id, fields: oldFields },
      },
    );
  }
  return card;
}
