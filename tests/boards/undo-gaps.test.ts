import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { cardEvents, itemEvents, recentBoardEvents } from "@/modules/boards/events";
import { getBoardFull } from "@/modules/boards/read";
import { NotUndoable, undoEvent } from "@/modules/boards/undo";
import { createItem, updateItem } from "@/modules/boards/structure/write-items";
import {
  createArea,
  createTheme,
  updateArea,
  updateTheme,
} from "@/modules/boards/structure/write-lists";
import { createSwimlane, updateSwimlane } from "@/modules/boards/write-swimlanes";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard, updateCard } from "@/modules/boards/write-cards";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The four holes an adversarial reading of docs/adr/0022 found in the
 * undo: a change to the board's shape that no event saw, a reverse that
 * quietly overwrote a newer change, a reverse that quietly orphaned
 * children, and a span that turned itself round behind a select. Every
 * one of them is either an event with a reverse now, or an honest no.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

const boardEvent = async (type: string) =>
  (await run((tx) => recentBoardEvents(tx, boardId, 60))).find((event) => event.type === type);

const itemOf = async (id: string) =>
  (await getBoardFull(ctx, boardId))!.items.find((item) => item.id === id)!;

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "undogaps_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Huller", key: "HUL", mode: "kanban", firstArea: "Alt" }),
  );
  boardId = board.id;
  areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("the board's own shape is written down, not only audited", () => {
  it("records a theme's rename, recolour and new owner, and undoes it", async () => {
    const theme = await run((tx) =>
      createTheme(tx, ctx, { boardId, name: "Hastighed", color: "moss" }),
    );
    await run((tx) =>
      updateTheme(tx, ctx, {
        themeId: theme.id,
        name: "Fart",
        color: "rust",
        ownerUserId: ctx.userId,
        active: true,
      }),
    );
    const renamed = (await boardEvent("theme.updated"))!;
    expect(renamed.payload).toMatchObject({ name: "Fart", from: "Hastighed" });
    expect((renamed.payload as { undo?: { kind?: string } }).undo?.kind).toBe("theme.update");

    await run((tx) => undoEvent(tx, ctx, renamed.id));
    const back = (await getBoardFull(ctx, boardId))!.themes.find((t) => t.id === theme.id)!;
    expect([back.name, back.color, back.ownerUserId]).toEqual(["Hastighed", "moss", null]);
    // The list entry stays in use: the active flag is its own event.
    expect(back.active).toBe(true);
  });

  it("records an area's rename and undoes it", async () => {
    const area = await run((tx) => createArea(tx, ctx, { boardId, name: "Forside" }));
    await run((tx) =>
      updateArea(tx, ctx, { areaId: area.id, name: "Butik", ownerUserId: null, active: true }),
    );
    const renamed = (await boardEvent("area.updated"))!;
    expect(renamed.payload).toMatchObject({ name: "Butik", from: "Forside" });
    await run((tx) => undoEvent(tx, ctx, renamed.id));
    const back = (await getBoardFull(ctx, boardId))!.areas.find((a) => a.id === area.id)!;
    expect([back.name, back.active]).toEqual(["Forside", true]);
  });

  it("records a lane's rename and undoes it", async () => {
    const lane = await run((tx) => createSwimlane(tx, ctx, { boardId, name: "Support" }));
    await run((tx) =>
      updateSwimlane(tx, ctx, { swimlaneId: lane.id, name: "Drift", active: true }),
    );
    const renamed = (await boardEvent("swimlane.updated"))!;
    expect(renamed.payload).toMatchObject({ name: "Drift", from: "Support" });
    await run((tx) => undoEvent(tx, ctx, renamed.id));
    const back = (await getBoardFull(ctx, boardId))!.swimlanes.find((l) => l.id === lane.id)!;
    expect([back.name, back.active]).toEqual(["Support", true]);
  });

  it("says nothing when nothing changed", async () => {
    const lane = await run((tx) => createSwimlane(tx, ctx, { boardId, name: "Uændret" }));
    const before = (await run((tx) => recentBoardEvents(tx, boardId, 60))).length;
    await run((tx) =>
      updateSwimlane(tx, ctx, { swimlaneId: lane.id, name: "Uændret", active: true }),
    );
    expect((await run((tx) => recentBoardEvents(tx, boardId, 60))).length).toBe(before);
  });
});

