import { boards, type EstimateUnit } from "@/core/db/schema";
import { withOrgContext, type OrgContext } from "@/core/db/tenant";

/**
 * What each board counts in (docs/adr/0030), for the lists that cross
 * boards. On a board page the unit is known from the board itself; "my
 * cards" puts three boards' rows in one column, and a bare "20" there
 * means nothing unless the row says whether it is hours, points or a
 * size. One query for the workspace: a person is on a handful of boards,
 * and asking per board would be a handful of round trips for one word.
 */
export async function listEstimateUnits(ctx: OrgContext): Promise<Map<string, EstimateUnit>> {
  return withOrgContext(ctx, async (tx) => {
    const rows = await tx.select({ id: boards.id, unit: boards.estimateUnit }).from(boards);
    return new Map(rows.map((row) => [row.id, row.unit as EstimateUnit]));
  });
}
