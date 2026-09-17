"use client";

import { useState } from "react";
import type { Release } from "@/core/db/schema";
import type { Run } from "@/components/board/use-board-actions";
import { updateItemAction } from "@/modules/boards/actions-structure";
import { updateReleaseAction } from "@/modules/boards/actions-releases";
import type { BoardFull } from "@/modules/boards/types";
import type { PlanSpan } from "./roadmap-line";

/**
 * What the roadmap shows before the server has answered.
 *
 * Both things the page can drag — an epic's span across quarters and a
 * release's day on the axis — write once, when the pointer is let go
 * (docs/adr/0019). Between that moment and the next render from the
 * server the page would otherwise snap the bar or the marker back to
 * where it was, and a person who dragged something correctly would see
 * it refuse them. So the move is held here and drawn as if it had
 * landed; a refusal takes it back, and rows arriving from the server
 * clear the whole memory, because the server is then the better witness.
 *
 * The two live together because they are the same promise made twice,
 * and because they are cleared by the same event.
 */
export function usePlanOverrides(full: BoardFull, run: Run) {
  const [seed, setSeed] = useState(full.items);
  const [plans, setPlans] = useState<Map<string, { start: string; target: string }>>(new Map());
  const [dates, setDates] = useState<Map<string, string>>(new Map());
  if (seed !== full.items) {
    setSeed(full.items);
    setPlans(new Map());
    setDates(new Map());
  }

  const plan: PlanSpan = (epicId, startQuarter, targetQuarter) => {
    setPlans((prev) => new Map(prev).set(epicId, { start: startQuarter, target: targetQuarter }));
    void run(() => updateItemAction({ itemId: epicId, startQuarter, targetQuarter })).then((ok) => {
      if (!ok) setDrop(setPlans, epicId);
    });
  };

  const moveRelease = (release: Release, targetDate: string) => {
    setDates((prev) => new Map(prev).set(release.id, targetDate));
    void run(() =>
      updateReleaseAction({ releaseId: release.id, name: release.name, targetDate }),
    ).then((ok) => {
      if (!ok) setDrop(setDates, release.id);
    });
  };

  return {
    plan,
    moveRelease,
    /** An epic's span as the page is drawing it, override included. */
    spanOf: (epicId: string) => plans.get(epicId),
    /**
     * A moved marker keeps its new day by going in where the board's own
     * rows do, so everything downstream of it — the strip's lanes, the
     * dialog, the axis itself — is drawn from one picture.
     */
    withDates: (board: BoardFull): BoardFull =>
      dates.size === 0
        ? board
        : {
            ...board,
            releases: board.releases.map((release) =>
              dates.has(release.id) ? { ...release, targetDate: dates.get(release.id)! } : release,
            ),
          },
  };
}

function setDrop<T>(set: React.Dispatch<React.SetStateAction<Map<string, T>>>, key: string) {
  set((prev) => {
    const next = new Map(prev);
    next.delete(key);
    return next;
  });
}
