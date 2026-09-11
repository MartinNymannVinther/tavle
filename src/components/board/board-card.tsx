"use client";

import { useTranslations } from "next-intl";
import { CircleAlert, ListChecks, MessageSquare } from "lucide-react";
import { formatDateDa } from "@/core/dates";
import type { Column, Label, Priority } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Initials, LabelChip, Points, PriorityMark } from "./bits";
import { MoveMenu } from "./move-menu";

/**
 * One card on the board. The title is a real link to the card's page;
 * the rest is what a glance needs: who, how big, when, and whether it is
 * stuck. Dragging is the quick path, the menu in the corner is the path
 * that works everywhere else.
 */
export function BoardCard({
  card,
  boardKey,
  boardId,
  labels,
  columns,
  today,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onMove,
}: {
  card: CardView;
  boardKey: string;
  boardId: string;
  labels: Label[];
  columns: Column[];
  today: string;
  dragging: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent) => void;
  onMove: (columnId: string, index?: number) => void;
}) {
  const t = useTranslations("boards.card");
  const priorities = useTranslations("boards.priority");
  const overdue = Boolean(card.dueDate && card.dueDate < today && !card.doneAt);
  const cardLabels = card.labelIds
    .map((id) => labels.find((label) => label.id === id))
    .filter((label): label is Label => Boolean(label));
  const href = `/boards/${boardId}/cards/${card.number}`;

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
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-meta flex items-center gap-1.5 text-[0.69rem] tabular-nums">
            <span>
              {boardKey}-{card.number}
            </span>
            <PriorityMark priority={card.priority as Priority} label={priorities(card.priority)} />
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
              "focus-visible:ring-ring mt-0.5 block rounded-sm text-sm leading-snug font-medium text-pretty focus-visible:ring-2 focus-visible:outline-none",
              card.doneAt && "text-secondary-foreground",
            )}
          >
            {card.title}
          </Link>
        </div>
        <MoveMenu columns={columns} currentColumnId={card.columnId} onMove={onMove} href={href} />
      </div>
      {cardLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cardLabels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      )}
      <div className="text-meta mt-2 flex items-center gap-2 text-[0.72rem]">
        {card.assigneeName ? (
          <Initials name={card.assigneeName} />
        ) : (
          <span
            className="border-border inline-flex size-6 items-center justify-center rounded-full border border-dashed"
            title={t("unassigned")}
          />
        )}
        <Points estimate={card.estimate} />
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
            {formatDateDa(card.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}
