"use client";

import { useTranslations } from "next-intl";
import type { Area, Theme } from "@/core/db/schema";
import type { CardView, ItemView } from "@/modules/boards/types";
import { AreaChip, FlagChip, ThemeChip } from "./bits";
import { TypeGlyph } from "./type-icon";

/** What the card and the backlog row need to say where a card belongs. */
export type StructureLookup = {
  themes: Theme[];
  areas: Area[];
  items: ItemView[];
};

export function structureOf(full: StructureLookup): StructureLookup {
  return { themes: full.themes, areas: full.areas, items: full.items };
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
  const own = deviatingPlace(card, context);
  const area = own.areaId ? structure.areas.find((a) => a.id === own.areaId) : null;
  const themes = own.themeIds
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
    <p className="text-meta mt-1 flex items-center gap-1 text-[0.69rem]">
      <TypeGlyph type="feature" />
      <span className="truncate">
        {t("partOf", { key: `${boardKey}-${feature.number}`, title: feature.title })}
      </span>
    </p>
  );
}
