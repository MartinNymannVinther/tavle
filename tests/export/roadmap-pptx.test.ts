import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { formatPlanDate, todayInCopenhagen } from "@/core/dates";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { getBoardFull } from "@/modules/boards/read";
import { createItem } from "@/modules/boards/structure/write-items";
import { createBoard } from "@/modules/boards/write-boards";
import { buildRoadmapPptx } from "@/modules/export/roadmap-pptx";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * The one-slide roadmap (docs/adr/0028): a real .pptx comes back for
 * the caller's own board, and a foreign board id is simply not found.
 */

let admin: Pool;
let ctx: OrgContext;
let boardId: string;

const run = <T>(fn: Parameters<typeof withOrgContext<T>>[1]) => withOrgContext(ctx, fn);

beforeAll(async () => {
  admin = adminPool();
  ctx = await seedWorkspace(admin, "pptx_a");
  const board = await run((tx) =>
    createBoard(tx, ctx, { name: "Slidebar", key: "PPT", mode: "scrum", firstArea: "Alt" }),
  );
  boardId = board.id;
  const areaId = (await getBoardFull(ctx, boardId))!.areas[0]!.id;
  await run((tx) =>
    createItem(tx, ctx, {
      boardId,
      level: "epic",
      title: "På sliden",
      doneWhen: "Roadmappet kan vises",
      areaId,
      targetQuarter: "2027-Q1",
    }),
  );
});

afterAll(async () => {
  await admin.end();
});

const LABELS = { unplanned: "Uplanlagt" };

/** Every word on the slide, read back out of the zip by a reader that did not write it. */
function slideText(buffer: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), "pptx-"));
  const file = join(dir, "deck.pptx");
  writeFileSync(file, buffer);
  return execFileSync("python3", [
    "-c",
    "import zipfile,re,sys;x=zipfile.ZipFile(sys.argv[1]).read('ppt/slides/slide1.xml').decode();print(' '.join(re.findall(r'<a:t>(.*?)</a:t>',x)))",
    file,
  ]).toString();
}

describe("the roadmap slide", () => {
  it("returns a real pptx (a zip) for the board", async () => {
    const buffer = await buildRoadmapPptx(ctx, boardId, LABELS);
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBeGreaterThan(2000);
    expect(buffer!.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("dates its footer in the reader's own format, never in ISO", async () => {
    // The deck is the one artefact that leaves the building, and it was
    // stamped "Tavle · 2026-09-16" — a raw ISO day, read in UTC — in
    // both languages.
    const today = todayInCopenhagen();
    const danish = slideText((await buildRoadmapPptx(ctx, boardId, LABELS))!);
    const english = slideText((await buildRoadmapPptx(ctx, boardId, { ...LABELS, locale: "en" }))!);
    expect(danish).toContain(`Tavle · ${formatPlanDate(today, "da")}`);
    expect(english).toContain(`Tavle · ${formatPlanDate(today, "en")}`);
    expect(danish).not.toContain(today);
    expect(english).not.toContain(today);
  });

  it("answers null for a board that is not the workspace's", async () => {
    const stranger = await seedWorkspace(admin, "pptx_b");
    expect(await buildRoadmapPptx(stranger, boardId, LABELS)).toBeNull();
  });
});
