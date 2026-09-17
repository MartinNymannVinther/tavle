"use client";

import { useState } from "react";
import type { Run } from "@/components/board/use-board-actions";
import { setCardsSprintAction, reorderBacklogAction } from "@/modules/boards/actions-sprints";
import { placeCardAction, updateCardAction } from "@/modules/boards/actions-cards";
import { reorderItemAction } from "@/modules/boards/actions-structure";
import type { CardView } from "@/modules/boards/types";
import type { Grouping } from "./group-backlog";

/**
 * Every move the backlog page can make, and the one drag they share.
 *
 * The page draws six surfaces — the flat list, the grouped lists, the
 * two altitudes, the navigator and the sprint panels — and a card can be
 * dragged from any of them to most of the others. What a drop means
 * belongs together in one place rather than spread through the markup:
 * the rank, the promise to a sprint, the group's field, the parent. Each
 * one is the same write the corresponding button makes, which is what
 * lets the page keep the constitution's promise that a drag is the quick
 * path and never the only one.
 *
 * The order inside a move matters and is the reason these are functions
 * rather than one handler: a card leaving a sprint has its promise taken
 * back first, and only then lands where it was dropped. Doing it the
 * other way would ask the service to rank a card it refuses to rank.
 */
export function useBacklogMoves({
  cards,
  grouping,
  run,
}: {
  /** The board's cards, to read what a dragged one currently is. */
  cards: CardView[];
  grouping: Grouping;
  run: Run;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  /**
   * The backlog's own order is the only order; a nudge is a move past the
   * row beside it — which may be a row promised to a sprint, standing at
   * its rank among the free ones (docs/adr/0033). The service ranks
   * against the whole priority, so one step is one row of what is read.
   */
  function nudge(cardId: string, siblingId: string, after: boolean) {
    void run(() => reorderBacklogAction({ cardId, siblingId, after }));
  }

  /** A card promised to a sprint, dragged: the promise is what a drop takes back. */
  const committedDrag = (cardId: string) => Boolean(cards.find((c) => c.id === cardId)?.sprintId);

  /** Takes the promise back, then does whatever the drop meant on top of it. */
  const release = (cardId: string): Promise<boolean> =>
    run(() => setCardsSprintAction({ cardIds: [cardId], sprintId: null }));

  /** Takes the card out of the air, whatever happens next. */
  function lift(): string | null {
    const id = dragId;
    setDragId(null);
    return id;
  }

  return {
    dragId,
    setDragId,
    nudge,
    committedDrag,

    /** A card dropped on a row: the rank it was dropped at. */
    dropOn(targetId: string, after: boolean) {
      const id = lift();
      if (!id || id === targetId) return;
      // Dragged out of a sprint and onto a row: the card comes back to the
      // backlog and lands where it was dropped, in that order.
      if (committedDrag(id)) {
        void release(id).then((ok) => {
          if (ok) nudge(id, targetId, after);
        });
        return;
      }
      nudge(id, targetId, after);
    },

    /** A card dropped on a sprint: the same promise the selection bar's button makes. */
    dropInSprint(sprintId: string) {
      const id = lift();
      if (!id) return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.sprintId === sprintId) return;
      void run(() => setCardsSprintAction({ cardIds: [id], sprintId }));
    },

    /** A card dropped on a backlog with no rows to land between. */
    dropOut() {
      const id = lift();
      if (id && committedDrag(id)) void release(id);
    },

    /** A card dropped on the navigator: the same placement as the story map's drag. */
    dropOnNav(featureId: string | null) {
      const id = lift();
      if (!id) return;
      void run(() => placeCardAction({ cardId: id, featureId }));
    },

    /** A card dropped into another group: the group's field first, then the spot it landed on. */
    async moveCardToGroup(
      cardId: string,
      groupKey: string,
      siblingId: string | null,
      after: boolean,
    ) {
      const card = cards.find((c) => c.id === cardId);
      if (!card || grouping === "list") return;
      // Out of the sprint first: a group says which field, never which sprint.
      if (card.sprintId && !(await release(cardId))) return;
      const ok = await run(() =>
        grouping === "theme"
          ? placeCardAction({
              cardId,
              themeIds: [groupKey, ...card.themeIds.filter((themeId) => themeId !== groupKey)],
            })
          : grouping === "area"
            ? placeCardAction({ cardId, areaId: groupKey })
            : updateCardAction({ cardId, kind: groupKey as "business" | "enabler" }),
      );
      if (ok && siblingId && siblingId !== cardId) nudge(cardId, siblingId, after);
    },

    /** A card dragged to another feature's fold-out: placement first, then the spot it landed on. */
    async moveCardToFeature(
      cardId: string,
      featureId: string,
      siblingId: string | null,
      after: boolean,
    ) {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      if (card.featureId !== featureId) {
        const ok = await run(() => placeCardAction({ cardId, featureId }));
        if (!ok) return;
      }
      if (siblingId && siblingId !== cardId) nudge(cardId, siblingId, after);
    },

    /** An epic or a feature past its neighbour, at whatever altitude it is read. */
    rank(itemId: string, siblingId: string, after: boolean) {
      void run(() => reorderItemAction({ itemId, siblingId, after }));
    },
  };
}
