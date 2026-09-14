import { describe, expect, it } from "vitest";
import { sanitizeDoneWhen, sanitizeQuickAssist } from "@/modules/ai/assists";

/**
 * The quiet assists' write boundary (docs/adr/0025), fed the answers
 * models actually give. No model runs here: the sanitizers are the
 * contract, and they must hold shape without one.
 */

const pools = {
  features: [
    { id: "f1", title: "Betalinger" },
    { id: "f2", title: "Login og konto" },
  ],
  areas: [
    { id: "a1", name: "Butikken" },
    { id: "a2", name: "Driften" },
  ],
  cards: [
    { number: 41, title: "Betaling fejler på mobil" },
    { number: 42, title: "Kvittering på mail" },
  ],
};

describe("the done-when draft", () => {
  it("keeps one capped sentence and refuses everything else", () => {
    expect(sanitizeDoneWhen({ doneWhen: "  Kunden kan betale med kort.  " })).toBe(
      "Kunden kan betale med kort.",
    );
    expect(sanitizeDoneWhen({ doneWhen: "x".repeat(600) })).toHaveLength(500);
    expect(sanitizeDoneWhen({ doneWhen: "" })).toBeNull();
    expect(sanitizeDoneWhen({ doneWhen: 42 })).toBeNull();
    expect(sanitizeDoneWhen(null)).toBeNull();
  });
});

describe("the quick assist", () => {
  it("resolves names against the board's own rows, feature before area", () => {
    expect(sanitizeQuickAssist({ feature: "betalinger", area: "Butikken" }, pools).place).toEqual({
      featureId: "f1",
    });
    expect(sanitizeQuickAssist({ feature: null, area: "Driften" }, pools).place).toEqual({
      areaId: "a2",
    });
    expect(sanitizeQuickAssist({ feature: "Opdigtet", area: "Ukendt" }, pools).place).toBeNull();
  });

  it("keeps only duplicates that exist, once each, at most three", () => {
    const out = sanitizeQuickAssist({ duplicates: [41, 99, "41", 42, 41, 41] }, pools);
    expect(out.duplicates.map((d) => d.number)).toEqual([41, 42]);
    expect(out.duplicates[0]!.title).toBe("Betaling fejler på mobil");
    expect(sanitizeQuickAssist({ duplicates: "alle sammen" }, pools).duplicates).toEqual([]);
    expect(sanitizeQuickAssist(undefined, pools)).toEqual({ place: null, duplicates: [] });
  });
});
