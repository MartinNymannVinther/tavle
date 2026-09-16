"use client";

import type { Place } from "@/components/board/quick-add";
import { QuickAdd } from "@/components/board/quick-add";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { MapCard } from "./map-card";

/**
 * One cell of the map: the cards of one feature in one sprint or
 * column, a place to drop a card from elsewhere, and a way to add one
 * that lands here. Air around the notes on purpose; the wall is the
 * point, not the grid.
 */
export function MapCell({
  cards,
  boardId,
  structure,
  doneIds,
  active,
  band,
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
  /** The nearest release's band, tinted. */
  active: boolean;
  /** Every other column is a shade darker, so the eye can follow one down. */
  band: boolean;
  /** Where a new card in this cell goes in the structure; undefined lets the person choose. */
  fixed?: Place;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: () => void;
  onAdd: (title: string, place: Place) => Promise<boolean>;
}) {
  return (
    <div
      onDragOver={(event) => {
        if (dragId) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!dragId) return;
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        "flex min-h-28 flex-col gap-2.5 px-2.5 py-3",
        band && "bg-secondary/40",
        active && "bg-accent/30",
        active && band && "bg-accent/45",
        dragId && "outline-primary/30 -outline-offset-4 outline-dashed",
      )}
    >
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
      <div className="mt-auto pt-1">
        <QuickAdd onAdd={onAdd} structure={structure} fixed={fixed} compact />
      </div>
    </div>
  );
}
