"use client";

import { useTranslations } from "next-intl";
import { SegmentedChoice } from "@/components/ui/segmented";
import { BoardFilters, type Filters } from "@/components/board/board-filters";
import type { StructureLookup } from "@/components/board/card-chips";
import type { Member } from "@/modules/boards/types";
import { GROUPINGS, type Grouping } from "./group-backlog";

/**
 * How the list is looked at: as the one list, or grouped by theme, area
 * or kind, and the filters beside it. Nothing here changes the board; it
 * all stays on the page.
 */
export function BacklogToolbar({
  grouping,
  onGrouping,
  filters,
  onFilters,
  members,
  structure,
}: {
  grouping: Grouping;
  onGrouping: (grouping: Grouping) => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  members: Member[];
  structure: StructureLookup;
}) {
  const g = useTranslations("backlog.grouping");
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      <SegmentedChoice
        value={grouping}
        onChange={onGrouping}
        label={g("label")}
        options={GROUPINGS.map((option) => ({ value: option, label: g(option) }))}
      />
      <BoardFilters
        filters={filters}
        onChange={onFilters}
        members={members}
        structure={structure}
        collapsible
      />
    </div>
  );
}
