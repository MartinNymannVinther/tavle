import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import {
  changedCount,
  choicesFor,
  conversionTable,
  convert,
  convertTotal,
  DEFAULT_HOURS_PER_POINT,
  HOURS_PER_POINT_MAX,
  HOURS_PER_POINT_MIN,
  isHoursPerPoint,
  labelOf,
  POINT_SCALE,
  scaleOf,
  sizeOf,
  totalLabel,
  TSHIRT,
} from "@/modules/boards/estimates";
import { listEstimateUnits } from "@/modules/boards/read-units";
import { EstimateUnitSchema } from "@/modules/boards/validation";
import { previewEstimateUnit, setEstimateUnit } from "@/modules/boards/write-estimates";
import { getBoardFull } from "@/modules/boards/read";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard } from "@/modules/boards/write-cards";
import { createSprint, setCardsSprint, startSprint } from "@/modules/boards/write-sprints";
import { undoEvent } from "@/modules/boards/undo";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * What a board counts in (docs/adr/0030). The arithmetic is proven on
 * its own, then the switch is proven through the services: sizes are a
 * label on the points already there, hours are a scale of their own,
 * and one Fortryd puts every number back.
 */

describe("the estimate scales", () => {
  it("treats a size as a label on a weight, so points and sizes are one scale", () => {
    expect(scaleOf("points")).toBe("points");
    expect(scaleOf("tshirt")).toBe("points");
    expect(scaleOf("hours")).toBe("hours");
    // Moving to sizes and back is the same number, because 5 is L is 5.
    expect(convert(5, "points", "tshirt")).toBe(5);
    expect(convert(5, "tshirt", "points")).toBe(5);
    expect(sizeOf(5)).toBe("L");
    expect(labelOf(5, "tshirt")).toBe("L");
    expect(labelOf(5, "points")).toBe("5");
    expect(labelOf(null, "tshirt")).toBeNull();
  });

  it("takes the hour's word from the caller, and never invents one", () => {
    // The word is copy and lives in messages/*.json; the domain module
    // holds no locale, so it formats with what it is handed and with
    // nothing at all otherwise. A "t" here is what put Danish in the
    // English UI.
    const da = (value: number) => `${value} t`;
    const en = (value: number) => `${value} h`;
    expect(labelOf(5, "hours", da)).toBe("5 t");
    expect(labelOf(5, "hours", en)).toBe("5 h");
    expect(labelOf(5, "hours")).toBe("5");
    expect(totalLabel(240, "hours", en)).toBe("240 h");
    expect(totalLabel(240, "points", en)).toBe("240");
    // A size has no word for a sum, so a total stays a number.
    expect(totalLabel(240, "tshirt", en)).toBe("240");
  });

  it("offers exactly the ladder the settings page writes out", () => {
    // The sentence in Settings → Estimering is built from POINT_SCALE, so
    // the promise and the picker cannot disagree (the page once said
    // "1, 2, 3, 5, 8, 13" while the picker offered 21 too).
    expect(choicesFor("points")).toEqual([...POINT_SCALE]);
    expect(choicesFor("tshirt")).toEqual(TSHIRT.map((size) => size.weight));
  });

  it("knows which hour factors a conversion can be asked for", () => {
    expect(isHoursPerPoint(HOURS_PER_POINT_MIN)).toBe(true);
    expect(isHoursPerPoint(HOURS_PER_POINT_MAX)).toBe(true);
    expect(isHoursPerPoint(DEFAULT_HOURS_PER_POINT)).toBe(true);
    expect(isHoursPerPoint(HOURS_PER_POINT_MAX + 6)).toBe(false);
    expect(isHoursPerPoint(0)).toBe(false);
    expect(isHoursPerPoint(Number.NaN)).toBe(false);
  });

  it("agrees with the schema, so the field never offers what the server refuses", () => {
    // The factor field disables the switch on a value out of range; that
    // is only honest if the range is the server's own.
    const factor = EstimateUnitSchema.shape.hoursPerPoint;
    for (const value of [HOURS_PER_POINT_MIN, HOURS_PER_POINT_MAX, DEFAULT_HOURS_PER_POINT]) {
      expect(factor.safeParse(value).success).toBe(isHoursPerPoint(value));
    }
    for (const value of [0, HOURS_PER_POINT_MIN / 2, HOURS_PER_POINT_MAX + 6]) {
      expect(factor.safeParse(value).success).toBe(isHoursPerPoint(value));
    }
  });

  it("snaps an estimate off the ladder onto the nearest size", () => {
    // 7 is nobody's size; it becomes XL, and the stored weight agrees.
    expect(convert(7, "points", "tshirt")).toBe(8);
    expect(sizeOf(7)).toBe("XL");
    expect(convert(4, "points", "tshirt")).toBe(5);
    expect(convert(20, "points", "tshirt")).toBe(13);
  });

  it("crosses to hours by the factor and back onto the point ladder", () => {
    expect(convert(3, "points", "hours", 4)).toBe(12);
    expect(convert(12, "hours", "points", 4)).toBe(3);
    // A different factor is honoured both ways.
    expect(convert(2, "points", "hours", 6)).toBe(12);
    // Hours that fall between points land on the nearest rung, never at zero.
    expect(convert(1, "hours", "points", 4)).toBe(1);
    expect(convert(30, "hours", "points", 4)).toBe(8);
  });

  it("never rounds estimated work away to nothing", () => {
    expect(convert(1, "points", "hours", 0.5)).toBeGreaterThanOrEqual(1);
    expect(convert(1, "hours", "points", 40)).toBeGreaterThanOrEqual(1);
  });

  it("scales a sum rather than snapping it onto the card ladder", () => {
    // A sprint that committed 64 hours committed 16 points, not the 13
    // the nearest rung would claim.
    expect(convertTotal(64, "hours", "points", 4)).toBe(16);
    expect(convertTotal(16, "points", "hours", 4)).toBe(64);
    // Within a scale a total is untouched, sizes included.
    expect(convertTotal(37, "points", "tshirt", 4)).toBe(37);
    expect(convertTotal(0, "hours", "points", 4)).toBe(0);
  });

  it("answers a table of every distinct estimate and how many wear it", () => {
    const table = conversionTable([3, 3, 5, null, 7], "points", "tshirt");
    expect(table).toEqual([
      { from: 3, to: 3, cards: 2 },
      { from: 5, to: 5, cards: 1 },
      { from: 7, to: 8, cards: 1 },
    ]);
    // Only the row that actually moves is counted as a change.
    expect(changedCount(table)).toBe(1);
  });
});

