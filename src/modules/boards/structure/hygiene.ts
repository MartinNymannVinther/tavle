import type { BoardFull, CardView, ItemView } from "../types";
import { velocity } from "../metrics/velocity";
import { reviewDue } from "./rules";
// The one definition of what the backlog holds. The summary links to the
// backlog page, so it has to count the set that page lists, and a second
// reading of "the backlog" here is how the two came apart.
import { backlogStories } from "./backlog";

/**
 * Backlog care (docs/adr/0031): the handful of things a product owner
 * would want to know before refining or planning, each one a list of
 * real rows rather than a percentage.
 *
 * Two rules keep the page honest. A finding appears only when it has
 * something to show, so a tended backlog shows a short page and an
 * untended one shows a long one — a measure that always warns teaches
 * people to stop reading. And nothing here is a verdict: an item
 * without a parent is a supported state (the tool never invents a
 * container), so it is listed as a decision waiting, not as a fault.
 *
 * All of it is computed from the board as it stands, with no model
 * involved, so the page works on an installation with no AI at all.
 */

/** How loudly a finding asks. Decide: somebody must choose. Tidy: debt worth clearing. Note: worth knowing. */
export type FindingTone = "decide" | "tidy" | "note";

export type Finding = {
  key: string;
  tone: FindingTone;
  /** The rows behind the number, so the page can show them and link to each. */
  items: Array<{ id: string; number: number; title: string; level: "epic" | "feature" | "card" }>;
  /** Filled only by the findings that are a measurement rather than a list. */
  measure?: { value: number; of: number };
};

export type BacklogCare = {
  findings: Finding[];
  /** The ranked work waiting: what a plan would be drawn from. */
  waiting: { cards: number; points: number; unestimated: number };
  /** Sprints of ranked work at the recent average, or null without a velocity to divide by. */
  depthInSprints: number | null;
};

const row = (item: ItemView | CardView, level: "epic" | "feature" | "card") => ({
  id: item.id,
  number: item.number,
  title: item.title,
  level,
});

/**
 * The cards a plan would be drawn from: the backlog itself, in the
 * board's own order. On a Scrum board that is the cards not yet in a
 * sprint; on a Kanban board it is the cards in a backlog column — not
 * every card that is not done, which counted work already in progress as
 * waiting and made the summary name a number the backlog it links to did
 * not hold. A done card is dropped: on Kanban a backlog column is never
 * done, so this only touches a Scrum board where something finished
 * without ever being committed, and finished work is not waiting.
 */
function waitingCards(full: BoardFull): CardView[] {
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  return backlogStories(full).filter((card) => category.get(card.columnId) !== "done");
}

export function backlogCare(full: BoardFull, now: Date = new Date()): BacklogCare {
  const openItems = full.items.filter((i) => i.state === "open");
  const epics = openItems.filter((i) => i.level === "epic");
  const features = openItems.filter((i) => i.level === "feature");
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const openCards = full.cards.filter((c) => category.get(c.columnId) !== "done");

  // Already in the backlog's own order, so the top of the rank is the top.
  const waiting = waitingCards(full);
  const waitingPoints = waiting.reduce((sum, c) => sum + (c.estimate ?? 0), 0);
  const unestimated = waiting.filter((c) => c.estimate === null);

  const average = velocity(full.sprints).average;
  const depthInSprints =
    average && average > 0 ? Math.round((waitingPoints / average) * 10) / 10 : null;

  const findings: Finding[] = [];
  const add = (
    key: string,
    tone: FindingTone,
    items: Finding["items"],
    measure?: Finding["measure"],
  ) => {
    if (items.length > 0 || measure) findings.push({ key, tone, items, measure });
  };

  // Waiting on a decision: the tool will not choose a parent for you.
  add("unplaced", "decide", [
    ...features.filter((f) => !f.parentId).map((f) => row(f, "feature")),
    ...openCards.filter((c) => !c.featureId).map((c) => row(c, "card")),
  ]);

  // Rule 4: without a done-when an item cannot be closed, so it is debt.
  add("noDoneWhen", "tidy", [
    ...epics.filter((e) => !e.doneWhen.trim()).map((e) => row(e, "epic")),
    ...features.filter((f) => !f.doneWhen.trim()).map((f) => row(f, "feature")),
  ]);

  // A promise with no work under it, at either level.
  const cardsByFeature = new Set(full.cards.map((c) => c.featureId).filter(Boolean));
  const featuresByEpic = new Set(features.map((f) => f.parentId).filter(Boolean));
  add(
    "emptyFeature",
    "decide",
    features.filter((f) => !cardsByFeature.has(f.id)).map((f) => row(f, "feature")),
  );
  add(
    "emptyEpic",
    "decide",
    epics.filter((e) => !featuresByEpic.has(e.id)).map((e) => row(e, "epic")),
  );

  // An epic nobody has confirmed is still a result worth having.
  add(
    "review",
    "tidy",
    epics.filter((e) => reviewDue(e, full.board.epicReviewDays, now)).map((e) => row(e, "epic")),
  );

  // You cannot plan what you have not weighed: the top of the rank only.
  const TOP = 10;
  add(
    "unestimatedTop",
    "tidy",
    waiting
      .slice(0, TOP)
      .filter((c) => c.estimate === null)
      .map((c) => row(c, "card")),
  );

  // Ranked work far beyond what the team finishes is a plan nobody will reach.
  if (depthInSprints !== null && depthInSprints > 6) {
    findings.push({
      key: "tooDeep",
      tone: "note",
      items: [],
      measure: { value: waitingPoints, of: Math.round(average!) },
    });
  }

  return {
    findings,
    waiting: { cards: waiting.length, points: waitingPoints, unestimated: unestimated.length },
    depthInSprints,
  };
}
