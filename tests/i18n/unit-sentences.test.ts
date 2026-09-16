import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import da from "../../messages/da.json";
import en from "../../messages/en.json";

/**
 * Every sentence that names what a board counts in, rendered through the
 * real catalogues in both languages and all three units (docs/adr/0030).
 *
 * Two bugs live here and neither the compiler nor a static reader sees
 * them. A missing variable is a formatting error at render time, so the
 * sentence simply vanishes in front of the user. And a select with only
 * `hours` and `other` tells a T-shirt board its work is measured in
 * points, on the same page whose cards read "L". The house answer for a
 * *sum* on such a board is a weight — "vægt 11", "weight 11" — because a
 * size names one card and there is no word for a total of sizes.
 */

type Values = Record<string, string | number>;

/** Every message in the catalogue that branches on the board's unit. */
function unitKeys(node: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      if (value.includes("{unit,")) keys.push(path);
    } else if (value && typeof value === "object") {
      keys.push(...unitKeys(value as Record<string, unknown>, path));
    }
  }
  return keys;
}

/**
 * next-intl swallows a formatting error and prints the key instead, which
 * is exactly the silence this file is here to break: onError rethrows, so
 * a message asked for without its variables fails the test.
 */
const say = (locale: "da" | "en", key: string, values: Values) =>
  createTranslator({
    locale,
    messages: locale === "da" ? da : en,
    onError: (error) => {
      throw error;
    },
  })(key as never, values as never) as unknown as string;

const UNITS = ["points", "hours", "tshirt"] as const;
const LOCALES = ["da", "en"] as const;

/**
 * What each sentence needs, and whether it names a *sum* — the ones that
 * do must say "vægt"/"weight" on a T-shirt board; the ones that do not
 * (a field label, a single card's estimate, the name of the unit itself)
 * must not.
 */
const CASES: Array<{ key: string; values: Values; sum: boolean }> = [
  { key: "boards.sprint.progressValue", values: { done: 1, total: 1 }, sum: true },
  { key: "boards.sprint.closeBody", values: { done: 1, open: 3, points: 1 }, sum: true },
  { key: "cards.ai.points", values: {}, sum: false },
  { key: "backlog.holds", values: { cards: 1, points: 1 }, sum: true },
  { key: "backlog.sprint.holds", values: { cards: 1, points: 1 }, sum: true },
  {
    key: "backlog.heading.epicCounts",
    values: { features: 1, cards: 1, points: 1 },
    sum: true,
  },
  {
    key: "backlog.heading.featureCounts",
    values: { cards: 1, points: 1, open: 1 },
    sum: true,
  },
  { key: "sprints.velocityBody", values: { average: 1 }, sum: true },
  { key: "sprints.closedPoints", values: { completed: 1, committed: 1 }, sum: true },
  { key: "sprints.committedPoints", values: { committed: 1 }, sum: true },
  {
    key: "sprints.detail.numbers",
    values: { done: 1, total: 1, donePoints: 1, totalPoints: 1 },
    sum: true,
  },
  {
    key: "insight.burndownBody",
    values: { name: "Sprint 4", remaining: 1, committed: 1, end: "25. sep." },
    sum: true,
  },
  { key: "insight.velocityBody", values: { average: 1 }, sum: true },
  { key: "care.summary", values: { cards: 1, points: 1 }, sum: true },
  { key: "care.tooDeep.body", values: { value: 1, of: 1 }, sum: true },
  { key: "overview.distributionBody", values: { cards: 1, points: 1 }, sum: true },
  { key: "overview.bucketValue", values: { cards: 1, points: 1 }, sum: true },
  { key: "map.rowCounts", values: { cards: 1, points: 1 }, sum: true },
  { key: "roadmap.releases.weight", values: { points: 1 }, sum: true },
  { key: "events.board.estimateUnit", values: { cards: 1 }, sum: false },
  { key: "events.card.estimated", values: { key: "TAV-3", points: 1, size: "L" }, sum: false },
  {
    key: "events.sprint.started",
    values: { name: "Sprint 4", cards: 1, points: 1 },
    sum: true,
  },
  {
    key: "events.sprint.closed",
    values: { name: "Sprint 4", completed: 1, committed: 1, carried: 1 },
    sum: true,
  },
];

