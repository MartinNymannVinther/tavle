"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { structureOf } from "@/components/board/card-chips";
import { legendTypes, TypeLegend } from "@/components/board/type-legend";
import { useBoardActions } from "@/components/board/use-board-actions";
import { BootstrapDialog } from "@/components/backlog/bootstrap-dialog";
import { ItemForm } from "@/components/backlog/item-form";
import { createCardAction, placeCardAction } from "@/modules/boards/actions-cards";
import { createItemAction, placeItemAction } from "@/modules/boards/actions-structure";
import type { BoardFull, CardView } from "@/modules/boards/types";
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
export function DecomposeView({ full }: { full: BoardFull }) {
  const t = useTranslations("decompose");
  const { run } = useBoardActions();
  const { board } = full;
  const structure = structureOf(full);
  const { view } = structure;
  const [drag, setDrag] = useState<DragItem>(null);

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
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <BootstrapDialog boardId={board.id} run={run} />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="-mx-5 min-w-0 flex-1 overflow-x-auto px-5 pb-2 sm:-mx-7 sm:px-7 lg:mx-0 lg:px-0">
          {view.epics ? (
            <div className="flex flex-col gap-10">
              {epics.map((epic) => (
                <div key={epic.id} className="overflow-x-auto pb-1">
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
              <div>
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
