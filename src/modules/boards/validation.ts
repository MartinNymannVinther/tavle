import { z } from "zod";
import { DEFAULT_HOURS_PER_POINT, HOURS_PER_POINT_MAX, HOURS_PER_POINT_MIN } from "./estimates";
import { isPlannableDate } from "./plan-dates";
import {
  BOARD_MODES,
  COLUMN_CATEGORIES,
  ESTIMATE_UNITS,
  ENABLER_TYPES,
  KINDS,
  PRIORITIES,
  STRUCTURE_LEVELS,
  SWIMLANE_MODES,
} from "@/core/db/schema";

/**
 * Input schemas for everything a page or the AI may write. Lengths are the
 * product's, not the database's: a card title is a line, a comment is a
 * paragraph, a description is a page.
 */

// Every plan date in the product goes through one gate: a real calendar
// day inside the plannable range, so a half-typed year cannot be stored
// by a sprint or a release any more than by a card.
export const isoDate = z.string().refine(isPlannableDate);
export const id = z.string().min(1).max(64);
export const shortText = (max: number) => z.string().trim().max(max);

/** WEB, OPS, K2: two to six capitals or digits, starting with a letter. */
export const boardKey = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/);

export const estimate = z.number().int().min(0).max(1000).nullable();

export const checklistItemSchema = z.object({
  id: z.string().min(1).max(40),
  title: shortText(200).min(1),
  done: z.boolean(),
});

/** How much of the structure the board shows; a way of looking, never a change to the data. */
export const StructureViewSchema = z.object({
  structureLevels: z.enum(STRUCTURE_LEVELS),
  showKind: z.boolean(),
  showThemes: z.boolean(),
  showAreas: z.boolean(),
  swimlaneBy: z.enum(SWIMLANE_MODES),
});
export type StructureViewInput = z.infer<typeof StructureViewSchema>;

export const NewBoardSchema = z
  .object({
    name: shortText(80).min(1),
    key: boardKey,
    mode: z.enum(BOARD_MODES),
    description: shortText(500).optional(),
    /** The board's first area, so rule 3 of the structure holds from the first card. */
    firstArea: shortText(40).min(1),
  })
  .merge(StructureViewSchema.partial());

export const BoardMetaSchema = z.object({
  boardId: id,
  name: shortText(80).min(1),
  description: shortText(500),
  sprintLengthDays: z.number().int().min(1).max(60),
  epicReviewDays: z.number().int().min(7).max(730),
});

export const BoardViewSchema = StructureViewSchema.extend({ boardId: id });

/** What the board counts in, and the factor that crosses between scales (docs/adr/0030). */
export const EstimateUnitSchema = z.object({
  boardId: id,
  unit: z.enum(ESTIMATE_UNITS),
  // The same bounds the field checks against, from the one place that
  // states them — a form and a service that disagree is a button that
  // looks armed and is not.
  hoursPerPoint: z
    .number()
    .min(HOURS_PER_POINT_MIN)
    .max(HOURS_PER_POINT_MAX)
    .default(DEFAULT_HOURS_PER_POINT),
});

export const BoardIdSchema = z.object({ boardId: id });

/** A release: a named bundle of work with a date the team aims at (docs/adr/0032). */
export const NewReleaseSchema = z.object({
  boardId: id,
  name: shortText(60).min(1),
  targetDate: isoDate.nullable().optional(),
});
export const ReleaseUpdateSchema = z.object({
  releaseId: id,
  name: shortText(60).min(1),
  targetDate: isoDate.nullable(),
});
export const ReleaseIdSchema = z.object({ releaseId: id });
export const ReleaseOrderSchema = z.object({
  releaseId: id,
  index: z.number().int().min(0).max(200),
});
export const CardsReleaseSchema = z.object({
  cardIds: z.array(id).min(1).max(100),
  /** Null takes the cards out of any release. */
  releaseId: id.nullable(),
});

export const NewColumnSchema = z.object({
  boardId: id,
  name: shortText(40).min(1),
  category: z.enum(COLUMN_CATEGORIES),
  wipLimit: z.number().int().min(1).max(99).nullable(),
});

export const ColumnUpdateSchema = z.object({
  columnId: id,
  name: shortText(40).min(1),
  category: z.enum(COLUMN_CATEGORIES),
  wipLimit: z.number().int().min(1).max(99).nullable(),
});

export const ColumnOrderSchema = z.object({ boardId: id, columnIds: z.array(id).min(1).max(20) });

export const ColumnDeleteSchema = z.object({ columnId: id, moveCardsTo: id });

export const NewCardSchema = z.object({
  boardId: id,
  title: shortText(160).min(1),
  /** Where the card lands; null means the first column of the board. */
  columnId: id.nullable().optional(),
  /** Scrum: the sprint it is created into; absent means the backlog. */
  sprintId: id.nullable().optional(),
  description: shortText(8000).optional(),
  estimate: estimate.optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: isoDate.nullable().optional(),
  assigneePersonId: id.nullable().optional(),
  /** Its place in the structure; a card without a feature needs an area. */
  featureId: id.nullable().optional(),
  areaId: id.nullable().optional(),
  themeIds: z.array(id).max(8).optional(),
  /** The manual swimlane the card starts in, when the board runs with them. */
  swimlaneId: id.nullable().optional(),
  /** The release it ships in (docs/adr/0032); absent leaves it unreleased. */
  releaseId: id.nullable().optional(),
  kind: z.enum(KINDS).optional(),
  enablerType: z.enum(ENABLER_TYPES).nullable().optional(),
  bug: z.boolean().optional(),
  acceptance: shortText(4000).optional(),
  /** Put the new card first in its lane rather than last. */
  atTop: z.boolean().optional(),
});

