import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createTranslator } from "next-intl";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull, getCardFull } from "@/modules/boards/read";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard, updateCard } from "@/modules/boards/write-cards";
import { renderEvent, type EventTranslator } from "@/modules/boards/events";
import da from "../../messages/da.json";
import en from "../../messages/en.json";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The activity feed is where a team reads what happened, so the line has
 * to be a sentence: the fields named in the reader's language rather than
 * the database's, no sentence stopping mid-air because half of it had no
 * value, a removed estimate read as removed, and a board's own word for
 * how big a card is. The events themselves stay structured facts; every
 * choice of wording below is made at render time.
 */

const lines = (locale: "da" | "en") =>
  createTranslator({
    locale,
    messages: locale === "da" ? da : en,
    namespace: "events",
  }) as unknown as EventTranslator;

const line = (
  locale: "da" | "en",
  type: string,
  payload: Record<string, unknown>,
  options?: { unit?: "points" | "hours" | "tshirt" },
) => renderEvent(lines(locale), { type, payload }, options);

describe("the sentence an event becomes", () => {
  it("names the edited fields in the reader's language, never the column's own name", () => {
    const payload = { key: "WEB-61", title: "Kurv", fields: ["dueDate", "priority"] };
    expect(line("da", "card.updated", payload)).toBe("WEB-61 blev redigeret (deadline, prioritet)");
    expect(line("en", "card.updated", payload)).toBe("WEB-61 was edited (due date, priority)");
  });

  it("translates the roadmap's own fields too", () => {
    const payload = { key: "APP-3", title: "Betaling", fields: ["targetQuarter", "startQuarter"] };
    expect(line("da", "item.updated", payload)).toBe(
      "APP-3 blev redigeret (målkvartal, startkvartal)",
    );
    expect(line("en", "item.updated", payload)).toBe(
      "APP-3 was edited (target quarter, start quarter)",
    );
  });

  it("degrades a field nobody has translated yet to words rather than breaking the line", () => {
    const rendered = line("da", "card.updated", {
      key: "WEB-61",
      title: "Kurv",
      fields: ["someNewField"],
    });
    expect(rendered).toBe("WEB-61 blev redigeret (some new field)");
    expect(rendered).not.toContain("events.field");
  });

  it("names only the halves that have a value, so a card without themes ends its sentence", () => {
    const one = { key: "WEB-17", title: "Forside", area: "Forside", themes: [] };
    expect(line("da", "card.placed", one)).toBe("WEB-17 fik område Forside");
    expect(line("en", "card.placed", one)).toBe("WEB-17 got area Forside");
    const other = { key: "WEB-17", title: "Forside", area: "", themes: ["Fart", "Tillid"] };
    expect(line("da", "card.placed", other)).toBe("WEB-17 fik temaer Fart, Tillid");
    expect(line("da", "item.placed", { key: "APP-3", area: "Butik", themes: ["Fart"] })).toBe(
      "APP-3 fik område Butik og temaer Fart",
    );
    expect(line("da", "card.placed", { key: "WEB-17", area: "", themes: [] })).toBe(
      "WEB-17 står uden område og temaer",
    );
  });

  it("writes an estimate in the board's own vocabulary", () => {
    const five = { key: "APP-45", title: "Kurv", points: 5, unit: "tshirt" };
    expect(line("da", "card.estimated", five)).toBe("APP-45 blev estimeret til L");
    expect(line("en", "card.estimated", five)).toBe("APP-45 was estimated at L");
    const hours = { key: "APP-45", title: "Kurv", points: 8, unit: "hours" };
    expect(line("da", "card.estimated", hours)).toBe("APP-45 blev estimeret til 8 timer");
    expect(line("en", "card.estimated", hours)).toBe("APP-45 was estimated at 8 hours");
  });

  it("reads an old line in the words the board uses now, as long as the scale is the same", () => {
    const points = { key: "APP-45", title: "Kurv", points: 5, unit: "points" };
    // Sizes are a label on the weight already written down, so the board
    // that switched to them reads its whole history in them.
    expect(line("da", "card.estimated", points, { unit: "tshirt" })).toBe(
      "APP-45 blev estimeret til L",
    );
    // Hours are a scale of their own: the cards were converted, the events
    // were not, so the old sentence keeps the unit it was written under.
    expect(line("da", "card.estimated", points, { unit: "hours" })).toBe(
      "APP-45 blev estimeret til 5 point",
    );
    // Written before there were units at all; points is what it meant.
    expect(line("da", "card.estimated", { key: "WEB-1", points: 3 })).toBe(
      "WEB-1 blev estimeret til 3 point",
    );
  });

  it("says a removed estimate is removed, never an estimate of nothing", () => {
    expect(line("da", "card.unestimated", { key: "WEB-61", title: "Kurv" })).toBe(
      "Estimatet på WEB-61 blev fjernet",
    );
    expect(line("en", "card.unestimated", { key: "WEB-61", title: "Kurv" })).toBe(
      "The estimate on WEB-61 was removed",
    );
  });

  it("leaves out the colon when nobody has written what the card waits for", () => {
    expect(line("da", "card.blocked", { key: "WEB-61", title: "Kurv", reason: "" })).toBe(
      "WEB-61 blev blokeret",
    );
    expect(line("en", "card.blocked", { key: "WEB-61", title: "Kurv", reason: "" })).toBe(
      "WEB-61 was blocked",
    );
    expect(
      line("da", "card.blocked", { key: "WEB-61", title: "Kurv", reason: "Venter på design" }),
    ).toBe("WEB-61 blev blokeret: Venter på design");
    expect(
      line("da", "card.waiting", { key: "WEB-61", title: "Kurv", reason: "Venter på design" }),
    ).toBe("WEB-61 venter på: Venter på design");
  });

  it("answers an event type it has no sentence for with the type, not a key path", () => {
    expect(line("da", "card.somethingElse", { key: "WEB-1" })).toBe("card.somethingElse");
  });
});

