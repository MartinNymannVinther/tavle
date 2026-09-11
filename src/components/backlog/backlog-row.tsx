"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Initials, Points, PriorityMark } from "@/components/board/bits";
import { CardChips, type StructureLookup } from "@/components/board/card-chips";
import type { Priority } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * One line in the backlog or in a sprint's list: a checkbox for bulk
 * moves, the key and the title as a link, and the facts that matter for
 * planning — points, priority, who. The arrows reorder without a drag.
 */
export function BacklogRow({
  card,
  boardKey,
  boardId,
  structure,
  selected,
  onSelect,
  onMoveUp,
  onMoveDown,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
  columnName,
}: {
  card: CardView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: () => void;
  dragging?: boolean;
  columnName?: string;
}) {
  const t = useTranslations("backlog.row");
  const priorities = useTranslations("boards.priority");
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("group/row flex items-center gap-3 px-2 py-2", dragging && "opacity-40")}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onSelect(event.target.checked)}
        aria-label={t("select", { key: `${boardKey}-${card.number}` })}
        className="accent-[var(--primary)]"
      />
      <span className="text-meta w-16 shrink-0 text-[0.72rem] tabular-nums">
        {boardKey}-{card.number}
      </span>
      <Link
        href={`/boards/${boardId}/cards/${card.number}`}
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium hover:underline",
          card.doneAt && "text-meta line-through",
        )}
      >
        {card.title}
      </Link>
      <CardChips card={card} structure={structure} className="hidden items-center gap-1 sm:flex" />
      {columnName && (
        <span className="text-meta hidden text-[0.72rem] md:inline">{columnName}</span>
      )}
      <PriorityMark priority={card.priority as Priority} label={priorities(card.priority)} />
      <Points estimate={card.estimate} />
      {card.assigneeName ? <Initials name={card.assigneeName} /> : <span className="size-6" />}
      {(onMoveUp || onMoveDown) && (
        <span className="flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">
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
    </li>
  );
}
