"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createCardAction, moveCardAction } from "@/modules/boards/actions-cards";
import type { BoardFull, CardView } from "@/modules/boards/types";
import { placeInLane } from "@/modules/boards/ordering";
import {
  applyLaneLocally,
  assignmentFor,
  boardLanes,
  columnIndexFor,
  effectiveSwimlaneMode,
  laneKeyOf,
  type BoardLane,
} from "@/modules/boards/structure/swimlanes";
import type { SwimlaneAssignment } from "@/modules/boards/validation";
import { Link } from "@/i18n/navigation";
import { BoardColumn, type DropTarget, type LaneOption } from "./board-column";
import { applyFilters, BoardFilters, NO_FILTERS, type Filters } from "./board-filters";
import { structureOf } from "./card-chips";
import type { Place } from "./quick-add";
import { SprintHeader } from "./sprint-header";
import { legendTypes, ThemeLegend, TypeLegend } from "./type-legend";
import { useBoardActions } from "./use-board-actions";

/**
 * The board. Columns side by side, cards in each, dragged or moved by
 * menu; on a Kanban board with swimlanes (docs/adr/0017) the same columns
 * repeat as one row per lane, and a drag across lanes is the same move
 * with the lane's field written too. A move is applied to the local copy
 * first and rolled back if the server says no, so the board feels like a
 * board and not like a form.
 */
