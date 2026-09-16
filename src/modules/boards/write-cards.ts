import { and, eq } from "drizzle-orm";
import {
  cards,
  releases,
  sprints,
  swimlanes,
  type Card,
  type EnablerType,
  type Kind,
  type Priority,
} from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "./events";
import {
  cardInWorkspace,
  columnInBoard,
  firstColumn,
  joiningSort,
  laneCards,
  laneFor,
  nextNumber,
  placeCard,
} from "./lanes";
import { personInWorkspace } from "./people";
import { assertPlannableDate } from "./plan-dates";
import { boardInWorkspace } from "./read";
import { inheritedFrom, resolveNew } from "./structure/inherit";
import { itemInBoard } from "./structure/items";
import { assertPlaced, enablerTypeFor, RuleViolation } from "./structure/rules";
import { setCardThemes } from "./structure/write-card-placement";
import { activeAreaInBoard, activeThemesInBoard, settleArea } from "./structure/write-lists";
import { clocksFor, enterColumn, recordTransition } from "./transitions";

/**
 * Card mutations, one transaction each when called from an action and
 * composable inside a larger one (the demo seed and the AI apply several
 * in one). Every function resolves the card inside the active workspace
 * first; a card id from another workspace is simply not found. The
 * checklist lives in write-card-details, archiving and deleting in
 * write-card-lifecycle, and the card's place in the backlog structure in
 * structure/write-card-placement.
 */

export type NewCardInput = {
  boardId: string;
  title: string;
  columnId?: string | null;
  sprintId?: string | null;
  description?: string;
  estimate?: number | null;
  priority?: Priority;
  dueDate?: string | null;
  assigneePersonId?: string | null;
  /** The feature the card is part of; area, themes and kind are inherited from it unless given. */
  featureId?: string | null;
  areaId?: string | null;
  themeIds?: string[];
  /** The manual swimlane the card starts in, when the board runs with them. */
  swimlaneId?: string | null;
  /** The release it ships in (docs/adr/0032). */
  releaseId?: string | null;
  kind?: Kind;
  enablerType?: EnablerType | null;
  bug?: boolean;
  acceptance?: string;
  atTop?: boolean;
};

