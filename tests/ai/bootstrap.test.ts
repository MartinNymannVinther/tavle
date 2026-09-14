import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { sanitizeBootstrap } from "@/modules/ai/bootstrap";
import { applyBootstrap } from "@/modules/ai/bootstrap-apply";
import { getBoardFull } from "@/modules/boards/read";
import { createBoard } from "@/modules/boards/write-boards";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The fourth proposal (docs/adr/0021), proven without a model: raw
 * model output is cut to shape by the sanitizer, and the apply writes
 * the kept tree through the ordinary services, marked as the AI's.
 */

const known = {
  quarters: ["2027-Q1", "2027-Q2"],
  existingAreas: ["Butik"],
  existingThemes: ["Tillid"],
};

describe("sanitizeBootstrap", () => {
  it("caps counts, resolves areas, filters themes and refuses quarters outside the horizon", () => {
    const raw = {
      areas: ["Betaling", "Betaling", "  ", ...Array.from({ length: 9 }, (_, i) => `A${i}`)],
      themes: ["Hurtig checkout"],
      epics: [
        {
          title: "Kunder kan betale",
          doneWhen: "Betalinger virker i produktion",
          area: "betaling",
          themes: ["Hurtig checkout", "Ukendt tema"],
          targetQuarter: "2031-Q4",
          features: [
            {
              title: "Kortbetaling",
              doneWhen: "",
              cards: [{ title: "Vis formular" }, "Rå streng"],
            },
          ],
        },
        { title: "", features: [] },
        { title: "Uden område", area: "Findes ikke", targetQuarter: "2027-Q2", features: [] },
      ],
    };
    const out = sanitizeBootstrap(raw, known)!;
    expect(out.areas.length).toBeLessThanOrEqual(5);
    expect(out.areas[0]).toBe("Betaling");
    expect(out.epics).toHaveLength(2);
    const [first, second] = out.epics;
    expect(first!.area).toBe("Betaling");
    expect(first!.themes).toEqual(["Hurtig checkout"]);
    expect(first!.targetQuarter).toBeNull();
    expect(first!.features[0]!.cards.map((c) => c.title)).toEqual(["Vis formular", "Rå streng"]);
    // An unknown area falls back to the first known one, so rule 3 can hold.
    expect(second!.area).toBe("Betaling");
    expect(second!.targetQuarter).toBe("2027-Q2");
  });

  it("answers null when the model gave nothing usable", () => {
    expect(sanitizeBootstrap({ epics: [] }, known)).toBeNull();
    expect(sanitizeBootstrap("nonsense", known)).toBeNull();
  });
});

describe("applyBootstrap", () => {
  let admin: Pool;
  let ctx: OrgContext;

  beforeAll(async () => {
    admin = adminPool();
    ctx = await seedWorkspace(admin, "boot_a");
  });

  afterAll(async () => {
    await admin.end();
  });

  it("writes the kept tree through the services: reuse, inheritance and the AI mark", async () => {
    const board = await withOrgContext(ctx, (tx) =>
      createBoard(tx, ctx, { name: "Ny bod", key: "BOD", mode: "kanban", firstArea: "Butik" }),
    );
    const done = await withOrgContext(ctx, (tx) =>
      applyBootstrap(tx, ctx, {
        boardId: board.id,
        engine: "test:none",
        areas: ["Butik", "Lager"],
        themes: ["Selvkørende drift"],
        epics: [
          {
            title: "Varer kan bestilles",
            doneWhen: "En bestilling går igennem",
            targetQuarter: "2027-Q1",
            area: "butik",
            themes: ["Selvkørende drift"],
            features: [
              {
                title: "Kurv og kasse",
                doneWhen: "Kurven kan tømmes ved kassen",
                cards: [{ title: "Læg i kurv" }, { title: "Betal" }],
              },
            ],
          },
        ],
      }),
    );
    expect(done?.boardId).toBe(board.id);
    const full = (await getBoardFull(ctx, board.id))!;
    // "Butik" existed already and is reused, "Lager" is new.
    expect(full.areas.map((a) => a.name).sort()).toEqual(["Butik", "Lager"]);
    expect(full.themes.map((t) => t.name)).toEqual(["Selvkørende drift"]);
    const epic = full.items.find((i) => i.level === "epic")!;
    expect(epic.targetQuarter).toBe("2027-Q1");
    expect(epic.areaId).toBe(full.areas.find((a) => a.name === "Butik")!.id);
    const feature = full.items.find((i) => i.level === "feature")!;
    expect(feature.parentId).toBe(epic.id);
    // Inheritance: the cards land under the feature with the epic's area.
    expect(full.cards).toHaveLength(2);
    expect(full.cards.every((c) => c.featureId === feature.id)).toBe(true);
    expect(full.cards[0]!.areaId).toBe(epic.areaId);
    const marked = await admin.query(
      "select actor_kind from events where board_id = $1 and type = 'ai.bootstrapped'",
      [board.id],
    );
    expect(marked.rows[0]?.actor_kind).toBe("ai");
  });
});
