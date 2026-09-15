"use client";

import { useTranslations } from "next-intl";
import type { StructureLookup } from "@/components/board/card-chips";
import { reviewDue } from "@/modules/boards/structure/rules";
import type { Selection } from "./backlog-selection";
import { epicProgress, featureProgress, type Hierarchy } from "./group-backlog";
import { ItemHeading } from "./item-row";

/**
 * What the list is showing, said once above it: the whole backlog, an
 * epic or a feature with everything the rows then need not repeat, or
 * what has no parent.
 */
export function BacklogHeading({
  selection,
  tree,
  boardKey,
  boardId,
  structure,
  reviewDays,
  cards,
  points,
  newFeature,
  featurePlan,
}: {
  selection: Selection;
  tree: Hierarchy;
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  reviewDays: number;
  /** The stories and points the list holds under this selection. */
  cards: number;
  points: number;
  /** The form that starts a feature under an epic, rendered by the page. */
  newFeature?: (epicId: string) => React.ReactNode;
  /** The chosen feature's planned span, rendered by the page (docs/adr/0023). */
  featurePlan?: (feature: import("@/modules/boards/types").ItemView) => React.ReactNode;
}) {
  const t = useTranslations("backlog");
  const h = useTranslations("backlog.heading");
  const nav = useTranslations("backlog.nav");

  if (selection.kind === "epic") {
    const node = tree.epics.find((n) => n.epic.id === selection.id);
    if (!node) return null;
    return (
      <ItemHeading
        item={node.epic}
        boardKey={boardKey}
        boardId={boardId}
        structure={structure}
        reviewDue={reviewDue(node.epic, reviewDays)}
        progress={epicProgress(node)}
        counts={h("epicCounts", {
          unit: structure.estimateUnit,
          features: node.features.length,
          cards,
          points,
        })}
        action={node.epic.state === "open" ? newFeature?.(node.epic.id) : undefined}
      />
    );
  }
  if (selection.kind === "feature") {
    const node =
      tree.epics.flatMap((n) => n.features).find((f) => f.feature.id === selection.id) ??
      tree.looseFeatures.find((f) => f.feature.id === selection.id);
    if (!node) return null;
    const progress = featureProgress(node);
    return (
      <ItemHeading
        item={node.feature}
        boardKey={boardKey}
        boardId={boardId}
        structure={structure}
        reviewDue={false}
        progress={progress}
        counts={h("featureCounts", {
          unit: structure.estimateUnit,
          cards,
          points,
          open: progress.open,
        })}
        action={node.feature.state === "open" ? featurePlan?.(node.feature) : undefined}
      />
    );
  }
  if (selection.kind === "all") return null;
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <h2 className="text-reading leading-snug font-semibold">{nav("noParent")}</h2>
      <p className="text-meta text-2sm tabular-nums">
        {h("looseHint")} · {t("holds", { unit: structure.estimateUnit, cards, points })}
      </p>
    </div>
  );
}
