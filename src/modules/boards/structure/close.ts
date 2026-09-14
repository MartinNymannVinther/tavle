import { eq } from "drizzle-orm";
import { backlogItems, cards, type BacklogItem } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "../events";
import { boardInWorkspace } from "../read";
import { archiveCard } from "../write-card-lifecycle";
import { inheritedFrom } from "./inherit";
import {
  itemInBoard,
  itemInWorkspace,
  openFeaturesOf,
  openStoriesOf,
  setItemThemes,
} from "./items";
import { RuleViolation } from "./rules";
import type { ChildDecision } from "./validation";
import { placeCardInStructure } from "./write-card-placement";

/**
 * Rule 10: closing a feature or an epic with open children is a decision
 * about each of them, never an automatic close. The first call answers
 * the list; the second call carries the plan — close (a feature with no
 * open stories), archive (a story), move (to another parent one level
 * up) or orphan (keep, without a parent) — and the item closes only when
 * every open child is accounted for.
 */

export type OpenChild = {
  id: string;
  level: "feature" | "story";
  key: string;
  title: string;
  areaId: string | null;
  /** For a feature: how many open stories it still has; a feature with any cannot simply be closed. */
  openStories: number;
  /** For a story: where it sits. */
  columnName: string | null;
};

export type CloseOutcome = { closed: true } | { closed: false; openChildren: OpenChild[] };

export async function openChildrenOf(
  tx: AppTransaction,
  board: { key: string },
  item: BacklogItem,
): Promise<OpenChild[]> {
  if (item.level === "epic") {
    const features = await openFeaturesOf(tx, item.id);
    const out: OpenChild[] = [];
    for (const feature of features) {
      out.push({
        id: feature.id,
        level: "feature",
        key: `${board.key}-${feature.number}`,
        title: feature.title,
        areaId: feature.areaId,
        openStories: (await openStoriesOf(tx, feature.id)).length,
        columnName: null,
      });
    }
    return out;
  }
  return (await openStoriesOf(tx, item.id)).map((story) => ({
    id: story.id,
    level: "story",
    key: `${board.key}-${story.number}`,
    title: story.title,
    areaId: story.areaId,
    openStories: 0,
    columnName: story.columnName,
  }));
}

export async function closeItem(
  tx: AppTransaction,
  ctx: OrgContext,
  itemId: string,
  plan: ChildDecision[] | undefined,
): Promise<CloseOutcome | null> {
  const item = await itemInWorkspace(tx, itemId);
  if (!item) return null;
  if (item.state === "closed") return { closed: true };
  // Rule 4, where it bites (docs/adr/0018): finished is a claim against
  // the done-when, so an item cannot close without one.
  if (!item.doneWhen.trim()) throw new RuleViolation("doneWhenRequired");
  const board = (await boardInWorkspace(tx, item.boardId))!;
  const open = await openChildrenOf(tx, board, item);

  if (open.length > 0) {
    if (!plan) return { closed: false, openChildren: open };
    const decided = new Map(plan.map((d) => [d.id, d]));
    if (open.some((child) => !decided.has(child.id))) throw new RuleViolation("openChildren");
    for (const child of open) {
      await applyDecision(tx, ctx, item, child, decided.get(child.id)!);
    }
  }

  await tx
    .update(backlogItems)
    .set({ state: "closed", closedAt: new Date() })
    .where(eq(backlogItems.id, item.id));
  await recordEvent(
    tx,
    ctx,
    item.boardId,
    "item.closed",
    { key: `${board.key}-${item.number}`, title: item.title, level: item.level },
    { itemId: item.id },
  );
  return { closed: true };
}

async function applyDecision(
  tx: AppTransaction,
  ctx: OrgContext,
  parent: BacklogItem,
  child: OpenChild,
  decision: ChildDecision,
): Promise<void> {
  if (child.level === "feature") {
    switch (decision.action) {
      case "close": {
        if (child.openStories > 0) throw new RuleViolation("openChildren");
        const outcome = await closeItem(tx, ctx, child.id, []);
        if (!outcome?.closed) throw new RuleViolation("openChildren");
        return;
      }
      case "move": {
        const target = await itemInBoard(tx, parent.boardId, "epic", decision.targetId);
        if (!target || target.id === parent.id) throw new RuleViolation("parentLevel");
        if (target.state === "closed") throw new RuleViolation("itemClosed");
        const inherited = await inheritedFrom(tx, target);
        await tx
          .update(backlogItems)
          .set({ parentId: target.id, areaId: inherited.areaId })
          .where(eq(backlogItems.id, child.id));
        await setItemThemes(tx, ctx.orgId, child.id, inherited.themeIds);
        return;
      }
      case "orphan": {
        const areaId = child.areaId ?? decision.areaId ?? parent.areaId;
        if (!areaId) throw new RuleViolation("needsArea");
        await tx
          .update(backlogItems)
          .set({ parentId: null, areaId })
          .where(eq(backlogItems.id, child.id));
        return;
      }
      default:
        throw new RuleViolation("openChildren");
    }
  }
  switch (decision.action) {
    case "archive":
      await archiveCard(tx, ctx, child.id);
      return;
    case "move": {
      const target = await itemInBoard(tx, parent.boardId, "feature", decision.targetId);
      if (!target || target.id === parent.id) throw new RuleViolation("parentLevel");
      await placeCardInStructure(tx, ctx, { cardId: child.id, featureId: target.id });
      return;
    }
    case "orphan": {
      const areaId = child.areaId ?? decision.areaId ?? parent.areaId;
      if (!areaId) throw new RuleViolation("needsArea");
      await tx.update(cards).set({ featureId: null, areaId }).where(eq(cards.id, child.id));
      return;
    }
    default:
      throw new RuleViolation("openChildren");
  }
}
