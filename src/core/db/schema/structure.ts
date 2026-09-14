import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { boards, cards, sprints } from "./boards";
import { domainId, users } from "./foundation";
import { tenant, timestamps } from "./shared";

/**
 * The backlog structure above the cards (docs/adr/0011): epics and
 * features, which finish, and themes and areas, which never do. The
 * tables reference boards.ts and boards.ts references them back; every
 * cross-reference is inside a `references(() => …)` closure, which
 * drizzle resolves lazily, so the cycle is harmless.
 */

/** The two levels above a card. A card is the story; there is nothing above an epic. */
export const ITEM_LEVELS = ["epic", "feature"] as const;
export type ItemLevel = (typeof ITEM_LEVELS)[number];

/** What sort of work an item is. A field on every level, never a separate tree. */
/** How much of the hierarchy a board shows: the top level in use. */
export const STRUCTURE_LEVELS = ["epic", "feature", "card"] as const;
export type StructureLevels = (typeof STRUCTURE_LEVELS)[number];

export const KINDS = ["business", "enabler"] as const;
export type Kind = (typeof KINDS)[number];

/** What an enabler is for; only set when the kind is enabler. */
export const ENABLER_TYPES = [
  "architecture",
  "infrastructure",
  "exploration",
  "compliance",
] as const;
export type EnablerType = (typeof ENABLER_TYPES)[number];

export const ITEM_STATES = ["open", "closed"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

/**
 * The palette a theme may use on the roadmap: eight, because a board holds
 * five to eight themes, and all of them the family's tokens.
 */
export const THEME_COLORS = [
  "moss",
  "sage",
  "clay",
  "rust",
  "sand",
  "stone",
  "ink",
  "forest",
] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

/** A target quarter on an epic, written 2027-Q1. */
export const QUARTER_PATTERN = /^[0-9]{4}-Q[1-4]$/;

/**
 * The two closed lists that answer why (theme) and where (area). Neither
 * ever finishes and neither has a status; a value is deactivated, never
 * deleted, so history keeps its names.
 */
export const themes = pgTable(
  "themes",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("moss"),
    /** Typically the product owner; a member of the workspace. */
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("themes_board_name_uq").on(t.boardId, sql`lower(${t.name})`),
    index("themes_board_idx").on(t.boardId, t.sort),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("areas_board_name_uq").on(t.boardId, sql`lower(${t.name})`),
    index("areas_board_idx").on(t.boardId, t.sort),
  ],
);

/**
 * Epics and features: the two levels above a card, one table, one
 * relation ("part of"). A feature's parent is an epic and nothing else, a
 * card's parent is a feature and nothing else — the level check is a
 * trigger (drizzle/0004), the rest is constraints. Numbers come from the
 * board's card counter, so WEB-12 means one thing whatever its level.
 */
export const backlogItems = pgTable(
  "backlog_items",
  {
    id: domainId("id"),
    orgId: tenant(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    level: text("level").notNull(),
    /** The epic a feature is part of; null is allowed and shown as exactly that. */
    parentId: text("parent_id").references((): AnyPgColumn => backlogItems.id, {
      onDelete: "set null",
    }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** The condition that makes this done; required, because an item that cannot finish is a category. */
    doneWhen: text("done_when").notNull(),
    kind: text("kind").notNull().default("business"),
    enablerType: text("enabler_type"),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    state: text("state").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Epics only: where the roadmap draws it, e.g. 2027-Q1. */
    targetQuarter: text("target_quarter"),
    /** Epics only: the planned start the roadmap draws from; null falls back to the creation quarter. */
    startQuarter: text("start_quarter"),
    /** Features only: the planned span on the sprint axis (docs/adr/0023); null is unplanned. */
    startSprintId: text("start_sprint_id").references((): AnyPgColumn => sprints.id, {
      onDelete: "set null",
    }),
    targetSprintId: text("target_sprint_id").references((): AnyPgColumn => sprints.id, {
      onDelete: "set null",
    }),
    /** The last time an owner said "still a result"; the review clock counts from here, or from creation. */
    reviewConfirmedAt: timestamp("review_confirmed_at", { withTimezone: true }),
    /** Position within its level on the board. One order per level, business and enabler alike. */
    sort: doublePrecision("sort").notNull().default(0),
    /** Features only: the place on the story map, left to right in the story's order; null is off the map. */
    mapSort: doublePrecision("map_sort"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("backlog_items_board_number_uq").on(t.boardId, t.number),
    index("backlog_items_board_level_idx").on(t.boardId, t.level, t.sort),
    index("backlog_items_parent_idx").on(t.parentId),
    index("backlog_items_start_sprint_idx").on(t.startSprintId),
    index("backlog_items_target_sprint_idx").on(t.targetSprintId),
    check("backlog_items_level_ck", sql`${t.level} in ('epic', 'feature')`),
    check(
      "backlog_items_epic_has_no_parent_ck",
      sql`${t.level} = 'feature' or ${t.parentId} is null`,
    ),
    // done_when may be empty while an item is shaped; rule 4 bites at the
    // close (docs/adr/0018), and the database holds that form of it: a
    // closed item keeps its done-when, whatever path closed it.
    check(
      "backlog_items_closed_done_when_ck",
      sql`${t.state} <> 'closed' or btrim(${t.doneWhen}) <> ''`,
    ),
    check("backlog_items_enabler_type_ck", sql`${t.enablerType} is null or ${t.kind} = 'enabler'`),
    check(
      "backlog_items_target_quarter_ck",
      sql`${t.targetQuarter} is null or ${t.targetQuarter} ~ '^[0-9]{4}-Q[1-4]$'`,
    ),
    check(
      "backlog_items_start_quarter_ck",
      sql`${t.startQuarter} is null or ${t.startQuarter} ~ '^[0-9]{4}-Q[1-4]$'`,
    ),
  ],
);

export const backlogItemThemes = pgTable(
  "backlog_item_themes",
  {
    orgId: tenant(),
    itemId: text("item_id")
      .notNull()
      .references(() => backlogItems.id, { onDelete: "cascade" }),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.themeId] })],
);

export const cardThemes = pgTable(
  "card_themes",
  {
    orgId: tenant(),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.themeId] })],
);

export type Theme = typeof themes.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type BacklogItem = typeof backlogItems.$inferSelect;
