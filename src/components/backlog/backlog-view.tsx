"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  applyFilters,
  hasFilters,
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
import { ALL_OPEN, HierarchyList, sectionIds, type StoryRowProps } from "./backlog-list";
import { BacklogToolbar } from "./backlog-toolbar";
import { backlogStories, grouped, hierarchy, type Group, type Grouping } from "./group-backlog";
import { GroupedList } from "./grouped-list";
import { ItemForm } from "./item-form";
import { SelectionBar } from "./selection-bar";
import { SprintForm } from "./sprint-form";
import { SprintPlan } from "./sprint-plan";
import { useFolded } from "./use-folded";

/**
 * The backlog: one list with a choice of grouping — the hierarchy of
 * epics and features by default, or one field at a time — and the
 * filters. The page opens with the epics folded and remembers what is
 * folded out. On a Scrum board the sprints stand to the right and
 * ticked stories are committed to one from a bar that appears with the
 * first tick; on a Kanban board the list has the width to itself. The
 * stories' one order is kept in every grouping: the arrows move a story
 * past its neighbour in the list, which is the same move in the
 * backlog's own order.
 */
export function BacklogView({ full }: { full: BoardFull }) {
  const t = useTranslations("backlog");
  const g = useTranslations("backlog.grouping");
  const s = useTranslations("boards.structure");
  const { run } = useBoardActions();
  const { board, cards, sprints } = full;
  const scrum = board.mode === "scrum";
  const structure = structureOf(full);
  const folded = useFolded(board.id);
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
  const tree = hierarchy(full, stories, { showClosed });
  const filtering = hasFilters(filters);

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
    reviewDays: board.epicReviewDays,
    selected,
    onSelect: scrum ? select : undefined,
    onNudge: nudge,
    onRank: (itemId, siblingId, after) =>
      void run(() => reorderItemAction({ itemId, siblingId, after })),
    dragId,
    setDragId,
    onDropOn: dropOn,
    isOpen: filtering ? ALL_OPEN : folded.isOpen,
    toggle: folded.toggle,
    newFeature: (epicId) => (
      <ItemForm
        full={full}
        level="feature"
        parentId={epicId}
        run={run}
        trigger={
          <button type="button" className="text-meta hover:text-foreground font-medium">
            + {t("newFeature")}
          </button>
        }
      />
    ),
  };
  const groupNames = { none: g("none"), business: s("kind.business"), enabler: s("kind.enabler") };
  const contextOf = (group: Group) =>
    grouping === "theme" && group.key !== "none"
      ? { themeIds: [group.key] }
      : grouping === "area" && group.key !== "none"
        ? { areaId: group.key }
        : undefined;
  const backlogSelected = all.filter((c) => selected.has(c.id)).length;

  const list = (
    <section className="border-border bg-card @container flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-meta text-sm tabular-nums">
            {t("holds", { cards: all.length, points })}
          </p>
        </div>
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
      </header>
      <BacklogToolbar
        grouping={grouping}
        onGrouping={setGrouping}
        showClosed={showClosed}
        onShowClosed={setShowClosed}
        anyOpen={folded.anyOpen}
        filtering={filtering}
        onFoldAll={() => (folded.anyOpen ? folded.closeAll() : folded.openAll(sectionIds(tree)))}
        filters={filters}
        onFilters={setFilters}
        members={full.members}
        structure={structure}
      />
      {scrum && (
        <SelectionBar
          count={backlogSelected}
          sprints={open}
          target={target}
          onTarget={setTarget}
          onCommit={() => void commit()}
          onClear={() => setSelected(new Set())}
        />
      )}
      {grouping === "hierarchy" ? (
        <HierarchyList tree={tree} rows={rows} />
      ) : (
        <GroupedList
          groups={grouped(full, stories, grouping, groupNames)}
          rows={rows}
          contextOf={contextOf}
        />
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
    <div className="grid gap-6 @5xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
