import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Two layout rules a phone depends on, and nothing else in the suite can
 * see. Both were found by measuring a real board at 414px, not by reading
 * the code, which is why they are pinned here.
 *
 * The board's tab strip is up to nine links wide and means to scroll
 * inside its own box. It is handed to PageHeader's actions slot, and the
 * strip's own `max-w-full` only means something when the box above it has
 * a width of its own: the slot is `shrink-0`, so without a cap it grows to
 * its content, `max-w-full` resolves against those 749px, nothing scrolls,
 * and every board page drags the whole document 769px wide on a 414px
 * phone - a band of bare background beside every screen.
 *
 * The sprint strip wraps, and wrapping is decided by the flex basis.
 * `flex-1` is a basis of zero: the block holding the sprint's dates and
 * name becomes invisible to the wrapping, the row never breaks, and the
 * block is crushed to whatever the numbers leave over - 3px at 390, with
 * the date range painted on top of the column beside it. A basis to ask
 * for is what makes the row break instead.
 */

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("the page header keeps to the viewport", () => {
  it("caps the actions slot at the header's own width", async () => {
    const source = await read("src/components/ui/page-header.tsx");
    const slot = source.match(/\{actions \?[\s\S]*?<div className="([^"]+)"/)?.[1];
    expect(slot, "the actions slot should still be one div with a class list").toBeDefined();
    expect(slot).toContain("max-w-full");
  });

  it("keeps the board's tabs in a box that scrolls sideways", async () => {
    const source = await read("src/app/[locale]/(app)/boards/[id]/board-tabs.tsx");
    const box = source.match(/<div ref=\{box\} className="([^"]+)"/)?.[1];
    expect(box, "the tab track should still sit in a box of its own").toBeDefined();
    expect(box).toContain("overflow-x-auto");
    expect(box).toContain("min-w-0");
  });
});

describe("the sprint strip asks for a width", () => {
  it("gives the sprint's dates and name a flex basis, not flex-1's nothing", async () => {
    const source = await read("src/components/board/sprint-header.tsx");
    const block = source.match(
      /<div className="([^"]*(?:grow|flex-1)[^"]*)">\s*<p className="text-chart-2/,
    )?.[1];
    expect(block, "the sprint's dates and name should still lead the strip").toBeDefined();
    expect(block).toMatch(/basis-\S+/);
    expect(block).toContain("min-w-0");
  });
});
