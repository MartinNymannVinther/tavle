import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { BARE_DECOMPOSITION_LIMIT, isBareDecomposition } from "@/modules/ai/bare-backlog";
import { sanitizeBacklogAssist, type AssistKnown } from "@/modules/ai/backlog-assist";
import { applyBacklogAssist } from "@/modules/ai/backlog-assist-apply";
import { getBoardFull } from "@/modules/boards/read";
import { createBoard } from "@/modules/boards/write-boards";
import { createItem, updateItem } from "@/modules/boards/structure/write-items";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The fifth proposal (docs/adr/0037), proven without a model: the
 * threshold that decides which offer stands in the slot, the sanitizer
 * refusing everything the assistant may not say, and the apply writing
 * the kept proposal through the ordinary services, marked as the AI's.
 */

describe("isBareDecomposition", () => {
  it("is bare below the threshold and built at it", () => {
    const epics = (n: number) => Array.from({ length: n }, () => ({ level: "epic" }));
    expect(isBareDecomposition([])).toBe(true);
    expect(isBareDecomposition(epics(BARE_DECOMPOSITION_LIMIT - 1))).toBe(true);
    expect(isBareDecomposition(epics(BARE_DECOMPOSITION_LIMIT))).toBe(false);
  });

  it("counts epics and features together and nothing else", () => {
    expect(isBareDecomposition([{ level: "epic" }, { level: "feature" }, { level: "card" }])).toBe(
      true,
    );
    expect(
      isBareDecomposition([{ level: "epic" }, { level: "feature" }, { level: "feature" }]),
    ).toBe(false);
  });
});

const known: AssistKnown = {
  quarters: ["2027-Q1", "2027-Q2"],
  areas: ["Butik"],
  themes: ["Tillid"],
  epics: [{ key: "BOD-1", title: "Kunder kan betale" }],
  features: [{ key: "BOD-2", title: "Kortbetaling" }],
  editable: [
    { key: "BOD-1", level: "epic", title: "Kunder kan betale", doneWhen: "" },
    { key: "BOD-2", level: "feature", title: "Kortbetaling", doneWhen: "Kortet trækkes" },
  ],
};

describe("sanitizeBacklogAssist", () => {
  it("resolves parents and areas, refuses invented ones and caps the counts", () => {
    const out = sanitizeBacklogAssist(
      {
        epics: [
          { title: "Lageret styrer sig selv", doneWhen: "Beholdningen passer", area: "butik" },
          ...Array.from({ length: 6 }, (_, i) => ({ title: `Epic ${i}`, area: "Butik" })),
        ],
        features: [
          { title: "Kurv", parent: "bod-1" },
          { title: "Opfundet", parent: "BOD-99" },
        ],
        cards: [
          { title: "Læg i kurv", parent: "BOD-2" },
          // A card may only hang under a feature, never under an epic.
          { title: "Under en epic", parent: "BOD-1" },
        ],
        edits: [{ key: "BOD-1", doneWhen: "En bestilling går igennem", why: "Manglede" }],
      },
      known,
    )!;
    expect(out.epics).toHaveLength(3);
    expect(out.epics[0]!.area).toBe("Butik");
    expect(out.features.map((f) => f.parentKey)).toEqual(["BOD-1"]);
    expect(out.cards.map((c) => c.parentKey)).toEqual(["BOD-2"]);
    expect(out.edits).toHaveLength(1);
    expect(out.edits[0]!.title).toBeNull();
    expect(out.edits[0]!.doneWhen).toBe("En bestilling går igennem");
  });

  it("keeps only known themes and quarters inside the horizon", () => {
    const out = sanitizeBacklogAssist(
      {
        epics: [
          {
            title: "Tillid til betaling",
            area: "Butik",
            themes: ["Tillid", "Opfundet tema"],
            targetQuarter: "2031-Q4",
          },
        ],
      },
      known,
    )!;
    expect(out.epics[0]!.themes).toEqual(["Tillid"]);
    expect(out.epics[0]!.targetQuarter).toBeNull();
  });

  it("drops new epics when the board has no area to put them in (rule 3)", () => {
    const out = sanitizeBacklogAssist(
      {
        epics: [{ title: "Uden område", area: "Butik" }],
        cards: [{ title: "Kort", parent: "BOD-2" }],
      },
      { ...known, areas: [] },
    )!;
    expect(out.epics).toEqual([]);
    expect(out.cards).toHaveLength(1);
  });

  it("refuses an edit that changes nothing, and answers null with nothing at all", () => {
    expect(
      sanitizeBacklogAssist({ edits: [{ key: "BOD-2", title: "Kortbetaling" }] }, known),
    ).toBeNull();
    expect(sanitizeBacklogAssist("nonsense", known)).toBeNull();
    expect(
      sanitizeBacklogAssist({ epics: [], features: [], cards: [], edits: [] }, known),
    ).toBeNull();
  });
});

