import { eq } from "drizzle-orm";
import { cardThemes, cards, type Card } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent, type ActorKind } from "../events";
import { cardInWorkspace } from "../lanes";
import { boardInWorkspace } from "../read";
import { inheritedFrom } from "./inherit";
import { itemInBoard } from "./items";
import { assertPlaced, RuleViolation } from "./rules";
import type { CardPlacementInput } from "./validation";
import { activeAreaInBoard, activeThemesInBoard } from "./write-lists";

/**
 * A card's place in the structure: the feature it is part of, its area
 * and its themes. The same rules as for an item: a parent is exactly one
 * level up (a feature, on the same board), a move inherits the parent's
 * area and themes, and a card with no parent needs an area.
 */

export async function cardThemeIds(tx: AppTransaction, cardId: string): Promise<string[]> {
  const rows = await tx
    .select({ themeId: cardThemes.themeId })
    .from(cardThemes)
    .where(eq(cardThemes.cardId, cardId));
  return rows.map((row) => row.themeId);
}

export async function setCardThemes(
  tx: AppTransaction,
  orgId: string,
  cardId: string,
  themeIds: string[],
): Promise<void> {
  await tx.delete(cardThemes).where(eq(cardThemes.cardId, cardId));
  if (themeIds.length > 0) {
    await tx.insert(cardThemes).values(themeIds.map((themeId) => ({ orgId, cardId, themeId })));
  }
}

export async function placeCardInStructure(
  tx: AppTransaction,
  ctx: OrgContext,
  input: CardPlacementInput,
  actor: ActorKind = "user",
): Promise<Card | null> {
  const card = await cardInWorkspace(tx, input.cardId);
  if (!card) return null;
  const board = (await boardInWorkspace(tx, card.boardId))!;
  let featureId = card.featureId;
  let areaId = card.areaId;
  let themeIds = await cardThemeIds(tx, card.id);
  let moved = false;

  if (input.featureId !== undefined && input.featureId !== card.featureId) {
    if (input.featureId) {
      const feature = await itemInBoard(tx, board.id, "feature", input.featureId);
      if (!feature) throw new RuleViolation("parentLevel");
      if (feature.state === "closed") throw new RuleViolation("itemClosed");
      const inherited = await inheritedFrom(tx, feature);
      areaId = inherited.areaId;
      themeIds = inherited.themeIds;
    }
    featureId = input.featureId;
    moved = true;
  }
  if (input.areaId !== undefined) areaId = input.areaId;
  if (input.themeIds !== undefined) themeIds = input.themeIds;

  const area = await activeAreaInBoard(tx, board.id, areaId);
  const themes = await activeThemesInBoard(tx, board.id, themeIds);
  assertPlaced(featureId, area?.id ?? null);

  await tx
    .update(cards)
    .set({ featureId, areaId: area?.id ?? null })
    .where(eq(cards.id, card.id));
  await setCardThemes(
    tx,
    ctx.orgId,
    card.id,
    themes.map((t) => t.id),
  );
  const key = `${board.key}-${card.number}`;
  if (moved) {
    const parent = featureId ? await itemInBoard(tx, board.id, "feature", featureId) : null;
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.parent",
      { key, title: card.title, parent: parent ? `${board.key}-${parent.number}` : "" },
      { cardId: card.id, actor },
    );
  } else {
    await recordEvent(
      tx,
      ctx,
      card.boardId,
      "card.placed",
      { key, title: card.title, area: area?.name ?? "", themes: themes.map((t) => t.name) },
      { cardId: card.id, actor },
    );
  }
  return card;
}
