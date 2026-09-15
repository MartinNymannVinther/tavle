"use client";

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
  onDropOn: (targetId: string) => void;
  /** The line under a title: where the story sits, as far as the heading has not said it. */
  crumbOf: (card: CardView) => Crumb;
  /** The place the heading already states, left out of the chips. */
  context?: ChipContext;
};

export function StoryRows({
  stories,
  rows,
  context,
}: {
  stories: CardView[];
  rows: StoryRowProps;
  context?: ChipContext;
}) {
  return (
    <ol className="divide-hairline divide-y">
      {stories.map((card, index) => {
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
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => rows.onDropOn(card.id)}
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
  /** Cards already committed to an open sprint: shown after the ranked rows, marked, not ranked. */
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
      <StoryRows stories={stories} rows={rows} />
      {allocated.length > 0 && (
        <ol className="divide-hairline border-hairline divide-y border-t">
          {allocated.map((card) => (
            <BacklogRow
              key={card.id}
              card={card}
              boardKey={rows.boardKey}
              boardId={rows.boardId}
              structure={rows.structure}
              context={rows.context}
              crumb={rows.crumbOf(card)}
              sprintName={(card.sprintId && sprintNameOf?.get(card.sprintId)) || undefined}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