export async function createCard(
  tx: AppTransaction,
  ctx: OrgContext,
  input: NewCardInput,
  actor: ActorKind = "user",
): Promise<Card> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) throw new Error("notFound");
  assertPlannableDate(input.dueDate);
  const column = input.columnId
    ? await columnInBoard(tx, board.id, input.columnId)
    : await firstColumn(tx, board.id);
  if (!column) throw new Error("notFound");
  // The sprint must be the board's own and still open — the same promise
  // setCardsSprint keeps; a closed sprint's record does not change shape.
  let sprintId: string | null = null;
  if (board.mode === "scrum" && input.sprintId) {
    const [sprint] = await tx
      .select()
      .from(sprints)
      .where(and(eq(sprints.id, input.sprintId), eq(sprints.boardId, board.id)))
      .limit(1);
    if (!sprint) throw new Error("notFound");
    if (sprint.state === "closed") throw new Error("invalid");
    sprintId = sprint.id;
  }
  const assignee = await personInWorkspace(tx, input.assigneePersonId);
  const [releaseOf] = input.releaseId
    ? await tx
        .select({ id: releases.id })
        .from(releases)
        .where(and(eq(releases.id, input.releaseId), eq(releases.boardId, board.id)))
        .limit(1)
    : [];
  // Rule 1 and 3 of the structure: a parent is a feature on this board, and
  // a card without one needs an area. What the caller left out is the
  // parent's.
  let feature = null;
  if (input.featureId) {
    feature = await itemInBoard(tx, board.id, "feature", input.featureId);
    if (!feature) throw new RuleViolation("parentLevel");
    if (feature.state === "closed") throw new RuleViolation("itemClosed");
  }
  const got = resolveNew(input, feature ? await inheritedFrom(tx, feature) : null);
  const area = await settleArea(
    tx,
    board,
    feature?.id ?? null,
    await activeAreaInBoard(tx, board.id, got.areaId),
  );
  const themes = await activeThemesInBoard(tx, board.id, got.themeIds);
  assertPlaced(feature?.id ?? null, area?.id ?? null);
  let swimlaneId: string | null = null;
  if (input.swimlaneId) {
    const [lane] = await tx
      .select()
      .from(swimlanes)
      .where(and(eq(swimlanes.id, input.swimlaneId), eq(swimlanes.boardId, board.id)))
      .limit(1);
    if (!lane) throw new Error("notFound");
    if (!lane.active) throw new Error("invalid");
    swimlaneId = lane.id;
  }
  const number = await nextNumber(tx, board.id);
  const sort = await joiningSort(
    tx,
    laneFor(board.mode, { boardId: board.id, columnId: column.id, sprintId }),
    input.atTop,
  );
  const clocks = clocksFor({ startedAt: null, doneAt: null }, column.category);
  const [card] = await tx
    .insert(cards)
    .values({
      orgId: ctx.orgId,
      boardId: board.id,
      columnId: column.id,
      sprintId,
      number,
      title: input.title,
      description: input.description ?? "",
      sort,
      assigneePersonId: assignee?.id ?? null,
      estimate: input.estimate ?? null,
      priority: input.priority ?? "normal",
      dueDate: input.dueDate ?? null,
      featureId: feature?.id ?? null,
      areaId: area?.id ?? null,
      swimlaneId,
      // Only this board's own release; an id from elsewhere is simply not taken.
      releaseId: releaseOf?.id ?? null,
      kind: got.kind,
      enablerType: enablerTypeFor(got.kind, input.enablerType),
      bug: input.bug ?? false,
      acceptance: input.acceptance ?? "",
      createdBy: ctx.userId,
      ...clocks,
    })
    .returning();
  await setCardThemes(
    tx,
    ctx.orgId,
    card!.id,
    themes.map((t) => t.id),
  );
  await recordTransition(tx, ctx, card!, null, column);
  await recordEvent(
    tx,
    ctx,
    board.id,
    "card.created",
    { key: `${board.key}-${number}`, title: input.title, column: column.name },
    { cardId: card!.id, actor, undo: { kind: "card.delete", cardId: card!.id } },
  );
  return card!;
}

/**
 * Moves a card to a column and, when the move says where, to a position
 * in it. A move that does not say where leaves the rank alone: the
 * number is the card's place in the board's one priority (docs/adr/0033)
 * and a column is not a priority of its own, so picking "I gang" from
 * the menu must not send the card's backlog row to the bottom. Entering
 * a column of another category records a transition and sets or clears
 * the clocks.
 */
export async function moveCard(
  tx: AppTransaction,
  ctx: OrgContext,
  cardId: string,
  columnId: string,
  index: number | undefined,
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, cardId);
  if (!card) return null;
  const target = await columnInBoard(tx, card.boardId, columnId);
  if (!target) return null;
  const from = await columnInBoard(tx, card.boardId, card.columnId);
  const board = await boardInWorkspace(tx, card.boardId);
  if (target.id !== card.columnId) {
    const oldIndex = (await laneCards(tx, laneFor(board?.mode ?? "kanban", card))).findIndex(
      (c) => c.id === card.id,
    );
    await enterColumn(tx, ctx, card, from, target);
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.moved",
      { key: `${board?.key ?? ""}-${card.number}`, title: card.title, column: target.name },
      {
        cardId: card.id,
        actor,
        undo: {
          kind: "card.move",
          cardId: card.id,
          columnId: card.columnId,
          index: Math.max(0, oldIndex),
        },
      },
    );
  }
  if (index !== undefined) {
    await placeCard(
      tx,
      laneFor(board?.mode ?? "kanban", { ...card, columnId: target.id }),
      card.id,
      index,
    );
  }
  return card;
}

/**
 * A card's plain fields live next door, in write-card-fields, and are
 * re-exported here: they are the same responsibility as the rest of this
 * file for everyone who calls them, and one file for both would be well
 * past the length this codebase keeps to.
 */
export { updateCard, type CardUpdate } from "./write-card-fields";
