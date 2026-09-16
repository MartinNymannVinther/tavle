import { describe, expect, it } from "vitest";
import { backlogCare } from "@/modules/boards/structure/hygiene";
import type { BoardFull } from "@/modules/boards/types";
import { board, card, item } from "../helpers/structure-board";

/**
 * Backlog care (docs/adr/0031). What the page must get right is not the
 * arithmetic but the judgement: it shows a finding only when there is
 * something to show, it calls a supported state a decision rather than
 * a fault, and it never claims a depth it cannot divide.
 */

const keys = (full: BoardFull) => backlogCare(full).findings.map((f) => f.key);
const find = (full: BoardFull, key: string) =>
  backlogCare(full).findings.find((f) => f.key === key);

describe("backlog care", () => {
  it("says nothing about what has been tended", () => {
    // The fixture keeps one epic 205 days old on purpose, so the review
    // finding is right about it; confirm it and the finding goes away.
    expect(keys(board)).toContain("review");
    const tended: BoardFull = {
      ...board,
      items: board.items.map((i) => ({
        ...i,
        doneWhen: "Når det virker",
        reviewConfirmedAt: new Date(),
      })),
    };
    expect(keys(tended)).not.toContain("noDoneWhen");
    expect(keys(tended)).not.toContain("review");
  });

  it("lists what waits on a decision, and lists the rows rather than a share", () => {
    const loose: BoardFull = {
      ...board,
      cards: [
        ...board.cards,
        card({ id: "c99", number: 99, title: "Uden feature", featureId: null }),
      ],
    };
    const finding = find(loose, "unplaced")!;
    expect(finding.tone).toBe("decide");
    expect(finding.items.map((i) => i.number)).toContain(99);
    // The row carries what a link needs, so the page can point at the thing.
    expect(finding.items[0]).toMatchObject({
      level: expect.any(String),
      title: expect.any(String),
    });
  });

  it("counts an item without a done-when as debt, because it cannot be closed", () => {
    const missing: BoardFull = {
      ...board,
      items: board.items.map((i) => (i.id === "f1" ? { ...i, doneWhen: "  " } : i)),
    };
    const finding = find(missing, "noDoneWhen")!;
    expect(finding.tone).toBe("tidy");
    expect(finding.items.map((i) => i.id)).toEqual(["f1"]);
  });

  it("finds a feature nobody has put work under", () => {
    const empty: BoardFull = {
      ...board,
      items: [
        ...board.items,
        item({ id: "f9", number: 9, title: "Tom feature", level: "feature", parentId: "e1" }),
      ],
    };
    expect(find(empty, "emptyFeature")!.items.map((i) => i.id)).toEqual(["f9"]);
  });

  it("only asks about unestimated work at the top of the rank", () => {
    const many = Array.from({ length: 14 }, (_, n) =>
      card({
        id: `u${n}`,
        number: 200 + n,
        title: `Uvejet ${n}`,
        featureId: "f1",
        estimate: null,
        sort: (n + 1) * 1000,
      }),
    );
    const deep: BoardFull = { ...board, cards: many };
    const finding = find(deep, "unestimatedTop")!;
    // Ten of the fourteen, because the rest are too far down to plan from.
    expect(finding.items).toHaveLength(10);
  });

  it("answers a depth only when there is a velocity to divide by", () => {
    // The fixture's sprints are none, so no average and no claim.
    expect(backlogCare(board).depthInSprints).toBeNull();
    expect(keys(board)).not.toContain("depth");
  });

  it("counts the waiting work a plan would be drawn from", () => {
    const care = backlogCare(board);
    expect(care.waiting.cards).toBeGreaterThan(0);
    expect(care.waiting.points).toBeGreaterThanOrEqual(0);
    expect(care.waiting.unestimated).toBeLessThanOrEqual(care.waiting.cards);
  });
});
