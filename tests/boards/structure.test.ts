import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull, getCardFull } from "@/modules/boards/read";
import { closeItem } from "@/modules/boards/structure/close";
import { getItemFull } from "@/modules/boards/structure/read";
import { RuleViolation, reviewDue, titleWarnings } from "@/modules/boards/structure/rules";
import { placeCardInStructure } from "@/modules/boards/structure/write-card-placement";
import { placeItemInStructure } from "@/modules/boards/structure/place-item";
import {
  confirmReview,
  createItem,
  reorderItem,
  updateItem,
} from "@/modules/boards/structure/write-items";
import { createArea, createTheme, updateTheme } from "@/modules/boards/structure/write-lists";
import { alignBacklogToMap, placeOnMap } from "@/modules/boards/structure/write-map";
import { createBoard, updateStructureView } from "@/modules/boards/write-boards";
import { createCard, moveCard } from "@/modules/boards/write-cards";
import type { ItemView } from "@/modules/boards/types";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The backlog structure's rules, proven through the services as an
 * ordinary member (docs/adr/0011). The blocking rules refuse with a code
 * the form can render; the warning rules answer a value; inheritance,
 * ranking and the close conversation do what the spec says, in order.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;
let colId: Record<string, string>;
let payments: string;
let login: string;
let selfService: string;
let stableOps: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

async function violation(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "NO_ERROR";
  } catch (error) {
    return error instanceof RuleViolation ? error.code : `OTHER:${String(error)}`;
  }
}

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "struct_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Webshop", key: "WEB", mode: "scrum", firstArea: "Betalinger" }),
  );
  boardId = board.id;
  const full = (await getBoardFull(ctx, boardId))!;
  colId = Object.fromEntries(full.columns.map((c) => [c.category, c.id]));
  payments = full.areas[0]!.id;
  areaId = payments;
  login = (await run((tx) => createArea(tx, ctx, { boardId, name: "Login" }))).id;
  selfService = (
    await run((tx) => createTheme(tx, ctx, { boardId, name: "Selvbetjening", color: "moss" }))
  ).id;
  stableOps = (
    await run((tx) => createTheme(tx, ctx, { boardId, name: "Stabil drift", color: "clay" }))
  ).id;
});

afterAll(async () => {
  await admin.end();
});

