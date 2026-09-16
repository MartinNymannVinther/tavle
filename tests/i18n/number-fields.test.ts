import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { decimalValue } from "@/components/settings/decimal";
import { HOURS_PER_POINT_MAX, HOURS_PER_POINT_MIN } from "@/modules/boards/estimates";
import da from "../../messages/da.json";
import en from "../../messages/en.json";

/**
 * A field that asks for a number, and a sentence beside it that writes
 * the bounds out, have to agree about what a number looks like. Danish
 * writes a half as "0,5"; `<input type="number">` takes "0.5" and
 * nothing else, whatever the page's language, so the sentence asked for
 * a character the field threw away and the factor silently fell back to
 * its default. The field reads both separators now, and this holds the
 * two together: whatever the message prints, the field can take.
 */

const say = (locale: "da" | "en", key: string, values: Record<string, number>) =>
  createTranslator({
    locale,
    messages: locale === "da" ? da : en,
    namespace: "boardSettings.estimates",
  })(key as never, values as never) as unknown as string;

/** The numbers as a reader sees them, in the order the sentence writes them. */
const numbersIn = (sentence: string) =>
  [...sentence.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0]);

describe("the hour factor's bounds", () => {
  it("are written in each language and read back by the field, comma and all", () => {
    for (const locale of ["da", "en"] as const) {
      const sentence = say(locale, "factorRange", {
        min: HOURS_PER_POINT_MIN,
        max: HOURS_PER_POINT_MAX,
      });
      expect(numbersIn(sentence).map(decimalValue)).toEqual([
        HOURS_PER_POINT_MIN,
        HOURS_PER_POINT_MAX,
      ]);
    }
    // The Danish sentence really does ask for the comma; without it this
    // test would pass on a message that had quietly switched to a point.
    expect(
      say("da", "factorRange", { min: HOURS_PER_POINT_MIN, max: HOURS_PER_POINT_MAX }),
    ).toContain("0,5");
  });

  it("takes a half written either way, and refuses what is not a number", () => {
    expect(decimalValue("0,5")).toBe(0.5);
    expect(decimalValue("0.5")).toBe(0.5);
    expect(decimalValue(" 7,5 ")).toBe(7.5);
    // An empty field is not a zero anybody typed, and a zero would be
    // refused as out of range rather than run as a conversion.
    expect(decimalValue("")).toBeNaN();
    expect(decimalValue("halvanden")).toBeNaN();
    expect(decimalValue("0,5,5")).toBeNaN();
  });
});
