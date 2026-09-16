import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import da from "../../messages/da.json";
import en from "../../messages/en.json";

/**
 * A band on the story map states the release's weight, and the roadmap
 * states the same release's weight in a strip above the epics. The two
 * must agree, and neither may print a word the board no longer uses:
 * a board counting in T-shirt sizes has no word for a *sum* of sizes
 * (docs/adr/0030), and one counting in hours must not say "point".
 */

const map = (locale: "da" | "en") =>
  createTranslator({ locale, messages: locale === "da" ? da : en, namespace: "map" });

describe("the story map's band label", () => {
  it("names the sum in the board's own unit", () => {
    expect(map("da")("rowCounts", { unit: "points", cards: 5, points: 11 })).toBe(
      "5 kort · 11 point",
    );
    expect(map("da")("rowCounts", { unit: "hours", cards: 5, points: 11 })).toBe(
      "5 kort · 11 timer",
    );
    // Sizes name one card; a band holding eleven weights is a weight.
    expect(map("da")("rowCounts", { unit: "tshirt", cards: 5, points: 11 })).toBe(
      "5 kort · vægt 11",
    );
  });

  it("counts in English too, with the plurals English needs", () => {
    expect(map("en")("rowCounts", { unit: "points", cards: 1, points: 1 })).toBe(
      "1 card · 1 point",
    );
    expect(map("en")("rowCounts", { unit: "points", cards: 2, points: 5 })).toBe(
      "2 cards · 5 points",
    );
    expect(map("en")("rowCounts", { unit: "hours", cards: 1, points: 1 })).toBe("1 card · 1 hour");
    expect(map("en")("rowCounts", { unit: "tshirt", cards: 2, points: 11 })).toBe(
      "2 cards · weight 11",
    );
  });

  it("says nothing about a unit when a band is empty", () => {
    expect(map("da")("rowCounts", { unit: "tshirt", cards: 0, points: 0 })).toBe("0 kort · vægt 0");
    expect(map("en")("rowCounts", { unit: "points", cards: 0, points: 0 })).toBe(
      "0 cards · 0 points",
    );
  });
});