describe("the two tests: can it finish, does it have one parent", () => {
  it("rule 4: an item may start without its done-when, but cannot close without it", async () => {
    // Its own board: the suite's other tests count the shared board's
    // items and numbers, and this one is about a rule, not the board.
    const own = await run((tx) =>
      createBoard(tx, ctx, { name: "Regel 4", key: "RFIR", mode: "kanban", firstArea: "Alt" }),
    );
    const area = (await getBoardFull(ctx, own.id))!.areas[0]!.id;
    // Jotting down is allowed (docs/adr/0018); finishing is the claim
    // that needs the criterion, so the close is where the rule bites.
    const item = await run((tx) =>
      createItem(tx, ctx, {
        boardId: own.id,
        level: "epic",
        title: "Kunder kan betale med MobilePay",
        areaId: area,
        doneWhen: "",
      }),
    );
    expect(item.doneWhen).toBe("");
    expect(await violation(run((tx) => closeItem(tx, ctx, item.id, undefined)))).toBe(
      "doneWhenRequired",
    );
    await run((tx) =>
      updateItem(tx, ctx, { itemId: item.id, doneWhen: "Betalingen virker i produktion" }),
    );
    expect((await run((tx) => closeItem(tx, ctx, item.id, undefined)))?.closed).toBe(true);
  });

  it("rule 3: an item without a parent needs an area", async () => {
    expect(
      await violation(
        run((tx) =>
          createItem(tx, ctx, {
            boardId,
            level: "feature",
            title: "Kunder kan gemme et kort",
            doneWhen: "Et gemt kort kan bruges ved næste køb",
          }),
        ),
      ),
    ).toBe("needsArea");
    expect(
      await violation(run((tx) => createCard(tx, ctx, { boardId, title: "Uden noget" }))),
    ).toBe("needsArea");
  });

  it("rule 6: an epic is created with its area and themes, and nothing else appears", async () => {
    const epic = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Kunder kan betale med MobilePay",
        doneWhen: "80 % af betalingerne i checkout kan gennemføres med MobilePay i produktion",
        areaId: payments,
        themeIds: [selfService],
        targetQuarter: "2027-Q1",
      }),
    );
    expect(epic.number).toBe(1);
    expect(epic.parentId).toBeNull();
    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.items.map((i) => i.level)).toEqual(["epic"]);
    expect(full.items[0]!.themeIds).toEqual([selfService]);
  });

  it("rule 1 and inheritance: a feature under the epic takes its area, themes and kind", async () => {
    const [epic] = (await getBoardFull(ctx, boardId))!.items;
    const feature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Kunder kan betale i checkout",
        doneWhen: "Betalingen gennemføres og kvitteringen sendes",
        parentId: epic!.id,
      }),
    );
    expect(feature.number).toBe(2);
    expect(feature.areaId).toBe(payments);
    const view = (await getItemFull(ctx, boardId, 2))!;
    expect(view.item.themeIds).toEqual([selfService]);
    expect(view.parent?.number).toBe(1);

    // A feature cannot hang under a feature, nor an epic under anything.
    expect(
      await violation(
        run((tx) =>
          createItem(tx, ctx, {
            boardId,
            level: "feature",
            title: "Under en feature",
            doneWhen: "aldrig",
            parentId: feature.id,
          }),
        ),
      ),
    ).toBe("parentLevel");
    expect(
      await violation(
        run((tx) => placeItemInStructure(tx, ctx, { itemId: epic!.id, parentId: feature.id })),
      ),
    ).toBe("parentLevel");
  });

  it("a card under the feature inherits too, and a card cannot hang under an epic", async () => {
    const items = (await getBoardFull(ctx, boardId))!.items;
    const epic = items.find((i) => i.level === "epic");
    const feature = items.find((i) => i.level === "feature");
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Vis MobilePay-knappen", featureId: feature!.id }),
    );
    expect(card.areaId).toBe(payments);
    expect((await getCardFull(ctx, boardId, card.number))!.card.themeIds).toEqual([selfService]);
    expect(card.number).toBe(3);
    expect(
      await violation(
        run((tx) => createCard(tx, ctx, { boardId, title: "Under en epic", featureId: epic!.id })),
      ),
    ).toBe("parentLevel");
  });

  it("rule 5: an enabler type belongs to an enabler", async () => {
    expect(
      await violation(
        run((tx) =>
          createCard(tx, ctx, {
            boardId,
            title: "Business med undertype",
            areaId,
            kind: "business",
            enablerType: "architecture",
          }),
        ),
      ),
    ).toBe("enablerTypeOnly");
    const enabler = await run((tx) =>
      createCard(tx, ctx, {
        boardId,
        title: "Vi kan udrulle uden nedetid",
        areaId,
        kind: "enabler",
        enablerType: "infrastructure",
      }),
    );
    expect(enabler.enablerType).toBe("infrastructure");
  });

  it("rule 2 and 11: a change of area does not cascade unless asked", async () => {
    const [epic] = (await getBoardFull(ctx, boardId))!.items;
    await run((tx) => placeItemInStructure(tx, ctx, { itemId: epic!.id, areaId: login }));
    let full = (await getBoardFull(ctx, boardId))!;
    expect(full.items.find((i) => i.level === "feature")!.areaId).toBe(payments);
    await run((tx) =>
      placeItemInStructure(tx, ctx, {
        itemId: epic!.id,
        themeIds: [selfService, stableOps],
        applyToChildren: true,
      }),
    );
    full = (await getBoardFull(ctx, boardId))!;
    expect(full.items.find((i) => i.level === "feature")!.areaId).toBe(login);
    expect(full.cards.find((c) => c.number === 3)!.themeIds.sort()).toEqual(
      [selfService, stableOps].sort(),
    );
  });
});

