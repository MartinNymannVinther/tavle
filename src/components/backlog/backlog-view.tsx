"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { QuickAdd } from "@/components/board/quick-add";
import { useBoardActions } from "@/components/board/use-board-actions";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import type { BoardFull, CardView } from "@/modules/boards/types";
import { createCardAction } from "@/modules/boards/actions-cards";
import { reorderBacklogAction, setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { BacklogRow } from "./backlog-row";
import { SprintForm } from "./sprint-form";
import { SprintPlan } from "./sprint-plan";

/**
 * Planning on a Scrum board. The backlog on the left in the order the
 * team keeps it — dragged, or nudged with the arrows — and the sprints on
 * the right: the one running, the ones planned, and a button for the
 * next. Selecting cards and choosing a sprint is how work is committed.
 */
export function BacklogView({ full }: { full: BoardFull }) {
  const t = useTranslations("backlog");
  const { run } = useBoardActions();
  const { board, cards, labels, sprints, columns } = full;
  const backlog = cards
    .filter((c) => !c.sprintId)
    .sort((a, b) => a.sort - b.sort || a.number - b.number);
  const open = sprints.filter((s) => s.state !== "closed").sort((a, b) => a.number - b.number);
  const active = sprints.find((s) => s.state === "active") ?? null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>(open[0]?.id ?? "");
  const [dragId, setDragId] = useState<string | null>(null);
  const columnNames = new Map(columns.map((c) => [c.id, c.name]));
  const lastEnd = sprints.reduce((max, s) => (s.endDate > max ? s.endDate : max), "");
  const suggestedStart = lastEnd ? addDaysIso(lastEnd, 1) : todayInCopenhagen();
  const backlogPoints = backlog.reduce((total, c) => total + (c.estimate ?? 0), 0);

  function select(cardId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  }

  async function commit() {
    const ids = [...selected];
    if (ids.length === 0 || !target) return;
    const ok = await run(() => setCardsSprintAction({ cardIds: ids, sprintId: target }));
    if (ok) setSelected(new Set());
  }

  function reorder(cardId: string, index: number) {
    void run(() => reorderBacklogAction({ cardId, index }));
  }

  const backlogSelected = backlog.filter((c) => selected.has(c.id)).length;

  return (
    <div className="grid gap-6 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="border-border bg-card flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]">
        <header className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="text-meta text-sm tabular-nums">
              {t("holds", { cards: backlog.length, points: backlogPoints })}
            </p>
          </div>
          {backlogSelected > 0 && open.length > 0 && (
            <div className="flex items-center gap-2">
              <NativeSelect
                variant="sm"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-label={t("targetSprint")}
                className="w-44"
              >
                {open.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
              <Button type="button" size="sm" onClick={() => void commit()}>
                {t("commit", { count: backlogSelected })}
              </Button>
            </div>
          )}
        </header>
        {backlog.length === 0 ? (
          <p className="text-meta border-hairline border-t px-4 py-3 text-sm">{t("empty")}</p>
        ) : (
          <ol className="border-hairline divide-hairline divide-y border-t">
            {backlog.map((card: CardView, index) => (
              <BacklogRow
                key={card.id}
                card={card}
                boardKey={board.key}
                boardId={board.id}
                labels={labels}
                selected={selected.has(card.id)}
                onSelect={(checked) => select(card.id, checked)}
                onMoveUp={index > 0 ? () => reorder(card.id, index - 1) : undefined}
                onMoveDown={
                  index < backlog.length - 1 ? () => reorder(card.id, index + 1) : undefined
                }
                draggable
                dragging={dragId === card.id}
                onDragStart={() => setDragId(card.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragId && dragId !== card.id) reorder(dragId, index);
                  setDragId(null);
                }}
              />
            ))}
          </ol>
        )}
        <div className="border-hairline border-t px-2 py-2">
          <QuickAdd
            onAdd={(title) => run(() => createCardAction({ boardId: board.id, title }))}
            placeholder={t("addPlaceholder")}
          />
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        {open.map((sprint) => (
          <SprintPlan
            key={sprint.id}
            sprint={sprint}
            cards={cards.filter((c) => c.sprintId === sprint.id).sort((a, b) => a.sort - b.sort)}
            boardId={board.id}
            boardKey={board.key}
            labels={labels}
            columnNames={columnNames}
            canStart={!active}
            selected={selected}
            onSelect={select}
            lengthDays={board.sprintLengthDays}
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
    </div>
  );
}
