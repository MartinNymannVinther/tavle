"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { AreaChip, FlagChip, ThemeChip } from "@/components/board/bits";
import { CardChips, type ChipContext, type StructureLookup } from "@/components/board/card-chips";
import { TypeIcon } from "@/components/board/type-icon";
import type { Theme } from "@/core/db/schema";
import type { ItemView } from "@/modules/boards/types";
import { titleWarnings } from "@/modules/boards/structure/rules";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { FoldButton, Key, ProgressBar, RankArrows } from "./backlog-bits";
import type { Progress } from "./group-backlog";

/**
 * An epic or a feature as its own line in the hierarchy. The epic is a
 * section head on the secondary ground, two lines deep: the key, the
 * title and the rules' marks, then its place and what it holds. The
 * feature is one line under it that says only what differs from the
 * epic. Both fold, both rank among their level, both show how far they
 * are.
 */
type Common = {
  item: ItemView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  reviewDue: boolean;
  open: boolean;
  onToggle: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  progress: Progress;
};

function Marks({ item, structure, reviewDue }: Pick<Common, "item" | "structure" | "reviewDue">) {
  const t = useTranslations("boards.structure");
  const categoryNames = [
    ...structure.themes.map((theme) => theme.name),
    ...structure.areas.map((a) => a.name),
  ];
  const warns = titleWarnings(item.title, categoryNames).length > 0;
  return (
    <>
      {warns && (
        <span
          className="text-warning inline-flex items-center gap-1 text-[0.69rem] font-medium"
          title={t("looksLikeTheme")}
        >
          <TriangleAlert className="size-3.5" aria-hidden />
          <span className="hidden @lg:inline">{t("looksLikeTheme")}</span>
        </span>
      )}
      {reviewDue && (
        <span className="bg-warning-tint text-warning rounded-full px-2 py-0.5 text-[0.69rem] font-medium whitespace-nowrap">
          {t("forReview")}
        </span>
      )}
    </>
  );
}

function Title({
  item,
  boardId,
  className,
}: {
  item: ItemView;
  boardId: string;
  className?: string;
}) {
  return (
    <Link
      href={`/boards/${boardId}/items/${item.number}`}
      className={cn(
        "hover:underline",
        item.state === "closed" && "text-meta line-through",
        className,
      )}
    >
      {item.title}
    </Link>
  );
}

export function EpicHeader({
  counts,
  action,
  ...p
}: Common & {
  /** What the epic holds, already worded: "2 features · 7 kort". */
  counts: string;
  /** Something to do from the line, such as a new feature under it. */
  action?: React.ReactNode;
}) {
  const t = useTranslations("boards.structure");
  const { item, structure } = p;
  const area = item.areaId ? structure.areas.find((a) => a.id === item.areaId) : null;
  const themes = item.themeIds
    .map((id) => structure.themes.find((theme) => theme.id === id))
    .filter((theme): theme is Theme => Boolean(theme));
  return (
    <div className="group/row bg-secondary/60 flex items-start gap-2 py-2.5 pr-3 pl-2">
      <FoldButton open={p.open} onToggle={p.onToggle} />
      <TypeIcon type="epic" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.95rem] leading-snug font-semibold text-pretty [&>*]:mr-2 [&>*]:align-middle [&>*:last-child]:mr-0">
          <Key boardKey={p.boardKey} number={item.number} />
          <Title item={item} boardId={p.boardId} />
          <Marks item={item} structure={structure} reviewDue={p.reviewDue} />
        </p>
        <div className="text-meta mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.72rem]">
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
          {action}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <ProgressBar progress={p.progress} long className="hidden @md:inline-flex" />
        <RankArrows onUp={p.onMoveUp} onDown={p.onMoveDown} />
      </div>
    </div>
  );
}

export function FeatureLine({
  context,
  ...p
}: Common & {
  /** The epic's place, so the line shows only what the feature has of its own. */
  context?: ChipContext;
}) {
  const h = useTranslations("backlog.hierarchy");
  const { item, structure } = p;
  return (
    <div className="group/row flex items-center gap-2 py-2 pr-3 pl-2">
      <FoldButton open={p.open} onToggle={p.onToggle} />
      <TypeIcon type="feature" />
      <Key boardKey={p.boardKey} number={item.number} />
      <Title item={item} boardId={p.boardId} className="min-w-0 truncate text-sm font-medium" />
      <Marks item={item} structure={structure} reviewDue={p.reviewDue} />
      <CardChips
        card={{ ...item, bug: false }}
        structure={structure}
        context={context}
        className="hidden items-center gap-1 @md:flex"
      />
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {p.progress.open > 0 && (
          <span className="text-meta hidden text-[0.72rem] tabular-nums whitespace-nowrap @sm:inline">
            {h("underway", { open: p.progress.open })}
          </span>
        )}
        <ProgressBar progress={p.progress} />
        <RankArrows onUp={p.onMoveUp} onDown={p.onMoveDown} />
      </span>
    </div>
  );
}
