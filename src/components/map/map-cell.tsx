"use client";

import { useTranslations } from "next-intl";
import type { Place } from "@/components/board/quick-add";
import { QuickAdd } from "@/components/board/quick-add";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { MapCard } from "./map-card";

/**
 * One cell of the map: the cards of one feature in one sprint or
 * column, a place to drop a card from elsewhere, and a way to add one
 * that lands here. A folded epic's cells say only how many.
 */
export function MapCell({
  cards,
  boardId,
  structure,
  doneIds,
  active,
  folded,
  fixed,
  dragId,
  setDragId,
  onDrop,
  onAdd,
}: {
  cards: CardView[];
  boardId: string;
  structure: StructureLookup;
  /** The cards that count as done, drawn faded. */
  doneIds: Set<string>;
  /** The running sprint's row, tinted. */
  active: boolean;
  folded: boolean;
  /** Where a new card in this cell goes in the structure; undefined lets the person choose. */
  fixed?: Place;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: () => void;
  onAdd: (title: string, place: Place) => Promise<boolean>;
}) {
  const t = useTranslations("map");
  const points = cards.reduce((sum, card) => sum + (card.estimate ?? 0), 0);
  return (
    <div
      onDragOver={(event) => {
        if (dragId) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        "border-hairline flex min-h-14 flex-col gap-1.5 border-r border-b p-1.5",
        active && "bg-accent/25",
        dragId && "outline-primary/30 -outline-offset-2 outline-dashed",
      )}
    >
      {folded ? (
        cards.length > 0 && (
          <p className="text-meta px-1 py-1 text-[0.72rem] tabular-nums">
            {t("rowCounts", { cards: cards.length, points })}
          </p>
        )
      ) : (
        <>
          {cards.map((card) => (
            <MapCard
              key={card.id}
              card={card}
              boardId={boardId}
              structure={structure}
              done={doneIds.has(card.id)}
              dragging={dragId === card.id}
              onDragStart={() => setDragId(card.id)}
              onDragEnd={() => setDragId(null)}
            />
          ))}
          <div className="mt-auto">
            <QuickAdd onAdd={onAdd} structure={structure} fixed={fixed} compact />
          </div>
        </>
      )}
    </div>
  );
}
