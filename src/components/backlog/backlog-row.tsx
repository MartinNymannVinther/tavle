"use client";

import { useTranslations } from "next-intl";
import { FlagChip, Initials, Points, PriorityMark, ThemeDots } from "@/components/board/bits";
import {
  deviatingPlace,
  type ChipContext,
  type StructureLookup,
} from "@/components/board/card-chips";
import { TypeGlyph, TypeIcon } from "@/components/board/type-icon";
import type { Priority, Theme } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { useLanded } from "@/components/board/use-landed";
import { cn } from "@/lib/utils";
import { Key, RankArrows } from "./backlog-bits";
import type { Crumb } from "./backlog-selection";

/**
 * One story as a line in the backlog or in a sprint: a box to tick it
 * for a sprint, the card's symbol (a bug shows as one), the key, the
 * title with its themes as dots beside it, and where it sits written
 * small under it — epic and feature, or the area when it has no
 * feature. What the heading already says is left out, so a line says
 * only what is its own, and nothing on it is a chip but the enabler
 * kind.
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
  onDragEnd,
  indicator,
  dragging,
  columnName,
  sprintName,
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
  onDragEnd?: () => void;
  /** Where the dragged thing will land: a line above or below this row. */
  indicator?: "above" | "below" | null;
  dragging?: boolean;
  columnName?: string;
  /** The open sprint the card is already committed to: the row stands in the backlog, marked, not ranked. */
  sprintName?: string;
  /** In a sprint's narrow panel: the chips wait for room, the column always shows. */
  quiet?: boolean;
}) {
  const t = useTranslations("backlog.row");
  const s = useTranslations("boards.structure");
  const priorities = useTranslations("boards.priority");
  const { isLanded } = useLanded();
  const { view } = structure;
  const own = deviatingPlace(card, context);
  const themes = view.themes
    ? own.themeIds
        .map((id) => structure.themes.find((theme) => theme.id === id))
        .filter((theme): theme is Theme => Boolean(theme))
    : [];
  const area = view.areas && own.areaId ? structure.areas.find((a) => a.id === own.areaId) : null;
  const parts: React.ReactNode[] = [];
  if (crumb?.epic)
    parts.push(
      <span key="epic" className="inline-flex min-w-0 items-center gap-1">
        <TypeGlyph type="epic" className="text-label size-2.5 shrink-0" />
        <span className="truncate">{crumb.epic.title}</span>
      </span>,
    );
  if (crumb?.feature)
    parts.push(
      <span key="feature" className="inline-flex min-w-0 items-center gap-1">
        <TypeGlyph type="feature" className="text-label size-2.5 shrink-0" />
        <span className="truncate">{crumb.feature.title}</span>
      </span>,
    );
  // The area stands apart from the "›" chain: epic › feature is the
  // decomposition, the area is where the card belongs — a field, not a
  // level, so it never reads as a child of the feature.

  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group/row hover:bg-secondary/40 relative flex items-center gap-2 py-2 pr-3 pl-3 transition-colors duration-[120ms]",
        dragging && "opacity-40",
        isLanded(card.id) && "landed",
      )}
    >
      {indicator && (
        <span
          aria-hidden
          className={cn(
            "bg-primary absolute inset-x-1 z-10 h-0.5 rounded-full",
            indicator === "above" ? "-top-px" : "-bottom-px",
          )}
        />
      )}
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
      <span className={cn("shrink-0", quiet && "hidden @md:inline")}>
        <Key boardKey={boardKey} number={card.number} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <Link
            href={`/boards/${boardId}/cards/${card.number}`}
            className={cn(
              // The title carries the row: reading size and weight, so the
              // epic/feature crumb underneath can never be mistaken for it.
              "line-clamp-2 min-w-0 leading-snug font-medium hover:underline",
              quiet ? "text-sm" : "text-reading",
              sprintName && "text-meta italic",
              card.doneAt && "text-meta line-through",
            )}
          >
            {card.title}
          </Link>
          <ThemeDots themes={themes} />
          {view.kind && card.kind === "enabler" && (
            <FlagChip
              tone="enabler"
              className={cn("hidden", quiet ? "@lg:inline-flex" : "@sm:inline-flex")}
            >
              {card.enablerType ? s(`enablerType.${card.enablerType}`) : s("kind.enabler")}
            </FlagChip>
          )}
        </span>
        {!quiet && card.descriptionPreview && (
          <p className="text-meta mt-0.5 hidden text-xs @3xl:line-clamp-1">
            {card.descriptionPreview}
          </p>
        )}
        {(parts.length > 0 || area) && (
          <p className="text-meta mt-0.5 flex items-center gap-1 text-2xs">
            {parts.map((part, index) => (
              <span key={index} className="inline-flex min-w-0 items-center gap-1">
                {index > 0 && (
                  <span aria-hidden className="text-label">
                    ›
                  </span>
                )}
                {part}
              </span>
            ))}
            {area && (
              <span className="inline-flex min-w-0 items-center gap-1">
                {parts.length > 0 && (
                  <span aria-hidden className="text-label">
                    ·
                  </span>
                )}
                <span className="truncate">{area.name}</span>
              </span>
            )}
          </p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-2">
        {sprintName && (
          <span className="text-meta text-2xs whitespace-nowrap italic">{sprintName}</span>
        )}
        {columnName && (
          <span
            className={cn("text-meta text-xs whitespace-nowrap", !quiet && "hidden @md:inline")}
          >
            {columnName}
          </span>
        )}
        <PriorityMark priority={card.priority as Priority} label={priorities(card.priority)} />
        <Points estimate={card.estimate} unit={structure.estimateUnit} />
        {card.assigneeName ? (
          <Initials name={card.assigneeName} />
        ) : (
          !quiet && <span className="size-6" />
        )}
        <RankArrows onUp={onMoveUp} onDown={onMoveDown} />
      </span>
    </li>
  );
}
