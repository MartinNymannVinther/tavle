import { z } from "zod";
import { ENABLER_TYPES, ITEM_LEVELS, KINDS, QUARTER_PATTERN, THEME_COLORS } from "@/core/db/schema";
import { id, shortText } from "../validation";

/**
 * Input schemas for the backlog structure: epics and features, the two
 * closed lists, and a card's place among them. Rule 5 (an enabler type
 * only on an enabler) and rule 3 (no parent means an area) are resolved
 * in the services, because both depend on the row as it is, not only on
 * the input.
 */

export const kind = z.enum(KINDS);
export const enablerType = z.enum(ENABLER_TYPES).nullable();
export const quarter = z.string().regex(QUARTER_PATTERN);

export const NewItemSchema = z.object({
  boardId: id,
  level: z.enum(ITEM_LEVELS),
  title: shortText(160).min(1),
  description: shortText(8000).optional(),
  doneWhen: shortText(500).min(1),
  kind: kind.optional(),
  enablerType: enablerType.optional(),
  /** The epic a feature is part of; ignored on an epic, which has no parent. */
  parentId: id.nullable().optional(),
  areaId: id.nullable().optional(),
  themeIds: z.array(id).max(8).optional(),
  targetQuarter: quarter.nullable().optional(),
});

export const ItemUpdateSchema = z.object({
  itemId: id,
  title: shortText(160).min(1).optional(),
  description: shortText(8000).optional(),
  doneWhen: shortText(500).min(1).optional(),
  kind: kind.optional(),
  enablerType: enablerType.optional(),
  targetQuarter: quarter.nullable().optional(),
  expectedUpdatedAt: z.string().optional(),
});

/** Where an item sits in the structure: its parent, its area, its themes. */
export const ItemPlacementSchema = z.object({
  itemId: id,
  parentId: id.nullable().optional(),
  areaId: id.nullable().optional(),
  themeIds: z.array(id).max(8).optional(),
  /** Rule 11: a change of theme or area never cascades by itself; this asks for it. */
  applyToChildren: z.boolean().optional(),
});

/** Rank an item next to a sibling of its level: before it, or after it. */
export const ItemOrderSchema = z.object({
  itemId: id,
  siblingId: id,
  after: z.boolean(),
});

export const ItemIdSchema = z.object({ itemId: id });

/** What to do with each open child when its parent closes (rule 10). */
export const ChildDecisionSchema = z.object({
  id: id,
  action: z.enum(["close", "archive", "move", "orphan"]),
  /** For "move": the new parent, one level up from the child. */
  targetId: id.optional(),
  /** For "orphan": the area a child without one gets, since rule 3 still holds. */
  areaId: id.optional(),
});

export const CloseItemSchema = z.object({
  itemId: id,
  plan: z.array(ChildDecisionSchema).max(500).optional(),
});

export const NewThemeSchema = z.object({
  boardId: id,
  name: shortText(40).min(1),
  color: z.enum(THEME_COLORS),
  ownerUserId: id.nullable().optional(),
});

export const ThemeUpdateSchema = z.object({
  themeId: id,
  name: shortText(40).min(1),
  color: z.enum(THEME_COLORS),
  ownerUserId: id.nullable(),
  active: z.boolean(),
});

export const NewAreaSchema = z.object({
  boardId: id,
  name: shortText(40).min(1),
  ownerUserId: id.nullable().optional(),
});

export const AreaUpdateSchema = z.object({
  areaId: id,
  name: shortText(40).min(1),
  ownerUserId: id.nullable(),
  active: z.boolean(),
});

/** A card's place in the structure: its feature, its area, its themes. */
export const CardPlacementSchema = z.object({
  cardId: id,
  featureId: id.nullable().optional(),
  areaId: id.nullable().optional(),
  themeIds: z.array(id).max(8).optional(),
});

export type NewItemInput = z.infer<typeof NewItemSchema>;
export type ItemUpdateInput = z.infer<typeof ItemUpdateSchema>;
export type ItemPlacementInput = z.infer<typeof ItemPlacementSchema>;
export type ChildDecision = z.infer<typeof ChildDecisionSchema>;
export type CardPlacementInput = z.infer<typeof CardPlacementSchema>;