describe("applyBacklogAssist", () => {
  let admin: Pool;
  let ctx: OrgContext;

  beforeAll(async () => {
    admin = adminPool();
    ctx = await seedWorkspace(admin, "assist_a");
  });

  afterAll(async () => {
    await admin.end();
  });

  it("writes the kept proposal through the services, marked as the AI's", async () => {
    const board = await withOrgContext(ctx, (tx) =>
      createBoard(tx, ctx, { name: "Boden", key: "BOD", mode: "kanban", firstArea: "Butik" }),
    );
    // Rule 3: an epic has no parent, so the board's own area places it.
    const areaId = (await getBoardFull(ctx, board.id))!.areas[0]!.id;
    const epic = await withOrgContext(ctx, (tx) =>
      createItem(tx, ctx, {
        boardId: board.id,
        level: "epic",
        title: "Kunder kan betale",
        doneWhen: "",
        areaId,
      }),
    );
    const feature = await withOrgContext(ctx, (tx) =>
      createItem(tx, ctx, {
        boardId: board.id,
        level: "feature",
        title: "Kortbetaling",
        doneWhen: "",
        parentId: epic.id,
      }),
    );
    const key = (item: { number: number }) => `${board.key}-${item.number}`;
    const done = await withOrgContext(ctx, (tx) =>
      applyBacklogAssist(tx, ctx, {
        boardId: board.id,
        engine: "test:none",
        epics: [
          {
            title: "Lageret styrer sig selv",
            doneWhen: "Beholdningen passer",
            area: "Butik",
            themes: [],
            targetQuarter: null,
          },
        ],
        features: [
          { title: "Optælling", doneWhen: "", parentKey: key(epic), parentTitle: epic.title },
        ],
        cards: [{ title: "Vis formular", parentKey: key(feature), parentTitle: feature.title }],
        edits: [
          {
            key: key(feature),
            level: "feature",
            title: null,
            doneWhen: "Kortet trækkes i produktion",
            currentTitle: feature.title,
            currentDoneWhen: "",
            why: "Manglede en færdig-når",
          },
        ],
      }),
    );
    expect(done?.boardId).toBe(board.id);
    const full = (await getBoardFull(ctx, board.id))!;
    expect(full.items.filter((i) => i.level === "epic")).toHaveLength(2);
    const added = full.items.find((i) => i.title === "Optælling")!;
    expect(added.parentId).toBe(epic.id);
    expect(full.cards.map((c) => c.featureId)).toEqual([feature.id]);
    expect(full.items.find((i) => i.id === feature.id)!.doneWhen).toBe(
      "Kortet trækkes i produktion",
    );
    // Every row the assistant wrote is the AI's, not this person's — the
    // constitution's "everything the AI does is marked". The five land in
    // one transaction and so share a created_at, which makes any
    // assertion about the last of them undefined. Counting by actor
    // instead is exact: the two rows above are the person's, and the
    // epic, the feature, the card, the edit and the summary are the AI's.
    // Drop the "ai" argument from any one of the writes and this moves.
    const marked = await admin.query(
      "select actor_kind, count(*)::int as rows from events where board_id = $1 and type in ('ai.assisted', 'item.created', 'item.updated', 'card.created') group by actor_kind",
      [board.id],
    );
    expect(Object.fromEntries(marked.rows.map((row) => [row.actor_kind, row.rows]))).toEqual({
      user: 2,
      ai: 5,
    });
    const summary = await admin.query(
      "select payload, actor_kind from events where board_id = $1 and type = 'ai.assisted'",
      [board.id],
    );
    expect(summary.rows[0]?.actor_kind).toBe("ai");
    expect(summary.rows[0]?.payload).toMatchObject({ epics: 1, features: 1, cards: 1, edits: 1 });
  });

  it("leaves an item a colleague rewrote while the proposal was open", async () => {
    const board = await withOrgContext(ctx, (tx) =>
      createBoard(tx, ctx, { name: "Lageret", key: "LAG", mode: "kanban", firstArea: "Drift" }),
    );
    const areaId = (await getBoardFull(ctx, board.id))!.areas[0]!.id;
    const epic = await withOrgContext(ctx, (tx) =>
      createItem(tx, ctx, {
        boardId: board.id,
        level: "epic",
        title: "Beholdning",
        doneWhen: "Tallet passer",
        areaId,
      }),
    );
    // The proposal was written against "Tallet passer"; by the time the
    // person says yes, a colleague has put something else there. The AI's
    // words must not land on top of theirs.
    await withOrgContext(ctx, (tx) =>
      updateItem(tx, ctx, { itemId: epic.id, doneWhen: "Optalt hver fredag" }),
    );
    const done = await withOrgContext(ctx, (tx) =>
      applyBacklogAssist(tx, ctx, {
        boardId: board.id,
        engine: "test:none",
        epics: [],
        features: [],
        cards: [],
        edits: [
          {
            key: `LAG-${epic.number}`,
            level: "epic",
            title: null,
            doneWhen: "Beholdningen stemmer med systemet",
            currentTitle: "Beholdning",
            currentDoneWhen: "Tallet passer",
            why: "Skarpere",
          },
        ],
      }),
    );
    expect(done?.boardId).toBe(board.id);
    const full = (await getBoardFull(ctx, board.id))!;
    expect(full.items.find((i) => i.id === epic.id)!.doneWhen).toBe("Optalt hver fredag");
    const summary = await admin.query(
      "select payload from events where board_id = $1 and type = 'ai.assisted'",
      [board.id],
    );
    expect(summary.rows[0]?.payload).toMatchObject({ edits: 0 });
  });

  it("refuses a parent that belongs to another board", async () => {
    const mine = await withOrgContext(ctx, (tx) =>
      createBoard(tx, ctx, { name: "Min", key: "MIN", mode: "kanban", firstArea: "Butik" }),
    );
    const other = await withOrgContext(ctx, (tx) =>
      createBoard(tx, ctx, { name: "Anden", key: "AND", mode: "kanban", firstArea: "Butik" }),
    );
    const otherArea = (await getBoardFull(ctx, other.id))!.areas[0]!.id;
    const elsewhere = await withOrgContext(ctx, (tx) =>
      createItem(tx, ctx, {
        boardId: other.id,
        level: "epic",
        title: "Andres epic",
        doneWhen: "",
        areaId: otherArea,
      }),
    );
    const done = await withOrgContext(ctx, (tx) =>
      applyBacklogAssist(tx, ctx, {
        boardId: mine.id,
        engine: "test:none",
        epics: [],
        features: [
          {
            title: "Skal ikke oprettes",
            doneWhen: "",
            parentKey: `AND-${elsewhere.number}`,
            parentTitle: elsewhere.title,
          },
        ],
        cards: [],
        edits: [],
      }),
    );
    expect(done?.boardId).toBe(mine.id);
    const full = (await getBoardFull(ctx, mine.id))!;
    expect(full.items).toHaveLength(0);
  });
});
