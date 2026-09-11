import type { CardView, ItemView } from "@/modules/boards/types";
import type { Hierarchy } from "./group-backlog";

/**
 * What the navigator points at, and what the list shows for it. The
 * backlog is one flat list in its own order; the navigator narrows it to
 * an epic (every story under its features), a feature, or what has no
 * parent. The narrowing never reorders: a story keeps its place among
 * the ones shown, so ranking past a neighbour is the same move as in the
 * whole list.
 */
export type Selection =
  | { kind: "all" }
  | { kind: "epic"; id: string }
  | { kind: "feature"; id: string }
  | { kind: "loose" };

export const ALL: Selection = { kind: "all" };
export const LOOSE: Selection = { kind: "loose" };

/** One string per selection, for a <select> and for remembering. */
export function selectionKey(selection: Selection): string {
  return selection.kind === "epic" || selection.kind === "feature"
    ? `${selection.kind}:${selection.id}`
    : selection.kind;
}

export function parseSelection(key: string): Selection {
  if (key === "loose") return LOOSE;
  const [kind, id] = key.split(":");
  if ((kind === "epic" || kind === "feature") && id) return { kind, id };
  return ALL;
}

/** The stories the selection shows, in the order they were given. */
export function selectStories(
  stories: CardView[],
  tree: Hierarchy,
  selection: Selection,
): CardView[] {
  switch (selection.kind) {
    case "all":
      return stories;
    case "feature":
      return stories.filter((s) => s.featureId === selection.id);
    case "epic": {
      const node = tree.epics.find((n) => n.epic.id === selection.id);
      const ids = new Set(node?.features.map((f) => f.feature.id) ?? []);
      return stories.filter((s) => s.featureId && ids.has(s.featureId));
    }
    case "loose": {
      const ids = new Set(tree.looseStories.map((s) => s.id));
      return stories.filter((s) => ids.has(s.id));
    }
  }
}

/** The selection still points at something after a reload or a close; otherwise everything. */
export function stillThere(selection: Selection, tree: Hierarchy): Selection {
  if (selection.kind === "epic" && !tree.epics.some((n) => n.epic.id === selection.id)) return ALL;
  if (
    selection.kind === "feature" &&
    !tree.epics.some((n) => n.features.some((f) => f.feature.id === selection.id)) &&
    !tree.looseFeatures.some((f) => f.feature.id === selection.id)
  )
    return ALL;
  return selection;
}

/** How many backlog stories each node of the navigator holds, by item id. */
export function navCounts(tree: Hierarchy): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of tree.epics) {
    let total = 0;
    for (const f of node.features) {
      counts.set(f.feature.id, f.stories.length);
      total += f.stories.length;
    }
    counts.set(node.epic.id, total);
  }
  for (const f of tree.looseFeatures) counts.set(f.feature.id, f.stories.length);
  return counts;
}

/** Where a story sits in the structure, for the line under its title. */
export type Crumb = { epic: ItemView | null; feature: ItemView | null };

export function crumbOf(card: Pick<CardView, "featureId">, items: ItemView[]): Crumb {
  const feature = card.featureId ? (items.find((i) => i.id === card.featureId) ?? null) : null;
  const epic = feature?.parentId ? (items.find((i) => i.id === feature.parentId) ?? null) : null;
  return { epic, feature };
}

/**
 * The part of the crumb worth writing under a selection: under an epic
 * only the feature is news, under a feature nothing is.
 */
export function crumbFor(crumb: Crumb, selection: Selection): Crumb {
  if (selection.kind === "feature") return { epic: null, feature: null };
  if (selection.kind === "epic") return { epic: null, feature: crumb.feature };
  return crumb;
}
