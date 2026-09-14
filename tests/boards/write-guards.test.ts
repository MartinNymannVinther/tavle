import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { recentBoardEvents } from "@/modules/boards/events";
import { getBoardFull } from "@/modules/boards/read";
import { closeItem } from "@/modules/boards/structure/close";
import { placeItemInStructure } from "@/modules/boards/structure/place-item";
import { RuleViolation } from "@/modules/boards/structure/rules";
import { createItem, updateItem } from "@/modules/boards/structure/write-items";
import { createArea } from "@/modules/boards/structure/write-lists";
import { undoEvent } from "@/modules/boards/undo";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard } from "@/modules/boards/write-cards";
import { closeSprint, createSprint, startSprint } from "@/modules/boards/write-sprints";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The workspace boundary on ids the client sends where no schema can
 * check them: a card's sprint at creation must be the board's own and
 * open, and the close conversation's orphan area must be the board's own
 * and active. Both were once written unchecked.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "guard_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Vagten", key: "VGT", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("a card's sprint at creation", () => {
  it("refuses another board's sprint and a closed one", async () => {
    const other = await run((tx) =>
      createBoard(tx, ctx, { name: "Naboen", key: "VGN", mode: "scrum", firstArea: "Alt" }),
    );
    const foreign = await run((tx) =>
      createSprint(tx, ctx, {
        boardId: other.id,
        name: "Sprint 1",
        goal: "",
        startDate: "2026-09-01",
        endDate: "2026-09-14",
      }),
    );
    await expect(
      run((tx) =>
        createCard(tx, ctx, { boardId, title: "Snydt ind", areaId, sprintId: foreign!.id }),
      ),
    ).rejects.toThrow("notFound");

    const done = await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 1",
        goal: "",
        startDate: "2026-08-01",
        endDate: "2026-08-14",
      }),
    );
    await run((tx) => startSprint(tx, ctx, done!.id));
    await run((tx) => closeSprint(tx, ctx, done!.id, null));
    await expect(
      run((tx) =>
        createCard(tx, ctx, { boardId, title: "Bagudrettet", areaId, sprintId: done!.id }),
      ),
    ).rejects.toThrow("invalid");
  });

  it("accepts the board's own open sprint", async () => {
    const sprint = await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 2",
        goal: "",
        startDate: "2026-09-15",
        endDate: "2026-09-28",
      }),
    );
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Planlagt fra start", areaId, sprintId: sprint!.id }),
    );
    expect(card.sprintId).toBe(sprint!.id);
  });
});

describe("a swapped quarter span carries its whole reverse", () => {
  it("undo restores both ends after a drag past the other", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Byttet om",
        doneWhen: "Spændet står rigtigt",
        areaId,
        targetQuarter: "2026-Q4",
      }),
    );
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, startQuarter: "2026-Q3" }));
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, targetQuarter: "2026-Q1" }));
    let fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === epic.id)!;
    expect([fresh.startQuarter, fresh.targetQuarter]).toEqual(["2026-Q1", "2026-Q3"]);
    const events = await run((tx) => recentBoardEvents(tx, boardId, 10));
    const swapped = events.find((e) => e.type === "item.updated" && e.itemId === epic.id)!;
    await run((tx) => undoEvent(tx, ctx, swapped.id));
    fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === epic.id)!;
    expect([fresh.startQuarter, fresh.targetQuarter]).toEqual(["2026-Q3", "2026-Q4"]);
  });
});

describe("rule 11's cascade", () => {
  it("is written down in the feed and can be taken back", async () => {
    const randen = await run((tx) => createArea(tx, ctx, { boardId, name: "Randen" }));
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Falder nedad",
        doneWhen: "Alt under den følger med",
        areaId,
      }),
    );
    const feature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Følger med",
        doneWhen: "",
        parentId: epic.id,
      }),
    );
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Følger også med", featureId: feature.id }),
    );
    await run((tx) =>
      placeItemInStructure(tx, ctx, {
        itemId: epic.id,
        areaId: randen.id,
        applyToChildren: true,
      }),
    );
    let full = (await getBoardFull(ctx, boardId))!;
    expect(full.items.find((i) => i.id === feature.id)!.areaId).toBe(randen.id);
    expect(full.cards.find((c) => c.id === card.id)!.areaId).toBe(randen.id);

    const events = await run((tx) => recentBoardEvents(tx, boardId, 10));
    const cascaded = events.find((e) => e.type === "item.cascaded" && e.itemId === epic.id)!;
    expect(cascaded.payload).toMatchObject({ features: 1, cards: 1 });
    await run((tx) => undoEvent(tx, ctx, cascaded.id));
    full = (await getBoardFull(ctx, boardId))!;
    expect(full.items.find((i) => i.id === feature.id)!.areaId).toBe(areaId);
    expect(full.cards.find((c) => c.id === card.id)!.areaId).toBe(areaId);
  });
});

describe("rule 4 after the close", () => {
  it("a closed item cannot lose its done-when", async () => {
    const feature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Lukket og låst",
        doneWhen: "Den blev færdig",
        areaId,
      }),
    );
    await run((tx) => closeItem(tx, ctx, feature.id, undefined));
    await expect(
      run((tx) => updateItem(tx, ctx, { itemId: feature.id, doneWhen: "  " })),
    ).rejects.toThrow(RuleViolation);
  });
});

describe("the close conversation's orphan area", () => {
  it("refuses another board's area and takes the board's own", async () => {
    const other = (await run((tx) =>
      createBoard(tx, ctx, { name: "Fremmed", key: "VGF", mode: "kanban", firstArea: "Alt" }),
    ))!;
    const foreignArea = (await getBoardFull(ctx, other.id))!.areas[0]!.id;
    const second = await run((tx) => createArea(tx, ctx, { boardId, name: "Kanten" }));

    const feature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Skal lukkes",
        doneWhen: "Alt under den er afgjort",
        areaId,
      }),
    );
    const orphanToBe = await run((tx) =>
      createCard(tx, ctx, {
        boardId,
        title: "Uden eget område",
        featureId: feature.id,
        areaId: null,
      }),
    );
    await expect(
      run((tx) =>
        closeItem(tx, ctx, feature.id, [
          { id: orphanToBe.id, action: "orphan", areaId: foreignArea },
        ]),
      ),
    ).rejects.toThrow("notFound");

    const outcome = await run((tx) =>
      closeItem(tx, ctx, feature.id, [{ id: orphanToBe.id, action: "orphan", areaId: second.id }]),
    );
    expect(outcome?.closed).toBe(true);
    const fresh = (await getBoardFull(ctx, boardId))!.cards.find((c) => c.id === orphanToBe.id)!;
    expect([fresh.featureId, fresh.areaId]).toEqual([null, second.id]);
  });
});
