"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Link, usePathname } from "@/i18n/navigation";
import { BoardTabs } from "./board-tabs";

/**
 * The board's header, in two sizes. On the board's own pages it is the
 * page opening: kicker, name, description, tabs. On a card or an item
 * the thing on the page is the card, so the header steps back to one
 * line — the kicker, the name as the way back, the tabs — and leaves
 * the title to the card.
 *
 * The navigation is drawn twice, as SidebarNav is: inline beside the
 * name from `lg`, and below the header in a band of its own on a phone,
 * where the name needs the whole line. The hidden copy is `display:none`
 * and so out of both the tab order and the accessibility tree. The band
 * is a sibling of the header rather than its child, because its sticky
 * position is measured against the board layout's own column — a
 * wrapper around the two would be the scroll container and the band
 * would never stick.
 */
export function BoardHeader({
  boardId,
  kicker,
  name,
  description,
  scrum,
  map,
  roadmap,
}: {
  boardId: string;
  kicker: string;
  name: string;
  description?: string;
  scrum: boolean;
  /** The map draws features; a board of cards alone has no map tab. */
  map: boolean;
  /** The roadmap draws epics; a board without them has no roadmap tab. */
  roadmap: boolean;
}) {
  const pathname = usePathname();
  const base = `/boards/${boardId}`;
  const detail = pathname.startsWith(`${base}/cards/`) || pathname.startsWith(`${base}/items/`);
  const props = { boardId, scrum, map, roadmap };
  const inline = <BoardTabs {...props} className="hidden lg:block" />;
  // top-[3.75rem] is MobileHeader's own height, which is what the band
  // comes to rest under; the fullscreen overlays on the breakdown and the
  // story map are z-40 and still cover it.
  const band = (
    <BoardTabs
      {...props}
      className="sticky top-[3.75rem] z-30 -mx-5 border-b border-border bg-background/90 px-5 py-1.5 backdrop-blur-md sm:-mx-7 sm:px-7 lg:hidden"
    />
  );

  if (detail) {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="text-chart-2 text-2sm font-medium">{kicker}</span>
            <Link
              href={base}
              className="truncate text-reading font-semibold tracking-[-0.01em] hover:underline"
            >
              {name}
            </Link>
          </p>
          {inline}
        </div>
        {band}
      </>
    );
  }
  return (
    <>
      <PageHeader
        size="detail"
        kicker={kicker}
        title={name}
        subtitle={description}
        actions={inline}
      />
      {band}
    </>
  );
}
