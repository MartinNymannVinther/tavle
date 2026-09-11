"use client";

import { CircleDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ChipContext, StructureLookup } from "@/components/board/card-chips";
import type { CardView } from "@/modules/boards/types";
import { reviewDue } from "@/modules/boards/structure/rules";
import { FoldButton } from "./backlog-bits";
import { BacklogRow } from "./backlog-row";
import {
  epicProgress,
  featureProgress,
  type EpicNode,
  type FeatureNode,
  type Hierarchy,
} from "./group-backlog";
import { EpicHeader, FeatureLine } from "./item-row";

/**
 * The backlog as the hierarchy: each epic a section that folds, its
 * features as blocks under it with their stories, and at the bottom a
 * section for what has no parent, named as exactly that. The story row
 * is shared with the grouped views and the sprints, and it is the thing
 * that can be selected for a sprint.
 */
export const LOOSE = "loose";

export type StoryRowProps = {
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  reviewDays: number;
  selected: Set<string>;
  /** Ticks a story for a sprint; absent on a board without sprints, and then no box is drawn. */
  onSelect?: (cardId: string, checked: boolean) => void;
  /** Moves a story before or after a sibling in the backlog's one order. */
  onNudge: (cardId: string, siblingId: string, after: boolean) => void;
  /** Ranks an epic or feature before or after a sibling of its level. */
  onRank: (itemId: string, siblingId: string, after: boolean) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDropOn: (targetId: string) => void;
  /** Sections are closed unless folded out; features open unless folded in. */
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  /** The form that starts a feature under the epic, rendered by the page. */
  newFeature?: (epicId: string) => React.ReactNode;
};

const featureKey = (id: string) => `f:${id}`;

/** The state while a filter is on: every section open, every feature too, so what matches is seen. */
export const ALL_OPEN = (id: string) => !id.startsWith("f:");

