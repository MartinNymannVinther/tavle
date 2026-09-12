"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { applyFilters, NO_FILTERS, type Filters } from "@/components/board/board-filters";
import { structureOf } from "@/components/board/card-chips";
import { QuickAdd } from "@/components/board/quick-add";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { cn } from "@/lib/utils";
import type { BoardFull } from "@/modules/boards/types";
import { createCardAction } from "@/modules/boards/actions-cards";
import { reorderItemAction } from "@/modules/boards/actions-structure";
import { reorderBacklogAction, setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { BacklogHeading } from "./backlog-heading";
import { BacklogList, type StoryRowProps } from "./backlog-list";
import { BacklogNav, BacklogNavSelect } from "./backlog-nav";
import {
  ALL,
  crumbFor,
  crumbOf,
  navCounts,
  selectStories,
  selectionKey,
  stillThere,
  type Selection,
} from "./backlog-selection";
import { BacklogToolbar } from "./backlog-toolbar";
import { backlogStories, grouped, hierarchy, type Group, type Grouping } from "./group-backlog";
import { GroupedList } from "./grouped-list";
import { ItemForm } from "./item-form";
import { SelectionBar } from "./selection-bar";
import { SprintColumn } from "./sprint-column";
import { useFolded } from "./use-folded";

/**
 * The backlog: the decomposition as a navigator on the left and the
 * stories as one flat list on the right, in the backlog's own order.
 * The navigator narrows the list to an epic, a feature or what has no
 * parent; the list can also be grouped by theme, area or kind, and
 * filtered. On a Scrum board the sprints stand beyond the list and
 * ticked stories are committed to one from a bar that appears with the
 * first tick; on a Kanban board there is nothing to tick. The order is
 * one order: the arrows move a story past its neighbour in the list,
 * which is the same move in the whole backlog.
 */
export function BacklogView({ full }: { full: BoardFull }) {
  const t = useTranslations("backlog");
  const g = useTranslations("backlog.grouping");
  const s = useTranslations("boards.structure");
  const { run } = useBoardActions();
  const { board, sprints } = full;
  const scrum = board.mode === "scrum";
  const structure = structureOf(full);
  const folded = useFolded(board.id);
  const [chosen, setChosen] = useState<Selection>(ALL);
  const [grouping, setGrouping] = useState<Grouping>("list");
  const [showClosed, setShowClosed] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);

  const all = backlogStories(full);
  const filtered = applyFilters(all, filters);
  const { view } = structure;
  const tree = hierarchy(full, all, { showClosed, items: structure.items });
  const selection = stillThere(chosen, tree);
  const stories = selectStories(filtered, tree, selection);
  const counts = navCounts(tree);
  const open = sprints.filter((sp) => sp.state !== "closed").sort((a, b) => a.number - b.number);
  const active = sprints.find((sp) => sp.state === "active") ?? null;
  const [target, setTarget] = useState<string>(open[0]?.id ?? "");
  const points = stories.reduce((total, c) => total + (c.estimate ?? 0), 0);

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

  const rank = (itemId: string, siblingId: string, after: boolean) =>
    void run(() => reorderItemAction({ itemId, siblingId, after }));

  const heading =
    selection.kind === "epic"
      ? tree.epics.find((n) => n.epic.id === selection.id)?.epic
      : selection.kind === "feature"
        ? full.items.find((i) => i.id === selection.id)
        : undefined;

  const rows: StoryRowProps = {
    boardKey: board.key,
    boardId: board.id,
    structure,
    selected,
    onSelect: scrum ? select : undefined,
    onNudge: nudge,
    dragId,
    setDragId,
    onDropOn: dropOn,
    crumbOf: (card) => crumbFor(crumbOf(card, structure.items), selection),
    context: heading ? { areaId: heading.areaId, themeIds: heading.themeIds } : undefined,
  };
  const groupNames = { none: g("none"), business: s("kind.business"), enabler: s("kind.enabler") };
  const contextOf = (group: Group) =>
    grouping === "theme" && group.key !== "none"
      ? { themeIds: [group.key] }
      : grouping === "area" && group.key !== "none"
        ? { areaId: group.key }
        : undefined;
  const backlogSelected = all.filter((c) => selected.has(c.id)).length;
  const newFeature = (epicId: string) => (
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
  );
  const navProps = {
    tree,
    counts,
    total: all.length,
    selection,
    onSelect: setChosen,
  };
  const quickAddWhere =
    selection.kind === "feature"
      ? `f:${selection.id}`
      : heading?.areaId
        ? `a:${heading.areaId}`
        : undefined;

  const list = (
    <section className="border-border bg-card @container flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]">
      <header className="border-hairline flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-meta text-sm tabular-nums">
            {t("holds", {
              cards: all.length,
              points: all.reduce((total, c) => total + (c.estimate ?? 0), 0),
            })}
          </p>
        </div>
        {view.epics && (
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
        )}
        {view.features && (
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
        )}
      </header>
      <div className={cn("grid", view.features && "@2xl:grid-cols-[17rem_minmax(0,1fr)]")}>
        {view.features && (
          <aside className="bg-secondary/60 border-hairline hidden border-r p-2 @2xl:block">
            <BacklogNav
              {...navProps}
              isOpen={folded.isOpen}
              toggle={folded.toggle}
              showClosed={showClosed}
              onShowClosed={setShowClosed}
              onRank={rank}
            />
          </aside>
        )}
        {view.features && (
          <div className="border-hairline border-b px-4 pt-3 @2xl:hidden">
            <BacklogNavSelect {...navProps} />
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <BacklogHeading
            selection={selection}
            tree={tree}
            boardKey={board.key}
            boardId={board.id}
            structure={structure}
            reviewDays={board.epicReviewDays}
            cards={stories.length}
            points={points}
            newFeature={newFeature}
          />
          <BacklogToolbar
            grouping={grouping}
            onGrouping={setGrouping}
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
          {grouping === "list" ? (
            <BacklogList stories={stories} rows={rows} />
          ) : (
            <GroupedList
              groups={grouped(full, stories, grouping, groupNames)}
              rows={rows}
              contextOf={contextOf}
            />
          )}
          <div className="border-hairline mt-auto border-t px-2 py-2">
            <QuickAdd
              key={selectionKey(selection)}
              onAdd={(title, place) =>
                run(() => createCardAction({ boardId: board.id, title, ...place }))
              }
              structure={structure}
              placeholder={t("addPlaceholder")}
              defaultWhere={quickAddWhere}
            />
          </div>
        </div>
      </div>
      <TypeLegend types={legendTypes(view)} className="border-hairline border-t px-4 py-2" />
    </section>
  );

  if (!scrum) return list;

  return (
    <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_20rem]">
      {list}
      <SprintColumn
        full={full}
        sprints={open}
        active={active}
        structure={structure}
        selected={selected}
        onSelect={select}
        run={run}
      />
    </div>
  );
}
