import type { Kind, Swimlane, SwimlaneMode, Theme } from "@/core/db/schema";
import type { SwimlaneAssignment } from "../validation";

/**
 * Swimlanes on a Kanban board (docs/adr/0017): the same columns, split
 * into rows by one of the structure's fields or by lanes the team named
 * itself. Everything here is grouping and arithmetic on the board's flat
 * card list; nothing reads the database, so the board view and the tests
 * share one meaning of "which lane is this card in".
 */

/** What the grouping needs to know about a card. */
export type LaneCard = {
  id: string;
  kind: string;
  areaId: string | null;
  swimlaneId: string | null;
  themeIds: string[];
};

/** One row on the board. A null name is the UI's to word: the kind labels, or the "without" row. */
export type BoardLane = { key: string | null; name: string | null };

type LaneSettings = {
  mode: string;
  swimlaneBy: string;
  showKind: boolean;
  showThemes: boolean;
  showAreas: boolean;
};

/**
 * The mode the board actually runs with. Lanes are Kanban's, and a lane
 * field the view hides (ADR 0014) cannot group the board: the choice
 * stays written and comes back when the field is shown again.
 */
export function effectiveSwimlaneMode(board: LaneSettings): SwimlaneMode {
  if (board.mode !== "kanban") return "none";
  const by = board.swimlaneBy as SwimlaneMode;
  if (by === "kind" && !board.showKind) return "none";
  if (by === "theme" && !board.showThemes) return "none";
  if (by === "area" && !board.showAreas) return "none";
  return by;
}

/**
 * The lane a card lies in. A card with several themes lies in its topmost
 * theme's lane — the themes' own order decides, so the board stays a
 * partition: every card in exactly one row.
 */
export function laneKeyOf(card: LaneCard, mode: SwimlaneMode, themes: Theme[]): string | null {
  switch (mode) {
    case "kind":
      return card.kind;
    case "area":
      return card.areaId;
    case "manual":
      return card.swimlaneId;
    case "theme":
      return themes.find((theme) => card.themeIds.includes(theme.id))?.id ?? null;
    default:
      return null;
  }
}

/**
 * The rows to draw, in order: active values as the team ordered them,
 * deactivated ones only while cards still lie in them, and the "without"
 * row last. For areas and manual lanes the "without" row is always there —
 * it is a real place a card can be put; for themes it only appears when
 * cards lie in it, because a drop cannot say which themes to take away.
 */
export function boardLanes(
  mode: SwimlaneMode,
  lists: { themes: Theme[]; areas: Array<{ id: string; name: string; active: boolean }> },
  swimlanes: Swimlane[],
  cards: LaneCard[],
): BoardLane[] {
  if (mode === "none") return [];
  if (mode === "kind") {
    return [
      { key: "business", name: null },
      { key: "enabler", name: null },
    ];
  }
  const used = new Set(cards.map((card) => laneKeyOf(card, mode, lists.themes)));
  const rows = mode === "theme" ? lists.themes : mode === "area" ? lists.areas : swimlanes;
  const lanes: BoardLane[] = rows
    .filter((row) => row.active || used.has(row.id))
    .map((row) => ({ key: row.id, name: row.name }));
  if (mode !== "theme" || used.has(null)) lanes.push({ key: null, name: null });
  return lanes;
}

/**
 * A drop index counted inside one lane, translated to the index among
 * the column's whole card list, which is what the server orders by. Both
 * lists must be in board order and include the dragged card.
 */
export function columnIndexFor(
  columnCards: Array<{ id: string }>,
  laneCards: Array<{ id: string }>,
  laneIndex: number,
): number | undefined {
  const at = laneCards[laneIndex];
  if (at) {
    const index = columnCards.findIndex((card) => card.id === at.id);
    return index === -1 ? undefined : index;
  }
  const last = laneCards[laneCards.length - 1];
  if (!last) return undefined;
  const index = columnCards.findIndex((card) => card.id === last.id);
  return index === -1 ? undefined : index + 1;
}

/** What a drop into a lane writes, or null when that lane takes no drops (themes' "without" row). */
export function assignmentFor(
  mode: SwimlaneMode,
  laneKey: string | null,
): SwimlaneAssignment | null {
  switch (mode) {
    case "kind":
      return laneKey ? { by: "kind", kind: laneKey as Kind } : null;
    case "theme":
      return laneKey ? { by: "theme", themeId: laneKey } : null;
    case "area":
      return { by: "area", areaId: laneKey };
    case "manual":
      return { by: "manual", swimlaneId: laneKey };
    default:
      return null;
  }
}

/**
 * The assignment applied to a local copy of the card, for the optimistic
 * move: the same replacement the server does, including keeping a card's
 * other themes when its lane theme is swapped.
 */
export function applyLaneLocally<T extends LaneCard & { enablerType: string | null }>(
  card: T,
  assignment: SwimlaneAssignment,
  themes: Theme[],
): T {
  switch (assignment.by) {
    case "kind":
      return {
        ...card,
        kind: assignment.kind,
        enablerType: assignment.kind === "enabler" ? card.enablerType : null,
      };
    case "area":
      return { ...card, areaId: assignment.areaId };
    case "manual":
      return { ...card, swimlaneId: assignment.swimlaneId };
    case "theme": {
      const top = laneKeyOf(card, "theme", themes);
      return {
        ...card,
        themeIds: [
          assignment.themeId,
          ...card.themeIds.filter((id) => id !== top && id !== assignment.themeId),
        ],
      };
    }
  }
}
