"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleDashed,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeDots } from "@/components/board/bits";
import type { StructureLookup } from "@/components/board/card-chips";
import { TypeIcon } from "@/components/board/type-icon";
import { formatPlanDate } from "@/core/dates";
import type { EstimateUnit, Release, Theme } from "@/core/db/schema";
import type { CardView, ItemView } from "@/modules/boards/types";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { MapRow } from "./story-map";

/**
 * The map's edges. The backbone is a row of sticky notes, one per
 * feature, in the story's order: a note can be dragged past its
 * neighbours, nudged with the arrows, or taken down from its menu.
 * Last comes the dashed head of the column for cards with no feature,
 * and down the left the row labels — a sprint with its dates, the
 * backlog, or a column of the board.
 */
export function FeatureNote({
  feature,
  boardId,
  structure,
  progress,
  tilt,
  dragging,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onNudge,
  onTakeDown,
  canDrop,
}: {
  feature: ItemView;
  boardId: string;
  structure: StructureLookup;
  progress: { total: number; done: number; open: number };
  /** Alternating notes lean a hair to each side; a wall, not a table. */
  tilt: -1 | 1;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
  onNudge: { left?: () => void; right?: () => void };
  onTakeDown: () => void;
  /** True while a note is being dragged, so this one can receive it. */
  canDrop: boolean;
}) {
  const t = useTranslations("map");
  const h = useTranslations("backlog.hierarchy");
  const router = useRouter();
  const { view } = structure;
  const area =
    view.areas && feature.areaId ? structure.areas.find((a) => a.id === feature.areaId) : null;
  const themes = view.themes
    ? feature.themeIds
        .map((id) => structure.themes.find((theme) => theme.id === id))
        .filter((theme): theme is Theme => Boolean(theme))
    : [];
  const share = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const href = `/boards/${boardId}/items/${feature.number}`;
  return (
    <div
      className="group/note flex items-end px-2.5 pt-3 pb-2"
      onDragOver={(event) => {
        if (canDrop) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDropBefore();
      }}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          "bg-sticky text-sticky-ink relative w-full cursor-grab rounded-xs px-3 pt-2.5 pb-2 shadow-[var(--note-shadow)] transition",
          tilt < 0 ? "-rotate-[0.6deg]" : "rotate-[0.5deg]",
          dragging && "opacity-40",
          canDrop && "outline-primary/40 outline-dashed outline-offset-4",
          feature.state === "closed" && "opacity-70",
        )}
      >
        <div className="flex items-start gap-1.5">
          <TypeIcon type="feature" className="mt-0.5 bg-white/40" />
          <Link
            href={href}
            className={cn(
              "focus-ring line-clamp-3 min-w-0 flex-1 text-2sm leading-snug font-semibold hover:underline",
              feature.state === "closed" && "line-through",
            )}
          >
            {feature.title}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("noteMenu")}
                  className="text-sticky-ink/70 -mt-1 -mr-1.5 shrink-0 hover:bg-black/5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/note:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:aria-expanded:opacity-100"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onClick={() => router.push(href)}>
                {t("openFeature")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTakeDown}>{t("takeDown")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2 flex items-center gap-2 text-2xs tabular-nums opacity-80">
          <span className="min-w-0 flex-1 truncate">
            {area ? `${area.name} · ` : ""}
            {h("progressShort", { done: progress.done, total: progress.total })}
            {progress.open > 0 ? ` · ${t("underway", { open: progress.open })}` : ""}
          </span>
          <ThemeDots themes={themes} />
          <span className="flex shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/note:opacity-100 [@media(hover:hover)]:group-focus-within/note:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("nudgeLeft")}
              onClick={onNudge.left}
              disabled={!onNudge.left}
              className="text-sticky-ink/70 size-5 hover:bg-black/5"
            >
              <ArrowLeft />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("nudgeRight")}
              onClick={onNudge.right}
              disabled={!onNudge.right}
              className="text-sticky-ink/70 size-5 hover:bg-black/5"
            >
              <ArrowRight />
            </Button>
          </span>
        </div>
        {progress.total > 0 && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/10">
            <span className="bg-primary block h-full rounded-full" style={{ width: `${share}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}

export function LooseHead({
  count,
  canDrop,
  onDropAtEnd,
}: {
  count: number;
  canDrop: boolean;
  onDropAtEnd: () => void;
}) {
  const t = useTranslations("map");
  return (
    <div
      className="flex items-end px-2.5 pt-3 pb-2"
      onDragOver={(event) => {
        if (canDrop) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        onDropAtEnd();
      }}
    >
      <div
        className={cn(
          "border-input flex w-full items-start gap-1.5 rounded-xs border border-dashed px-3 pt-2.5 pb-2",
          canDrop && "outline-primary/40 outline-dashed outline-offset-4",
        )}
      >
        <span className="text-label mt-0.5 inline-flex size-[1.125rem] shrink-0 items-center justify-center">
          <CircleDashed className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-2sm leading-snug font-semibold">{t("noParent")}</p>
          <p className="text-meta mt-0.5 text-2xs">{t("noParentHint", { count })}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * A card the wall is counting but not drawing, and why: its feature is
 * waiting in the tray, or it is closed and the tick above hides it.
 */
export type HiddenCard = {
  card: CardView;
  featureId: string;
  featureTitle: string;
  reason: "tray" | "closed";
};

export function RowLabel({
  row,
  cards,
  points,
  unit,
  hidden = [],
  onReveal,
  onEdit,
  onNudge,
}: {
  row: MapRow;
  cards: number;
  points: number;
  /** What the board counts in, so the row's sum is named right (docs/adr/0030). */
  unit: EstimateUnit;
  /** The row's cards the map is not drawing, whatever the reason. */
  hidden?: HiddenCard[];
  /** Brings the card out: its feature goes up, or the closed ones are shown. */
  onReveal?: (featureId: string, reason: HiddenCard["reason"]) => void;
  /** Opens the band for renaming and dating; absent for the unreleased band. */
  onEdit?: (release: Release) => void;
  /** Moves the band a step nearer or further; absent ends of the list are disabled. */
  onNudge?: { up?: () => void; down?: () => void };
}) {
  const t = useTranslations("map");
  const locale = useLocale();
  return (
    <div className="bg-card group/row sticky left-0 z-10 flex flex-col gap-0.5 px-4 py-4 text-xs">
      {row.kind === "release" ? (
        <>
          <span className="flex items-start gap-1">
            <span className="min-w-0 flex-1 text-2sm font-semibold">{row.release.name}</span>
            <span className="flex shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">
              {/* Every drag has a button beside it; the bands are no exception. */}
              {onNudge && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("moveReleaseUp")}
                    disabled={!onNudge.up}
                    onClick={onNudge.up}
                    className="text-meta size-5"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("moveReleaseDown")}
                    disabled={!onNudge.down}
                    onClick={onNudge.down}
                    className="text-meta size-5"
                  >
                    <ArrowDown />
                  </Button>
                </>
              )}
              {onEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("editRelease")}
                  onClick={() => onEdit(row.release)}
                  className="text-meta size-5"
                >
                  <Pencil />
                </Button>
              )}
            </span>
          </span>
          <span className="text-chart-2 font-medium">
            {row.release.targetDate ? formatPlanDate(row.release.targetDate, locale) : t("noDate")}
          </span>
        </>
      ) : (
        <span className="text-2sm font-semibold">{t("unreleased")}</span>
      )}
      <span className="text-meta mt-1 tabular-nums">{t("rowCounts", { unit, cards, points })}</span>
      {hidden.length > 0 && onReveal && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="xs" className="text-meta -ml-2 w-fit" />
            }
          >
            <Plus data-slot="icon" />
            {t("hiddenCards", { count: hidden.length })}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-w-72 min-w-56">
            {/* A GroupLabel must stand inside a Group, or Base UI refuses the popup. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("hiddenHint")}</DropdownMenuLabel>
              {hidden.map(({ card, featureId, featureTitle, reason }) => (
                <DropdownMenuItem key={card.id} onClick={() => onReveal(featureId, reason)}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{card.title}</span>
                    <span className="text-meta text-2xs">
                      {featureTitle}
                      {reason === "closed" ? ` · ${t("closedFeature")}` : ""}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
