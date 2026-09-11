"use client";

import { useTranslations } from "next-intl";
import type { Area, Theme } from "@/core/db/schema";
import type { CardView, ItemView } from "@/modules/boards/types";
import { AreaChip, FlagChip, ThemeChip } from "./bits";

/** What the card and the backlog row need to say where a card belongs. */
export type StructureLookup = {
  themes: Theme[];
  areas: Area[];
  items: ItemView[];
};

export function structureOf(full: StructureLookup): StructureLookup {
  return { themes: full.themes, areas: full.areas, items: full.items };
}

/**
 * The card's place, as chips: the bug flag, the enabler kind, the area
 * and the themes. A plain business story in the area everyone works in
 * shows only the area, which is what a glance needs.
 */
export function CardChips({
  card,
  structure,
  className,
}: {
  card: Pick<CardView, "bug" | "kind" | "enablerType" | "areaId" | "themeIds">;
  structure: StructureLookup;
  className?: string;
}) {
  const t = useTranslations("boards.structure");
  const area = card.areaId ? structure.areas.find((a) => a.id === card.areaId) : null;
  const themes = card.themeIds
    .map((id) => structure.themes.find((theme) => theme.id === id))
    .filter((theme): theme is Theme => Boolean(theme));
  if (!card.bug && card.kind !== "enabler" && !area && themes.length === 0) return null;
  return (
    <div className={className ?? "mt-2 flex flex-wrap gap-1"}>
      {card.bug && <FlagChip tone="bug">{t("bug")}</FlagChip>}
      {card.kind === "enabler" && (
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
  const feature = featureId ? structure.items.find((i) => i.id === featureId) : null;
  if (!feature) return null;
  return (
    <p className="text-meta mt-1 truncate text-[0.69rem]">
      {t("partOf", { key: `${boardKey}-${feature.number}`, title: feature.title })}
    </p>
  );
}
