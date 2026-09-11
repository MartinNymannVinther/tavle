"use client";

import { ArrowDown, ArrowUp, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AreaChip, FlagChip, ThemeChip } from "@/components/board/bits";
import type { StructureLookup } from "@/components/board/card-chips";
import type { Theme } from "@/core/db/schema";
import type { ItemView } from "@/modules/boards/types";
import { titleWarnings } from "@/modules/boards/structure/rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * An epic or a feature as a line in the hierarchy: the key and the title
 * as a link, what it is (kind, area, themes), what is under it, and the
 * two marks the rules produce — "looks like a theme" (rules 7 and 8) and
 * "for review" (rule 9). The arrows rank it among its level.
 */
export function ItemRow({
  item,
  boardKey,
  boardId,
  structure,
  counts,
  reviewDue,
  onMoveUp,
  onMoveDown,
  children,
}: {
  item: ItemView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  /** What the line says after the title, already worded. */
  counts: string;
  reviewDue: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("boards.structure");
  const area = item.areaId ? structure.areas.find((a) => a.id === item.areaId) : null;
  const themes = item.themeIds
    .map((id) => structure.themes.find((theme) => theme.id === id))
    .filter((theme): theme is Theme => Boolean(theme));
  const categoryNames = [
    ...structure.themes.map((theme) => theme.name),
    ...structure.areas.map((a) => a.name),
  ];
  const warns = titleWarnings(item.title, categoryNames).length > 0;
  const epic = item.level === "epic";

  return (
    <li className={cn("group/item", epic ? "bg-secondary/40" : "")}>
      <div className={cn("flex items-center gap-3 px-2 py-2", !epic && "pl-8")}>
        <span className="text-meta w-16 shrink-0 text-[0.72rem] tabular-nums">
          {boardKey}-{item.number}
        </span>
        <span className="text-label w-14 shrink-0 text-[0.69rem] font-medium uppercase">
          {t(`level.${item.level}`)}
        </span>
        <Link
          href={`/boards/${boardId}/items/${item.number}`}
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold hover:underline",
            item.state === "closed" && "text-meta line-through",
          )}
        >
          {item.title}
        </Link>
        {warns && (
          <span
            className="text-warning inline-flex items-center gap-1 text-[0.69rem] font-medium"
            title={t("looksLikeTheme")}
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            <span className="hidden lg:inline">{t("looksLikeTheme")}</span>
          </span>
        )}
        {reviewDue && (
          <span className="bg-warning-tint text-warning rounded-full px-2 py-0.5 text-[0.69rem] font-medium">
            {t("forReview")}
          </span>
        )}
        <span className="hidden items-center gap-1 md:flex">
          {item.kind === "enabler" && (
            <FlagChip tone="enabler">
              {item.enablerType ? t(`enablerType.${item.enablerType}`) : t("kind.enabler")}
            </FlagChip>
          )}
          {area && <AreaChip name={area.name} />}
          {themes.slice(0, 2).map((theme) => (
            <ThemeChip key={theme.id} theme={theme} />
          ))}
        </span>
        <span className="text-meta shrink-0 text-[0.72rem] tabular-nums">{counts}</span>
        {(onMoveUp || onMoveDown) && (
          <span className="flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:group-focus-within/item:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("up")}
              onClick={onMoveUp}
              disabled={!onMoveUp}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("down")}
              onClick={onMoveDown}
              disabled={!onMoveDown}
            >
              <ArrowDown />
            </Button>
          </span>
        )}
      </div>
      {children}
    </li>
  );
}
