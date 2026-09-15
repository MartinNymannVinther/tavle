import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { domainId, users } from "./foundation";
import { areas, backlogItems } from "./structure";
import { tenant, timestamps } from "./shared";

/**
 * The product's data model: the few concepts a team board needs — board,
 * column, card, sprint, comment — the backlog structure above the cards
 * (epic and feature, which finish; theme and area, which never do; see
 * docs/adr/0011) — plus what running one for real needs: a record of
 * every move a card makes (the metrics are computed from it, never
 * estimated) and a structured event log.
 *
 * Every table carries `org_id` with a cascading foreign key to the
 * workspace, so deleting a workspace deletes everything it owns, and RLS
 * keys on the same column. Dates are ISO strings (yyyy-mm-dd) in
 * Europe/Copenhagen; instants are timestamptz.
 */

/** How a board is run: a continuous flow, or work committed in sprints. */
export const BOARD_MODES = ["kanban", "scrum"] as const;
export type BoardMode = (typeof BOARD_MODES)[number];

/**
 * What splits a Kanban board into swimlanes: nothing, one of the three
 * structure fields, or lanes the team names itself (docs/adr/0017). The
 * three field modes are a way of looking, like the rest of the view;
 * only "manual" adds rows of its own.
 */
export const SWIMLANE_MODES = ["none", "kind", "theme", "area", "manual"] as const;
export type SwimlaneMode = (typeof SWIMLANE_MODES)[number];

/**
 * What the team counts in (docs/adr/0030). Points and T-shirt sizes are
 * the same numbers — a size is a label on a weight — so switching
 * between them never rewrites a sum; hours are their own scale.
 */
export const ESTIMATE_UNITS = ["points", "hours", "tshirt"] as const;
export type EstimateUnit = (typeof ESTIMATE_UNITS)[number];

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

export type ChecklistItem = { id: string; title: string; done: boolean };

/** What the team wrote down at the end of a sprint. */
export type Retro = { wentWell: string; improve: string; actions: string };

/**
 * The workspace's roster (docs/adr/0029): the people work is assigned
 * to. A person may stand alone — a colleague not signed up yet — or
 * carry a login through `user_id`; the invitation flow links the two by
 * e-mail when the login arrives. Actors (who *did* something) stay real
 * users; only responsibility points here.
 */
export const people = pgTable(
  "people",
  {
    id: domainId("id"),
    orgId: tenant(),
    name: text("name").notNull(),
    /** Where the invitation will go, and the key the auto-link matches on. */
    email: text("email"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    // One person per login per workspace; unlinked rows (null) may repeat.
    uniqueIndex("people_org_user_uq").on(t.orgId, t.userId),
    index("people_org_idx").on(t.orgId),
  ],
);

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
    /** An epic open longer than this is marked for review until its owner confirms it is still a result. */
    epicReviewDays: integer("epic_review_days").notNull().default(180),
    /**
     * How much of the structure the board shows: "epic" is all three
     * levels, "feature" hides the epics, "card" hides both. A way of
     * looking, not a shape: what is hidden stays in the tables and comes
     * back when the level is switched on again.
     */
    structureLevels: text("structure_levels").notNull().default("epic"),
    /** Which of the item's fields the board shows; the data stays either way. */
    showKind: boolean("show_kind").notNull().default(true),
    showThemes: boolean("show_themes").notNull().default(true),
    showAreas: boolean("show_areas").notNull().default(true),
    /** Kanban only: how the board splits into swimlanes, if at all. */
    swimlaneBy: text("swimlane_by").notNull().default("none"),
    /** Points, hours or T-shirt sizes; a way of counting, stored as one number (docs/adr/0030). */
    estimateUnit: text("estimate_unit").notNull().default("points"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("boards_org_key_uq").on(t.orgId, t.key),
    index("boards_org_created_idx").on(t.orgId, t.createdAt),
    check("boards_structure_levels_ck", sql`${t.structureLevels} in ('epic', 'feature', 'card')`),
    check("boards_estimate_unit_ck", sql`${t.estimateUnit} in ('points', 'hours', 'tshirt')`),
    check(
      "boards_swimlane_by_ck",
      sql`${t.swimlaneBy} in ('none', 'kind', 'theme', 'area', 'manual')`,
    ),
  ],
);

/**
 * The lanes a board names itself when `swimlane_by` is "manual". The same
 * shape as the closed lists: deactivated rather than deleted, so a lane's
 * name survives on the cards' history.
 */
export const swimlanes = pgTable(
  "swimlanes",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("swimlanes_board_name_uq").on(t.boardId, sql`lower(${t.name})`),
    index("swimlanes_board_idx").on(t.boardId, t.sort),
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
    /** The feature this card is part of, or null; a card without a parent needs an area (docs/adr/0011). */
    featureId: text("feature_id").references(() => backlogItems.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("business"),
    enablerType: text("enabler_type"),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    /** The card's manual swimlane, when the board runs with them; null is the "without" lane. */
    swimlaneId: text("swimlane_id").references(() => swimlanes.id, { onDelete: "set null" }),
    /** A bug is a story with a flag, not a fourth level; it follows every story rule and can be counted. */
    bug: boolean("bug").notNull().default(false),
    /** Acceptance criteria, optional. */
    acceptance: text("acceptance").notNull().default(""),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Position within its lane (column, or the backlog). Rewritten as whole numbers on every move. */
    sort: doublePrecision("sort").notNull().default(0),
    assigneePersonId: text("assignee_person_id").references(() => people.id, {
      onDelete: "set null",
    }),
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
    index("cards_assignee_idx").on(t.assigneePersonId),
    index("cards_feature_idx").on(t.featureId),
    // The FK's set-null on swimlane delete walks this; without it every
    // lane row deleted in a cascade seq-scans the whole cards table.
    index("cards_swimlane_idx").on(t.swimlaneId),
    check("cards_enabler_type_ck", sql`${t.enablerType} is null or ${t.kind} = 'enabler'`),
  ],
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
    /** Set on events about an epic or a feature, so an item has an activity feed like a card. */
    itemId: text("item_id").references(() => backlogItems.id, { onDelete: "cascade" }),
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
    index("events_item_idx").on(t.itemId, t.createdAt),
  ],
);

export type Person = typeof people.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type Column = typeof columns.$inferSelect;
export type Swimlane = typeof swimlanes.$inferSelect;
export type Sprint = typeof sprints.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type CardTransition = typeof cardTransitions.$inferSelect;
export type BoardEvent = typeof events.$inferSelect;
