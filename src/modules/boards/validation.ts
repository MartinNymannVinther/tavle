import { z } from "zod";
import { ISO_DATE } from "@/core/dates";
import { BOARD_MODES, COLUMN_CATEGORIES, LABEL_COLORS, PRIORITIES } from "@/core/db/schema";

/**
 * Input schemas for everything a page or the AI may write. Lengths are the
 * product's, not the database's: a card title is a line, a comment is a
 * paragraph, a description is a page.
 */

export const isoDate = z.string().regex(ISO_DATE);
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

export const NewBoardSchema = z.object({
  name: shortText(80).min(1),
  key: boardKey,
  mode: z.enum(BOARD_MODES),
  description: shortText(500).optional(),
});

export const BoardMetaSchema = z.object({
  boardId: id,
  name: shortText(80).min(1),
  description: shortText(500),
  sprintLengthDays: z.number().int().min(1).max(60),
});

export const BoardIdSchema = z.object({ boardId: id });

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

export const NewLabelSchema = z.object({
  boardId: id,
  name: shortText(30).min(1),
  color: z.enum(LABEL_COLORS),
});

export const LabelUpdateSchema = z.object({
  labelId: id,
  name: shortText(30).min(1),
  color: z.enum(LABEL_COLORS),
});

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
  assigneeUserId: id.nullable().optional(),
  labelIds: z.array(id).max(10).optional(),
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
  assigneeUserId: id.nullable().optional(),
  blocked: z.boolean().optional(),
  blockedReason: shortText(300).optional(),
  expectedUpdatedAt: z.string().optional(),
});

export const CardMoveSchema = z.object({
  cardId: id,
  columnId: id,
  /** Position in the target lane, 0 = first. Omitted means the end. */
  index: z.number().int().min(0).max(10_000).optional(),
});

export const CardIdSchema = z.object({ cardId: id });

export const ChecklistSchema = z.object({
  cardId: id,
  checklist: z.array(checklistItemSchema).max(50),
});

export const CardLabelsSchema = z.object({ cardId: id, labelIds: z.array(id).max(10) });

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

/** Dates the wrong way round are swapped rather than refused; people type fast. */
export function orderedDates(start: string, end: string): [string, string] {
  return end < start ? [end, start] : [start, end];
}