export function StoryRows({
  stories,
  rows,
  context,
}: {
  stories: CardView[];
  rows: StoryRowProps;
  context?: ChipContext;
}) {
  return (
    <ol className="divide-hairline divide-y">
      {stories.map((card, index) => {
        const before = stories[index - 1];
        const after = stories[index + 1];
        return (
          <BacklogRow
            key={card.id}
            card={card}
            boardKey={rows.boardKey}
            boardId={rows.boardId}
            structure={rows.structure}
            context={context}
            selected={rows.selected.has(card.id)}
            onSelect={rows.onSelect ? (checked) => rows.onSelect!(card.id, checked) : undefined}
            onMoveUp={before ? () => rows.onNudge(card.id, before.id, false) : undefined}
            onMoveDown={after ? () => rows.onNudge(card.id, after.id, true) : undefined}
            draggable
            dragging={rows.dragId === card.id}
            onDragStart={() => rows.setDragId(card.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => rows.onDropOn(card.id)}
          />
        );
      })}
    </ol>
  );
}

function FeatureBlock({
  node,
  rows,
  context,
  before,
  after,
}: {
  node: FeatureNode;
  rows: StoryRowProps;
  /** The epic's place; a loose feature has none and shows its own. */
  context?: ChipContext;
  before?: string;
  after?: string;
}) {
  const t = useTranslations("backlog.hierarchy");
  const { feature, stories } = node;
  const progress = featureProgress(node);
  const open = !rows.isOpen(featureKey(feature.id));
  return (
    <li>
      <FeatureLine
        item={feature}
        boardKey={rows.boardKey}
        boardId={rows.boardId}
        structure={rows.structure}
        context={context}
        reviewDue={reviewDue(feature, rows.reviewDays)}
        progress={progress}
        open={open}
        onToggle={() => rows.toggle(featureKey(feature.id))}
        onMoveUp={before ? () => rows.onRank(feature.id, before, false) : undefined}
        onMoveDown={after ? () => rows.onRank(feature.id, after, true) : undefined}
      />
      {open && (
        <div className="border-hairline ml-[1.6rem] border-t border-l">
          {stories.length > 0 ? (
            <StoryRows
              stories={stories}
              rows={rows}
              context={{ areaId: feature.areaId, themeIds: feature.themeIds }}
            />
          ) : (
            <p className="text-meta px-3 py-2 text-[0.78rem]">
              {progress.total > 0 ? t("allElsewhere") : t("noStories")}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function FeatureBlocks({
  nodes,
  rows,
  context,
}: {
  nodes: FeatureNode[];
  rows: StoryRowProps;
  context?: ChipContext;
}) {
  return (
    <ol className="divide-hairline divide-y">
      {nodes.map((node, index) => (
        <FeatureBlock
          key={node.feature.id}
          node={node}
          rows={rows}
          context={context}
          before={nodes[index - 1]?.feature.id}
          after={nodes[index + 1]?.feature.id}
        />
      ))}
    </ol>
  );
}

function EpicSection({
  node,
  rows,
  before,
  after,
}: {
  node: EpicNode;
  rows: StoryRowProps;
  before?: string;
  after?: string;
}) {
  const t = useTranslations("backlog.hierarchy");
  const { epic, features } = node;
  const progress = epicProgress(node);
  const open = rows.isOpen(epic.id);
  return (
    <li>
      <EpicHeader
        item={epic}
        boardKey={rows.boardKey}
        boardId={rows.boardId}
        structure={rows.structure}
        reviewDue={reviewDue(epic, rows.reviewDays)}
        progress={progress}
        counts={t("epicCounts", { features: features.length, cards: progress.total })}
        action={epic.state === "open" ? rows.newFeature?.(epic.id) : undefined}
        open={open}
        onToggle={() => rows.toggle(epic.id)}
        onMoveUp={before ? () => rows.onRank(epic.id, before, false) : undefined}
        onMoveDown={after ? () => rows.onRank(epic.id, after, true) : undefined}
      />
      {open && (
        <div className="border-hairline ml-[1.6rem] border-l">
          {features.length > 0 ? (
            <FeatureBlocks
              nodes={features}
              rows={rows}
              context={{ areaId: epic.areaId, themeIds: epic.themeIds }}
            />
          ) : (
            <p className="text-meta px-3 py-2 text-[0.78rem]">{t("noFeatures")}</p>
          )}
        </div>
      )}
    </li>
  );
}

/** What has no parent, as a section of its own at the bottom — never an epic of the tool's making. */
function LooseSection({ tree, rows }: { tree: Hierarchy; rows: StoryRowProps }) {
  const t = useTranslations("backlog.hierarchy");
  const open = rows.isOpen(LOOSE);
  const count = tree.looseFeatures.length + tree.looseStories.length;
  return (
    <li>
      <div className="flex items-start gap-2 py-2.5 pr-3 pl-2">
        <FoldButton open={open} onToggle={() => rows.toggle(LOOSE)} />
        <span className="text-label border-border mt-0.5 inline-flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3rem] border border-dashed">
          <CircleDashed className="size-3" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] leading-snug font-semibold">{t("noParent")}</p>
          <p className="text-meta mt-1 text-[0.72rem]">
            {t("noParentHint")}
            <span aria-hidden className="text-label mx-1.5">
              ·
            </span>
            <span className="tabular-nums">{t("groupCount", { count })}</span>
          </p>
        </div>
      </div>
      {open && (
        <div className="border-hairline ml-[1.6rem] border-l">
          {tree.looseFeatures.length > 0 && (
            <FeatureBlocks nodes={tree.looseFeatures} rows={rows} />
          )}
          {tree.looseStories.length > 0 && (
            <div className={tree.looseFeatures.length > 0 ? "border-hairline border-t" : undefined}>
              <StoryRows stories={tree.looseStories} rows={rows} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function HierarchyList({ tree, rows }: { tree: Hierarchy; rows: StoryRowProps }) {
  const loose = tree.looseFeatures.length > 0 || tree.looseStories.length > 0;
  return (
    <ol className="border-hairline divide-hairline divide-y border-t">
      {tree.epics.map((node, index) => (
        <EpicSection
          key={node.epic.id}
          node={node}
          rows={rows}
          before={tree.epics[index - 1]?.epic.id}
          after={tree.epics[index + 1]?.epic.id}
        />
      ))}
      {loose && <LooseSection tree={tree} rows={rows} />}
    </ol>
  );
}

/** The ids "Fold alle ud" opens: every epic and the loose section. */
export function sectionIds(tree: Hierarchy): string[] {
  return [...tree.epics.map((node) => node.epic.id), LOOSE];
}
