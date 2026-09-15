import type {
  Area,
  BacklogItem,
  Board,
  BoardEvent,
  BoardMode,
  Card,
  Column,
  Comment,
  Sprint,
  Swimlane,
  Theme,
} from "@/core/db/schema";

export type { Result } from "@/core/result";
export { fail, ok } from "@/core/result";

/**
 * What the pages and the AI see: the rows of a board with the people on
 * them resolved to names. Members are identities in the database; names
 * are how humans and models refer to them.
 */

export type Member = { userId: string; name: string; email: string; role: string };

/** A roster row as the views need it (docs/adr/0029): who work can be assigned to. */
export type PersonRef = { id: string; name: string; userId: string | null };

/**
 * The list surfaces ship every card of the board to the client, so the
 * view carries only what a board, backlog, map or roadmap renders — the
 * prose (description, acceptance, the raw checklist, the blocked reason)
 * stays on the server and travels only with the one card a page opens.
 */
export type CardView = Omit<Card, "description" | "acceptance" | "checklist" | "blockedReason"> & {
  /** The description's first ~200 characters, for a list line; the whole prose stays on the card page. */
  descriptionPreview: string;
  assigneeName: string | null;
  themeIds: string[];
  checklistDone: number;
  checklistTotal: number;
  commentCount: number;
};

/** The whole card, for its own page: the view plus the prose. */
export type CardDetail = CardView &
  Pick<Card, "description" | "acceptance" | "checklist" | "blockedReason">;

/** An epic or a feature with its themes resolved to ids. */
export type ItemView = BacklogItem & { themeIds: string[] };

export type BoardFull = {
  board: Board;
  columns: Column[];
  themes: Theme[];
  areas: Area[];
  /** The board's manual swimlanes; empty unless the team has named some. */
  swimlanes: Swimlane[];
  /** Every epic and feature of the board, open and closed; closed ones still name a card's parent. */
  items: ItemView[];
  /** Every card that is not archived, backlog included on a Scrum board. */
  cards: CardView[];
  sprints: Sprint[];
  activeSprint: Sprint | null;
  /** Owners of themes and areas pick from these — logins with a role. */
  members: Member[];
  /** Assignees pick from these — the roster, logins or not (docs/adr/0029). */
  people: PersonRef[];
};

export type CommentView = Comment & { authorName: string | null };

export type CardFull = {
  card: CardDetail;
  board: Board;
  columns: Column[];
  themes: Theme[];
  areas: Area[];
  /** The board's features, open ones and the card's own, for the parent select. */
  features: ItemView[];
  /** Planned and active sprints a card can be moved to. */
  sprints: Sprint[];
  people: PersonRef[];
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