export function BoardView({ full, today }: { full: BoardFull; today: string }) {
  const t = useTranslations("boards.view");
  const kinds = useTranslations("boards.structure.kind");
  const { run } = useBoardActions();
  const [seed, setSeed] = useState(full.cards);
  const [cards, setCards] = useState(full.cards);
  if (seed !== full.cards) {
    // React's "adjust state on props" pattern: fresh rows from the server
    // replace the optimistic copy during render, without an effect.
    setSeed(full.cards);
    setCards(full.cards);
  }
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const { board, columns, members, activeSprint } = full;
  const structure = structureOf(full);
  const scrum = board.mode === "scrum";
  const onBoard = scrum ? cards.filter((c) => c.sprintId === activeSprint?.id) : cards;
  const visible = applyFilters(onBoard, filters);
  const planned = full.sprints.filter((s) => s.state === "planned");

  const laneMode = effectiveSwimlaneMode(board);
  const lanes = boardLanes(
    laneMode,
    { themes: full.themes, areas: full.areas },
    full.swimlanes,
    onBoard,
  );
  const laneLabel = (lane: BoardLane) =>
    lane.name ??
    (lane.key === "business" || lane.key === "enabler"
      ? kinds(lane.key)
      : t(`laneWithout_${laneMode}`));
  const laneOptions: LaneOption[] = lanes
    .filter((lane) => assignmentFor(laneMode, lane.key) !== null)
    .map((lane) => ({ key: lane.key, label: laneLabel(lane) }));

  function lane(columnId: string): CardView[] {
    return onBoard
      .filter((c) => c.columnId === columnId)
      .sort((a, b) => a.sort - b.sort || a.number - b.number);
  }

  function cell(columnId: string, laneKey: string | null): CardView[] {
    return lane(columnId).filter((c) => laneKeyOf(c, laneMode, full.themes) === laneKey);
  }

  function moveLocally(
    cardId: string,
    columnId: string,
    index: number | undefined,
    assignment?: SwimlaneAssignment,
  ) {
    setCards((current) => {
      const card = current.find((c) => c.id === cardId);
      if (!card) return current;
      const target = current
        .filter((c) => c.columnId === columnId && c.id !== cardId && c.sprintId === card.sprintId)
        .sort((a, b) => a.sort - b.sort || a.number - b.number);
      const changes = new Map(placeInLane(target, cardId, index).map((c) => [c.id, c.sort]));
      const column = columns.find((c) => c.id === columnId);
      return current.map((c) => {
        if (c.id === cardId) {
          const moved = {
            ...c,
            columnId,
            sort: changes.get(c.id) ?? c.sort,
            doneAt: column?.category === "done" ? (c.doneAt ?? new Date()) : null,
          };
          return assignment ? applyLaneLocally(moved, assignment, full.themes) : moved;
        }
        return changes.has(c.id) ? { ...c, sort: changes.get(c.id)! } : c;
      });
    });
  }

  async function move(
    cardId: string,
    columnId: string,
    index?: number,
    assignment?: SwimlaneAssignment,
  ) {
    const before = cards;
    moveLocally(cardId, columnId, index, assignment);
    const ok = await run(() => moveCardAction({ cardId, columnId, index, swimlane: assignment }));
    if (!ok) setCards(before);
  }

  function onDrop(columnId: string, index: number) {
    const id = dragId;
    const targetLane = dropTarget?.laneKey ?? null;
    setDragId(null);
    setDropTarget(null);
    if (!id) return;
    // An index counted among the visible cards is also an index among the
    // lane's cards unless a filter hides some; then the end is the honest
    // place, and the person can drag again with the filter cleared.
    const filtered = visible.length !== onBoard.length;
    if (laneMode === "none") {
      void move(id, columnId, filtered ? undefined : index);
      return;
    }
    const card = onBoard.find((c) => c.id === id);
    if (!card) return;
    let assignment: SwimlaneAssignment | undefined;
    if (laneKeyOf(card, laneMode, full.themes) !== targetLane) {
      const across = assignmentFor(laneMode, targetLane);
      // The themes' "without" row takes no drops: a drop cannot say which
      // themes to take away. The drag simply falls back where it was.
      if (!across) return;
      assignment = across;
    }
    const at = filtered
      ? undefined
      : columnIndexFor(lane(columnId), cell(columnId, targetLane), index);
    void move(id, columnId, at, assignment);
  }

  async function add(columnId: string, title: string, place: Place, laneKey: string | null) {
    // A card added inside a lane starts in that lane; the "without" rows
    // and a hidden quick-add choice add nothing.
    const inLane =
      laneMode === "kind" && laneKey
        ? { kind: laneKey as "business" | "enabler" }
        : laneMode === "theme" && laneKey
          ? { themeIds: [laneKey] }
          : laneMode === "area" && laneKey
            ? { areaId: laneKey }
            : laneMode === "manual" && laneKey
              ? { swimlaneId: laneKey }
              : {};
    return run(() =>
      createCardAction({
        boardId: board.id,
        title,
        columnId,
        sprintId: activeSprint?.id ?? null,
        ...place,
        ...inLane,
      }),
    );
  }

  if (scrum && !activeSprint) {
    return (
      <EmptyState
        title={t("noSprintTitle")}
        hint={t("noSprintBody")}
        action={
          <Link href={`/boards/${board.id}/backlog`} className={buttonVariants({ size: "sm" })}>
            {t("noSprintCta")}
          </Link>
        }
      />
    );
  }

  const donePoints = onBoard
    .filter((c) => columns.find((col) => col.id === c.columnId)?.category === "done")
    .reduce((total, c) => total + (c.estimate ?? 0), 0);
  const totalPoints = onBoard.reduce((total, c) => total + (c.estimate ?? 0), 0);
  const doneCards = onBoard.filter(
    (c) => columns.find((col) => col.id === c.columnId)?.category === "done",
  ).length;

  const columnStrip = (laneKey: string | null, withLanes: boolean) => (
    <div className="flex items-start gap-3" style={{ minWidth: `${columns.length * 17.75}rem` }}>
      {columns.map((column) => (
        <BoardColumn
          key={column.id}
          column={column}
          cards={applyFilters(withLanes ? cell(column.id, laneKey) : lane(column.id), filters)}
          boardKey={board.key}
          boardId={board.id}
          structure={structure}
          columns={columns}
          today={today}
          laneKey={laneKey}
          laneOptions={withLanes ? laneOptions : undefined}
          wipCount={withLanes ? lane(column.id).length : undefined}
          dragId={dragId}
          dropTarget={dropTarget}
          setDropTarget={setDropTarget}
          onDragStart={setDragId}
          onDragEnd={() => {
            setDragId(null);
            setDropTarget(null);
          }}
          onDrop={onDrop}
          onMove={(cardId, columnId, index) => void move(cardId, columnId, index)}
          onMoveToLane={
            withLanes
              ? (cardId, key) => {
                  const card = onBoard.find((c) => c.id === cardId);
                  const assignment = assignmentFor(laneMode, key);
                  if (!card || !assignment) return;
                  void move(cardId, card.columnId, undefined, assignment);
                }
              : undefined
          }
          onAdd={add}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {scrum && activeSprint && (
        <SprintHeader
          sprint={activeSprint}
          planned={planned}
          boardId={board.id}
          today={today}
          donePoints={donePoints}
          totalPoints={totalPoints}
          doneCards={doneCards}
          totalCards={onBoard.length}
          run={run}
        />
      )}
      <BoardFilters
        filters={filters}
        onChange={setFilters}
        members={members}
        structure={structure}
      />
      <div className="-mx-5 overflow-x-auto px-5 pb-4 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8">
        {laneMode === "none" ? (
          columnStrip(null, false)
        ) : (
          <div className="flex flex-col gap-5">
            {lanes.map((swimlane) => (
              <section key={swimlane.key ?? ""} aria-label={laneLabel(swimlane)}>
                <h2 className="text-label mb-2 text-[0.72rem] font-semibold tracking-wide uppercase">
                  {laneLabel(swimlane)}
                </h2>
                {columnStrip(swimlane.key, true)}
              </section>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <TypeLegend types={legendTypes({ ...structure.view, epics: false }, ["bug"])} />
        {structure.view.themes && <ThemeLegend themes={structure.themes} />}
      </div>
    </div>
  );
}