describe("a reverse is held against the world it lands in", () => {
  it("refuses an older estimate once the estimate has moved on", async () => {
    const card = await run((tx) => createCard(tx, ctx, { boardId, title: "Kurv", areaId }));
    await run((tx) => updateCard(tx, ctx, card.id, { estimate: 5 }));
    await run((tx) => updateCard(tx, ctx, card.id, { estimate: 8 }));
    const events = await run((tx) => cardEvents(tx, card.id));
    const estimated = events.filter((event) => event.type === "card.estimated");
    // Newest first: the 8 can still be taken back, the 5 no longer can.
    const [newer, older] = estimated;
    await expect(run((tx) => undoEvent(tx, ctx, older!.id))).rejects.toThrow(NotUndoable);
    expect((await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!.estimate).toBe(
      8,
    );
    await run((tx) => undoEvent(tx, ctx, newer!.id));
    expect((await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!.estimate).toBe(
      5,
    );
  });

  it("refuses an older field edit when one of its fields has moved on since", async () => {
    const card = await run((tx) => createCard(tx, ctx, { boardId, title: "Først", areaId }));
    await run((tx) => updateCard(tx, ctx, card.id, { title: "Så", priority: "high" }));
    const first = (await run((tx) => cardEvents(tx, card.id))).find(
      (event) => event.type === "card.updated",
    )!;
    await run((tx) => updateCard(tx, ctx, card.id, { title: "Sidst" }));
    await expect(run((tx) => undoEvent(tx, ctx, first.id))).rejects.toThrow(NotUndoable);
    // Nothing was half-applied: the newer title and the older priority stand.
    const fresh = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!;
    expect([fresh.title, fresh.priority]).toEqual(["Sidst", "high"]);
  });

  it("refuses an older item edit once the title has moved on", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Første",
        doneWhen: "Den står",
        areaId,
      }),
    );
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, title: "Anden" }));
    const edit = (await run((tx) => itemEvents(tx, epic.id))).find(
      (event) => event.type === "item.updated",
    )!;
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, title: "Tredje" }));
    await expect(run((tx) => undoEvent(tx, ctx, edit.id))).rejects.toThrow(NotUndoable);
    expect((await itemOf(epic.id)).title).toBe("Tredje");
  });
});

describe("undoing a creation that has grown children", () => {
  it("refuses rather than dropping the features to no parent at all", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Har børn",
        doneWhen: "Alle features er lukket",
        areaId,
      }),
    );
    const created = (await run((tx) => itemEvents(tx, epic.id))).find(
      (event) => event.type === "item.created",
    )!;
    const feature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Barnet",
        doneWhen: "Den står",
        parentId: epic.id,
      }),
    );
    await expect(run((tx) => undoEvent(tx, ctx, created.id))).rejects.toThrow(NotUndoable);
    expect((await itemOf(feature.id)).parentId).toBe(epic.id);
    expect(await itemOf(epic.id)).toBeTruthy();
  });

  it("refuses a feature's creation while a card still hangs under it", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Kortets epic",
        doneWhen: "Den står",
        areaId,
      }),
    );
    const feature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Kortets feature",
        doneWhen: "Den står",
        parentId: epic.id,
      }),
    );
    const created = (await run((tx) => itemEvents(tx, feature.id))).find(
      (event) => event.type === "item.created",
    )!;
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Hænger under", featureId: feature.id }),
    );
    await expect(run((tx) => undoEvent(tx, ctx, created.id))).rejects.toThrow(NotUndoable);
    expect((await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === card.id)!.featureId).toBe(
      feature.id,
    );
  });

  it("still undoes a creation nothing hangs under", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Alene",
        doneWhen: "Den står",
        areaId,
      }),
    );
    const created = (await run((tx) => itemEvents(tx, epic.id))).find(
      (event) => event.type === "item.created",
    )!;
    await run((tx) => undoEvent(tx, ctx, created.id));
    expect((await getBoardFull(ctx, boardId))!.items.find((i) => i.id === epic.id)).toBeUndefined();
  });
});

describe("the roadmap's two ends", () => {
  it("swaps a span drawn in one gesture and refuses one end picked past the other", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Spændet",
        doneWhen: "Den står",
        areaId,
        targetQuarter: "2026-Q4",
      }),
    );
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, startQuarter: "2026-Q3" }));
    // A drag names both ends at once: the span the person drew, whichever
    // way round the pointer left them.
    await run((tx) =>
      updateItem(tx, ctx, {
        itemId: epic.id,
        startQuarter: "2027-Q3",
        targetQuarter: "2027-Q1",
      }),
    );
    let fresh = await itemOf(epic.id);
    expect([fresh.startQuarter, fresh.targetQuarter]).toEqual(["2027-Q1", "2027-Q3"]);
    // A select names one end, and must not rewrite the other.
    await expect(
      run((tx) => updateItem(tx, ctx, { itemId: epic.id, targetQuarter: "2026-Q1" })),
    ).rejects.toThrow("invalid");
    await expect(
      run((tx) => updateItem(tx, ctx, { itemId: epic.id, startQuarter: "2028-Q1" })),
    ).rejects.toThrow("invalid");
    fresh = await itemOf(epic.id);
    expect([fresh.startQuarter, fresh.targetQuarter]).toEqual(["2027-Q1", "2027-Q3"]);
    // One end that keeps the span the right way round is an ordinary edit.
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, targetQuarter: "2027-Q4" }));
    fresh = await itemOf(epic.id);
    expect([fresh.startQuarter, fresh.targetQuarter]).toEqual(["2027-Q1", "2027-Q4"]);
  });
});
