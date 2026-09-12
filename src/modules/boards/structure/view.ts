import type { StructureLevels } from "@/core/db/schema";

/**
 * How much of the structure a board shows. The tables always hold the
 * whole of it; these flags say which parts the pages draw, which fields
 * the forms offer and which filters and groupings exist. Switching a
 * part off hides it, switching it on brings it back with everything
 * that was there.
 */
export type StructureView = {
  epics: boolean;
  features: boolean;
  kind: boolean;
  themes: boolean;
  areas: boolean;
};

export type StructureSettings = {
  structureLevels: string;
  showKind: boolean;
  showThemes: boolean;
  showAreas: boolean;
};

export const FULL_VIEW: StructureView = {
  epics: true,
  features: true,
  kind: true,
  themes: true,
  areas: true,
};

export function structureView(board: StructureSettings): StructureView {
  const levels = board.structureLevels as StructureLevels;
  return {
    epics: levels === "epic",
    features: levels !== "card",
    kind: board.showKind,
    themes: board.showThemes,
    areas: board.showAreas,
  };
}

/** The levels a card can be placed under, given the view: none, features, or both. */
export function visibleLevels(view: StructureView): Array<"epic" | "feature"> {
  return [
    ...(view.epics ? (["epic"] as const) : []),
    ...(view.features ? (["feature"] as const) : []),
  ];
}