describe("the warnings", () => {
  it("rules 7 and 8: a title that names a category, or is one or two words", () => {
    const names = ["Betalinger", "Selvbetjening"];
    expect(titleWarnings("Betalinger", names)).toEqual(["matchesCategory", "tooShort"]);
    expect(titleWarnings("betalinger ", names)).toContain("matchesCategory");
    expect(titleWarnings("Diverse ting", names)).toEqual(["tooShort"]);
    expect(titleWarnings("Kunder kan betale med MobilePay", names)).toEqual([]);
    expect(titleWarnings("   ", names)).toEqual([]);
  });

  it("rule 9: an epic open longer than the board's period is due for review, until confirmed", async () => {
    const [epic] = (await getBoardFull(ctx, boardId))!.items;
    const later = new Date(epic!.createdAt.getTime() + 181 * 86_400_000);
    expect(reviewDue(epic!, 180, later)).toBe(true);
    expect(reviewDue(epic!, 200, later)).toBe(false);
    expect(reviewDue({ ...epic!, state: "closed" }, 180, later)).toBe(false);
    await run((tx) => confirmReview(tx, ctx, epic!.id));
    const confirmed = (await getItemFull(ctx, boardId, 1))!.item;
    expect(confirmed.reviewConfirmedAt).not.toBeNull();
    const day = 86_400_000;
    const since = confirmed.reviewConfirmedAt!.getTime();
    expect(reviewDue(confirmed, 180, new Date(since + 179 * day))).toBe(false);
    expect(reviewDue(confirmed, 180, new Date(since + 181 * day))).toBe(true);
  });
});

describe("ranking", () => {
  it("keeps one order per level, business and enabler alike", async () => {
    const epicOne = (await getItemFull(ctx, boardId, 1))!.item.id;
    const second = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "epic",
        title: "Vi kan udrulle uden nedetid",
        doneWhen: "Tre udrulninger i træk uden nedetid",
        areaId,
        kind: "enabler",
        enablerType: "infrastructure",
      }),
    );
    const before = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === epicOne)!;
    await run((tx) => reorderItem(tx, second.id, epicOne, false));
    const epics = (await getBoardFull(ctx, boardId))!.items.filter((i) => i.level === "epic");
    expect(epics.map((e) => e.number)).toEqual([second.number, 1]);
    // One rank, one number (docs/adr/0033): the move writes the moved
    // item's number and leaves the one it passed exactly where it was.
    expect(epics.map((e) => e.sort)).toEqual([...epics.map((e) => e.sort)].sort((a, b) => a - b));
    expect(epics.find((e) => e.id === epicOne)!.sort).toBe(before.sort);
  });
});

