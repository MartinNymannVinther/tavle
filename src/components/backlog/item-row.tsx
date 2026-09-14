"use client";

import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { AreaChip, FlagChip, StatusChip, ThemeChip } from "@/components/board/bits";
import type { StructureLookup } from "@/components/board/card-chips";
import { TypeIcon } from "@/components/board/type-icon";
import type { Theme } from "@/core/db/schema";
import type { ItemView } from "@/modules/boards/types";
import { titleWarnings } from "@/modules/boards/structure/rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Key, ProgressBar } from "./backlog-bits";
import type { Progress } from "./group-backlog";

/**
 * The epic or feature the list is narrowed to, as the list's heading:
 * the symbol, the key and the title as a link to the item, the rules'
 * marks, then what it is done by, its place and how far it is. One
 * place for everything the rows under it no longer need to repeat.
 */
export function ItemHeading({
  item,
  boardKey,
  boardId,
  structure,
  reviewDue,
  progress,
  counts,
  action,
}: {
  item: ItemView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  reviewDue: boolean;
  progress: Progress;
  /** What the item holds, already worded: "2 features · 7 kort". */
  counts: string;
  /** Something to do from here, such as a new feature under the epic. */
  action?: React.ReactNode;
}) {
  const t = useTranslations("boards.structure");
  const h = useTranslations("backlog.heading");
  const area = item.areaId ? structure.areas.find((a) => a.id === item.areaId) : null;
  const themes = item.themeIds
    .map((id) => structure.themes.find((theme) => theme.id === id))
    .filter((theme): theme is Theme => Boolean(theme));
  const categoryNames = [
    ...structure.themes.map((theme) => theme.name),
    ...structure.areas.map((a) => a.name),
  ];
  const warns = titleWarnings(item.title, categoryNames).length > 0;
  const level = item.level as "epic" | "feature";

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3">
      <p className="text-reading leading-snug font-semibold text-pretty [&>*]:mr-2 [&>*]:align-middle [&>*:last-child]:mr-0">
        <TypeIcon type={level} />
        <Key boardKey={boardKey} number={item.number} />
        <Link
          href={`/boards/${boardId}/items/${item.number}`}
          className={cn("hover:underline", item.state === "closed" && "text-meta line-through")}
        >
          {item.title}
          <ArrowUpRight className="text-label ml-1 inline size-3.5 align-[-2px]" aria-hidden />
        </Link>
        {warns && (
          <span
            className="text-warning inline-flex items-center gap-1 text-2xs font-medium"
            title={t("looksLikeTheme")}
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            {t("looksLikeTheme")}
          </span>
        )}
        {item.state === "open" && !item.doneWhen.trim() && (
          <span
            className="text-warning inline-flex items-center gap-1 text-2xs font-medium"
            title={t("missingDoneWhen")}
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            {t("missingDoneWhen")}
          </span>
        )}
        {reviewDue && (
          <StatusChip tone="warning" className="whitespace-nowrap">
            {t("forReview")}
          </StatusChip>
        )}
      </p>
      {item.doneWhen && (
        <p className="text-meta text-2sm">
          <span className="text-label">{h("doneWhen")}</span> {item.doneWhen}
        </p>
      )}
      <div className="text-meta flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {item.kind === "enabler" && (
          <FlagChip tone="enabler">
            {item.enablerType ? t(`enablerType.${item.enablerType}`) : t("kind.enabler")}
          </FlagChip>
        )}
        {area && <AreaChip name={area.name} />}
        {themes.map((theme) => (
          <ThemeChip key={theme.id} theme={theme} />
        ))}
        {(area || themes.length > 0 || item.kind === "enabler") && (
          <span aria-hidden className="text-label">
            ·
          </span>
        )}
        <span className="tabular-nums">{counts}</span>
        <ProgressBar progress={progress} long className="ml-1" />
        {action}
      </div>
    </div>
  );
}
