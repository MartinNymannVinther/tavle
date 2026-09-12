"use client";

import { CircleDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import { FoldButton, ProgressBar } from "@/components/backlog/backlog-bits";
import { AreaChip, ThemeDots } from "@/components/board/bits";
import type { StructureLookup } from "@/components/board/card-chips";
import { TypeIcon } from "@/components/board/type-icon";
import { formatDateDa } from "@/core/dates";
import type { Theme } from "@/core/db/schema";
import { reviewDue } from "@/modules/boards/structure/rules";
import type { ItemView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { MapRow } from "./story-map";

/**
 * The map's edges: an epic across its features, a feature over its
 * column, the dashed head of the column without a parent, and the row
 * labels down the left — a sprint with its dates, the backlog, or a
 * column of the board.
 */
export function EpicHead({
  epic,
  boardId,
  structure,
  reviewDays,
  progress,
  folded,
  onFold,
  action,
  span,
}: {
  epic: ItemView;
  boardId: string;
  structure: StructureLookup;
  reviewDays: number;
  progress: { total: number; done: number; open: number };
  folded: boolean;
  onFold: () => void;
  action?: React.ReactNode;
  span: number;
}) {
  const s = useTranslations("boards.structure");
  const { view } = structure;
  const area = view.areas && epic.areaId ? structure.areas.find((a) => a.id === epic.areaId) : null;
  const themes = view.themes
    ? epic.themeIds
        .map((id) => structure.themes.find((theme) => theme.id === id))
        .filter((theme): theme is Theme => Boolean(theme))
    : [];
  return (
    <div
      className="bg-accent/70 border-hairline flex items-start gap-1.5 border-r border-b px-2 py-2"
      style={{ gridColumn: `span ${span}` }}
    >
      <FoldButton open={!folded} onToggle={onFold} />
      <TypeIcon type="epic" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] leading-snug font-semibold">
          <Link
            href={`/boards/${boardId}/items/${epic.number}`}
            className={cn("hover:underline", epic.state === "closed" && "text-meta line-through")}
          >
            {epic.title}
          </Link>
          {reviewDue(epic, reviewDays) && (
            <span className="bg-warning-tint text-warning ml-2 rounded-full px-2 py-0.5 text-[0.69rem] font-medium whitespace-nowrap">
              {s("forReview")}
            </span>
          )}
        </p>
        <div className="text-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem]">
          {area && <AreaChip name={area.name} />}
          <ThemeDots themes={themes} />
          <ProgressBar progress={progress} />
          {action}
        </div>
      </div>
    </div>
  );
}

export function FeatureHead({
  feature,
  boardId,
  structure,
  progress,
}: {
  feature: ItemView;
  boardId: string;
  structure: StructureLookup;
  progress: { total: number; done: number; open: number };
}) {
  const h = useTranslations("backlog.hierarchy");
  const m = useTranslations("map");
  const { view } = structure;
  const area =
    view.areas && !view.epics && feature.areaId
      ? structure.areas.find((a) => a.id === feature.areaId)
      : null;
  const share = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="bg-secondary border-hairline flex items-start gap-1.5 border-r border-b px-2 py-2">
      <TypeIcon type="feature" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/boards/${boardId}/items/${feature.number}`}
          className={cn(
            "line-clamp-2 text-[0.8125rem] leading-snug font-medium hover:underline",
            feature.state === "closed" && "text-meta line-through",
          )}
        >
          {feature.title}
        </Link>
        <p className="text-meta mt-0.5 text-[0.69rem] tabular-nums">
          {area ? `${area.name} · ` : ""}
          {h("progressShort", { done: progress.done, total: progress.total })}
          {progress.open > 0 ? ` · ${m("underway", { open: progress.open })}` : ""}
        </p>
        {progress.total > 0 && (
          <span className="bg-muted mt-1.5 block h-1 overflow-hidden rounded-full">
            <span className="bg-primary block h-full rounded-full" style={{ width: `${share}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}

export function LooseHead({ count, epicRow }: { count: number; epicRow: boolean }) {
  const t = useTranslations("map");
  return (
    <div
      className={cn(
        "border-hairline flex items-start gap-1.5 border-r border-b px-2 py-2",
        epicRow && "row-span-2",
      )}
    >
      <span className="text-label border-input mt-0.5 inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3rem] border border-dashed">
        <CircleDashed className="size-3" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] leading-snug font-semibold">{t("noParent")}</p>
        <p className="text-meta mt-0.5 text-[0.69rem]">{t("noParentHint", { count })}</p>
      </div>
    </div>
  );
}

export function RowLabel({ row, cards, points }: { row: MapRow; cards: number; points: number }) {
  const t = useTranslations("map");
  const sprint = useTranslations("backlog.sprint");
  return (
    <div className="bg-card border-border sticky left-0 z-10 flex flex-col gap-0.5 border-r border-b px-3 py-2 text-[0.72rem]">
      {row.kind === "sprint" && (
        <>
          <span className="text-chart-2 font-medium">
            {formatDateDa(row.sprint.startDate)} – {formatDateDa(row.sprint.endDate)}
            {row.sprint.state === "active"
              ? ` · ${sprint("activeLabel")}`
              : ` · ${sprint("plannedLabel")}`}
          </span>
          <span className="text-[0.8125rem] font-semibold">{row.sprint.name}</span>
        </>
      )}
      {row.kind === "backlog" && (
        <span className="text-[0.8125rem] font-semibold">{t("backlog")}</span>
      )}
      {row.kind === "column" && (
        <span className="text-[0.8125rem] font-semibold">{row.column.name}</span>
      )}
      <span className="text-meta tabular-nums">{t("rowCounts", { cards, points })}</span>
    </div>
  );
}