describe("rule 10: closing with open children", () => {
  it("answers the open children first, then closes only with a decision for each", async () => {
    const feature = (await getBoardFull(ctx, boardId))!.items.find((i) => i.level === "feature")!;
    const first = await run((tx) => closeItem(tx, ctx, feature.id, undefined));
    expect(first).toMatchObject({ closed: false });
    const open = first && !first.closed ? first.openChildren : [];
    expect(open.map((c) => c.key)).toEqual(["WEB-3"]);

    // A plan that forgets a child is refused.
    expect(await violation(run((tx) => closeItem(tx, ctx, feature.id, [])))).toBe("openChildren");
    // A story in a done column is not open and needs no decision.
    const story = open[0]!;
    await run((tx) => moveCard(tx, ctx, story.id, colId.done!, 0));
    const second = await run((tx) => closeItem(tx, ctx, feature.id, undefined));
    expect(second).toEqual({ closed: true });
    expect((await getItemFull(ctx, boardId, feature.number))!.item.state).toBe("closed");
  });

  it("a closed feature takes no new cards, and archiving is what closes a story", async () => {
    const feature = (await getBoardFull(ctx, boardId))!.items.find((i) => i.level === "feature")!;
    expect(
      await violation(
        run((tx) => createCard(tx, ctx, { boardId, title: "For sent", featureId: feature.id })),
      ),
    ).toBe("itemClosed");

    const epic = (await getItemFull(ctx, boardId, 1))!.item;
    const other = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Kunder kan se deres kvitteringer",
        doneWhen: "Kvitteringer kan hentes som PDF",
        parentId: epic.id,
      }),
    );
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Kvitteringsliste", featureId: other.id }),
    );
    const orphanFeature = await run((tx) =>
      createItem(tx, ctx, {
        boardId,
        level: "feature",
        title: "Kunder kan betale med Apple Pay",
        doneWhen: "Apple Pay virker i checkout",
        areaId,
      }),
    );
    // Closing the epic: one feature with an open story cannot be closed;
    // it is moved out instead, and the orphan feature is left as it is.
    const asked = await run((tx) => closeItem(tx, ctx, epic.id, undefined));
    expect(asked && !asked.closed ? asked.openChildren.map((c) => c.openStories) : []).toEqual([1]);
    expect(
      await violation(
        run((tx) => closeItem(tx, ctx, epic.id, [{ id: other.id, action: "close" }])),
      ),
    ).toBe("openChildren");
    const done = await run((tx) =>
      closeItem(tx, ctx, epic.id, [{ id: other.id, action: "orphan" }]),
    );
    expect(done).toEqual({ closed: true });
    const after = (await getBoardFull(ctx, boardId))!;
    expect(after.items.find((i) => i.id === other.id)).toMatchObject({
      parentId: null,
      state: "open",
      areaId: login,
    });
    expect(after.items.find((i) => i.id === orphanFeature.id)!.parentId).toBeNull();
    expect(after.cards.find((c) => c.id === card.id)!.featureId).toBe(other.id);
  });

  it("a story can be moved to another feature or left without a parent, keeping an area", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const from = full.items.find((i) => i.title === "Kunder kan se deres kvitteringer")!;
    const to = full.items.find((i) => i.title === "Kunder kan betale med Apple Pay")!;
    const card = full.cards.find((c) => c.title === "Kvitteringsliste")!;
    const outcome = await run((tx) =>
      closeItem(tx, ctx, from.id, [{ id: card.id, action: "move", targetId: to.id }]),
    );
    expect(outcome).toEqual({ closed: true });
    const moved = (await getCardFull(ctx, boardId, card.number))!.card;
    expect(moved.featureId).toBe(to.id);
    expect(moved.areaId).toBe(payments);

    const orphaned = await run((tx) =>
      closeItem(tx, ctx, to.id, [{ id: card.id, action: "orphan" }]),
    );
    expect(orphaned).toEqual({ closed: true });
    const alone = (await getCardFull(ctx, boardId, card.number))!.card;
    expect(alone.featureId).toBeNull();
    expect(alone.areaId).toBe(payments);
  });
});

