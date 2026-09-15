import type { BoardFull, CardView, ItemView } from "@/modules/boards/types";

/**
 * The backlog as groups, computed from the board. The backlog is the
 * stories not yet committed: on a Scrum board those without a sprint, on
 * a Kanban board those in a backlog column (or, on a board without one,
 * in the first column). The hierarchy hangs them under their features
 * and epics, with what has no parent in a group of its own, never in an
 * epic of the tool's making; the navigator is drawn from it and the
 * list is narrowed by it. The other views group the same stories by one
 * field each.
 */

export type Grouping = "list" | "theme" | "area" | "kind";
export const GROUPINGS: Grouping[] = ["list", "theme", "area", "kind"];

export type FeatureNode = {
  feature: ItemView;
  stories: CardView[];
  /** Stories under the feature that are not in the backlog: in a sprint, on the board, done. */
  elsewhere: { open: number; done: number };
};

export type EpicNode = {
  epic: ItemView;
  features: FeatureNode[];
};

export type Hierarchy = {
  epics: EpicNode[];
  /** Features with no epic, with their stories. */
  looseFeatures: FeatureNode[];
  /** Stories with no feature. */
  looseStories: CardView[];
};

export type Group = { key: string; name: string; color: string | null; stories: CardView[] };

/** How far an item is: all its stories, the ones done, the ones under way elsewhere. */
export type Progress = { total: number; done: number; open: number };

export function featureProgress(node: FeatureNode): Progress {
  return {
    total: node.stories.length + node.elsewhere.open + node.elsewhere.done,
    done: node.elsewhere.done,
    open: node.elsewhere.open,
  };
}

export function epicProgress(node: EpicNode): Progress {
  return node.features.map(featureProgress).reduce(
    (sum, p) => ({
      total: sum.total + p.total,
      done: sum.done + p.done,
      open: sum.open + p.open,
    }),
    { total: 0, done: 0, open: 0 },
  );
}

/** The stories that are in the backlog, in the backlog's own order. */
export function backlogStories(full: BoardFull): CardView[] {
  const { board, columns, cards } = full;
  let inBacklog: (card: CardView) => boolean;
  if (board.mode === "scrum") {
    inBacklog = (card) => !card.sprintId;
  } else {
    const backlogColumns = columns.filter((c) => c.category === "backlog").map((c) => c.id);
    const ids = backlogColumns.length > 0 ? backlogColumns : columns.slice(0, 1).map((c) => c.id);
    inBacklog = (card) => ids.includes(card.columnId);
  }
  return cards.filter(inBacklog).sort((a, b) => a.sort - b.sort || a.number - b.number);
}

/**
 * Scrum: the cards already committed to an open sprint and not yet done.
 * They left the backlog's order, but not the backlog's sight — the list
 * shows them marked with their sprint, so the whole of a feature is one
 * look (docs/adr/0027).
 */
export function allocatedStories(full: BoardFull): CardView[] {
  if (full.board.mode !== "scrum") return [];
  const open = new Map(full.sprints.filter((s) => s.state !== "closed").map((s) => [s.id, s]));
  return full.cards
    .filter((c) => c.sprintId && open.has(c.sprintId) && !c.doneAt)
    .sort((a, b) => {
      const sprintA = open.get(a.sprintId!)!;
      const sprintB = open.get(b.sprintId!)!;
      return sprintA.number - sprintB.number || a.sort - b.sort || a.number - b.number;
    });
}

const byRank = (a: ItemView, b: ItemView) => a.sort - b.sort || a.number - b.number;

export function hierarchy(
  full: BoardFull,
  stories: CardView[],
  options: { showClosed: boolean; items?: ItemView[] },
): Hierarchy {
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const backlogIds = new Set(stories.map((s) => s.id));
  // The items the board shows; a level switched off leaves its children without a parent here.
  const items = (options.items ?? full.items).filter(
    (i) => options.showClosed || i.state === "open",
  );
  const features = items.filter((i) => i.level === "feature").sort(byRank);
  const epics = items.filter((i) => i.level === "epic").sort(byRank);

  const node = (feature: ItemView): FeatureNode => {
    const under = full.cards.filter((c) => c.featureId === feature.id);
    const elsewhere = under.filter((c) => !backlogIds.has(c.id));
    return {
      feature,
      stories: stories.filter((s) => s.featureId === feature.id),
      elsewhere: {
        open: elsewhere.filter((c) => category.get(c.columnId) !== "done").length,
        done: elsewhere.filter((c) => category.get(c.columnId) === "done").length,
      },
    };
  };

  const epicIds = new Set(epics.map((e) => e.id));
  return {
    epics: epics.map((epic) => ({
      epic,
      features: features.filter((f) => f.parentId === epic.id).map(node),
    })),
    looseFeatures: features.filter((f) => !f.parentId || !epicIds.has(f.parentId)).map(node),
    looseStories: stories.filter(
      (s) => !s.featureId || !features.some((f) => f.id === s.featureId),
    ),
  };
}

/**
 * The same stories under one field. A story with two themes is in two
 * groups; the group counts say so. Groups with nothing in them are left
 * out, except the "none" group, which is the one worth seeing empty.
 */
export function grouped(
  full: BoardFull,
  stories: CardView[],
  by: Exclude<Grouping, "list">,
  names: { none: string; business: string; enabler: string },
): Group[] {
  if (by === "theme") {
    const groups = full.themes
      .filter((theme) => theme.active)
      .map((theme) => ({
        key: theme.id,
        name: theme.name,
        color: theme.color,
        stories: stories.filter((s) => s.themeIds.includes(theme.id)),
      }))
      .filter((group) => group.stories.length > 0);
    return [
      ...groups,
      {
        key: "none",
        name: names.none,
        color: null,
        stories: stories.filter((s) => s.themeIds.length === 0),
      },
    ];
  }
  if (by === "area") {
    const groups = full.areas
      .filter((area) => area.active)
      .map((area) => ({
        key: area.id,
        name: area.name,
        color: null,
        stories: stories.filter((s) => s.areaId === area.id),
      }))
      .filter((group) => group.stories.length > 0);
    return [
      ...groups,
      { key: "none", name: names.none, color: null, stories: stories.filter((s) => !s.areaId) },
    ];
  }
  return [
    {
      key: "business",
      name: names.business,
      color: null,
      stories: stories.filter((s) => s.kind !== "enabler"),
    },
    {
      key: "enabler",
      name: names.enabler,
      color: null,
      stories: stories.filter((s) => s.kind === "enabler"),
    },
  ];
}
