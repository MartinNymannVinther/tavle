"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { StructureLookup } from "@/components/board/card-chips";
import type { CardView, ItemView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { CardNode, FeatureTree, type DecomposeHandlers } from "./decompose-tree";

/**
 * What has no parent, gathered where it can be seen and dragged into
 * the structure — and the place a drag out of the structure lands. The
 * tool never invents a container; this is the honest pile, named as
 * exactly that (ADR 0011 rule 3 keeps every one of them in an area).
 */
export function DecomposeTray({
  features,
  cards,
  boardKey,
  boardId,
  structure,
  cardsOf,
  doneOf,
  h,
}: {
  features: ItemView[];
  cards: CardView[];
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  cardsOf: (featureId: string) => CardView[];
  doneOf: (card: CardView) => boolean;
  h: DecomposeHandlers;
}) {
  const t = useTranslations("decompose");
  const [over, setOver] = useState(false);
  return (
    <aside
      aria-label={t("tray")}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node)) setOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!h.drag) return;
        if (h.drag.kind === "feature") h.onPlaceFeature(h.drag.id, null);
        else h.onPlaceCard(h.drag.id, null);
      }}
      className={cn(
        "border-border bg-secondary/40 flex w-full flex-col gap-3 rounded-xl border border-dashed p-3 transition-colors",
        over && "border-primary bg-accent/60",
      )}
    >
      <header>
        <h2 className="text-sm font-semibold">{t("tray")}</h2>
        <p className="text-meta text-[0.72rem]">{t("trayHint")}</p>
      </header>
      {features.length === 0 && cards.length === 0 && (
        <p className="border-border text-meta rounded-lg border border-dashed p-3 text-center text-xs">
          {t("trayEmpty")}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {features.map((feature) => (
          <FeatureTree
            key={feature.id}
            feature={feature}
            boardKey={boardKey}
            boardId={boardId}
            structure={structure}
            cards={cardsOf(feature.id)}
            doneOf={doneOf}
            h={h}
          />
        ))}
        <div className="flex flex-wrap items-start gap-1.5">
          {cards.map((card) => (
            <CardNode
              key={card.id}
              card={card}
              boardKey={boardKey}
              boardId={boardId}
              done={doneOf(card)}
              structure={structure}
              h={h}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
