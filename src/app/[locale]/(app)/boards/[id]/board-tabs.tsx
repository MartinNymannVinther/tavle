"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { activePlace, boardPlaces } from "@/components/board/places";
import { SegmentedFilter } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { BoardMoreMenu } from "./board-more-menu";

/**
 * The board's navigation: the three places a team uses daily on the
 * track, and the six it visits now and then behind one door
 * (docs/adr/0036).
 * The three and the board's own name are links, so they work without a
 * script and the active one is known from the URL; the six inside the
 * menu need JavaScript to be reached from here, and are reachable by
 * their own address without it.
 */
export function BoardTabs({
  boardId,
  scrum,
  map = true,
  roadmap = true,
  className,
}: {
  boardId: string;
  scrum: boolean;
  /** The map needs features to draw columns; a board of cards alone has none. */
  map?: boolean;
  roadmap?: boolean;
  className?: string;
}) {
  const t = useTranslations("boards.tabs");
  const pathname = usePathname();
  const box = useScrollActiveIntoView(pathname);
  const base = `/boards/${boardId}`;
  const { track, groups } = boardPlaces(base, { scrum, map, roadmap });
  const active = activePlace(pathname, [...track, ...groups.flatMap((group) => group.places)]);
  const items = track.map((place) => ({
    key: place.key,
    label: t(place.key),
    href: place.href,
    active: place.key === active,
  }));

  // Four segments now, but the menu's trigger takes the widest of its
  // six words when you stand behind it, so the track can still outgrow a
  // phone and scrolls inside its own box. The box only holds its ground
  // because the header's actions slot is capped at the header's width
  // (src/components/ui/page-header.tsx) — and because `min-w-0` is on
  // whichever element is the flex item in that slot. That is this `nav`,
  // not the box inside it: a flex item's floor is its content unless it
  // is told otherwise, and a grandchild's `min-w-0` cannot lower it. Get
  // that wrong and an over-wide track stops scrolling and widens the
  // document instead, which is the whole failure this box exists to stop.
  return (
    <nav aria-label={t("navLabel")} className={cn("max-w-full min-w-0", className)}>
      <div ref={box} className="max-w-full min-w-0 overflow-x-auto">
        <SegmentedFilter
          items={items}
          trailing={<BoardMoreMenu groups={groups} active={active} />}
        />
      </div>
    </nav>
  );
}

/**
 * On a phone the track is wider than its box, so the place you are
 * standing has to be brought into sight; on a wide screen nothing moves.
 */
function useScrollActiveIntoView(at: string) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = box.current;
    if (!track) return;
    const hidden = track.scrollWidth - track.clientWidth;
    if (hidden <= 0) return;
    const active = track.querySelector<HTMLElement>("[aria-current]");
    if (!active) return;
    const offset =
      active.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    const centred = offset - (track.clientWidth - active.offsetWidth) / 2;
    track.scrollLeft = Math.max(0, Math.min(centred, hidden));
  }, [at]);
  return box;
}