/**
 * The same three defects from the write side: the event that is recorded
 * has to carry the fact the sentence reads, and a date no plan can point
 * at is refused by the service rather than only by the widget.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);
const typesOf = async (number: number) =>
  (await getCardFull(ctx, boardId, number))!.events.map((e) => e.type);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "lines_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Feed", key: "FEED", mode: "kanban", firstArea: "Butik" }),
  );
  boardId = board.id;
  areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
});

afterAll(async () => {
  await admin.end();
});

describe("what the write path records", () => {
  it("records a cleared estimate as removed rather than as nought", async () => {
    const card = await run((tx) => createCard(tx, ctx, { boardId, title: "Kurv", areaId }));
    await run((tx) => updateCard(tx, ctx, card.id, { estimate: 5 }));
    await run((tx) => updateCard(tx, ctx, card.id, { estimate: null }));
    const events = (await getCardFull(ctx, boardId, card.number))!.events;
    expect(events.map((e) => e.type)).toContain("card.unestimated");
    const estimated = events.filter((e) => e.type === "card.estimated");
    expect(estimated).toHaveLength(1);
    expect((estimated[0]!.payload as { points: number }).points).toBe(5);
  });

  it("writes down what a blocked card waits for, whenever the reason is written", async () => {
    const card = await run((tx) => createCard(tx, ctx, { boardId, title: "Betaling", areaId }));
    // The reason box only appears once the box is ticked, so this is the
    // only order a person can work in.
    await run((tx) => updateCard(tx, ctx, card.id, { blocked: true, blockedReason: "" }));
    await run((tx) =>
      updateCard(tx, ctx, card.id, { blocked: true, blockedReason: "Venter på design" }),
    );
    const waiting = (await getCardFull(ctx, boardId, card.number))!.events.filter(
      (e) => e.type === "card.waiting",
    );
    expect(waiting).toHaveLength(1);
    expect((waiting[0]!.payload as { reason: string }).reason).toBe("Venter på design");
    // Saving the same reason again is not a change, and says nothing; nor
    // is blanking it, which would be a sentence ending in its own colon.
    await run((tx) =>
      updateCard(tx, ctx, card.id, { blocked: true, blockedReason: "Venter på design" }),
    );
    await run((tx) => updateCard(tx, ctx, card.id, { blocked: true, blockedReason: "" }));
    expect((await typesOf(card.number)).filter((t) => t === "card.waiting")).toHaveLength(1);
    expect((await getCardFull(ctx, boardId, card.number))!.card.blockedReason).toBe("");
  });

  it("refuses a due date no plan can point at, on the way in and on the way through", async () => {
    const card = await run((tx) =>
      createCard(tx, ctx, { boardId, title: "Deadline", areaId, dueDate: "2026-12-02" }),
    );
    await expect(
      run((tx) => updateCard(tx, ctx, card.id, { dueDate: "0202-12-02" })),
    ).rejects.toThrow("invalid");
    await expect(
      run((tx) => updateCard(tx, ctx, card.id, { dueDate: "2026-02-31" })),
    ).rejects.toThrow("invalid");
    await expect(
      run((tx) => createCard(tx, ctx, { boardId, title: "Nej", areaId, dueDate: "0020-01-01" })),
    ).rejects.toThrow("invalid");
    const after = (await getCardFull(ctx, boardId, card.number))!.card;
    expect(after.dueDate).toBe("2026-12-02");
    // A due date taken away is not a bad date.
    await run((tx) => updateCard(tx, ctx, card.id, { dueDate: null }));
    expect((await getCardFull(ctx, boardId, card.number))!.card.dueDate).toBeNull();
  });
});
