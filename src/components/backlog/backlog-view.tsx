"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  applyFilters,
  BoardFilters,
  NO_FILTERS,
  type Filters,
} from "@/components/board/board-filters";
import { structureOf } from "@/components/board/card-chips";
import { QuickAdd } from "@/components/board/quick-add";
import { useBoardActions } from "@/components/board/use-board-actions";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import type { BoardFull } from "@/modules/boards/types";
import { createCardAction } from "@/modules/boards/actions-cards";
import { reorderItemAction } from "@/modules/boards/actions-structure";
import { reorderBacklogAction, setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { GroupedList, HierarchyList, type StoryRowProps } from "./backlog-list";
import { backlogStories, grouped, GROUPINGS, hierarchy, type Grouping } from "./group-backlog";
import { ItemForm } from "./item-form";
import { SprintForm } from "./sprint-form";
import { SprintPlan } from "./sprint-plan";

/**
 * The backlog: one list with a choice of grouping — the hierarchy of
 * epics and features by default, or one field at a time — and the
 * filters. On a Scrum board the sprints stand to the right and selected
 * stories are committed to one; on a Kanban board the list has the
 * width to itself. The stories' one order is kept in every grouping:
 * the arrows move a story past its neighbour in the list, which is the
 * same move in the backlog's own order.
 */
export function BacklogView({ full }: { full: BoardFull }) {
  const t = useTranslations("backlog");
  const g = useTranslations("backlog.grouping");
  const s = useTranslations("boards.structure");
  const { run } = useBoardActions();
  const { board, cards, sprints } = full;
  const scrum = board.mode === "scrum";
  const structure = structureOf(full);
  const [grouping, setGrouping] = useState<Grouping>("hierarchy");
  const [showClosed, setShowClosed] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);

  const all = backlogStories(full);
  const stories = applyFilters(all, filters);
  const open = sprints.filter((sp) => sp.state !== "closed").sort((a, b) => a.number - b.number);
  const active = sprints.find((sp) => sp.state === "active") ?? null;
  const [target, setTarget] = useState<string>(open[0]?.id ?? "");
  const columnNames = new Map(full.columns.map((c) => [c.id, c.name]));
  const lastEnd = sprints.reduce((max, sp) => (sp.endDate > max ? sp.endDate : max), "");
  const suggestedStart = lastEnd ? addDaysIso(lastEnd, 1) : todayInCopenhagen();
  const points = all.reduce((total, c) => total + (c.estimate ?? 0), 0);

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

  /** The backlog's own order is the only order; a nudge is a move past the sibling in it. */
  function nudge(cardId: string, siblingId: string, after: boolean) {
    const order = all.map((c) => c.id).filter((id) => id !== cardId);
    const at = order.indexOf(siblingId);
    if (at < 0) return;
    void run(() => reorderBacklogAction({ cardId, index: after ? at + 1 : at }));
  }

  function dropOn(targetId: string) {
    const id = dragId;
    setDragId(null);
    if (!id || id === targetId) return;
    nudge(id, targetId, false);
  }

  const rows: StoryRowProps = {
    boardKey: board.key,
    boardId: board.id,
    structure,
    selected,
    onSelect: select,
    onNudge: nudge,
    onRank: (itemId, siblingId, after) =>
      void run(() => reorderItemAction({ itemId, siblingId, after })),
    dragId,
    setDragId,
    onDropOn: dropOn,
  };
  const groupNames = { none: g("none"), business: s("kind.business"), enabler: s("kind.enabler") };
  const backlogSelected = all.filter((c) => selected.has(c.id)).length;

  const list = (
    <section className="border-border bg-card flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-meta text-sm tabular-nums">
            {t("holds", { cards: all.length, points })}
          </p>
        </div>
        <NativeSelect
          variant="sm"
          value={grouping}
          onChange={(event) => setGrouping(event.target.value as Grouping)}
          aria-label={g("label")}
          className="w-40"
        >
          {GROUPINGS.map((option) => (
            <option key={option} value={option}>
              {g(option)}
            </option>
          ))}
        </NativeSelect>
        {grouping === "hierarchy" && (
          <label className="text-meta flex items-center gap-1.5 text-[0.78rem]">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(event) => setShowClosed(event.target.checked)}
            />
            {t("showClosed")}
          </label>
        )}
        <ItemForm
          full={full}
          level="epic"
          run={run}
          trigger={
            <Button type="button" variant="outline" size="sm">
              {t("newEpic")}
            </Button>
          }
        />
        <ItemForm
          full={full}
          level="feature"
          run={run}
          trigger={
            <Button type="button" variant="outline" size="sm">
              {t("newFeature")}
            </Button>
          }
        />
        {scrum && backlogSelected > 0 && open.length > 0 && (
          <div className="flex items-center gap-2">
            <NativeSelect
              variant="sm"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label={t("targetSprint")}
              className="w-44"
            >
              {open.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </NativeSelect>
            <Button type="button" size="sm" onClick={() => void commit()}>
              {t("commit", { count: backlogSelected })}
            </Button>
          </div>
        )}
      </header>
      <div className="px-4 pb-3">
        <BoardFilters
          filters={filters}
          onChange={setFilters}
          members={full.members}
          structure={structure}
        />
      </div>
      {grouping === "hierarchy" ? (
        <HierarchyList
          tree={hierarchy(full, stories, { showClosed })}
          rows={rows}
          reviewDays={board.epicReviewDays}
        />
      ) : (
        <GroupedList groups={grouped(full, stories, grouping, groupNames)} rows={rows} />
      )}
      {all.length === 0 && (
        <p className="text-meta border-hairline border-t px-4 py-3 text-sm">{t("empty")}</p>
      )}
      <div className="border-hairline border-t px-2 py-2">
        <QuickAdd
          onAdd={(title, place) =>
            run(() => createCardAction({ boardId: board.id, title, ...place }))
          }
          structure={structure}
          placeholder={t("addPlaceholder")}
        />
      </div>
    </section>
  );

  if (!scrum) return list;

  return (
    <div className="grid gap-6 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {list}
      <div className="flex min-w-0 flex-col gap-4">
        {open.map((sprint) => (
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
