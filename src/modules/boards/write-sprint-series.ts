import { and, eq, ne, sql } from "drizzle-orm";
import { boards, sprints, type Sprint } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import { recordEvent } from "./events";
import { boardInWorkspace } from "./read";
import { createSprint } from "./write-sprints";

/**
 * Sprints ahead of time (docs/adr/0023): a run of planned sprints laid
 * back to back from the last one's end, each the board's own length, so
 * the feature plan has an axis to stand on. Twelve planned sprints is
 * the ceiling — a plan further out than that is a roadmap, and the
 * epics' quarters already carry it.
 */
export const MAX_PLANNED_SPRINTS = 12;

export async function createSprintSeries(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { boardId: string; count: number },
): Promise<Sprint[]> {
  const board = await boardInWorkspace(tx, input.boardId);
  if (!board || board.mode !== "scrum") return [];
  // The board row is the series' lock: two concurrent series serialize
  // here, so the ceiling and the axis are read after the other landed.
  const [numbering] = await tx
    .select({ next: boards.nextSprintNumber })
    .from(boards)
    .where(eq(boards.id, board.id))
    .for("update");
  let number = numbering!.next;
  const [planned] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(sprints)
    .where(and(eq(sprints.boardId, board.id), eq(sprints.state, "planned")));
  if (Number(planned?.n ?? 0) + input.count > MAX_PLANNED_SPRINTS) throw new Error("invalid");

  const [latest] = await tx
    .select({ endDate: sql<string | null>`max(${sprints.endDate})` })
    .from(sprints)
    .where(and(eq(sprints.boardId, board.id), ne(sprints.state, "closed")));
  // The series continues where the plan ends; with no open sprint it starts today.
  let start = latest?.endDate ? addDaysIso(latest.endDate, 1) : todayInCopenhagen();

  const created: Sprint[] = [];
  for (let i = 0; i < input.count; i += 1) {
    const end = addDaysIso(start, board.sprintLengthDays - 1);
    const sprint = await createSprint(tx, ctx, {
      boardId: board.id,
      name: `Sprint ${number}`,
      goal: "",
      startDate: start,
      endDate: end,
    });
    if (!sprint) break;
    created.push(sprint);
    number += 1;
    start = addDaysIso(end, 1);
  }
  if (created.length > 0) {
    await recordEvent(tx, ctx, board.id, "sprint.series", {
      count: created.length,
      from: created[0]!.startDate,
      to: created[created.length - 1]!.endDate,
    });
  }
  return created;
}
