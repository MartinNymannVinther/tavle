"use client";

import { useTranslations } from "next-intl";
import { FlagChip, Initials, Points, PriorityMark, ThemeDots } from "@/components/board/bits";
import type { StructureLookup } from "@/components/board/card-chips";
import { TypeIcon } from "@/components/board/type-icon";
import type { Priority, Theme } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * A card as it sits in a cell of the map: a paper note with the symbol,
 * the title as a link, and the planning facts. Small on purpose — a map
 * shows many — and quiet: the column already says what it is part of,
 * so only the themes as dots and the enabler kind are its own.
 */
export function MapCard({
  card,
  boardId,
  structure,
  done,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  card: CardView;
  boardId: string;
  structure: StructureLookup;
  done: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const s = useTranslations("boards.structure");
  const priorities = useTranslations("boards.priority");
  const { view } = structure;
  const themes = view.themes
    ? card.themeIds
        .map((id) => structure.themes.find((theme) => theme.id === id))
        .filter((theme): theme is Theme => Boolean(theme))
    : [];
  const facts =
    card.priority !== "normal" ||
    card.estimate !== null ||
    card.assigneeName ||
    themes.length > 0 ||
    (view.kind && card.kind === "enabler");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-card flex cursor-grab gap-1.5 rounded-[0.3rem] px-2.5 py-2 shadow-[0_1px_2px_rgba(36,34,30,0.1),0_5px_12px_-8px_rgba(36,34,30,0.3)] transition",
        "hover:shadow-[0_1px_2px_rgba(36,34,30,0.12),0_8px_18px_-8px_rgba(36,34,30,0.4)] focus-within:shadow-[0_1px_2px_rgba(36,34,30,0.12),0_8px_18px_-8px_rgba(36,34,30,0.4)]",
        done && "opacity-55",
        dragging && "opacity-40",
      )}
    >
      <TypeIcon type={card.bug ? "bug" : "card"} className="mt-px size-4 rounded-[0.25rem]" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/boards/${boardId}/cards/${card.number}`}
          className={cn(
            "line-clamp-2 text-[0.8125rem] leading-snug hover:underline",
            done && "line-through",
          )}
        >
          {card.title}
        </Link>
        {facts && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PriorityMark priority={card.priority as Priority} label={priorities(card.priority)} />
            {view.kind && card.kind === "enabler" && (
              <FlagChip tone="enabler">
                {card.enablerType ? s(`enablerType.${card.enablerType}`) : s("kind.enabler")}
              </FlagChip>
            )}
            <ThemeDots themes={themes} />
            <Points estimate={card.estimate} />
            {card.assigneeName && <Initials name={card.assigneeName} className="size-5" />}
          </div>
        )}
      </div>
    </div>
  );
}
