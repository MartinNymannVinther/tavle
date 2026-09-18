import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { LANDED_MS } from "@/components/board/use-landed";

/**
 * The landing mark lives in two places that cannot see each other: the
 * timeout that takes the class off, and the animation that fades the
 * tint. Drift either way and the mark misbehaves in a manner nobody
 * reports as a bug — a little too long and it lingers over the next
 * move; a little too short and it disappears mid-fade, which reads as a
 * flicker rather than an answer.
 *
 * Also pinned here: what reduced motion is allowed to take away. It may
 * take the fade; it may not take the mark, because the mark is the only
 * thing the person is being told.
 */

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("the landing mark", () => {
  it("fades for exactly as long as the class is on the row", async () => {
    const css = await read("src/app/globals.css");
    const duration = css.match(/animation: landed (\d+)ms/)?.[1];
    expect(duration, "the .landed rule should still name its own duration").toBeDefined();
    expect(Number(duration)).toBe(LANDED_MS);
  });

  it("keeps the mark under reduced motion and drops only the movement", async () => {
    const css = await read("src/app/globals.css");
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.landed::after \{([\s\S]*?)\}/,
    )?.[1];
    expect(block, "reduced motion should still be answered for .landed").toBeDefined();
    expect(block).toContain("animation: none");
    // Not display:none, not opacity:0 — the tint has to stand.
    expect(block).toMatch(/opacity:\s*1/);
  });

  it("lays the tint over the row instead of setting its background", async () => {
    // Rows sit on three different grounds — the list's, a card's, a
    // sprint panel's. Animating background-color would fade whichever
    // one it is to nothing on the way out.
    const css = await read("src/app/globals.css");
    const rule = css.match(/\.landed::after \{([\s\S]*?)\}/)?.[1];
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("pointer-events: none");
  });
});
