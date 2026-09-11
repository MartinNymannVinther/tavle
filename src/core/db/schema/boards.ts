import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { domainId, organizations, users } from "./foundation";

/**
 * The product's data model: the few concepts a team board needs — board,
 * column, card, label, sprint, comment — plus what running one for real
 * needs: a record of every move a card makes (the metrics are computed
 * from it, never estimated) and a structured event log.
 *
 * Every table carries `org_id` with a cascading foreign key to the
 * workspace, so deleting a workspace deletes everything it owns, and RLS
 * keys on the same column. Dates are ISO strings (yyyy-mm-dd) in
 * Europe/Copenhagen; instants are timestamptz.
 */

const tenant = () =>
  text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** How a board is run: a continuous flow, or work committed in sprints. */
export const BOARD_MODES = ["kanban", "scrum"] as const;
export type BoardMode = (typeof BOARD_MODES)[number];

/**
 * What a column means, whatever it is called. The metrics read the
 * category, not the name: a card enters `doing` and its clock starts, it
 * enters `done` and the clock stops.
 */
export const COLUMN_CATEGORIES = ["backlog", "todo", "doing", "done"] as const;
export type ColumnCategory = (typeof COLUMN_CATEGORIES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SPRINT_STATES = ["planned", "active", "closed"] as const;
export type SprintState = (typeof SPRINT_STATES)[number];

/** The palette a label may use; the tokens are the family's, not new colours. */
export const LABEL_COLORS = ["moss", "amber", "rose", "sky", "plum", "slate"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export type ChecklistItem = { id: string; title: string; done: boolean };

/** What the team wrote down at the end of a sprint. */
export type Retro = { wentWell: string; improve: string; actions: string };

export const boards = pgTable(
  "boards",
  {
    id: domainId("id"),
    orgId: tenant(),
    name: text("name").notNull(),
    /** Short uppercase prefix for card numbers, e.g. WEB in WEB-12. */
    key: text("key").notNull(),
    mode: text("mode").notNull().default("kanban"),
    description: text("description").notNull().default(""),
    /** Default length of a new sprint, in days. */
    sprintLengthDays: integer("sprint_length_days").notNull().default(14),
    /** The next card number to hand out; bumped inside the insert's transaction, so numbers never repeat and never skip. */
    nextCardNumber: integer("next_card_number").notNull().default(1),
    nextSprintNumber: integer("next_sprint_number").notNull().default(1),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("boards_org_key_uq").on(t.orgId, t.key),
    index("boards_org_created_idx").on(t.orgId, t.createdAt),
  ],
);

export const columns = pgTable(
  "columns",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("todo"),
    /** Null means no limit; the board shows a column over its limit, it never blocks it. */
    wipLimit: integer("wip_limit"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("columns_board_idx").on(t.boardId, t.sort)],
);

export const labels = pgTable(
  "labels",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("slate"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("labels_board_name_uq").on(t.boardId, sql`lower(${t.name})`),
    index("labels_board_idx").on(t.boardId, t.sort),
  ],
);

export const sprints = pgTable(
  "sprints",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    goal: text("goal").notNull().default(""),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    state: text("state").notNull().default("planned"),
    /** Points on the cards the moment the sprint started; the burndown's top. */
    committedPoints: integer("committed_points"),
    /** Points on the cards that were done when the sprint closed; the velocity. */
    completedPoints: integer("completed_points"),
    /** A written account of the sprint, drafted by a model or a person, kept by a person. */
    summary: text("summary").notNull().default(""),
    retro: jsonb("retro").$type<Retro | null>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sprints_board_number_uq").on(t.boardId, t.number),
    index("sprints_board_idx").on(t.boardId, t.startDate),
  ],
);

export const cards = pgTable(
  "cards",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    columnId: text("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "restrict" }),
    /** Scrum only: the sprint the card is committed to; null is the product backlog. */
    sprintId: text("sprint_id").references(() => sprints.id, { onDelete: "set null" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Position within its lane (column, or the backlog). Rewritten as whole numbers on every move. */
    sort: doublePrecision("sort").notNull().default(0),
    assigneeUserId: text("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Story points or any unit the team agrees on; null is unestimated. */
    estimate: integer("estimate"),
    priority: text("priority").notNull().default("normal"),
    dueDate: date("due_date", { mode: "string" }),
    checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
    blocked: boolean("blocked").notNull().default(false),
    blockedReason: text("blocked_reason").notNull().default(""),
    /** First time the card entered a `doing` column; the cycle-time clock starts here. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    /** Set while the card sits in a `done` column, cleared when it leaves one. */
    doneAt: timestamp("done_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("cards_board_number_uq").on(t.boardId, t.number),
    index("cards_board_column_idx").on(t.boardId, t.columnId, t.sort),
    index("cards_sprint_idx").on(t.sprintId),
    index("cards_assignee_idx").on(t.assigneeUserId),
  ],
);

export const cardLabels = pgTable(
  "card_labels",
  {
    orgId: tenant(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);

export const comments = pgTable(
  "comments",
  {
    id: domainId("id"),
    orgId: tenant(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [index("comments_card_idx").on(t.cardId, t.createdAt)],
);

/**
 * Every move a card makes between columns, as it happened. Throughput,
 * cycle time and the cumulative flow diagram are all read from here; the
 * card's own columns say where it is now, this table says where it was.
 * `to_category` is `archived` when a card leaves the board without being
 * done, so a flow diagram stops counting it from that day.
 */
export const cardTransitions = pgTable(
  "card_transitions",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    fromColumnId: text("from_column_id"),
    toColumnId: text("to_column_id"),
    fromCategory: text("from_category"),
    toCategory: text("to_category").notNull(),
    /** The card's estimate at the time, so a later re-estimate does not rewrite history. */
    points: integer("points"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("card_transitions_board_at_idx").on(t.boardId, t.at),
    index("card_transitions_card_idx").on(t.cardId, t.at),
  ],
);

/**
 * What happened on a board, as structured facts: a type and a payload,
 * rendered into sentences in the reader's language. Nothing in the data
 * layer is tied to Danish.
 */
export const events = pgTable(
  "events",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    cardId: text("card_id").references(() => cards.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** user | ai | system */
    actorKind: text("actor_kind").notNull().default("user"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_board_idx").on(t.boardId, t.createdAt),
    index("events_card_idx").on(t.cardId, t.createdAt),
  ],
);

export type Board = typeof boards.$inferSelect;
export type Column = typeof columns.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type CardTransition = typeof cardTransitions.$inferSelect;
export type BoardEvent = typeof events.$inferSelect;
