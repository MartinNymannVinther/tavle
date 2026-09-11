"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TypeIcon, type ItemType } from "./type-icon";

const ALL_TYPES: ItemType[] = ["epic", "feature", "card", "bug", "enabler"];

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
    <p
      className={cn(
        "text-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem]",
        className,
      )}
    >
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
