import { describe, expect, it } from "vitest";
import { sanitizeCloseDecisions, sanitizeReviewBrief } from "@/modules/ai/advice";
import { sanitizeSprintGoal } from "@/modules/ai/assists";

/**
 * The counsel's write boundary (docs/adr/0026), fed the answers models
 * actually give. No model runs here: what does not resolve against the
 * real children, targets and caps simply disappears, and the dialog's
 * own defaults stand.
 */

const children = [
  { id: "c1", key: "WEB-10", level: "feature" as const, openStories: 2 },
  { id: "c2", key: "WEB-11", level: "feature" as const, openStories: 0 },
  { id: "c3", key: "WEB-12", level: "story" as const, openStories: 0 },
];
const targets = [{ id: "t1", key: "WEB-2", title: "Et andet resultat" }];

describe("the close advice", () => {
  it("drops illegal actions, unknown keys and unresolved targets", () => {
    const out = sanitizeCloseDecisions(
      {
        decisions: [
          { key: "web-10", action: "close", target: null, reason: "ser færdig ud" },
          { key: "WEB-11", action: "close", target: null, reason: "intet åbent under den" },
          { key: "WEB-12", action: "archive", target: null, reason: "står i Færdig" },
          { key: "WEB-12", action: "orphan", target: null, reason: "en genganger ignoreres" },
          { key: "WEB-99", action: "orphan", target: null, reason: "opdigtet barn" },
          { key: "WEB-10", action: "move", target: "WEB-77", reason: "ukendt mål" },
        ],
      },
      children,
      targets,
    );
    // WEB-10 cannot close with open stories; WEB-99 does not exist; the
    // move to WEB-77 resolves nowhere; the duplicate WEB-12 is ignored.
    expect(out).toEqual([
      { id: "c2", action: "close", reason: "intet åbent under den" },
      { id: "c3", action: "archive", reason: "står i Færdig" },
    ]);
  });

  it("resolves a move target by key and survives garbage", () => {
    const out = sanitizeCloseDecisions(
      { decisions: [{ key: "WEB-10", action: "move", target: "web-2", reason: "hører til dér" }] },
      children,
      targets,
    );
    expect(out).toEqual([{ id: "c1", action: "move", targetId: "t1", reason: "hører til dér" }]);
    expect(sanitizeCloseDecisions(null, children, targets)).toEqual([]);
    expect(sanitizeCloseDecisions({ decisions: "luk det hele" }, children, targets)).toEqual([]);
  });
});

describe("the review brief", () => {
  it("keeps a capped summary and at most six observations", () => {
    const brief = sanitizeReviewBrief({
      summary: "  Epicen bevæger sig.  ",
      observations: ["a", "", 7, "b".repeat(400), ...Array.from({ length: 10 }, (_, i) => `o${i}`)],
    });
    expect(brief?.summary).toBe("Epicen bevæger sig.");
    expect(brief?.observations).toHaveLength(6);
    expect(brief?.observations[1]).toHaveLength(300);
    expect(sanitizeReviewBrief({ observations: ["uden resumé"] })).toBeNull();
  });
});

describe("the sprint goal", () => {
  it("is one capped sentence or nothing", () => {
    expect(sanitizeSprintGoal({ goal: " Kunden kan betale. " })).toBe("Kunden kan betale.");
    expect(sanitizeSprintGoal({ goal: "x".repeat(600) })).toHaveLength(500);
    expect(sanitizeSprintGoal({ goal: "" })).toBeNull();
    expect(sanitizeSprintGoal(undefined)).toBeNull();
  });
});