/** Words that belong to one unit and must never appear under another. */
const FOREIGN: Record<(typeof UNITS)[number], RegExp> = {
  points: /\btimer?\b|\bhours?\b|vægt|weight/i,
  hours: /\bpoints?\b|vægt|weight/i,
  tshirt: /\bpoints?\b|\btimer?\b|\bhours?\b/i,
};

describe("the sentences that name what a board counts in", () => {
  it("covers every unit-naming message in the catalogue", () => {
    const covered = new Set(CASES.map((c) => c.key));
    const uncovered = unitKeys(da as Record<string, unknown>)
      .filter((key) => !covered.has(key))
      .sort();
    expect(uncovered).toEqual([]);
  });

  it("renders in both languages and all three units, with every variable it asks for", () => {
    for (const { key, values } of CASES) {
      for (const locale of LOCALES) {
        for (const unit of UNITS) {
          const sentence = say(locale, key, { ...values, unit });
          expect(sentence, `${locale} ${unit} ${key}`).not.toBe(key);
          expect(sentence.trim(), `${locale} ${unit} ${key}`).not.toBe("");
        }
      }
    }
  });

  it("never borrows another unit's word", () => {
    const wrong: string[] = [];
    for (const { key, values } of CASES) {
      for (const locale of LOCALES) {
        for (const unit of UNITS) {
          const sentence = say(locale, key, { ...values, unit });
          // The event that announces the switch names all three by design.
          if (key === "events.board.estimateUnit") continue;
          if (FOREIGN[unit].test(sentence)) wrong.push(`${locale} ${unit} ${key}: ${sentence}`);
        }
      }
    }
    expect(wrong.sort()).toEqual([]);
  });

  it("calls a total on a T-shirt board a weight, and nothing else one", () => {
    for (const { key, values, sum } of CASES) {
      for (const locale of LOCALES) {
        const sizes = say(locale, key, { ...values, unit: "tshirt" });
        const word = locale === "da" ? /vægt/i : /weight/i;
        expect(word.test(sizes), `${locale} tshirt ${key}: ${sizes}`).toBe(sum);
      }
    }
  });

  it("never writes “1 points” or “1 hours”", () => {
    const wrong: string[] = [];
    for (const { key, values } of CASES) {
      for (const unit of UNITS) {
        const english = say("en", key, { ...values, unit });
        if (/\b1 (points|hours|cards|features|epics|sprints)\b/.test(english)) {
          wrong.push(`en ${unit} ${key}: ${english}`);
        }
        // "kort" and "point" are invariant in Danish; "time/timer" is not.
        const danish = say("da", key, { ...values, unit });
        if (/\b1 timer\b/.test(danish)) wrong.push(`da ${unit} ${key}: ${danish}`);
      }
    }
    expect(wrong.sort()).toEqual([]);
  });

  /**
   * Backlog care asks for its findings with a key built at runtime, so
   * the static scan in messages.test.ts cannot see them. Render the whole
   * family with the values src/components/overview/care-list.tsx hands
   * over — a measurement, or a plain count — in every unit.
   */
  it("renders every backlog-care finding, including the ones asked for by a built key", () => {
    const findings = Object.keys((da as { care: Record<string, unknown> }).care).filter(
      (key) => typeof (da.care as Record<string, { body?: string }>)[key]?.body === "string",
    );
    expect(findings.length).toBeGreaterThan(5);
    for (const finding of findings) {
      for (const locale of LOCALES) {
        for (const unit of UNITS) {
          const sentence = say(locale, `care.${finding}.body`, {
            unit,
            count: 1,
            value: 756,
            of: 84,
          });
          expect(sentence, `${locale} ${unit} care.${finding}.body`).not.toBe("");
        }
      }
    }
  });

  it("fails loudly when a sentence is asked for without a unit", () => {
    expect(() => say("da", "care.summary", { cards: 1, points: 1 })).toThrow();
  });
});

