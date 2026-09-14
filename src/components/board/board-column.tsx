"use client";

import { useTranslations } from "next-intl";
import type { Column } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { BoardCard } from "./board-card";
import type { StructureLookup } from "./card-chips";
import { QuickAdd, type Place } from "./quick-add";
import { CATEGORY_DOT } from "./tokens";

export type DropTarget = { columnId: string; index: number; laneKey: string | null } | null;

/** A swimlane a card can be moved to from the menu, worded by the board view. */
export type LaneOption = { key: string | null; label: string };

/**
 * One column: its name, how many cards it holds against its limit, the
 * cards in order, and a way to add one. A column over its WIP limit is
 * tinted and says so; it never refuses a card, because a limit is a
 * conversation the team has, not a wall the tool builds. On a board with
 * swimlanes the column appears once per lane; `wipCount` then carries
 * the whole column's count, because the limit belongs to the column.
 */
export function BoardColumn({
  column,
  cards,
  boardKey,
  boardId,
  structure,
  columns,
  today,
  laneKey = null,
  laneOptions,
  wipCount,
  dense,
  dragId,
  dropTarget,
  setDropTarget,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onMoveToLane,
  onNudge,
  onAdd,
}: {
  column: Column;
  cards: CardView[];
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  columns: Column[];
  today: string;
  laneKey?: string | null;
  laneOptions?: LaneOption[];
  wipCount?: number;
  /** Inside a swimlane row: lower, and quiet about being empty. */
  dense?: boolean;
  dragId: string | null;
  dropTarget: DropTarget;
  setDropTarget: (target: DropTarget) => void;
  onDragStart: (cardId: string) => void;
  onDragEnd: () => void;
  onDrop: (columnId: string, index: number) => void;
  onMove: (cardId: string, columnId: string, index?: number) => void;
  onMoveToLane?: (cardId: string, laneKey: string | null) => void;
  /** Reordering past a visible neighbour, for the menu path drag cannot cover. */
  onNudge?: (cardId: string, neighbourId: string, delta: -1 | 1) => void;
  onAdd: (
    columnId: string,
    title: string,
    place: Place,
    laneKey: string | null,
  ) => Promise<boolean>;
}) {
  const t = useTranslations("boards.column");
  const count = wipCount ?? cards.length;
  const over = column.wipLimit !== null && count > column.wipLimit;
  const isTarget = dropTarget?.columnId === column.id && dropTarget.laneKey === laneKey;

  return (
    <section
      aria-label={column.name}
      onDragOver={(event) => {
        event.preventDefault();
        if (!isTarget || event.target === event.currentTarget) {
          setDropTarget({ columnId: column.id, index: cards.length, laneKey });
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(column.id, isTarget ? (dropTarget?.index ?? cards.length) : cards.length);
      }}
      className={cn(
        "flex min-w-[15rem] flex-1 basis-0 flex-col rounded-xl border p-2.5 transition-colors",
        dense ? "min-h-[6rem]" : "min-h-[12rem]",
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
          {column.wipLimit === null ? count : `${count}/${column.wipLimit}`}
        </span>
        {over && (
          <span className="text-destructive ml-auto text-[0.69rem] font-medium">
            {t("overLimit")}
          </span>
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {cards.length === 0 &&
          !isTarget &&
          (dense ? (
            // A board of many lanes says "no cards here" often enough with
            // the dashed slot alone.
            <div className="border-border min-h-9 rounded-xl border border-dashed" aria-hidden />
          ) : (
            <p className="border-border text-meta rounded-xl border border-dashed p-3 text-center text-xs">
              {t("empty")}
            </p>
          ))}
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
              laneKey={laneKey}
              laneOptions={laneOptions}
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
                const at = index + (below ? 1 : 0);
                // dragover fires continuously; only a changed target is
                // worth a render of the whole board.
                if (
                  dropTarget?.columnId !== column.id ||
                  dropTarget.index !== at ||
                  dropTarget.laneKey !== laneKey
                ) {
                  setDropTarget({ columnId: column.id, index: at, laneKey });
                }
              }}
              onMove={(columnId, at) => onMove(card.id, columnId, at)}
              onMoveToLane={onMoveToLane ? (key) => onMoveToLane(card.id, key) : undefined}
              onNudge={
                onNudge
                  ? (delta) => {
                      const neighbour = cards[index + delta];
                      if (neighbour) onNudge(card.id, neighbour.id, delta);
                    }
                  : undefined
              }
              canUp={index > 0}
              canDown={index < cards.length - 1}
            />
          </div>
        ))}
        {isTarget && dropTarget?.index === cards.length && (
          <div className="bg-primary h-0.5 rounded-full" aria-hidden />
        )}
      </div>
      <div className="pt-2">
        <QuickAdd
          onAdd={(title, place) => onAdd(column.id, title, place, laneKey)}
          structure={structure}
        />
      </div>
    </section>
  );
}
