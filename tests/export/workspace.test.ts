import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";
import { createBoard } from "@/modules/boards/write-boards";
import { createCard } from "@/modules/boards/write-cards";
import { exportFileName, exportToJson, exportToXlsx } from "@/modules/export/format";
import { buildOrgExport } from "@/modules/export/service";
import { EXPORT_TABLES, MEMBERS_SHEET } from "@/modules/export/tables";
import { adminPool } from "../helpers/db";
import { seedWorkspace } from "../helpers/workspace";

/**
 * Dogma three, proven: the whole workspace comes out as a spreadsheet and
 * as JSON, through the RLS-guarded path, and one workspace's export holds
 * nothing of another's.
 */

let admin: Pool;
let a: OrgContext;
let b: OrgContext;

beforeAll(async () => {
  admin = adminPool();
  a = await seedWorkspace(admin, "export_a");
  b = await seedWorkspace(admin, "export_b");
  for (const ctx of [a, b]) {
    await withOrgContext(ctx, async (tx) => {
      const board = await createBoard(tx, ctx, {
        name: `Tavle ${ctx.orgId}`,
        key: "EXP",
        mode: "kanban",
      });
      await createCard(tx, ctx, { boardId: board.id, title: `Kort i ${ctx.orgId}` });
    });
  }
});

afterAll(async () => {
  await admin.end();
});

describe("the workspace export", () => {
  it("holds one tab per table, members first, and nothing from another workspace", async () => {
    const data = await buildOrgExport(a);
    expect(data.sections.map((s) => s.sheet)).toEqual([
      MEMBERS_SHEET,
      ...EXPORT_TABLES.map((t) => t.sheet),
    ]);
    const cards = data.sections.find((s) => s.sheet === "Kort")!;
    const titles = cards.rows.map((row) => row[cards.columns.indexOf("title")]);
    expect(titles).toEqual([`Kort i ${a.orgId}`]);
    const members = data.sections.find((s) => s.sheet === MEMBERS_SHEET)!;
    expect(members.rows.map((row) => row[1])).toEqual(["export_a@example.com"]);
  });

  it("records that the data left, in the audit log", async () => {
    const rows = await admin.query(
      `select count(*)::int as n from audit_log where org_id = $1 and action = 'workspace.exported'`,
      [a.orgId],
    );
    expect(rows.rows[0].n).toBeGreaterThan(0);
  });

  it("writes the same rows as JSON and as a workbook", async () => {
    const data = await buildOrgExport(b);
    const json = JSON.parse(exportToJson(data));
    expect(json.tavle.format).toBe(1);
    expect(json.tables.Kort.map((row: { title: string }) => row.title)).toEqual([
      `Kort i ${b.orgId}`,
    ]);
    const workbook = exportToXlsx(data);
    expect(workbook.subarray(0, 2).toString()).toBe("PK");
    expect(exportFileName("Team Æble", new Date("2026-09-11T10:00:00Z"), "xlsx")).toBe(
      "tavle-team-aeble-2026-09-11.xlsx",
    );
  });
});
