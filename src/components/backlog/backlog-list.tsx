"use client";

import { useTranslations } from "next-intl";
import type { StructureLookup } from "@/components/board/card-chips";
import { themeSwatch } from "@/components/board/tokens";
import type { CardView } from "@/modules/boards/types";
import { reviewDue } from "@/modules/boards/structure/rules";
import { BacklogRow } from "./backlog-row";
import type { FeatureNode, Group, Hierarchy } from "./group-backlog";
import { ItemRow } from "./item-row";

/**
 * The backlog's rows. In the hierarchy: epics, their features, the
 * stories under each, and at the bottom what has no parent, named as
 * exactly that. Grouped by a field: one heading per value with the
 * stories under it. The story row is the same in both, and it is the
 * thing that can be selected for a sprint.
 */
export type StoryRowProps = {
  boardKey: string;
  boardId: string;
  structure: StructureLookup;
  selected: Set<string>;
  onSelect: (cardId: string, checked: boolean) => void;
  /** Moves a story before or after a sibling in the backlog's one order. */
  onNudge: (cardId: string, siblingId: string, after: boolean) => void;
  /** Ranks an epic or feature before or after a sibling of its level. */
  onRank: (itemId: string, siblingId: string, after: boolean) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDropOn: (targetId: string) => void;
};

function StoryRows({ stories, rows }: { stories: CardView[]; rows: StoryRowProps }) {
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
            selected={rows.selected.has(card.id)}
            onSelect={(checked) => rows.onSelect(card.id, checked)}
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
  reviewDays,
  before,
  after,
}: {
  node: FeatureNode;
  rows: StoryRowProps;
  reviewDays: number;
  /** The neighbouring features in the same list, for the arrows. */
  before?: string;
  after?: string;
}) {
  const t = useTranslations("backlog.hierarchy");
  const { feature, stories, elsewhere } = node;
  return (
    <ItemRow
      item={feature}
      boardKey={rows.boardKey}
      boardId={rows.boardId}
      structure={rows.structure}
      counts={t("featureCounts", {
        backlog: stories.length,
        open: elsewhere.open,
        done: elsewhere.done,
      })}
      reviewDue={reviewDue(feature, reviewDays)}
      onMoveUp={before ? () => rows.onRank(feature.id, before, false) : undefined}
      onMoveDown={after ? () => rows.onRank(feature.id, after, true) : undefined}
    >
      {stories.length > 0 && (
        <div className="border-hairline ml-8 border-t">
          <StoryRows stories={stories} rows={rows} />
        </div>
      )}
    </ItemRow>
  );
}

function FeatureBlocks({
  nodes,
  rows,
  reviewDays,
}: {
  nodes: FeatureNode[];
  rows: StoryRowProps;
  reviewDays: number;
}) {
  return (
    <ol className="border-hairline divide-hairline divide-y border-t">
      {nodes.map((node, index) => (
        <FeatureBlock
          key={node.feature.id}
          node={node}
          rows={rows}
          reviewDays={reviewDays}
          before={nodes[index - 1]?.feature.id}
          after={nodes[index + 1]?.feature.id}
        />
      ))}
    </ol>
  );
}

export function HierarchyList({
  tree,
  rows,
  reviewDays,
}: {
  tree: Hierarchy;
  rows: StoryRowProps;
  reviewDays: number;
}) {
  const t = useTranslations("backlog.hierarchy");
  return (
    <ol className="border-hairline divide-hairline divide-y border-t">
      {tree.epics.map((node, index) => (
        <ItemRow
          key={node.epic.id}
          item={node.epic}
          boardKey={rows.boardKey}
          boardId={rows.boardId}
          structure={rows.structure}
          counts={t("epicCounts", { features: node.features.length })}
          reviewDue={reviewDue(node.epic, reviewDays)}
          onMoveUp={
            tree.epics[index - 1]
              ? () => rows.onRank(node.epic.id, tree.epics[index - 1]!.epic.id, false)
              : undefined
          }
          onMoveDown={
            tree.epics[index + 1]
              ? () => rows.onRank(node.epic.id, tree.epics[index + 1]!.epic.id, true)
              : undefined
          }
        >
          {node.features.length > 0 && (
            <FeatureBlocks nodes={node.features} rows={rows} reviewDays={reviewDays} />
          )}
        </ItemRow>
      ))}
      {(tree.looseFeatures.length > 0 || tree.looseStories.length > 0) && (
        <li>
          <p className="text-label bg-secondary/40 px-2 py-2 text-[0.72rem] font-medium uppercase">
            {t("noParent")}
          </p>
          {tree.looseFeatures.length > 0 && (
            <FeatureBlocks nodes={tree.looseFeatures} rows={rows} reviewDays={reviewDays} />
          )}
          {tree.looseStories.length > 0 && (
            <div className="border-hairline border-t">
              <StoryRows stories={tree.looseStories} rows={rows} />
            </div>
          )}
        </li>
      )}
    </ol>
  );
}

export function GroupedList({ groups, rows }: { groups: Group[]; rows: StoryRowProps }) {
  const t = useTranslations("backlog.hierarchy");
  return (
    <ol className="border-hairline divide-hairline divide-y border-t">
      {groups.map((group) => (
        <li key={group.key}>
          <p className="text-label bg-secondary/40 flex items-center gap-2 px-2 py-2 text-[0.72rem] font-medium uppercase">
            {group.color && (
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: themeSwatch(group.color) }}
              />
            )}
            {group.name}
            <span className="text-meta normal-case tabular-nums">
              {t("groupCount", { count: group.stories.length })}
            </span>
          </p>
          {group.stories.length > 0 ? (
            <StoryRows stories={group.stories} rows={rows} />
          ) : (
            <p className="text-meta px-2 py-2 text-sm">{t("groupEmpty")}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
