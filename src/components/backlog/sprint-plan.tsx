"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatDateDa } from "@/core/dates";
import type { Sprint } from "@/core/db/schema";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView } from "@/modules/boards/types";
import { setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { Link } from "@/i18n/navigation";
import type { Run } from "@/components/board/use-board-actions";
import { FoldButton } from "./backlog-bits";
import { BacklogRow } from "./backlog-row";
import { SprintForm } from "./sprint-form";
import { StartSprint } from "./start-sprint";

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
  structure,
  columnNames,
  canStart,
  selected,
  onSelect,
  lengthDays,
  velocityAverage = null,
  aiAvailable = false,
  fold,
  run,
}: {
  sprint: Sprint;
  cards: CardView[];
  boardId: string;
  boardKey: string;
  structure: StructureLookup;
  columnNames: Map<string, string>;
  canStart: boolean;
  selected: Set<string>;
  onSelect: (cardId: string, checked: boolean) => void;
  lengthDays: number;
  /** The recent closed sprints' average completed points; null before any close. */
  velocityAverage?: number | null;
  aiAvailable?: boolean;
  /** Folds the panel to its one header line, for a backlog that needs the room. */
  fold?: { open: boolean; onToggle: () => void };
  run: Run;
}) {
  const t = useTranslations("backlog.sprint");
  const points = cards.reduce((total, c) => total + (c.estimate ?? 0), 0);
  const active = sprint.state === "active";

  const open = fold?.open ?? true;
  return (
    <section className="border-border bg-card @container rounded-xl border shadow-[var(--surface-shadow)]">
      <header className="flex flex-col gap-1 px-4 py-3">
        <div className="flex items-start gap-1">
          {fold && (
            <span className="-ml-2">
              <FoldButton open={open} onToggle={fold.onToggle} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-chart-2 text-xs font-medium">
              {formatDateDa(sprint.startDate)} – {formatDateDa(sprint.endDate)}
              {active ? ` · ${t("activeLabel")}` : ` · ${t("plannedLabel")}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-base font-semibold">{sprint.name}</h2>
          <p className="text-meta text-2sm tabular-nums">
            {t("holds", { cards: cards.length, points })}
            {velocityAverage !== null && points > 0 && (
              <span> · {t("againstAverage", { average: velocityAverage })}</span>
            )}
          </p>
        </div>
        {open && sprint.goal && <p className="text-meta text-sm">{sprint.goal}</p>}
        {open && (
          <div className="flex items-center gap-2 pt-1">
            <SprintForm
              boardId={boardId}
              sprint={sprint}
              nextNumber={sprint.number}
              suggestedStart={sprint.startDate}
              lengthDays={lengthDays}
              aiAssist={aiAvailable}
              run={run}
              trigger={
                <Button type="button" variant="ghost" size="xs">
                  {t("edit")}
                </Button>
              }
            />
            {active ? (
              <Link
                href={`/boards/${boardId}`}
                className="text-primary text-2sm underline-offset-4 hover:underline"
              >
                {t("toBoard")}
              </Link>
            ) : (
              <StartSprint sprint={sprint} canStart={canStart} run={run} />
            )}
          </div>
        )}
      </header>
      {open &&
        (cards.length === 0 ? (
          <p className="text-meta border-hairline border-t px-4 py-3 text-sm">{t("empty")}</p>
        ) : (
          <ul className="border-hairline divide-hairline divide-y border-t">
            {cards.map((card) => (
              <BacklogRow
                key={card.id}
                card={card}
                boardKey={boardKey}
                boardId={boardId}
                structure={structure}
                selected={selected.has(card.id)}
                onSelect={(checked) => onSelect(card.id, checked)}
                columnName={active ? columnNames.get(card.columnId) : undefined}
                quiet
              />
            ))}
          </ul>
        ))}
      {open && cards.some((c) => selected.has(c.id)) && (
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