let admin: Pool;
let ctx: OrgContext;
let boardId: string;
let areaId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "est_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Estimater", key: "EST", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
  for (const estimate of [3, 5, 8]) {
    await run((tx) =>
      createCard(tx, ctx, { boardId, title: `Kort på ${estimate}`, estimate, areaId }),
    );
  }
});

afterAll(async () => {
  await admin.end();
});

describe("switching what a board counts in", () => {
  it("starts on points, and previewing writes nothing", async () => {
    const before = (await getBoardFull(ctx, boardId))!;
    expect(before.board.estimateUnit).toBe("points");
    const preview = await run((tx) => previewEstimateUnit(tx, boardId, "hours", 4));
    expect(preview!.table).toEqual([
      { from: 3, to: 12, cards: 1 },
      { from: 5, to: 20, cards: 1 },
      { from: 8, to: 32, cards: 1 },
    ]);
    const after = (await getBoardFull(ctx, boardId))!;
    expect(after.board.estimateUnit).toBe("points");
    expect(after.cards.map((c) => c.estimate).sort((a, b) => a! - b!)).toEqual([3, 5, 8]);
  });

  it("moves to sizes without touching a single number", async () => {
    await run((tx) => setEstimateUnit(tx, ctx, { boardId, unit: "tshirt", hoursPerPoint: 4 }));
    const full = (await getBoardFull(ctx, boardId))!;
    expect(full.board.estimateUnit).toBe("tshirt");
    expect(full.cards.map((c) => c.estimate).sort((a, b) => a! - b!)).toEqual([3, 5, 8]);
    // The same weights now read as sizes.
    expect(full.cards.map((c) => labelOf(c.estimate, "tshirt")).sort()).toEqual(["L", "M", "XL"]);
  });

  it("carries the cards and the sprint's frozen numbers across to hours, and undoes both", async () => {
    const sprint = (await run((tx) =>
      createSprint(tx, ctx, {
        boardId,
        name: "Sprint 1",
        goal: "",
        startDate: "2026-09-01",
        endDate: "2026-09-14",
      }),
    ))!;
    const ids = (await getBoardFull(ctx, boardId))!.cards.map((c) => c.id);
    await run((tx) => setCardsSprint(tx, ctx, ids, sprint.id));
    await run((tx) => startSprint(tx, ctx, sprint.id));
    const committedBefore = (await getBoardFull(ctx, boardId))!.activeSprint!.committedPoints;
    expect(committedBefore).toBe(16);

    await run((tx) => setEstimateUnit(tx, ctx, { boardId, unit: "hours", hoursPerPoint: 4 }));
    const inHours = (await getBoardFull(ctx, boardId))!;
    expect(inHours.board.estimateUnit).toBe("hours");
    expect(inHours.cards.map((c) => c.estimate).sort((a, b) => a! - b!)).toEqual([12, 20, 32]);
    // The velocity record follows the scale, or the chart would mix units.
    expect(inHours.activeSprint!.committedPoints).toBe(64);

    const event = await lastEstimateEvent();
    expect(await run((tx) => undoEvent(tx, ctx, event!))).not.toBeNull();
    const back = (await getBoardFull(ctx, boardId))!;
    expect(back.board.estimateUnit).toBe("tshirt");
    expect(back.cards.map((c) => c.estimate).sort((a, b) => a! - b!)).toEqual([3, 5, 8]);
    expect(back.activeSprint!.committedPoints).toBe(16);
  });

  it("tells a list that crosses boards what each board counts in", async () => {
    // "My cards" puts several boards in one column and has no board of
    // its own to ask, so it reads the units for the whole workspace. A
    // row there must wear the same unit the board page would give it.
    const units = await listEstimateUnits(ctx);
    const board = (await getBoardFull(ctx, boardId))!.board;
    expect(units.get(boardId)).toBe(board.estimateUnit);
    expect(units.size).toBeGreaterThan(0);
  });
});

/** The id of the most recent unit change, which is what a person would press Fortryd on. */
async function lastEstimateEvent(): Promise<string | null> {
  const rows = await admin.query(
    `select id from events where board_id = $1 and type = 'board.estimateUnit'
     order by created_at desc limit 1`,
    [boardId],
  );
  return rows.rows[0]?.id ?? null;
}
