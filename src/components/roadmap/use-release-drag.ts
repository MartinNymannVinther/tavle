"use client";

import { useRef, useState } from "react";
import { dateAtPosition } from "@/modules/boards/structure/roadmap";
import type { RoadmapRelease } from "@/modules/boards/structure/roadmap";

/**
 * A release marker dragged along the quarter axis (docs/adr/0019, on the
 * strip rather than the bars). The preview follows the pointer in days
 * and the write happens once, when it is let go — the same bargain the
 * epic bars make one file over, and the reason the marker never asks the
 * server what it already knows.
 *
 * The marker is also a button that opens the release dialog, so this
 * hook's other job is telling one gesture from the other. Two things
 * make that harder than a distance:
 *
 * A finger is not a mouse. An ordinary tap travels five to ten pixels,
 * and at about a pixel and a half to the day a mouse's three would turn
 * a tap meant to open the dialog into a week's slip — written, audited,
 * and with the dialog never opening to say so. So a coarse pointer gets
 * a coarse threshold.
 *
 * And a drag leaves a click behind that nobody asked for. The latch
 * swallows it; what the latch must not swallow is the keyboard, which
 * arrives at the same handler with `detail` of zero and no pointer
 * before it — on a touch screen no click follows the drag at all, so
 * the latch would otherwise still be up when somebody later pressed
 * Enter.
 */

/** A marker under the pointer: where it started, and the day it reads now. */
export type ReleaseDrag = {
  id: string;
  from: number;
  cell: number;
  start: number;
  date: string;
  moved: number;
  slop: number;
};

const CLICK_SLOP = { fine: 3, coarse: 12 };

export function useReleaseDrag({
  quarters,
  onMove,
  onOpen,
}: {
  quarters: string[];
  /** A finished drag, on the day it was let go over. */
  onMove: (release: RoadmapRelease, targetDate: string) => void;
  /** A press that never travelled, or a keyboard's. */
  onOpen: (release: RoadmapRelease) => void;
}) {
  const [drag, setDrag] = useState<ReleaseDrag | null>(null);
  const dragged = useRef(false);

  return {
    drag,

    /**
     * The drag starts from where the date really falls, not from where
     * the marker is painted: the strip's edge clamp is a rule about ink,
     * and measuring travel from it would make a release at either end of
     * the axis jump days the pointer never moved — rightwards, and
     * sometimes backwards.
     */
    down(release: RoadmapRelease, targetDate: string) {
      return (event: React.PointerEvent<HTMLElement>) => {
        const strip = event.currentTarget.closest("[data-strip]") as HTMLElement;
        event.currentTarget.setPointerCapture(event.pointerId);
        // A drag that ended somewhere the click never followed must not
        // swallow the next one.
        dragged.current = false;
        setDrag({
          id: release.release.id,
          from: event.clientX,
          cell: strip.getBoundingClientRect().width / quarters.length,
          start: release.at!,
          date: targetDate,
          moved: 0,
          slop: event.pointerType === "touch" ? CLICK_SLOP.coarse : CLICK_SLOP.fine,
        });
      };
    },

    move(event: React.PointerEvent) {
      if (!drag) return;
      // A drag the browser took over must never keep steering the marker
      // into a later click — and the click that comes anyway is not a
      // request to open the dialog, so it is swallowed like a finished
      // drag's would be.
      if (event.buttons === 0) {
        dragged.current = drag.moved >= drag.slop;
        setDrag(null);
        return;
      }
      const travelled = event.clientX - drag.from;
      const date = dateAtPosition(drag.start + travelled / drag.cell, quarters);
      const moved = Math.max(drag.moved, Math.abs(travelled));
      if (date !== drag.date || moved !== drag.moved) setDrag({ ...drag, date, moved });
    },

    up(among: RoadmapRelease[]) {
      if (!drag) return;
      const row = among.find((r) => r.release.id === drag.id);
      setDrag(null);
      if (drag.moved < drag.slop) return;
      dragged.current = true;
      if (row && drag.date !== row.release.targetDate) onMove(row, drag.date);
    },

    cancel() {
      setDrag(null);
    },

    /** The keyboard and a pointer that stayed put; a finished drag passes. */
    click(release: RoadmapRelease) {
      return (event: React.MouseEvent) => {
        if (event.detail !== 0 && dragged.current) {
          dragged.current = false;
          return;
        }
        dragged.current = false;
        onOpen(release);
      };
    },
  };
}
