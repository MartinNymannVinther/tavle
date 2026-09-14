import { THEME_COLORS, type ThemeColor } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "@/modules/boards/events";
import { boardAreas, boardInWorkspace, boardThemes } from "@/modules/boards/read";
import { createItem } from "@/modules/boards/structure/write-items";
import { createArea, createTheme } from "@/modules/boards/structure/write-lists";
import { createCard } from "@/modules/boards/write-cards";
import type { BootstrapProposal } from "./bootstrap";

/**
 * Writes the starting point the person kept, through the ordinary
 * services in one transaction: areas and themes first (existing names
 * are reused, never duplicated), then epics, features and cards with
 * the structure's own rules and inheritance. Every row is marked as the
 * AI's work, applied because a person said yes.
 */
export async function applyBootstrap(
  tx: AppTransaction,
  ctx: OrgContext,
  input: BootstrapProposal & { boardId: string; engine: string },
): Promise<{ boardId: string } | null> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) return null;

  const areaIds = new Map(
    (await boardAreas(tx, board.id)).map((a) => [a.name.toLowerCase(), a.id]),
  );
  for (const name of input.areas) {
    if (areaIds.has(name.toLowerCase())) continue;
    const area = await createArea(tx, ctx, { boardId: board.id, name });
    areaIds.set(name.toLowerCase(), area.id);
  }
  const themeRows = await boardThemes(tx, board.id);
  const themeIds = new Map(themeRows.map((t) => [t.name.toLowerCase(), t.id]));
  let colorAt = themeRows.length;
  for (const name of input.themes) {
    if (themeIds.has(name.toLowerCase())) continue;
    const color = THEME_COLORS[colorAt % THEME_COLORS.length] as ThemeColor;
    colorAt += 1;
    const theme = await createTheme(tx, ctx, { boardId: board.id, name, color });
    themeIds.set(name.toLowerCase(), theme.id);
  }

  let features = 0;
  let cards = 0;
  for (const epic of input.epics) {
    const created = await createItem(
      tx,
      ctx,
      {
        boardId: board.id,
        level: "epic",
        title: epic.title,
        doneWhen: epic.doneWhen,
        areaId: areaIds.get(epic.area.toLowerCase()) ?? null,
        themeIds: epic.themes
          .map((name) => themeIds.get(name.toLowerCase()))
          .filter((id): id is string => Boolean(id)),
        targetQuarter: epic.targetQuarter,
      },
      "ai",
    );
    for (const feature of epic.features) {
      const featureRow = await createItem(
        tx,
        ctx,
        {
          boardId: board.id,
          level: "feature",
          title: feature.title,
          doneWhen: feature.doneWhen,
          parentId: created.id,
        },
        "ai",
      );
      features += 1;
      for (const card of feature.cards) {
        await createCard(
          tx,
          ctx,
          { boardId: board.id, title: card.title, featureId: featureRow.id },
          "ai",
        );
        cards += 1;
      }
    }
  }

  await recordEvent(
    tx,
    ctx,
    board.id,
    "ai.bootstrapped",
    { epics: input.epics.length, features, cards, engine: input.engine },
    { actor: "ai" },
  );
  return { boardId: board.id };
}
