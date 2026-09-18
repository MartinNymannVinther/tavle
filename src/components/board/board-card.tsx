"use client";

import { useLocale, useTranslations } from "next-intl";
import { CircleAlert, ListChecks, MessageSquare } from "lucide-react";
import { formatPlanDate } from "@/core/dates";
import type { Column, Priority } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Initials, Points, PriorityMark, ThemeDots } from "./bits";
import type { LaneOption } from "./board-column";
import { CardChips, PartOf, type StructureLookup } from "./card-chips";
import { MoveMenu } from "./move-menu";
import { useLanded } from "./use-landed";

/**
 * One card on the board. The title is a real link to the card's page;
 * the rest is what a glance needs: who, how big, when, whether it is
 * stuck, and what it is part of. Its themes are dots by the key and its
 * area is not on the card at all — a board of cards that all repeat the
 * same three chips says nothing with them; the card page and the
 * filters say where a card belongs. Dragging is the quick path, the menu in the corner is the path
 * that works everywhere else.
 */
export function BoardCard({
  card,
  boardKey,
  boardId,
  structure,
  columns,
  today,
  laneKey = null,
  laneOptions,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onMove,
  onMoveToLane,
  onNudge,
  canUp,
  canDown,
}: {
  card: CardView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  columns: Column[];
  today: string;
  laneKey?: string | null;
  laneOptions?: LaneOption[];
  dragging: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onMove: (columnId: string, index?: number) => void;
  onMoveToLane?: (laneKey: string | null) => void;
  onNudge?: (delta: -1 | 1) => void;
  canUp?: boolean;
  canDown?: boolean;
}) {
  const t = useTranslations("boards.card");
  const locale = useLocale();
  const priorities = useTranslations("boards.priority");
  const { isLanded } = useLanded();
  const overdue = Boolean(card.dueDate && card.dueDate < today && !card.doneAt);
  const href = `/boards/${boardId}/cards/${card.number}`;
  const themes = structure.view.themes
    ? card.themeIds
        .map((id) => structure.themes.find((theme) => theme.id === id))
        .filter((theme): theme is (typeof structure.themes)[number] => Boolean(theme))
    : [];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      data-card-id={card.id}
      className={cn(
        "group/card bg-card border-border relative rounded-xl border p-3 shadow-[var(--surface-shadow)] transition",
        "hover:border-primary/40 focus-within:border-primary/40",
        card.blocked && "border-destructive/50",
        dragging && "opacity-40",
        isLanded(card.id) && "landed",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-meta flex items-center gap-1.5 text-2xs tabular-nums">
            <span className="font-mono">
              {boardKey}-{card.number}
            </span>
            <PriorityMark priority={card.priority as Priority} label={priorities(card.priority)} />
            <ThemeDots themes={themes} className="ml-0.5" />
            {card.blocked && (
              <span className="text-destructive inline-flex items-center gap-1 font-medium">
                <CircleAlert className="size-3" aria-hidden />
                {t("blocked")}
              </span>
            )}
          </p>
          <Link
            href={href}
            className={cn(
              "focus-ring mt-0.5 block text-sm leading-snug font-medium text-pretty",
              card.doneAt && "text-secondary-foreground",
            )}
          >
            {card.title}
          </Link>
          <PartOf featureId={card.featureId} structure={structure} boardKey={boardKey} />
        </div>
        <MoveMenu
          columns={columns}
          currentColumnId={card.columnId}
          onMove={onMove}
          href={href}
          currentLaneKey={laneKey}
          laneOptions={laneOptions}
          onMoveToLane={onMoveToLane}
          onNudge={onNudge}
          canUp={canUp}
          canDown={canDown}
        />
      </div>
      {(card.bug || (structure.view.kind && card.kind === "enabler")) && (
        <CardChips
          card={{ ...card, areaId: null, themeIds: [] }}
          structure={structure}
          className="mt-2 flex flex-wrap gap-1"
        />
      )}
      <div className="text-meta mt-2 flex items-center gap-2 text-xs">
        {card.assigneeName ? (
          <Initials name={card.assigneeName} />
        ) : (
          <span
            className="border-input inline-flex size-6 items-center justify-center rounded-full border border-dashed"
            title={t("unassigned")}
          />
        )}
        <Points estimate={card.estimate} unit={structure.estimateUnit} />
        {card.checklistTotal > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <ListChecks className="size-3.5" aria-hidden />
            {card.checklistDone}/{card.checklistTotal}
          </span>
        )}
        {card.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <MessageSquare className="size-3.5" aria-hidden />
            {card.commentCount}
          </span>
        )}
        {card.dueDate && (
          <span className={cn("ml-auto tabular-nums", overdue && "text-destructive font-medium")}>
            {formatPlanDate(card.dueDate, locale)}
          </span>
        )}
      </div>
    </div>
  );
}
