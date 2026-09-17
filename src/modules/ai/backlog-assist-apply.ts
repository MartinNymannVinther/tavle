import { and, eq } from "drizzle-orm";
import { backlogItems } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { recordEvent } from "@/modules/boards/events";
import { boardAreas, boardInWorkspace, boardThemes } from "@/modules/boards/read";
import { createItem, updateItem } from "@/modules/boards/structure/write-items";
import { createCard } from "@/modules/boards/write-cards";
import type { AssistProposal } from "./backlog-assist";

/**
 * Writes what the person kept of the assistant's proposal (docs/adr/0037),
 * through the ordinary services in one transaction. Every key is resolved
 * against this board's own rows here, not trusted from the client: a key
 * naming another board's item resolves to nothing and that row is skipped,
 * which is the same answer the propose side would have given.
 *
 * Four writes and no others. There is no delete, no close, no move and no
 * re-rank in this file, and that absence is the feature.
 */
export async function applyBacklogAssist(
  tx: AppTransaction,
  ctx: OrgContext,
  input: AssistProposal & { boardId: string; engine: string },
): Promise<{ boardId: string } | null> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board) return null;

  const areaIds = new Map(
    (await boardAreas(tx, board.id))
      .filter((a) => a.active)
      .map((a) => [a.name.toLowerCase(), a.id]),
  );
  const themeIds = new Map(
    (await boardThemes(tx, board.id))
      .filter((t) => t.active)
      .map((t) => [t.name.toLowerCase(), t.id]),
  );
  const rows = await tx
    .select({
      id: backlogItems.id,
      number: backlogItems.number,
      level: backlogItems.level,
      state: backlogItems.state,
      title: backlogItems.title,
      doneWhen: backlogItems.doneWhen,
    })
    .from(backlogItems)
    .where(and(eq(backlogItems.boardId, board.id), eq(backlogItems.state, "open")));
  const byKey = new Map(rows.map((row) => [`${board.key}-${row.number}`.toLowerCase(), row]));
  const resolve = (key: string, level: "epic" | "feature") => {
    const row = byKey.get(key.toLowerCase());
    return row && row.level === level ? row.id : null;
  };

  let epics = 0;
  for (const epic of input.epics) {
    const areaId = areaIds.get(epic.area.toLowerCase());
    // Rule 3 again: without a real area the epic cannot be placed, and an
    // area is not the assistant's to create.
    if (!areaId) continue;
    await createItem(
      tx,
      ctx,
      {
        boardId: board.id,
        level: "epic",
        title: epic.title,
        doneWhen: epic.doneWhen,
        areaId,
        themeIds: epic.themes
          .map((name) => themeIds.get(name.toLowerCase()))
          .filter((id): id is string => Boolean(id)),
        targetQuarter: epic.targetQuarter,
      },
      "ai",
    );
    epics += 1;
  }

  let features = 0;
  for (const feature of input.features) {
    const parentId = resolve(feature.parentKey, "epic");
    if (!parentId) continue;
    await createItem(
      tx,
      ctx,
      {
        boardId: board.id,
        level: "feature",
        title: feature.title,
        doneWhen: feature.doneWhen,
        parentId,
      },
      "ai",
    );
    features += 1;
  }

  let cards = 0;
  for (const card of input.cards) {
    const featureId = resolve(card.parentKey, "feature");
    if (!featureId) continue;
    await createCard(tx, ctx, { boardId: board.id, title: card.title, featureId }, "ai");
    cards += 1;
  }

  let edits = 0;
  for (const edit of input.edits) {
    const row = byKey.get(edit.key.toLowerCase());
    if (!row || row.level !== edit.level) continue;
    // The proposal carries the words it meant to replace, and this is
    // where they earn their passage. A person reads a proposal for a
    // minute or two; a colleague can rewrite the same done-when inside
    // it, and an edit written on top would take that rewrite away with
    // no trace but an audit row nobody is looking for. So a row that no
    // longer says what the model was shown is left exactly as the
    // colleague left it, and is not counted as an edit.
    const stale =
      (edit.title !== null && row.title !== edit.currentTitle) ||
      (edit.doneWhen !== null && (row.doneWhen ?? "") !== edit.currentDoneWhen);
    if (stale) continue;
    await updateItem(
      tx,
      ctx,
      {
        itemId: row.id,
        ...(edit.title ? { title: edit.title } : {}),
        ...(edit.doneWhen ? { doneWhen: edit.doneWhen } : {}),
      },
      "ai",
    );
    edits += 1;
  }

  await recordEvent(
    tx,
    ctx,
    board.id,
    "ai.assisted",
    { epics, features, cards, edits, engine: input.engine },
    { actor: "ai" },
  );
  return { boardId: board.id };
}
