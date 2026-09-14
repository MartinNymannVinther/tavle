"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Theme } from "@/core/db/schema";
import { themeSwatch } from "./tokens";
import { TypeIcon, type ItemType } from "./type-icon";

const ALL_TYPES: ItemType[] = ["epic", "feature", "card", "bug", "enabler"];

/** The kinds a page with cards and their parents shows under a given view. */
export function legendTypes(
  view: { epics: boolean; features: boolean; kind: boolean },
  base: ItemType[] = ["card", "bug"],
): ItemType[] {
  return ALL_TYPES.filter(
    (type) =>
      base.includes(type) ||
      (type === "epic" && view.epics) ||
      (type === "feature" && view.features) ||
      (type === "enabler" && view.kind),
  );
}

/**
 * What the symbols on a page mean, said in one quiet line wherever they
 * are used: each symbol with its word. A page passes the kinds it shows,
 * so the legend never explains a symbol that is not there.
 */
export function TypeLegend({
  types = ALL_TYPES,
  className,
}: {
  types?: ItemType[];
  className?: string;
}) {
  const t = useTranslations("boards.types");
  return (
    <p className={cn("text-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      <span className="text-label">{t("legend")}</span>
      {types.map((type) => (
        <span key={type} className="inline-flex items-center gap-1">
          <TypeIcon type={type} />
          {t(type)}
        </span>
      ))}
    </p>
  );
}

/** The board's themes as dot and name, so a dot on a card can be read without hovering. */
export function ThemeLegend({
  themes,
  className,
}: {
  themes: Array<Pick<Theme, "id" | "name" | "color" | "active">>;
  className?: string;
}) {
  const t = useTranslations("boards.types");
  const active = themes.filter((theme) => theme.active);
  if (active.length === 0) return null;
  return (
    <p className={cn("text-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      <span className="text-label">{t("themes")}</span>
      {active.map((theme) => (
        <span key={theme.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ background: themeSwatch(theme.color) }}
          />
          {theme.name}
        </span>
      ))}
    </p>
  );
}
