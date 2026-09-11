"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SegmentedChoice } from "@/components/ui/segmented";
import { BoardFilters, type Filters } from "@/components/board/board-filters";
import type { StructureLookup } from "@/components/board/card-chips";
import type { Member } from "@/modules/boards/types";
import { GROUPINGS, type Grouping } from "./group-backlog";

/**
 * How the backlog is looked at: the grouping as one segmented choice,
 * whether closed items show, the fold for the whole list, and the
 * filters on their own line under it. Nothing here changes the board;
 * it all stays on the page.
 */
export function BacklogToolbar({
  grouping,
  onGrouping,
  showClosed,
  onShowClosed,
  anyOpen,
  filtering,
  onFoldAll,
  filters,
  onFilters,
  members,
  structure,
}: {
  grouping: Grouping;
  onGrouping: (grouping: Grouping) => void;
  showClosed: boolean;
  onShowClosed: (show: boolean) => void;
  anyOpen: boolean;
  /** With a filter on, everything is open and the fold has nothing to say. */
  filtering: boolean;
  onFoldAll: () => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  members: Member[];
  structure: StructureLookup;
}) {
  const t = useTranslations("backlog");
  const g = useTranslations("backlog.grouping");
  const f = useTranslations("backlog.fold");
  const hierarchy = grouping === "hierarchy";
  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SegmentedChoice
          value={grouping}
          onChange={onGrouping}
          label={g("label")}
          options={GROUPINGS.map((option) => ({ value: option, label: g(option) }))}
        />
        {hierarchy && (
          <label className="text-meta flex items-center gap-1.5 text-[0.78rem]">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(event) => onShowClosed(event.target.checked)}
              className="accent-[var(--primary)]"
            />
            {t("showClosed")}
          </label>
        )}
        {hierarchy && !filtering && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onFoldAll}
            className="text-meta ml-auto"
          >
            {anyOpen ? <ChevronsDownUp data-slot="icon" /> : <ChevronsUpDown data-slot="icon" />}
            {anyOpen ? f("all") : f("none")}
          </Button>
        )}
      </div>
      <BoardFilters
        filters={filters}
        onChange={onFilters}
        members={members}
        structure={structure}
      />
    </div>
  );
}
