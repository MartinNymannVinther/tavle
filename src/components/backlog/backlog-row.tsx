"use client";

import { useTranslations } from "next-intl";
import { Initials, Points, PriorityMark } from "@/components/board/bits";
import { CardChips, type ChipContext, type StructureLookup } from "@/components/board/card-chips";
import { TypeGlyph, TypeIcon } from "@/components/board/type-icon";
import type { Priority } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Key, RankArrows } from "./backlog-bits";
import type { Crumb } from "./backlog-selection";

/**
 * One story as a line in the backlog or in a sprint: a box to tick it
 * for a sprint, the card's symbol (a bug shows as one), the key and the
 * title with where it sits written small under it, then the facts that
 * matter for planning — points, priority, who. What the heading already
 * says is left out, so a line says only what is its own.
 */
export function BacklogRow({
  card,
  boardKey,
  boardId,
  structure,
  context,
  crumb,
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
  quiet,
}: {
  card: CardView;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  /** The parent's or the group's place, left out of the chips. */
  context?: ChipContext;
  /** The epic and feature to write under the title; empty parts are left out. */
  crumb?: Crumb;
  selected?: boolean;
  /** Ticks the story for a sprint; without it the line has no box. */
  onSelect?: (checked: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: () => void;
  dragging?: boolean;
  columnName?: string;
  /** In a sprint's narrow panel: the chips wait for room, the column always shows. */
  quiet?: boolean;
}) {
  const t = useTranslations("backlog.row");
  const priorities = useTranslations("boards.priority");
  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group/row hover:bg-secondary/40 flex items-center gap-2 py-2 pr-3 pl-3 transition-colors duration-[120ms]",
        dragging && "opacity-40",
      )}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={(event) => onSelect(event.target.checked)}
          aria-label={t("select", { key: `${boardKey}-${card.number}` })}
          className="accent-[var(--primary)]"
        />
      )}
      <TypeIcon type={card.bug ? "bug" : "card"} />
      <Key boardKey={boardKey} number={card.number} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/boards/${boardId}/cards/${card.number}`}
          className={cn(
            "block truncate text-sm hover:underline",
            card.doneAt && "text-meta line-through",
          )}
        >
          {card.title}
        </Link>
        {(crumb?.epic || crumb?.feature) && (
          <p className="text-meta mt-0.5 flex items-center gap-1 truncate text-[0.69rem]">
            {crumb.epic && (
              <>
                <TypeGlyph type="epic" className="text-label" />
                <span className="truncate">{crumb.epic.title}</span>
                {crumb.feature && (
                  <span aria-hidden className="text-label">
                    ›
                  </span>
                )}
              </>
            )}
            {crumb.feature && (
              <>
                <TypeGlyph type="feature" className="text-label" />
                <span className="truncate">{crumb.feature.title}</span>
              </>
            )}
          </p>
        )}
      </div>
      <CardChips
        card={{ ...card, bug: false }}
        structure={structure}
        context={context}
        className={cn("hidden items-center gap-1", quiet ? "@lg:flex" : "@sm:flex")}
      />
      <span className="flex shrink-0 items-center gap-2">
        {columnName && (
          <span
            className={cn(
              "text-meta text-[0.72rem] whitespace-nowrap",
              !quiet && "hidden @md:inline",
            )}
          >
            {columnName}
          </span>
        )}
        <PriorityMark priority={card.priority as Priority} label={priorities(card.priority)} />
        <Points estimate={card.estimate} />
        {card.assigneeName ? <Initials name={card.assigneeName} /> : <span className="size-6" />}
        <RankArrows onUp={onMoveUp} onDown={onMoveDown} />
      </span>
    </li>
  );
}
