"use client";

import { useTranslations } from "next-intl";
import type { Area, EstimateUnit, Theme } from "@/core/db/schema";
import type { CardView, ItemView } from "@/modules/boards/types";
import {
  structureView,
  type StructureSettings,
  type StructureView,
} from "@/modules/boards/structure/view";
import { AreaChip, FlagChip, ThemeChip } from "./bits";
import { TypeGlyph } from "./type-icon";

/** What the card and the backlog row need to say where a card belongs. */
export type StructureLookup = {
  themes: Theme[];
  areas: Area[];
  items: ItemView[];
  /** How much of the structure the board shows; what is hidden is left out everywhere. */
  view: StructureView;
  /** What the board counts in, so every card reads its estimate the same way (docs/adr/0030). */
  estimateUnit: EstimateUnit;
};

export function structureOf(full: {
  board: StructureSettings & { estimateUnit?: string };
  themes: Theme[];
  areas: Area[];
  items: ItemView[];
}): StructureLookup {
  const view = structureView(full.board);
  return {
    themes: full.themes,
    areas: full.areas,
    items: full.items.filter(
      (item) =>
        (item.level === "epic" && view.epics) || (item.level === "feature" && view.features),
    ),
    view,
    estimateUnit: (full.board.estimateUnit as EstimateUnit) ?? "points",
  };
}

/** The place a chip row is read against: what the parent, or the group, already says. */
export type ChipContext = { areaId?: string | null; themeIds?: string[] };

/** The area and themes a card shows next to a context: only what differs from it. */
export function deviatingPlace(
  card: { areaId: string | null; themeIds: string[] },
  context: ChipContext | undefined,
): { areaId: string | null; themeIds: string[] } {
  if (!context) return { areaId: card.areaId, themeIds: card.themeIds };
  const themes = context.themeIds ?? [];
  return {
    areaId: card.areaId && card.areaId !== context.areaId ? card.areaId : null,
    themeIds: card.themeIds.filter((id) => !themes.includes(id)),
  };
}

/**
 * The card's place, as chips: the bug flag, the enabler kind, the area
 * and the themes. Under a feature or in a group the area and themes
 * inherited from it are left out, so a row says only what is its own;
 * a plain business story in its parent's place shows nothing at all.
 */
export function CardChips({
  card,
  structure,
  context,
  className,
}: {
  card: Pick<CardView, "bug" | "kind" | "enablerType" | "areaId" | "themeIds">;
  structure: StructureLookup;
  context?: ChipContext;
  className?: string;
}) {
  const t = useTranslations("boards.structure");
  const { view } = structure;
  const own = deviatingPlace(card, context);
  const area = view.areas && own.areaId ? structure.areas.find((a) => a.id === own.areaId) : null;
  const themes = view.themes
    ? own.themeIds
        .map((id) => structure.themes.find((theme) => theme.id === id))
        .filter((theme): theme is Theme => Boolean(theme))
    : [];
  const enabler = view.kind && card.kind === "enabler";
  if (!card.bug && !enabler && !area && themes.length === 0) return null;
  return (
    <div className={className ?? "mt-2 flex flex-wrap gap-1"}>
      {card.bug && <FlagChip tone="bug">{t("bug")}</FlagChip>}
      {enabler && (
        <FlagChip tone="enabler">
          {card.enablerType ? t(`enablerType.${card.enablerType}`) : t("kind.enabler")}
        </FlagChip>
      )}
      {area && <AreaChip name={area.name} />}
      {themes.map((theme) => (
        <ThemeChip key={theme.id} theme={theme} />
      ))}
    </div>
  );
}

/** The feature a card is part of, as one muted line: "Del af WEB-2 · Kunder kan betale". */
export function PartOf({
  featureId,
  structure,
  boardKey,
}: {
  featureId: string | null;
  structure: StructureLookup;
  boardKey: string;
}) {
  const t = useTranslations("boards.structure");
  const feature =
    structure.view.features && featureId ? structure.items.find((i) => i.id === featureId) : null;
  if (!feature) return null;
  return (
    <p className="text-meta mt-1 flex items-center gap-1 text-2xs">
      <TypeGlyph type="feature" />
      <span className="truncate">
        {t("partOf", { key: `${boardKey}-${feature.number}`, title: feature.title })}
      </span>
    </p>
  );
}