/** Every editable field of a card, all optional, so one action serves every field. */
export const CardUpdateSchema = z.object({
  cardId: id,
  title: shortText(160).min(1).optional(),
  description: shortText(8000).optional(),
  estimate: estimate.optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: isoDate.nullable().optional(),
  assigneePersonId: id.nullable().optional(),
  blocked: z.boolean().optional(),
  blockedReason: shortText(300).optional(),
  acceptance: shortText(4000).optional(),
  bug: z.boolean().optional(),
  kind: z.enum(KINDS).optional(),
  enablerType: z.enum(ENABLER_TYPES).nullable().optional(),
  expectedUpdatedAt: z.string().optional(),
});

/**
 * What a drop into another swimlane writes on the card, named by the
 * board's own mode so a stale client cannot set a field the board does
 * not group by. Kind has no "without" lane; the others allow null.
 */
export const SwimlaneAssignmentSchema = z.union([
  z.object({ by: z.literal("kind"), kind: z.enum(KINDS) }),
  z.object({ by: z.literal("theme"), themeId: id }),
  z.object({ by: z.literal("area"), areaId: id.nullable() }),
  z.object({ by: z.literal("manual"), swimlaneId: id.nullable() }),
]);
export type SwimlaneAssignment = z.infer<typeof SwimlaneAssignmentSchema>;

export const CardMoveSchema = z.object({
  cardId: id,
  columnId: id,
  /** Position in the target lane, 0 = first. Omitted means the end. */
  index: z.number().int().min(0).max(10_000).optional(),
  /** Set when the drop also crossed a swimlane. */
  swimlane: SwimlaneAssignmentSchema.optional(),
});

export const NewSwimlaneSchema = z.object({ boardId: id, name: shortText(40).min(1) });

export const SwimlaneUpdateSchema = z.object({
  swimlaneId: id,
  name: shortText(40).min(1),
  active: z.boolean(),
});

export const CardIdSchema = z.object({ cardId: id });

export const ChecklistSchema = z.object({
  cardId: id,
  checklist: z.array(checklistItemSchema).max(50),
});

/** Ticked cards put under one feature (or none) in one gesture, from the backlog. */
export const CardsPlacementSchema = z.object({
  cardIds: z.array(id).min(1).max(100),
  /** Null puts them without a parent; each card keeps its area. */
  featureId: id.nullable(),
});

export const CardSprintSchema = z.object({
  cardIds: z.array(id).min(1).max(100),
  /** Null sends the cards back to the backlog. */
  sprintId: id.nullable(),
});

export const BacklogOrderSchema = z.object({
  cardId: id,
  index: z.number().int().min(0).max(10_000),
});

export const NewCommentSchema = z.object({ cardId: id, text: shortText(4000).min(1) });
export const CommentIdSchema = z.object({ commentId: id });

/** A run of planned sprints laid back to back (docs/adr/0023). */
export const SprintSeriesSchema = z.object({
  boardId: id,
  count: z.number().int().min(1).max(12),
});

/** A feature's planned span on the sprint axis; null unplans it. */
export const ItemPlanSchema = z.object({
  itemId: id,
  startSprintId: id.nullable(),
  targetSprintId: id.nullable(),
});

export const NewSprintSchema = z.object({
  boardId: id,
  name: shortText(80).min(1),
  goal: shortText(500),
  startDate: isoDate,
  endDate: isoDate,
});

export const SprintUpdateSchema = z.object({
  sprintId: id,
  name: shortText(80).min(1),
  goal: shortText(500),
  startDate: isoDate,
  endDate: isoDate,
});

export const SprintIdSchema = z.object({ sprintId: id });

export const CloseSprintSchema = z.object({
  sprintId: id,
  /** Where the unfinished cards go: the backlog, or a planned sprint. */
  moveUnfinishedTo: id.nullable(),
});

export const RetroSchema = z.object({
  sprintId: id,
  wentWell: shortText(2000),
  improve: shortText(2000),
  actions: shortText(2000),
});

export const SprintSummarySchema = z.object({ sprintId: id, summary: shortText(6000) });

/** The roster (docs/adr/0029): a person by name, a login attached by hand. */
export const PersonCreateSchema = z.object({
  name: shortText(80).min(1),
  email: z.union([z.email().max(320), z.literal("")]).optional(),
});
export const PersonRenameSchema = z.object({ personId: id, name: shortText(80).min(1) });
export const PersonIdSchema = z.object({ personId: id });
export const PersonLinkSchema = z.object({ personId: id, userId: z.string().min(1).max(64) });

/** Dates the wrong way round are swapped rather than refused; people type fast. */
export function orderedDates(start: string, end: string): [string, string] {
  return end < start ? [end, start] : [start, end];
}
