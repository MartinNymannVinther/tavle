import type {
  Board,
  BoardEvent,
  BoardMode,
  Card,
  Column,
  Comment,
  Label,
  Sprint,
} from "@/core/db/schema";

export type { Result } from "@/core/result";
export { fail, ok } from "@/core/result";

/**
 * What the pages and the AI see: the rows of a board with the people on
 * them resolved to names. Members are identities in the database; names
 * are how humans and models refer to them.
 */

export type Member = { userId: string; name: string; email: string; role: string };

export type CardView = Card & {
  assigneeName: string | null;
  labelIds: string[];
  checklistDone: number;
  checklistTotal: number;
  commentCount: number;
};

export type BoardFull = {
  board: Board;
  columns: Column[];
  labels: Label[];
  /** Every card that is not archived, backlog included on a Scrum board. */
  cards: CardView[];
  sprints: Sprint[];
  activeSprint: Sprint | null;
  members: Member[];
};

export type CommentView = Comment & { authorName: string | null };

export type CardFull = {
  card: CardView;
  board: Board;
  columns: Column[];
  labels: Label[];
  /** Planned and active sprints a card can be moved to. */
  sprints: Sprint[];
  members: Member[];
  comments: CommentView[];
  events: BoardEvent[];
};

export type BoardSummary = {
  id: string;
  name: string;
  key: string;
  mode: BoardMode;
  description: string;
  archivedAt: Date | null;
  updatedAt: Date;
  /** Cards on the board that are neither archived nor done. */
  openCount: number;
  doneCount: number;
  /** Cards in a `doing` column right now. */
  inProgressCount: number;
  activeSprint: { id: string; name: string; endDate: string } | null;
};

export type MyCard = CardView & {
  boardId: string;
  boardName: string;
  boardKey: string;
  columnName: string;
  columnCategory: string;
};
