"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { StructureLookup } from "@/components/board/card-chips";
import type { Run } from "@/components/board/use-board-actions";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import type { Sprint } from "@/core/db/schema";
import { velocity } from "@/modules/boards/metrics/velocity";
import type { BoardFull } from "@/modules/boards/types";
import { SprintForm } from "./sprint-form";
import { SprintPlan } from "./sprint-plan";

/**
 * The open sprints beside the backlog on a Scrum board, newest last,
 * and the button that plans the next one with a start the day after
 * the last end.
 */
export function SprintColumn({
  full,
  sprints,
  active,
  structure,
  selected,
  onSelect,
  run,
}: {
  full: BoardFull;
  /** The open sprints, in number order. */
  sprints: Sprint[];
  active: Sprint | null;
  structure: StructureLookup;
  selected: Set<string>;
  onSelect: (cardId: string, checked: boolean) => void;
  run: Run;
}) {
  const t = useTranslations("backlog");
  const { board, cards } = full;
  const columnNames = new Map(full.columns.map((c) => [c.id, c.name]));
  // The record speaks at the moment of planning: the recent closed
  // sprints' written-down points, next to what this plan holds.
  const average = velocity(full.sprints).average;
  const lastEnd = full.sprints.reduce((max, sp) => (sp.endDate > max ? sp.endDate : max), "");
  const suggestedStart = lastEnd ? addDaysIso(lastEnd, 1) : todayInCopenhagen();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {sprints.map((sprint) => (
        <SprintPlan
          key={sprint.id}
          sprint={sprint}
          cards={cards.filter((c) => c.sprintId === sprint.id).sort((a, b) => a.sort - b.sort)}
          boardId={board.id}
          boardKey={board.key}
          structure={structure}
          columnNames={columnNames}
          canStart={!active}
          selected={selected}
          onSelect={onSelect}
          lengthDays={board.sprintLengthDays}
          velocityAverage={average}
          run={run}
        />
      ))}
      <SprintForm
        boardId={board.id}
        nextNumber={board.nextSprintNumber}
        suggestedStart={suggestedStart}
        lengthDays={board.sprintLengthDays}
        run={run}
        trigger={
          <Button type="button" variant="outline" size="sm" className="w-fit">
            {t("newSprint")}
          </Button>
        }
      />
    </div>
  );
}
