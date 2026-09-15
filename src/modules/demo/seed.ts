import { sql } from "drizzle-orm";
import { addDaysIso, todayInCopenhagen } from "@/core/dates";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { ownPerson } from "@/modules/boards/people";
import { createBoard } from "@/modules/boards/write-boards";
import { updateChecklist } from "@/modules/boards/write-card-details";
import { createCard, moveCard, updateCard } from "@/modules/boards/write-cards";
import {
  closeSprint,
  createSprint,
  setCardsSprint,
  startSprint,
} from "@/modules/boards/write-sprints";
import { addComment } from "@/modules/boards/comments";
import { columnsOf } from "@/modules/boards/lanes";
import { closeSeeded, placement, seedStructure, type SeededStructure } from "./seed-structure";
import { DEMO_DA, DEMO_EN, type DemoWords } from "./words";

/**
 * The two boards a visitor lands in. Both are deliberately mid-flight: a
 * Kanban board with a column over its limit and a blocked card, and a
 * Scrum board four days into a sprint with two closed sprints behind it,
 * because a board where nothing is happening shows nothing about what
 * the tool is for.
 *
 * Built through the ordinary services rather than raw inserts, so the
 * demo cannot drift away from what the product actually does. The one
 * liberty taken afterwards is time: the clocks and the transition log
 * are shifted back so the insight page has weeks to draw, not minutes.
 */
export async function seedDemoWorkspace(
  tx: AppTransaction,
  ctx: OrgContext,
  locale: "da" | "en",
): Promise<string> {
  const words = locale === "da" ? DEMO_DA : DEMO_EN;
  // The visitor's person: made by the membership trigger (docs/adr/0029).
  const me = (await ownPerson(tx, ctx))?.id ?? null;
  const today = todayInCopenhagen();
  const day = (offset: number) => addDaysIso(today, offset);

  const kanban = await seedKanban(tx, ctx, words, me);
  const scrum = await seedScrum(tx, ctx, words, day, me);
  await shiftHistory(tx, ctx, [...kanban.seeded.aged, ...scrum.aged]);
  return kanban.boardId;
}

async function seedKanban(
  tx: AppTransaction,
  ctx: OrgContext,
  words: DemoWords,
  me: string | null,
): Promise<{ boardId: string; seeded: SeededStructure }> {
  const board = await createBoard(tx, ctx, {
    name: words.kanban.name,
    key: words.kanban.key,
    mode: "kanban",
    description: words.kanban.description,
    firstArea: words.kanban.structure.areas[0]!,
  });
  const seeded = await seedStructure(tx, ctx, board.id, words.kanban.structure);
  const columns = await columnsOf(tx, board.id);
  const col = (category: string) => columns.find((c) => c.category === category)!;
  const created: string[] = [];
  for (const [i, spec] of words.kanban.cards.entries()) {
    const card = await createCard(tx, ctx, {
      boardId: board.id,
      title: spec.title,
      description: spec.description ?? "",
      estimate: spec.estimate ?? null,
      priority: spec.priority ?? "normal",
      dueDate:
        spec.dueOffset === undefined ? null : addDaysIso(todayInCopenhagen(), spec.dueOffset),
      assigneePersonId: i % 3 === 0 ? me : null,
      bug: spec.bug ?? false,
      kind: spec.enabler ? "enabler" : undefined,
      enablerType: spec.enabler ?? null,
      ...placement(seeded, spec),
    });
    created.push(card.id);
    if (spec.column !== "backlog") await moveCard(tx, ctx, card.id, col(spec.column).id, undefined);
    if (spec.checklist) {
      await updateChecklist(
        tx,
        ctx,
        card.id,
        spec.checklist.map((title, n) => ({ id: `demo-${n}`, title, done: n < 1 })),
      );
    }
    if (spec.blocked) {
      await updateCard(tx, ctx, card.id, { blocked: true, blockedReason: spec.blocked });
    }
  }
  const first = created[0];
  if (first) await addComment(tx, ctx, first, words.kanban.comment);
  await closeSeeded(tx, ctx, seeded);
  return { boardId: board.id, seeded };
}