describe("the closed lists", () => {
  it("deactivates rather than deletes, and refuses a deactivated value on new work", async () => {
    const theme = await run((tx) =>
      createTheme(tx, ctx, { boardId, name: "Regulatorisk", color: "rust" }),
    );
    await run((tx) =>
      updateTheme(tx, ctx, {
        themeId: theme.id,
        name: "Regulatorisk",
        color: "rust",
        ownerUserId: null,
        active: false,
      }),
    );
    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.themes.find((t) => t.id === theme.id)?.active).toBe(false);
    expect(
      await violation(
        run((tx) => createCard(tx, ctx, { boardId, title: "GDPR", areaId, themeIds: [theme.id] })),
      ),
    ).toBe("inactiveCategory");
  });

  it("closes the theme list at eight", async () => {
    const names = ["T3", "T4", "T5", "T6", "T7", "T8"];
    for (const name of names) {
      await run((tx) => createTheme(tx, ctx, { boardId, name, color: "sand" }));
    }
    expect(
      await violation(run((tx) => createTheme(tx, ctx, { boardId, name: "T9", color: "sand" }))),
    ).toBe("themeLimit");
  });

  it("a card's placement refuses an area from another board", async () => {
    const otherBoard = await run((tx) =>
      createBoard(tx, ctx, { name: "Drift", key: "OPS", mode: "kanban", firstArea: "Servere" }),
    );
    const foreign = (await getBoardFull(ctx, otherBoard.id))!.areas[0]!;
    const card = (await getBoardFull(ctx, boardId))!.cards[0]!;
    expect(
      await violation(
        run((tx) => placeCardInStructure(tx, ctx, { cardId: card.id, areaId: foreign.id })),
      ),
    ).toMatch(/OTHER:Error: notFound/);
  });

  it("an item's kind can change, and the enabler type goes with it", async () => {
    const epic = (await getItemFull(ctx, boardId, 1))!.item;
    await run((tx) =>
      updateItem(tx, ctx, { itemId: epic.id, kind: "enabler", enablerType: "compliance" }),
    );
    expect((await getItemFull(ctx, boardId, 1))!.item).toMatchObject({
      kind: "enabler",
      enablerType: "compliance",
    });
    await run((tx) => updateItem(tx, ctx, { itemId: epic.id, kind: "business" }));
    expect((await getItemFull(ctx, boardId, 1))!.item).toMatchObject({
      kind: "business",
      enablerType: null,
    });
  });
});

describe("the board's view of the structure", () => {
  it("hides levels and fields without touching the data, and settles rule 3 on a hidden area", async () => {
    const small = await run((tx) =>
      createBoard(tx, ctx, {
        name: "Lille",
        key: "LIL",
        mode: "kanban",
        firstArea: "Alt",
        structureLevels: "card",
        showAreas: false,
        showThemes: false,
        showKind: false,
      }),
    );
    expect(small.structureLevels).toBe("card");
    expect(small.showAreas).toBe(false);
    // Nobody can choose an area on this board, so a card without one gets the first area quietly.
    const card = await run((tx) => createCard(tx, ctx, { boardId: small.id, title: "Første" }));
    const full = (await getBoardFull(ctx, small.id))!;
    expect(full.cards.find((c) => c.id === card.id)?.areaId).toBe(full.areas[0]!.id);
    // Switching the view back on changes nothing but the view.
    await run((tx) =>
      updateStructureView(tx, ctx, small.id, {
        structureLevels: "epic",
        showAreas: true,
        showThemes: true,
        showKind: true,
        swimlaneBy: "none",
      }),
    );
    const again = (await getBoardFull(ctx, small.id))!;
    expect(again.board.structureLevels).toBe("epic");
    expect(again.cards.find((c) => c.id === card.id)?.areaId).toBe(full.areas[0]!.id);
    // With areas shown, rule 3 is the person's to meet again.
    expect(
      await violation(run((tx) => createCard(tx, ctx, { boardId: small.id, title: "Uden" }))),
    ).toBe("needsArea");
  });
});