describe("the sentences, word for word", () => {
  it("states the sprint's close in the board's own unit", () => {
    expect(
      say("en", "boards.sprint.closeBody", { unit: "points", done: 1, open: 3, points: 1 }),
    ).toBe(
      "1 card is done (1 point). 3 are not. The sprint's numbers are written down as they stand now.",
    );
    expect(
      say("en", "boards.sprint.closeBody", { unit: "hours", done: 1, open: 3, points: 1 }),
    ).toBe(
      "1 card is done (1 hour). 3 are not. The sprint's numbers are written down as they stand now.",
    );
    expect(
      say("da", "boards.sprint.closeBody", { unit: "tshirt", done: 5, open: 0, points: 23 }),
    ).toBe("5 kort er færdige (vægt 23). 0 er ikke. Sprintens tal skrives ned som de står nu.");
  });

  it("counts backlog care in what the cards on the board actually show", () => {
    expect(say("da", "care.summary", { unit: "tshirt", cards: 5, points: 23 })).toBe(
      "5 kort venter · vægt 23",
    );
    expect(say("da", "care.summary", { unit: "points", cards: 5, points: 23 })).toBe(
      "5 kort venter · 23 point",
    );
    expect(say("da", "care.summary", { unit: "hours", cards: 1, points: 1 })).toBe(
      "1 kort venter · 1 time",
    );
    expect(say("en", "care.summary", { unit: "hours", cards: 5, points: 23 })).toBe(
      "5 cards waiting · 23 hours",
    );
  });

  it("agrees with the cards it counts on the sprint's own page", () => {
    const values = { done: 1, total: 1, donePoints: 1, totalPoints: 1 };
    expect(say("en", "sprints.detail.numbers", { ...values, unit: "points" })).toBe(
      "1 of 1 card done · 1 of 1 point",
    );
    expect(say("da", "sprints.detail.numbers", { ...values, unit: "hours" })).toBe(
      "1 af 1 kort færdigt · 1 af 1 time",
    );
    expect(
      say("en", "sprints.detail.numbers", {
        unit: "tshirt",
        done: 2,
        total: 5,
        donePoints: 8,
        totalPoints: 23,
      }),
    ).toBe("2 of 5 cards done · weight 8 of 23");
  });

  it("names the sprint list's numbers the same way", () => {
    expect(say("da", "sprints.closedPoints", { unit: "tshirt", completed: 8, committed: 23 })).toBe(
      "vægt 8 af 23",
    );
    expect(say("en", "sprints.committedPoints", { unit: "hours", committed: 1 })).toBe(
      "1 hour committed",
    );
    expect(say("en", "sprints.committedPoints", { unit: "tshirt", committed: 23 })).toBe(
      "weight 23 committed",
    );
  });

  it("keeps the burndown's remainder out of the commitment's shadow", () => {
    const values = { name: "Sprint 11", remaining: 18, committed: 5, end: "25. september" };
    expect(say("da", "insight.burndownBody", { ...values, unit: "tshirt" })).toBe(
      "Sprint 11: vægt 18 tilbage, 5 lovet ved start. Slutter 25. september.",
    );
    expect(say("en", "insight.burndownBody", { ...values, unit: "points" })).toBe(
      "Sprint 11: 18 points left, 5 committed at start. Ends 25. september.",
    );
  });

  it("states the board's progress with the word where the unit puts it", () => {
    expect(say("da", "boards.sprint.progressValue", { unit: "points", done: 3, total: 8 })).toBe(
      "3/8 point",
    );
    expect(say("da", "boards.sprint.progressValue", { unit: "tshirt", done: 3, total: 8 })).toBe(
      "vægt 3/8",
    );
    expect(say("en", "boards.sprint.progressValue", { unit: "hours", done: 0, total: 1 })).toBe(
      "0/1 hour",
    );
  });
});
