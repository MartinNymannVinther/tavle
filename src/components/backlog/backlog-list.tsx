"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChipContext, StructureLookup } from "@/components/board/card-chips";
import type { CardView } from "@/modules/boards/types";
import { BacklogRow } from "./backlog-row";
import type { Crumb } from "./backlog-selection";

/**
 * The backlog's stories as one flat list in the backlog's own order —
 * narrowed by the navigator, never reordered by it. The story row is
 * shared with the grouped views and the sprints, and it is the thing
 * that can be selected for a sprint.
 */
export type StoryRowProps = {
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  selected: Set<string>;
  /** Ticks a story for a sprint; absent on a board without sprints, and then no box is drawn. */
  onSelect?: (cardId: string, checked: boolean) => void;
  /** Moves a story before or after a sibling in the backlog's one order. */
  onNudge: (cardId: string, siblingId: string, after: boolean) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDropOn: (targetId: string, after: boolean) => void;
  /** The line under a title: where the story sits, as far as the heading has not said it. */
  crumbOf: (card: CardView) => Crumb;
  /** The place the heading already states, left out of the chips. */
  context?: ChipContext;
};

export function StoryRows({
  stories,
  rows,
  context,
  groupDrop,
  extras,
}: {
  stories: CardView[];
  rows: StoryRowProps;
  context?: ChipContext;
  /** In a grouped view: what a card from another group lands as when dropped here. */
  groupDrop?: { onDrop: (cardId: string, siblingId: string | null, after: boolean) => void };
  /** Sprint-committed cards, standing at their rank among the rows, marked, not ranked. */
  extras?: { cards: CardView[]; sprintNameOf?: Map<string, string> };
}) {
  // Where the dragged card will land, drawn as a line above or below the
  // row under the pointer — the drop should never be a guess.
  const [hover, setHover] = useState<{ id: string; after: boolean } | null>(null);
  // Committed cards keep their place in the one priority (docs/adr/0013):
  // the sequence merges on the rank itself, and only the free rows drag.
  const merged = [
    ...stories.map((card) => ({ card, committed: false })),
    ...(extras?.cards ?? []).map((card) => ({ card, committed: true })),
  ].sort((a, b) => a.card.sort - b.card.sort || a.card.number - b.card.number);
  const rankIndex = new Map(stories.map((card, index) => [card.id, index]));
  return (
    <ol className="divide-hairline divide-y">
      {merged.map(({ card, committed }) => {
        if (committed) {
          return (
            <BacklogRow
              key={card.id}
              card={card}
              boardKey={rows.boardKey}
              boardId={rows.boardId}
              structure={rows.structure}
              context={context ?? rows.context}
              crumb={rows.crumbOf(card)}
              sprintName={(card.sprintId && extras?.sprintNameOf?.get(card.sprintId)) || undefined}
            />
          );
        }
        const index = rankIndex.get(card.id)!;
        const before = stories[index - 1];
        const after = stories[index + 1];
        return (
          <BacklogRow
            key={card.id}
            card={card}
            boardKey={rows.boardKey}
            boardId={rows.boardId}
            structure={rows.structure}
            context={context ?? rows.context}
            crumb={rows.crumbOf(card)}
            selected={rows.selected.has(card.id)}
            onSelect={rows.onSelect ? (checked) => rows.onSelect!(card.id, checked) : undefined}
            onMoveUp={before ? () => rows.onNudge(card.id, before.id, false) : undefined}
            onMoveDown={after ? () => rows.onNudge(card.id, after.id, true) : undefined}
            draggable
            dragging={rows.dragId === card.id}
            onDragStart={() => rows.setDragId(card.id)}
            onDragOver={(event) => {
              // A card from another group may land here only when the drop
              // can honestly put it here (the group assigns its field).
              const foreign = rows.dragId ? !stories.some((c) => c.id === rows.dragId) : false;
              if (foreign && !groupDrop) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const below = event.clientY > rect.top + rect.height / 2;
              if (hover?.id !== card.id || hover.after !== below) {
                setHover({ id: card.id, after: below });
              }
            }}
            onDrop={() => {
              const after = hover?.id === card.id ? hover.after : false;
              const foreign = rows.dragId ? !stories.some((c) => c.id === rows.dragId) : false;
              if (foreign && groupDrop && rows.dragId) {
                groupDrop.onDrop(rows.dragId, card.id, after);
                rows.setDragId(null);
              } else {
                rows.onDropOn(card.id, after);
              }
              setHover(null);
            }}
            onDragEnd={() => {
              setHover(null);
              rows.setDragId(null);
            }}
            indicator={
              hover?.id === card.id && rows.dragId && rows.dragId !== card.id
                ? hover.after
                  ? "below"
                  : "above"
                : null
            }
          />
        );
      })}
    </ol>
  );
}

export function BacklogList({
  stories,
  rows,
  allocated = [],
  sprintNameOf,
  emptyText,
}: {
  stories: CardView[];
  rows: StoryRowProps;
  /** Cards already committed to an open sprint: standing at their rank, marked, not draggable. */
  allocated?: CardView[];
  sprintNameOf?: Map<string, string>;
  /** What an empty list says; the whole-backlog wording differs from a narrowed one's. */
  emptyText?: string;
}) {
  const t = useTranslations("backlog");
  if (stories.length === 0 && allocated.length === 0) {
    return (
      <p className="text-meta border-hairline border-t px-4 py-3 text-sm">
        {emptyText ?? t("nothingHere")}
      </p>
    );
  }
  return (
    <div className="border-hairline border-t">
      <StoryRows stories={stories} rows={rows} extras={{ cards: allocated, sprintNameOf }} />
    </div>
  );
}
