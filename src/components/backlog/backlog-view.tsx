"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedChoice } from "@/components/ui/segmented";
import { useTranslations } from "next-intl";
import { applyFilters, NO_FILTERS, type Filters } from "@/components/board/board-filters";
import { structureOf } from "@/components/board/card-chips";
import { QuickAdd } from "@/components/board/quick-add";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { cn } from "@/lib/utils";
import type { BoardFull, CardView } from "@/modules/boards/types";
import {
  createCardAction,
  placeCardAction,
  placeCardsAction,
  updateCardAction,
} from "@/modules/boards/actions-cards";
import { reorderItemAction } from "@/modules/boards/actions-structure";
import { reorderBacklogAction, setCardsSprintAction } from "@/modules/boards/actions-sprints";
import { FeaturePlanFields } from "@/components/item/feature-plan-fields";
import { BacklogHeader } from "./backlog-header";
import { BacklogHeading } from "./backlog-heading";
import { BacklogList, type StoryRowProps } from "./backlog-list";
import { BacklogNav, BacklogNavSelect } from "./backlog-nav";
import {
  crumbFor,
  crumbOf,
  navCounts,
  selectExtra,
  selectStories,
  stillThere,
} from "./backlog-selection";
import { useChosen } from "./use-chosen";
import { BacklogToolbar } from "./backlog-toolbar";
import {
  allocatedStories,
  backlogStories,
  grouped,
  hierarchy,
  type Group,
  type Grouping,
} from "./group-backlog";
import { GroupedList } from "./grouped-list";
import { ItemForm } from "./item-form";
import { ItemBacklog } from "./item-backlog";
import { SelectionBar } from "./selection-bar";
import { SprintColumn } from "./sprint-column";
import { useFolded } from "./use-folded";
import { usePref } from "./use-pref";

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
export function BacklogView({ full, aiAvailable }: { full: BoardFull; aiAvailable: boolean }) {
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
  // Cards made here since the filter was last touched. A card written
  // under a filter it does not pass would otherwise be indistinguishable
  // from a card that was never written at all — the form clears, nothing
  // appears, and the person types the sentence again.
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  // The backlog's altitude (docs/adr/0027) and whether the sprints stand
  // beside it — both remembered per board, like the folds.
  const [levelPref, setLevelPref] = usePref<"epics" | "features" | "cards">(
    `tavle.backlog.${board.id}.level`,
    "cards",
  );
  const [sprintsPref, setSprintsPref] = usePref<"on" | "off">(
    `tavle.backlog.${board.id}.sprints`,
    "on",
  );
  const [navPref, setNavPref] = usePref<"on" | "off">(`tavle.backlog.${board.id}.nav`, "on");

  const all = backlogStories(full);
  /** The filter's answer, plus whatever was just made here. */
  const shown = (list: CardView[]): CardView[] => {
    const kept = applyFilters(list, filters, board.key);
    if (justAdded.length === 0) return kept;
    const ids = new Set(kept.map((card) => card.id));
    return list.filter((card) => ids.has(card.id) || justAdded.includes(card.id));
  };
  const filtered = shown(all);
  const { view } = structure;
  const tree = hierarchy(full, all, { showClosed, items: structure.items });
  const selection = stillThere(chosen, tree);
  const stories = selectStories(filtered, tree, selection);
  const counts = navCounts(tree);
  // Committed cards stay in the backlog's sight, marked with their sprint.
  const allocated = allocatedStories(full);
  const allocatedShown = selectExtra(shown(allocated), tree, selection);
  const sprintNameOf = new Map(sprints.map((sp) => [sp.id, sp.name]));
  const open = sprints.filter((sp) => sp.state !== "closed").sort((a, b) => a.number - b.number);
  const active = sprints.find((sp) => sp.state === "active") ?? null;
  // The chosen sprint holds as long as it exists; otherwise the first
  // open one steps in — a first sprint created on this very page must be
  // committable without a reload.
  const [target, setTarget] = useState<string>(open[0]?.id ?? "");
  const commitTarget = open.some((sp) => sp.id === target) ? target : (open[0]?.id ?? "");
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
    if (backlogIds.length === 0 || !commitTarget) return;
    const ok = await run(() =>
      setCardsSprintAction({ cardIds: backlogIds, sprintId: commitTarget }),
    );
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

  /**
   * The backlog's own order is the only order; a nudge is a move past the
   * row beside it — which may be a row promised to a sprint, standing at
   * its rank among the free ones (docs/adr/0033). The service ranks
   * against the whole priority, so one step is one row of what is read.
   */
  function nudge(cardId: string, siblingId: string, after: boolean) {
    void run(() => reorderBacklogAction({ cardId, siblingId, after }));
  }

  /** A card promised to a sprint, dragged: the promise is what a drop takes back. */
  const committedDrag = (cardId: string) =>
    Boolean(full.cards.find((c) => c.id === cardId)?.sprintId);

  /** Takes the promise back, then does whatever the drop meant on top of it. */
  async function release(cardId: string): Promise<boolean> {
    return run(() => setCardsSprintAction({ cardIds: [cardId], sprintId: null }));
  }

  function dropOn(targetId: string, after: boolean) {
    const id = dragId;
    setDragId(null);
    if (!id || id === targetId) return;
    // Dragged out of a sprint and onto a row: the card comes back to the
    // backlog and lands where it was dropped, in that order.
    if (committedDrag(id)) {
      void release(id).then((ok) => {
        if (ok) nudge(id, targetId, after);
      });
      return;
    }
    nudge(id, targetId, after);
  }

  /** A card dropped on a sprint: the same promise the selection bar's button makes. */
  function dropInSprint(sprintId: string) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const card = full.cards.find((c) => c.id === id);
    if (!card || card.sprintId === sprintId) return;
    void run(() => setCardsSprintAction({ cardIds: [id], sprintId }));
  }

  /** A card dropped on a backlog with no rows to land between. */
  function dropOut() {
    const id = dragId;
    setDragId(null);
    if (id && committedDrag(id)) void release(id);
  }

  /** A card dropped into another group: the group's field first, then the spot it was dropped on. */
  async function moveCardToGroup(
    cardId: string,
    groupKey: string,
    siblingId: string | null,
    after: boolean,
  ) {
    const card = full.cards.find((c) => c.id === cardId);
    if (!card || grouping === "list") return;
    // Out of the sprint first: a group says which field, never which sprint.
    if (card.sprintId && !(await release(cardId))) return;
    const ok = await run(() =>
      grouping === "theme"
        ? placeCardAction({
            cardId,
            themeIds: [groupKey, ...card.themeIds.filter((themeId) => themeId !== groupKey)],
          })
        : grouping === "area"
          ? placeCardAction({ cardId, areaId: groupKey })
          : updateCardAction({ cardId, kind: groupKey as "business" | "enabler" }),
    );
    if (ok && siblingId && siblingId !== cardId) nudge(cardId, siblingId, after);
  }

  /** A card dragged to another feature's fold-out: placement first, then the spot it was dropped on. */
  async function moveCardToFeature(
    cardId: string,
    featureId: string,
    siblingId: string | null,
    after: boolean,
  ) {
    const card = full.cards.find((c) => c.id === cardId);
    if (!card) return;
    if (card.featureId !== featureId) {
      const ok = await run(() => placeCardAction({ cardId, featureId }));
      if (!ok) return;
    }
    if (siblingId && siblingId !== cardId) nudge(cardId, siblingId, after);
  }

  const rank = (itemId: string, siblingId: string, after: boolean) =>
    void run(() => reorderItemAction({ itemId, siblingId, after }));

  const levelChoice =
    levelPref === "epics" && view.epics
      ? "epics"
      : levelPref === "features" && view.features
        ? "features"
        : "cards";

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
    fromSprint: committedDrag,
    onDropOut: dropOut,
    // Only the whole backlog can take a card back on its own terms; a
    // group writes its field instead, and a narrowed list would hide the
    // card it just drew a line for.
    adopts: grouping === "list" && selection.kind === "all",
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
        aiAvailable={aiAvailable}
      />
      {(view.features || scrum) && (
        <div className="border-hairline flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2">
          {view.features && levelChoice === "cards" && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-pressed={navPref === "on"}
              aria-label={navPref === "on" ? t("hideNav") : t("showNav")}
              title={navPref === "on" ? t("hideNav") : t("showNav")}
              className="text-meta @max-2xl:hidden"
              onClick={() => setNavPref(navPref === "on" ? "off" : "on")}
            >
              {navPref === "on" ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          )}
          {view.features && (
            <SegmentedChoice
              value={levelChoice}
              onChange={setLevelPref}
              label={t("level.label")}
              options={[
                ...(view.epics ? [{ value: "epics" as const, label: t("level.epics") }] : []),
                { value: "features" as const, label: t("level.features") },
                { value: "cards" as const, label: t("level.cards") },
              ]}
              className="w-fit"
            />
          )}
          {levelChoice !== "cards" && (
            <label className="text-meta flex items-center gap-1.5 text-2sm">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(event) => setShowClosed(event.target.checked)}
                className="accent-[var(--primary)]"
              />
              {t("nav.showClosed")}
            </label>
          )}
          <span className="flex-1" />
          {scrum && (
            <label className="text-meta flex items-center gap-1.5 text-2sm">
              <input
                type="checkbox"
                checked={sprintsPref === "on"}
                onChange={(event) => setSprintsPref(event.target.checked ? "on" : "off")}
                className="accent-[var(--primary)]"
              />
              {t("showSprints")}
            </label>
          )}
        </div>
      )}
      {levelChoice !== "cards" ? (
        <ItemBacklog
          full={full}
          level={levelChoice === "epics" ? "epic" : "feature"}
          structure={structure}
          tree={tree}
          run={run}
          onRankItem={rank}
          onNudgeCard={nudge}
          onMoveCard={(cardId, featureId, siblingId, after) =>
            void moveCardToFeature(cardId, featureId, siblingId, after)
          }
          allocated={allocated}
          sprintNameOf={sprintNameOf}
          newFeature={newFeature}
        />
      ) : (
        <div
          className={cn(
            "grid",
            view.features && navPref === "on" && "@2xl:grid-cols-[17rem_minmax(0,1fr)]",
          )}
        >
          {view.features && navPref === "on" && (
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
            <div
              className={cn(
                "border-hairline border-b px-4 pt-3 pb-2",
                navPref === "on" && "@2xl:hidden",
              )}
            >
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
              featurePlan={
                scrum
                  ? (feature) => (
                      <FeaturePlanFields item={feature} sprints={full.sprints} run={run} />
                    )
                  : undefined
              }
            />
            <BacklogToolbar
              grouping={grouping}
              onGrouping={setGrouping}
              filters={filters}
              onFilters={(next) => {
                setFilters(next);
                // Looking again: the cards held out of the filter go back
                // to obeying it.
                setJustAdded([]);
              }}
              people={full.people}
              structure={structure}
            />
            <SelectionBar
              count={backlogIds.length}
              scrum={scrum}
              sprints={scrum ? open : []}
              target={commitTarget}
              onTarget={setTarget}
              onCommit={() => void commit()}
              features={view.features ? openFeatures : []}
              onPlace={(featureId) => void place(featureId)}
              onClear={() => setSelected(new Set())}
            />
            <div className="border-hairline border-b px-2 py-2">
              <QuickAdd
                onAdd={(title, place) =>
                  run(
                    () => createCardAction({ boardId: board.id, title, ...place }),
                    (created) => setJustAdded((ids) => [...ids, created.id]),
                  )
                }
                structure={structure}
                placeholder={t("addPlaceholder")}
                defaultWhere={quickAddWhere}
                boardId={board.id}
                boardKey={board.key}
              />
            </div>
            {grouping === "list" ? (
              <BacklogList
                stories={stories}
                rows={rows}
                allocated={allocatedShown}
                sprintNameOf={sprintNameOf}
                emptyText={all.length === 0 ? t("empty") : undefined}
              />
            ) : (
              <GroupedList
                groups={grouped(full, stories, grouping, groupNames)}
                rows={rows}
                contextOf={contextOf}
                groupDropOf={(group) =>
                  // "none" cannot be assigned by a drop — a drop cannot say
                  // which theme or area to take away, only which to give.
                  group.key === "none"
                    ? undefined
                    : {
                        onDrop: (cardId, siblingId, after) =>
                          void moveCardToGroup(cardId, group.key, siblingId, after),
                      }
                }
              />
            )}
          </div>
        </div>
      )}
      <TypeLegend types={legendTypes(view)} className="border-hairline border-t px-4 py-2" />
    </section>
  );

  if (!scrum || sprintsPref === "off") return list;

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
        aiAvailable={aiAvailable}
        drag={{ id: dragId, setId: setDragId, onDrop: dropInSprint }}
        run={run}
      />
    </div>
  );
}
