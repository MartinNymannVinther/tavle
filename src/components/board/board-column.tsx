"use client";

import { useTranslations } from "next-intl";
import type { Column } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { BoardCard } from "./board-card";
import type { StructureLookup } from "./card-chips";
import { QuickAdd, type Place } from "./quick-add";
import { CATEGORY_DOT } from "./tokens";

export type DropTarget = { columnId: string; index: number } | null;

/**
 * One column: its name, how many cards it holds against its limit, the
 * cards in order, and a way to add one. A column over its WIP limit is
 * tinted and says so; it never refuses a card, because a limit is a
 * conversation the team has, not a wall the tool builds.
 */
export function BoardColumn({
  column,
  cards,
  boardKey,
  boardId,
  structure,
  columns,
  today,
  dragId,
  dropTarget,
  setDropTarget,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onAdd,
}: {
  column: Column;
  cards: CardView[];
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  columns: Column[];
  today: string;
  dragId: string | null;
  dropTarget: DropTarget;
  setDropTarget: (target: DropTarget) => void;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onDrop: (columnId: string, index: number) => void;
  onMove: (cardId: string, columnId: string, index?: number) => void;
  onAdd: (columnId: string, title: string, place: Place) => Promise<boolean>;
}) {
  const t = useTranslations("boards.column");
  const over = column.wipLimit !== null && cards.length > column.wipLimit;
  const isTarget = dropTarget?.columnId === column.id;

  return (
    <section
      aria-label={column.name}
      onDragOver={(event) => {
        event.preventDefault();
        if (dropTarget?.columnId !== column.id || event.target === event.currentTarget) {
          setDropTarget({ columnId: column.id, index: cards.length });
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(column.id, dropTarget?.index ?? cards.length);
      }}
      className={cn(
        "flex min-h-[12rem] w-[17rem] shrink-0 flex-col rounded-xl border p-2.5 transition-colors",
        over ? "border-warning bg-warning-tint/40" : "border-border bg-secondary/60",
        isTarget && "border-primary bg-accent/60",
      )}
    >
      <header className="flex items-baseline gap-2 px-1 pb-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT[column.category])}
          aria-hidden
        />
        <h2 className="text-sm font-semibold">{column.name}</h2>
        <span
          className={cn(
            "text-xs tabular-nums",
            over ? "text-destructive font-semibold" : "text-label",
          )}
        >
          {column.wipLimit === null ? cards.length : `${cards.length}/${column.wipLimit}`}
        </span>
        {over && (
          <span className="text-destructive ml-auto text-[0.69rem] font-medium">
            {t("overLimit")}
          </span>
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {cards.length === 0 && !isTarget && (
          <p className="border-border text-meta rounded-xl border border-dashed p-3 text-center text-xs">
            {t("empty")}
          </p>
        )}
        {cards.map((card, index) => (
          <div key={card.id} className="relative">
            {isTarget && dropTarget?.index === index && dragId !== card.id && (
              <div
                className="bg-primary absolute -top-1.5 right-1 left-1 h-0.5 rounded-full"
                aria-hidden
              />
            )}
            <BoardCard
              card={card}
              boardKey={boardKey}
              boardId={boardId}
              structure={structure}
              columns={columns}
              today={today}
              dragging={dragId === card.id}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", card.id);
                event.dataTransfer.effectAllowed = "move";
                onDragStart(card.id);
              }}
              onDragEnd={onDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                const below = event.clientY > rect.top + rect.height / 2;
                setDropTarget({ columnId: column.id, index: index + (below ? 1 : 0) });
              }}
              onMove={(columnId, at) => onMove(card.id, columnId, at)}
            />
          </div>
        ))}
        {isTarget && dropTarget?.index === cards.length && (
          <div className="bg-primary h-0.5 rounded-full" aria-hidden />
        )}
      </div>
      <div className="pt-2">
        <QuickAdd onAdd={(title, place) => onAdd(column.id, title, place)} structure={structure} />
      </div>
    </section>
  );
}