async function seedScrum(
  tx: AppTransaction,
  ctx: OrgContext,
  words: DemoWords,
  day: (offset: number) => string,
  me: string | null,
): Promise<SeededStructure> {
  const board = await createBoard(tx, ctx, {
    name: words.scrum.name,
    key: words.scrum.key,
    mode: "scrum",
    description: words.scrum.description,
    firstArea: words.scrum.structure.areas[0]!,
  });
  const seeded = await seedStructure(tx, ctx, board.id, words.scrum.structure);
  const columns = await columnsOf(tx, board.id);
  const done = columns.find((c) => c.category === "done")!;
  const doing = columns.find((c) => c.category === "doing")!;

  // Two sprints already behind the team, with their velocity written down.
  for (const [i, past] of words.scrum.pastSprints.entries()) {
    const sprint = (await createSprint(tx, ctx, {
      boardId: board.id,
      name: past.name,
      goal: past.goal,
      startDate: day(-28 + i * 14),
      endDate: day(-15 + i * 14),
    }))!;
    const ids: string[] = [];
    for (const spec of past.cards) {
      const card = await createCard(tx, ctx, {
        boardId: board.id,
        title: spec.title,
        estimate: spec.estimate,
        assigneePersonId: me,
        bug: spec.bug ?? false,
        kind: spec.enabler ? "enabler" : undefined,
        enablerType: spec.enabler ?? null,
        ...placement(seeded, spec),
      });
      ids.push(card.id);
    }
    await setCardsSprint(tx, ctx, ids, sprint.id);
    await startSprint(tx, ctx, sprint.id);
    for (const [n, id] of ids.entries()) {
      if (past.cards[n]!.done) await moveCard(tx, ctx, id, done.id, undefined);
    }
    await closeSprint(tx, ctx, sprint.id, null);
  }

  // The sprint the team is in now, four days in.
  const active = (await createSprint(tx, ctx, {
    boardId: board.id,
    name: words.scrum.activeSprint.name,
    goal: words.scrum.activeSprint.goal,
    startDate: day(-4),
    endDate: day(9),
  }))!;
  const activeIds: string[] = [];
  for (const spec of words.scrum.activeSprint.cards) {
    const card = await createCard(tx, ctx, {
      boardId: board.id,
      title: spec.title,
      estimate: spec.estimate,
      priority: spec.priority ?? "normal",
      assigneePersonId: spec.mine ? me : null,
      bug: spec.bug ?? false,
      kind: spec.enabler ? "enabler" : undefined,
      enablerType: spec.enabler ?? null,
      ...placement(seeded, spec),
    });
    activeIds.push(card.id);
  }
  await setCardsSprint(tx, ctx, activeIds, active.id);
  await startSprint(tx, ctx, active.id);
  for (const [n, id] of activeIds.entries()) {
    const spec = words.scrum.activeSprint.cards[n]!;
    if (spec.state === "done") await moveCard(tx, ctx, id, done.id, undefined);
    if (spec.state === "doing") await moveCard(tx, ctx, id, doing.id, undefined);
  }

  // The backlog, in priority order, and a sprint already planned.
  for (const spec of words.scrum.backlog) {
    await createCard(tx, ctx, {
      boardId: board.id,
      title: spec.title,
      estimate: spec.estimate,
      bug: spec.bug ?? false,
      kind: spec.enabler ? "enabler" : undefined,
      enablerType: spec.enabler ?? null,
      ...placement(seeded, spec),
    });
  }
  await createSprint(tx, ctx, {
    boardId: board.id,
    name: words.scrum.plannedSprint.name,
    goal: words.scrum.plannedSprint.goal,
    startDate: day(10),
    endDate: day(23),
  });
  await closeSeeded(tx, ctx, seeded);
  return seeded;
}

/**
 * Moves the seeded history back in time. Every card, transition and
 * closed sprint was written a moment ago; here the closed sprints' work
 * is spread over the four weeks the sprint dates claim, and the active
 * sprint's done cards over its first days, so the burndown, the
 * throughput and the flow diagram have a past to draw.
 */
