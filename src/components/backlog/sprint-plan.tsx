"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatDateDa } from "@/core/dates";
import type { Label, Sprint } from "@/core/db/schema";
import type { CardView } from "@/modules/boards/types";
import { setCardsSprintAction, startSprintAction } from "@/modules/boards/actions-sprints";
import { Link } from "@/i18n/navigation";
import type { Run } from "@/components/board/use-board-actions";
import { BacklogRow } from "./backlog-row";
import { SprintForm } from "./sprint-form";

/**
 * A sprint on the planning page: its dates and goal, the points it
 * holds, its cards, and the button that starts it. The active sprint is
 * shown the same way, minus the start button, so cards can be pulled
 * into it mid-sprint when the team decides to.
 */
export function SprintPlan({
  sprint,
  cards,
  boardId,
  boardKey,
  labels,
  columnNames,
  canStart,
  selected,
  onSelect,
  lengthDays,
  run,
}: {
  sprint: Sprint;
  cards: CardView[];
  boardId: string;
  boardKey: string;
  labels: Label[];
  columnNames: Map<string, string>;
  canStart: boolean;
  selected: Set<string>;
  onSelect: (cardId: string, checked: boolean) => void;
  lengthDays: number;
  run: Run;
}) {
  const t = useTranslations("backlog.sprint");
  const points = cards.reduce((total, c) => total + (c.estimate ?? 0), 0);
  const active = sprint.state === "active";

  return (
    <section className="border-border bg-card rounded-xl border shadow-[var(--surface-shadow)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-chart-2 text-[0.72rem] font-medium">
            {formatDateDa(sprint.startDate)} – {formatDateDa(sprint.endDate)}
            {active ? ` · ${t("activeLabel")}` : ` · ${t("plannedLabel")}`}
          </p>
          <h2 className="truncate text-base font-semibold">{sprint.name}</h2>
          {sprint.goal && <p className="text-meta truncate text-sm">{sprint.goal}</p>}
        </div>
        <p className="text-meta text-sm tabular-nums">
          {t("holds", { cards: cards.length, points })}
        </p>
        <div className="flex items-center gap-2">
          <SprintForm
            boardId={boardId}
            sprint={sprint}
            nextNumber={sprint.number}
            suggestedStart={sprint.startDate}
            lengthDays={lengthDays}
            run={run}
            trigger={
              <Button type="button" variant="ghost" size="sm">
                {t("edit")}
              </Button>
            }
          />
          {active ? (
            <Link
              href={`/boards/${boardId}`}
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              {t("toBoard")}
            </Link>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!canStart}
              title={canStart ? undefined : t("anotherActive")}
              onClick={() => void run(() => startSprintAction({ sprintId: sprint.id }))}
            >
              {t("start")}
            </Button>
          )}
        </div>
      </header>
      {cards.length === 0 ? (
        <p className="text-meta border-hairline border-t px-4 py-3 text-sm">{t("empty")}</p>
      ) : (
        <ul className="border-hairline divide-hairline divide-y border-t">
          {cards.map((card) => (
            <BacklogRow
              key={card.id}
              card={card}
              boardKey={boardKey}
              boardId={boardId}
              labels={labels}
              selected={selected.has(card.id)}
              onSelect={(checked) => onSelect(card.id, checked)}
              columnName={active ? columnNames.get(card.columnId) : undefined}
            />
          ))}
        </ul>
      )}
      {cards.some((c) => selected.has(c.id)) && (
        <div className="border-hairline flex gap-2 border-t px-4 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void run(() =>
                setCardsSprintAction({
                  cardIds: cards.filter((c) => selected.has(c.id)).map((c) => c.id),
                  sprintId: null,
                }),
              )
            }
          >
            {t("toBacklog", { count: cards.filter((c) => selected.has(c.id)).length })}
          </Button>
        </div>
      )}
    </section>
  );
}
