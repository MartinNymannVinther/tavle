import { z } from "zod";
import { THEME_COLORS } from "@/core/db/schema";
import { id } from "./validation";

/**
 * The reverses an event can carry (docs/adr/0022), one schema per kind.
 * The payload was written by the service that knew the "before"; parsing
 * it again here means a hand-edited or ancient payload is refused, never
 * half-applied.
 */

const cardFields = z
  .object({
    title: z.string(),
    description: z.string(),
    acceptance: z.string(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    dueDate: z.string().nullable(),
    estimate: z.number().nullable(),
    assigneePersonId: z.string().nullable(),
    /** Written before docs/adr/0029; the undo maps the login to its person. */
    assigneeUserId: z.string().nullable(),
    blocked: z.boolean(),
    blockedReason: z.string(),
    bug: z.boolean(),
    kind: z.enum(["business", "enabler"]),
    enablerType: z.enum(["architecture", "infrastructure", "exploration", "compliance"]).nullable(),
  })
  .partial();

const itemFields = z
  .object({
    title: z.string(),
    description: z.string(),
    doneWhen: z.string(),
    kind: z.enum(["business", "enabler"]),
    enablerType: z.enum(["architecture", "infrastructure", "exploration", "compliance"]).nullable(),
    targetQuarter: z.string().nullable(),
    startQuarter: z.string().nullable(),
  })
  .partial();

/** One child of a rule-11 cascade, as it stood before the cascade ran. */
const childState = z.object({
  itemId: id.optional(),
  cardId: id.optional(),
  areaId: id.nullable(),
  themeIds: z.array(id),
});
export type ChildState = z.infer<typeof childState>;

export const UndoStepSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("card.move"), cardId: id, columnId: id, index: z.number().int() }),
  z.object({ kind: z.literal("card.swimlane"), cardId: id, swimlaneId: id.nullable() }),
  z.object({
    kind: z.literal("card.place"),
    cardId: id,
    featureId: id.nullable(),
    areaId: id.nullable(),
    themeIds: z.array(id),
  }),
  /**
   * `fields` is what the card held before; `after` is what the event
   * set. A field-level reverse is only honest while the field still
   * holds what the event set it to — an estimate event undone after a
   * second estimate would throw away the newer one without a word — so
   * `undo.ts` refuses when the two no longer agree (docs/adr/0022).
   * Absent on payloads written before the reverse carried both ends.
   */
  z.object({
    kind: z.literal("card.update"),
    cardId: id,
    fields: cardFields,
    after: cardFields.optional(),
  }),
  z.object({ kind: z.literal("card.delete"), cardId: id }),
  z.object({ kind: z.literal("card.archive"), cardId: id }),
  z.object({ kind: z.literal("card.restore"), cardId: id }),
  z.object({
    kind: z.literal("card.sprint"),
    cardId: id,
    sprintId: id.nullable(),
    /** The column the card stood in; absent on payloads written before it was carried. */
    columnId: id.optional(),
  }),
  z.object({ kind: z.literal("item.delete"), itemId: id }),
  z.object({
    kind: z.literal("item.update"),
    itemId: id,
    fields: itemFields,
    after: itemFields.optional(),
  }),
  z.object({
    kind: z.literal("item.place"),
    itemId: id,
    parentId: id.nullable(),
    areaId: id.nullable(),
    themeIds: z.array(id),
  }),
  z.object({
    kind: z.literal("item.cascade"),
    itemId: id,
    children: z.array(childState).max(5000),
  }),
  z.object({
    kind: z.literal("item.plan"),
    itemId: id,
    startSprintId: id.nullable(),
    targetSprintId: id.nullable(),
  }),
  z.object({ kind: z.literal("item.reopen"), itemId: id }),
  z.object({
    kind: z.literal("items.order"),
    boardId: id,
    level: z.enum(["epic", "feature"]),
    /** The whole lane's ids in the order that held before the rewrite. */
    order: z.array(id).max(2000),
  }),
  z.object({ kind: z.literal("item.close"), itemId: id }),
  z.object({ kind: z.literal("card.release"), cardId: id, releaseId: id.nullable() }),
  z.object({
    kind: z.literal("release.update"),
    releaseId: id,
    name: z.string(),
    targetDate: z.string().nullable(),
  }),
  z.object({ kind: z.literal("releases.order"), boardId: id, order: z.array(id).max(200) }),
  z.object({
    kind: z.literal("board.estimates"),
    boardId: id,
    unit: z.enum(["points", "hours", "tshirt"]),
    /** Every estimated card as it stood, so one Fortryd puts the whole board back. */
    cards: z.array(z.object({ cardId: id, estimate: z.number().nullable() })).max(5000),
    sprints: z
      .array(
        z.object({
          sprintId: id,
          committedPoints: z.number().nullable(),
          completedPoints: z.number().nullable(),
        }),
      )
      .max(500),
  }),
  z.object({
    kind: z.literal("board.view"),
    boardId: id,
    structureLevels: z.enum(["epic", "feature", "card"]),
    showKind: z.boolean(),
    showThemes: z.boolean(),
    showAreas: z.boolean(),
    swimlaneBy: z.enum(["none", "kind", "theme", "area", "manual"]),
  }),
  z.object({ kind: z.literal("comment.delete"), commentId: id }),
  z.object({ kind: z.literal("theme.active"), themeId: id, active: z.boolean() }),
  z.object({ kind: z.literal("area.active"), areaId: id, active: z.boolean() }),
  z.object({ kind: z.literal("swimlane.active"), swimlaneId: id, active: z.boolean() }),
  /**
   * The names, colours and owners of the closed lists and the lanes. A
   * rename is as much a change to the board's shape as a deactivation,
   * and the settings page offers a Fortryd on both. The active flag is
   * not carried: it is its own event with its own reverse, and putting
   * a name back must not quietly put a list entry back in use.
   */
  z.object({
    kind: z.literal("theme.update"),
    themeId: id,
    name: z.string(),
    color: z.enum(THEME_COLORS),
    ownerUserId: id.nullable(),
  }),
  z.object({
    kind: z.literal("area.update"),
    areaId: id,
    name: z.string(),
    ownerUserId: id.nullable(),
  }),
  z.object({ kind: z.literal("swimlane.update"), swimlaneId: id, name: z.string() }),
]);
export type UndoStep = z.infer<typeof UndoStepSchema>;