async function shiftHistory(
  tx: AppTransaction,
  ctx: OrgContext,
  aged: Array<{ id: string; days: number }>,
): Promise<void> {
  // Closed sprints: cards done spread across the sprint's own days.
  await tx.execute(sql`
    with placed as (
      select c.id, s.start_date, s.end_date,
             row_number() over (partition by s.id order by c.number) as n,
             count(*) over (partition by s.id) as total
      from cards c join sprints s on s.id = c.sprint_id
      where s.state = 'closed' and c.org_id = ${ctx.orgId}
    )
    update cards c set
      created_at = (p.start_date::timestamptz - interval '2 days') + (p.n * interval '3 hours'),
      started_at = p.start_date::timestamptz + ((p.n - 1) * (p.end_date - p.start_date) * interval '1 day' / greatest(p.total, 1)) + interval '9 hours',
      done_at = case when c.done_at is null then null else
        p.start_date::timestamptz + (p.n * (p.end_date - p.start_date) * interval '1 day' / greatest(p.total, 1)) + interval '15 hours' end,
      updated_at = now()
    from placed p where p.id = c.id
  `);
  // The active sprint: created before it started, done cards on its first days.
  await tx.execute(sql`
    with placed as (
      select c.id, s.start_date, row_number() over (partition by s.id order by c.number) as n
      from cards c join sprints s on s.id = c.sprint_id
      where s.state = 'active' and c.org_id = ${ctx.orgId}
    )
    update cards c set
      created_at = p.start_date::timestamptz - interval '3 days' + (p.n * interval '1 hour'),
      started_at = case when c.started_at is null then null else p.start_date::timestamptz + interval '10 hours' + (p.n * interval '5 hours') end,
      done_at = case when c.done_at is null then null else p.start_date::timestamptz + interval '1 day' + (p.n * interval '9 hours') end
    from placed p where p.id = c.id
  `);
  // The Kanban board: finished cards spread over the last three weeks,
  // the rest created over the last three as well, everything in the past,
  // so throughput and cycle time have a past to count.
  await tx.execute(sql`
    with placed as (
      select c.id,
             row_number() over (order by c.number) as n,
             count(*) over () as total,
             row_number() over (partition by (c.done_at is not null) order by c.number) as dn,
             count(*) over (partition by (c.done_at is not null)) as dtotal
      from cards c join boards b on b.id = c.board_id
      where b.mode = 'kanban' and c.org_id = ${ctx.orgId}
    )
    update cards c set
      done_at = case when c.done_at is null then null else
        now() - interval '24 days' + ((p.dn - 1) * interval '22 days' / greatest(p.dtotal, 1)) + interval '6 hours' end,
      started_at = case
        when c.started_at is null then null
        when c.done_at is not null then
          now() - interval '24 days' + ((p.dn - 1) * interval '22 days' / greatest(p.dtotal, 1)) - ((2 + p.dn % 4) * interval '1 day')
        else now() - interval '9 days' + ((p.n % 5) * interval '1 day') end,
      created_at = case
        when c.done_at is not null then
          now() - interval '24 days' + ((p.dn - 1) * interval '22 days' / greatest(p.dtotal, 1)) - ((3 + p.dn % 4) * interval '1 day')
        else now() - interval '20 days' + ((p.n - 1) * interval '10 days' / greatest(p.total, 1)) end
    from placed p where p.id = c.id
  `);
  // The transition log follows the clocks: creation, start and finish.
  await tx.execute(sql`
    update card_transitions t set at = c.created_at
    from cards c where c.id = t.card_id and t.from_column_id is null and c.org_id = ${ctx.orgId}
  `);
  await tx.execute(sql`
    update card_transitions t set at = coalesce(c.started_at, c.created_at)
    from cards c where c.id = t.card_id and t.to_category = 'doing' and c.org_id = ${ctx.orgId}
  `);
  await tx.execute(sql`
    update card_transitions t set at = coalesce(c.done_at, c.created_at)
    from cards c where c.id = t.card_id and t.to_category = 'done' and c.org_id = ${ctx.orgId}
  `);
  await tx.execute(sql`
    update card_transitions t set at = c.created_at + interval '1 hour'
    from cards c where c.id = t.card_id and t.to_category = 'todo' and t.from_column_id is not null and c.org_id = ${ctx.orgId}
  `);
  await tx.execute(sql`
    update sprints s set
      started_at = s.start_date::timestamptz + interval '9 hours',
      closed_at = case when s.state = 'closed' then s.end_date::timestamptz + interval '16 hours' else null end
    where s.org_id = ${ctx.orgId} and s.state <> 'planned'
  `);
  // The structure: items were created before their cards, and one epic is
  // made old enough to show the review mark; closed items closed with the
  // second sprint.
  await tx.execute(sql`
    update backlog_items i set created_at = now() - interval '40 days' - (i.number * interval '1 hour')
    where i.org_id = ${ctx.orgId}
  `);
  for (const epic of aged) {
    await tx.execute(sql`
      update backlog_items set created_at = now() - (${epic.days} * interval '1 day')
      where id = ${epic.id} and org_id = ${ctx.orgId}
    `);
  }
  await tx.execute(sql`
    update backlog_items set closed_at = now() - interval '15 days'
    where org_id = ${ctx.orgId} and state = 'closed'
  `);
}
