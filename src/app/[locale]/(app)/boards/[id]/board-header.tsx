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
  const tabs = <BoardTabs boardId={boardId} scrum={scrum} map={map} roadmap={roadmap} />;

  if (detail) {
    return (
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
        {tabs}
      </div>
    );
  }
  return (
    <PageHeader size="detail" kicker={kicker} title={name} subtitle={description} actions={tabs} />
  );
}