describe("the story map's backbone", () => {
  it("takes features up in its own order, moves them, and takes them down, leaving the rank alone", async () => {
    const feature = (title: string) =>
      run((tx) =>
        createItem(tx, ctx, {
          boardId,
          level: "feature",
          title,
          doneWhen: "Når det virker",
          areaId,
        }),
      );
    const a = await feature("Kunder kan betale i checkout");
    const b = await feature("Kunder kan gemme et kort");
    expect(a.mapSort).toBeNull();

    const onMap = async () =>
      (await getBoardFull(ctx, boardId))!.items
        .filter((i) => i.mapSort !== null)
        .sort((x, y) => x.mapSort! - y.mapSort!)
        .map((i) => i.id);

    await run((tx) => placeOnMap(tx, ctx, a.id, undefined));
    await run((tx) => placeOnMap(tx, ctx, b.id, 0));
    expect(await onMap()).toEqual([b.id, a.id]);
    const ranked = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === a.id)!;
    expect(ranked.sort).toBe(a.sort);

    await run((tx) => placeOnMap(tx, ctx, a.id, 0));
    expect(await onMap()).toEqual([a.id, b.id]);

    await run((tx) => placeOnMap(tx, ctx, b.id, null));
    expect(await onMap()).toEqual([a.id]);

    const epic = (await getBoardFull(ctx, boardId))!.items.find((i) => i.level === "epic")!;
    expect(await violation(run((tx) => placeOnMap(tx, ctx, epic.id, undefined)))).toBe(
      "parentLevel",
    );
  });

  it("takes a closed feature back onto the wall, because taking it down is not one-way", async () => {
    // The wall draws closed features struck through when the tick asks
    // for them, so hanging one back up is an arrangement, not giving a
    // closed thing more to do. Refusing it stranded the feature's cards:
    // counted in their band, drawn nowhere, offered by a dead menu.
    const full = (await getBoardFull(ctx, boardId))!;
    const closed = full.items.find((i) => i.level === "feature" && i.state === "closed");
    if (!closed) return;
    await run((tx) => placeOnMap(tx, ctx, closed.id, null));
    expect(
      (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === closed.id)!.mapSort,
    ).toBeNull();
    await run((tx) => placeOnMap(tx, ctx, closed.id, 0));
    expect(
      (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === closed.id)!.mapSort,
    ).not.toBeNull();
  });

  it("lets the backlog follow the map on request, unmapped features keeping their slots", async () => {
    const full = (await getBoardFull(ctx, boardId))!;
    const features = full.items
      .filter((i) => i.level === "feature" && i.state === "open")
      .sort((x, y) => x.sort - y.sort || x.number - y.number);
    // Two features up in the opposite of their rank; the rest stay down.
    const [first, second] = features.slice(0, 2) as [ItemView, ItemView];
    await run((tx) => placeOnMap(tx, ctx, second.id, 0));
    await run((tx) => placeOnMap(tx, ctx, first.id, 1));

    const moved = await run((tx) => alignBacklogToMap(tx, ctx, boardId));
    expect(moved).toBeGreaterThan(0);

    const after = (await getBoardFull(ctx, boardId))!.items
      .filter((i) => i.level === "feature" && i.state === "open")
      .sort((x, y) => x.sort - y.sort || x.number - y.number);
    // The mapped pair swapped into the two front slots in map order; the
    // unmapped tail is untouched in its old relative order.
    expect(after.slice(0, 2).map((i) => i.id)).toEqual([second.id, first.id]);
    expect(after.slice(2).map((i) => i.id)).toEqual(features.slice(2).map((i) => i.id));
    // Nothing left to do: running it again moves nothing.
    expect(await run((tx) => alignBacklogToMap(tx, ctx, boardId))).toBe(0);
  });
});

describe("the roadmap's plan", () => {
  it("keeps a span the right way round, and only on epics", async () => {
    const items = (await getBoardFull(ctx, boardId))!.items;
    const epic = items.find((i) => i.level === "epic");
    const feature = items.find((i) => i.level === "feature");
    // Dragged past its own end: the span the person drew, swapped quietly.
    await run((tx) =>
      updateItem(tx, ctx, { itemId: epic!.id, targetQuarter: "2027-Q1", startQuarter: "2027-Q3" }),
    );
    let fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === epic!.id)!;
    expect([fresh.startQuarter, fresh.targetQuarter]).toEqual(["2027-Q1", "2027-Q3"]);
    // A feature has no bar; the quarters are quietly not its fields.
    await run((tx) => updateItem(tx, ctx, { itemId: feature!.id, startQuarter: "2027-Q1" }));
    fresh = (await getBoardFull(ctx, boardId))!.items.find((i) => i.id === feature!.id)!;
    expect(fresh.startQuarter).toBeNull();
  });
});
