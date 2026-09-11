import type { BoardMode, ColumnCategory } from "@/core/db/schema";

/**
 * What a new board starts with. Column names are the Danish words a team
 * would write on a whiteboard; the category behind each one is what the
 * metrics read. Both are the team's to change afterwards.
 *
 * Kanban gets a backlog column, because on a Kanban board the backlog is
 * part of the flow. Scrum does not: its backlog is the list of cards not
 * yet committed to a sprint, which is a page of its own, and the board
 * shows only the sprint.
 */
export type ColumnSeed = { name: string; category: ColumnCategory; wipLimit: number | null };

export const DEFAULT_COLUMNS: Record<BoardMode, ColumnSeed[]> = {
  kanban: [
    { name: "Backlog", category: "backlog", wipLimit: null },
    { name: "Klar", category: "todo", wipLimit: null },
    { name: "I gang", category: "doing", wipLimit: 3 },
    { name: "Færdig", category: "done", wipLimit: null },
  ],
  scrum: [
    { name: "Planlagt", category: "todo", wipLimit: null },
    { name: "I gang", category: "doing", wipLimit: null },
    { name: "Færdig", category: "done", wipLimit: null },
  ],
};

export const DEFAULT_SPRINT_LENGTH_DAYS = 14;
