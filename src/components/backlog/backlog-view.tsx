"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { applyFilters, NO_FILTERS, type Filters } from "@/components/board/board-filters";
import { structureOf } from "@/components/board/card-chips";
import { QuickAdd } from "@/components/board/quick-add";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { cn } from "@/lib/utils";
import type { BoardFull } from "@/modules/boards/types";
import {
  createCardAction,
  placeCardAction,
  placeCardsAction,
} from "@/modules/boards/actions-cards";
import { reorderItemAction } from "@/modules/boards/actions-structure";
import { reorderBacklogAction, setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { BacklogHeader } from "./backlog-header";
import { BacklogHeading } from "./backlog-heading";
import { BacklogList, type StoryRowProps } from "./backlog-list";
import { BacklogNav, BacklogNavSelect } from "./backlog-nav";
import { crumbFor, crumbOf, navCounts, selectStories, stillThere } from "./backlog-selection";
import { useChosen } from "./use-chosen";
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
  const [chosen, choose] = useChosen();
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

  // Only the backlog's own ticks: the sprint panels share the selection
  // set, and neither gesture should quietly take their cards along.
  const backlogIds = all.filter((c) => selected.has(c.id)).map((c) => c.id);

  async function commit() {
    if (backlogIds.length === 0 || !target) return;
    const ok = await run(() => setCardsSprintAction({ cardIds: backlogIds, sprintId: target }));
    if (ok) setSelected(new Set());
  }

  async function place(featureId: string | null) {
    if (backlogIds.length === 0) return;
    const ok = await run(() => placeCardsAction({ cardIds: backlogIds, featureId }));
    if (ok) setSelected(new Set());
  }

  /** A card dropped on the navigator: the same placement as the story map's drag. */
  function dropOnNav(featureId: string | null) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    void run(() => placeCardAction({ cardId: id, featureId }));
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
    onSelect: select,
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
  /** After a create the page follows the new item: epic unfolded, node chosen, quick add primed. */
  const follow = (level: "epic" | "feature") => (item: { id: string; parentId: string | null }) => {
    if (item.parentId) folded.unfold(item.parentId);
    choose({ kind: level, id: item.id });
  };
  const newFeature = (epicId: string) => (
    <ItemForm
      full={full}
      level="feature"
      parentId={epicId}
      run={run}
      onCreated={follow("feature")}
      trigger={
        <button type="button" className="text-meta hover:text-foreground font-medium">
          + {t("newFeature")}
        </button>
      }
    />
  );
  const openFeatures = structure.items.filter((i) => i.level === "feature" && i.state === "open");
  const navProps = {
    tree,
    counts,
    total: all.length,
    selection,
    onSelect: choose,
  };
  const quickAddWhere =
    selection.kind === "feature"
      ? `f:${selection.id}`
      : heading?.areaId
        ? `a:${heading.areaId}`
        : undefined;

  const list = (
    <section className="border-border bg-card @container flex min-w-0 flex-col rounded-xl border shadow-[var(--surface-shadow)]">
      <BacklogHeader
        full={full}
        view={view}
        all={all}
        selection={selection}
        run={run}
        follow={follow}
      />
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
              onDropCard={dropOnNav}
              newFeature={newFeature}
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
          <SelectionBar
            count={backlogIds.length}
            scrum={scrum}
            sprints={scrum ? open : []}
            target={target}
            onTarget={setTarget}
            onCommit={() => void commit()}
            features={view.features ? openFeatures : []}
            onPlace={(featureId) => void place(featureId)}
            onClear={() => setSelected(new Set())}
          />
          <div className="border-hairline border-b px-2 py-2">
            <QuickAdd
              onAdd={(title, place) =>
                run(() => createCardAction({ boardId: board.id, title, ...place }))
              }
              structure={structure}
              placeholder={t("addPlaceholder")}
              defaultWhere={quickAddWhere}
            />
          </div>
          {grouping === "list" ? (
            <BacklogList
              stories={stories}
              rows={rows}
              emptyText={all.length === 0 ? t("empty") : undefined}
            />
          ) : (
            <GroupedList
              groups={grouped(full, stories, grouping, groupNames)}
              rows={rows}
              contextOf={contextOf}
            />
          )}
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
