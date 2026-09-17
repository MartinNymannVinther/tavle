"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { segmentedTrack } from "@/components/ui/segmented";
import { structureOf } from "@/components/board/card-chips";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { FullscreenButton, useFullscreen } from "@/components/board/use-fullscreen";
import { AssistDialog } from "@/components/backlog/assist-dialog";
import { BootstrapDialog } from "@/components/backlog/bootstrap-dialog";
import { ItemForm } from "@/components/backlog/item-form";
import { isBareDecomposition } from "@/modules/ai/bare-backlog";
import { createCardAction, placeCardAction } from "@/modules/boards/actions-cards";
import { createItemAction, placeItemAction } from "@/modules/boards/actions-structure";
import { planFeatureAction } from "@/modules/boards/actions-sprints";
import type { BoardFull, CardView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { DecomposeTray } from "./decompose-tray";
import { EpicTree, FeatureTree, type DragItem } from "./decompose-tree";

/**
 * The decomposition as a surface to build on (docs/adr/0020, amended by
 * the owner to read as a chart): each epic drawn as a WBS tree — the
 * epic on top, features on a rail below it, cards below each feature,
 * joined by real connector lines. What has no parent waits in the tray
 * beside it, and a drag either way is the same placement every other
 * page writes. The backlog keeps the order; this page keeps the shape.
 */
export function DecomposeView({ full, aiAvailable }: { full: BoardFull; aiAvailable: boolean }) {
  const t = useTranslations("decompose");
  const { run } = useBoardActions();
  const { board } = full;
  const structure = structureOf(full);
  const { view } = structure;
  const [drag, setDrag] = useState<DragItem>(null);
  const screen = useFullscreen();
  // Zoom: the whole surface scales, tray included, so a big breakdown
  // can be read at a glance or a corner of it up close. CSS zoom keeps
  // layout and hit-testing honest, so every drag still lands right.
  const STEPS = [0.5, 0.65, 0.8, 1, 1.2] as const;
  const [zoom, setZoom] = useState(1);
  const step = (by: number) => {
    const at = STEPS.indexOf(zoom as (typeof STEPS)[number]);
    setZoom(STEPS[Math.min(STEPS.length - 1, Math.max(0, at + by))] ?? 1);
  };
  const epics = full.items
    .filter((i) => i.level === "epic" && i.state === "open")
    .sort((a, b) => a.sort - b.sort || a.number - b.number);
  const openEpicIds = new Set(epics.map((e) => e.id));
  const features = full.items
    .filter((i) => i.level === "feature" && i.state === "open")
    .sort((a, b) => a.sort - b.sort || a.number - b.number);
  const featuresOf = (epicId: string) => features.filter((f) => f.parentId === epicId);
  const looseFeatures = features.filter((f) => !f.parentId || !openEpicIds.has(f.parentId));
  const looseCards = full.cards.filter((c) => !c.featureId);
  const category = new Map(full.columns.map((c) => [c.id, c.category]));
  const cardsOf = (featureId: string) =>
    full.cards
      .filter((c) => c.featureId === featureId)
      .sort((a, b) => a.sort - b.sort || a.number - b.number);
  const doneOf = (card: CardView) => category.get(card.columnId) === "done";

  const h = {
    drag,
    setDrag,
    onPlaceFeature: (featureId: string, epicId: string | null) => {
      setDrag(null);
      void run(() => placeItemAction({ itemId: featureId, parentId: epicId }));
    },
    onPlaceCard: (cardId: string, featureId: string | null) => {
      setDrag(null);
      void run(() => placeCardAction({ cardId, featureId }));
    },
    onAddCard: (featureId: string, title: string) =>
      run(() => createCardAction({ boardId: board.id, title, featureId })),
    sprints: full.sprints
      .filter((s) => s.state !== "closed")
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    onPlanFeature: (featureId: string, sprintId: string | null) => {
      // One pick sets the end; a span that already has a start keeps it,
      // so choosing the bolded current sprint never collapses S1–S3 to S3.
      const item = full.items.find((i) => i.id === featureId);
      void run(() =>
        planFeatureAction({
          itemId: featureId,
          startSprintId: sprintId === null ? null : (item?.startSprintId ?? sprintId),
          targetSprintId: sprintId,
        }),
      );
    },
    onAddFeature: (epicId: string, title: string) =>
      run(() =>
        createItemAction({
          boardId: board.id,
          level: "feature",
          title,
          doneWhen: "",
          parentId: epicId,
        }),
      ),
  };

  return (
    <div className={cn("flex flex-col gap-4", screen.overlay)}>
      <div className="flex items-center justify-end gap-2">
        <div className={segmentedTrack}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("zoomOut")}
            disabled={zoom === STEPS[0]}
            onClick={() => step(-1)}
          >
            <ZoomOut />
          </Button>
          <span className="text-meta w-10 text-center text-xs tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("zoomIn")}
            disabled={zoom === STEPS[STEPS.length - 1]}
            onClick={() => step(1)}
          >
            <ZoomIn />
          </Button>
        </div>
        {/* The same slot and the same offer as the backlog's header. */}
        {isBareDecomposition(full.items) ? (
          <BootstrapDialog boardId={board.id} run={run} available={aiAvailable} />
        ) : (
          <AssistDialog boardId={board.id} run={run} available={aiAvailable} />
        )}
        <FullscreenButton fullscreen={screen.fullscreen} onToggle={screen.toggle} />
      </div>
      <div className="flex flex-col gap-4" style={{ zoom }}>
        <div className="-mx-5 min-w-0 flex-1 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:px-7 lg:mx-0 lg:px-0">
          {view.epics ? (
            // The epics side by side, one shared scroll; each tree folds
            // from its own nodes rather than fighting for the height.
            <div className="flex items-start gap-10">
              {epics.map((epic) => (
                <div key={epic.id} className="shrink-0 pb-1">
                  <EpicTree
                    epic={epic}
                    features={featuresOf(epic.id)}
                    boardKey={board.key}
                    boardId={board.id}
                    structure={structure}
                    cardsOf={cardsOf}
                    doneOf={doneOf}
                    h={h}
                  />
                </div>
              ))}
              <div className="shrink-0 pt-1">
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
              </div>
            </div>
          ) : (
            // Without epics the features are the top of the breakdown.
            <div className="flex flex-wrap items-start gap-8">
              {features.map((feature) => (
                <div key={feature.id} className="overflow-x-auto pb-1">
                  <FeatureTree
                    feature={feature}
                    boardKey={board.key}
                    boardId={board.id}
                    structure={structure}
                    cards={cardsOf(feature.id)}
                    doneOf={doneOf}
                    h={h}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DecomposeTray
          features={view.epics ? looseFeatures : []}
          cards={looseCards}
          boardKey={board.key}
          boardId={board.id}
          structure={structure}
          cardsOf={cardsOf}
          doneOf={doneOf}
          h={h}
        />
      </div>
      <TypeLegend types={legendTypes(view, ["bug"])} />
    </div>
  );
}
