"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChipContext, StructureLookup } from "@/components/board/card-chips";
import { mergeByRank } from "@/modules/boards/ordering";
import type { CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
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
  /** Whether the card being dragged is one promised to a sprint. */
  fromSprint?: (cardId: string) => boolean;
  /** A card dragged out of a sprint onto a backlog with no rows to land between. */
  onDropOut?: () => void;
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
  // the sequence merges on the rank both carry (docs/adr/0033). Only the
  // free rows are dragged, but every row is a place to land — an arrow or
  // a drop that skipped the marked rows would move the card further than
  // the eye was told.
  const merged = mergeByRank(stories, extras?.cards ?? []);
  const dragged = rows.dragId;
  // A card from elsewhere: another group's row, or one being dragged out
  // of a sprint. Either may land here; what it means differs.
  const foreign = dragged ? !stories.some((c) => c.id === dragged) : false;
  const released = Boolean(dragged && rows.fromSprint?.(dragged));
  const canLand = !foreign || released || Boolean(groupDrop);
  const landing = (card: CardView) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragged || dragged === card.id || !canLand) return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const below = event.clientY > rect.top + rect.height / 2;
      if (hover?.id !== card.id || hover.after !== below) setHover({ id: card.id, after: below });
    },
    onDrop: () => {
      const after = hover?.id === card.id ? hover.after : false;
      // A card out of a sprint comes back to the backlog wherever it is
      // dropped; a card from another group takes that group's field.
      if (foreign && !released && groupDrop && dragged) {
        groupDrop.onDrop(dragged, card.id, after);
        rows.setDragId(null);
      } else {
        rows.onDropOn(card.id, after);
      }
      setHover(null);
    },
    onDragEnd: () => {
      setHover(null);
      rows.setDragId(null);
    },
    indicator:
      hover?.id === card.id && dragged && dragged !== card.id
        ? hover.after
          ? ("below" as const)
          : ("above" as const)
        : null,
  });
  return (
    <ol className="divide-hairline divide-y">
      {merged.map(({ card, committed }, seat) => {
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
              {...landing(card)}
            />
          );
        }
        const before = merged[seat - 1]?.card;
        const after = merged[seat + 1]?.card;
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
            dragging={dragged === card.id}
            onDragStart={() => rows.setDragId(card.id)}
            {...landing(card)}
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
  const [over, setOver] = useState(false);
  if (stories.length === 0 && allocated.length === 0) {
    // With no rows there is nothing to land between, but a card dragged
    // out of a sprint still has somewhere to go: the empty backlog itself.
    const released = Boolean(rows.dragId && rows.fromSprint?.(rows.dragId) && rows.onDropOut);
    return (
      <p
        onDragOver={(event) => {
          if (!released) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          if (!released) return;
          event.preventDefault();
          setOver(false);
          rows.onDropOut!();
        }}
        className={cn(
          "text-meta border-hairline border-t px-4 py-3 text-sm",
          released && "outline-primary/40 -outline-offset-4 outline-dashed",
          released && over && "bg-accent/40",
        )}
      >
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
