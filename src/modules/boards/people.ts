import { and, asc, eq, isNull } from "drizzle-orm";
import { memberships, people, users, type Person } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";
import { Conflict } from "./lanes";

/**
 * The workspace's roster (docs/adr/0029): the people work is assigned
 * to. A person exists before any login does — a colleague named while
 * the board is set up — and a membership insert adopts them by e-mail
 * through the database trigger, so the two doors a login can come in
 * by both land here. Only responsibility points at a person; who *did*
 * something stays a real user in the audit trail.
 */

/** The roster in name order; the list every assignee picker shows. */
export async function peopleOf(tx: AppTransaction, orgId: string): Promise<Person[]> {
  return tx.select().from(people).where(eq(people.orgId, orgId)).orderBy(asc(people.name));
}

/** A person by id, or null; RLS makes anyone else's roster invisible. */
export async function personInWorkspace(
  tx: AppTransaction,
  personId: string | null | undefined,
): Promise<Person | null> {
  if (!personId) return null;
  const [row] = await tx.select().from(people).where(eq(people.id, personId)).limit(1);
  return row ?? null;
}

export async function createPerson(
  tx: AppTransaction,
  ctx: OrgContext,
  input: { name: string; email?: string | null },
): Promise<Person> {
  const [row] = await tx
    .insert(people)
    .values({ orgId: ctx.orgId, name: input.name.trim(), email: input.email?.trim() || null })
    .returning();
  return row!;
}

export async function renamePerson(
  tx: AppTransaction,
  _ctx: OrgContext,
  personId: string,
  name: string,
): Promise<Person | null> {
  const [row] = await tx
    .update(people)
    .set({ name: name.trim() })
    .where(eq(people.id, personId))
    .returning();
  return row ?? null;
}

/**
 * Only a person without a login can be removed here; a linked person is
 * the member, and members leave through the workspace door. Cards that
 * pointed at the person fall back to unassigned by the foreign key.
 */
export async function removePerson(
  tx: AppTransaction,
  _ctx: OrgContext,
  personId: string,
): Promise<Person | null> {
  const person = await personInWorkspace(tx, personId);
  if (!person) return null;
  if (person.userId) throw new Conflict();
  const [row] = await tx.delete(people).where(eq(people.id, personId)).returning();
  return row ?? null;
}

/** Hands a login to a person by hand, for the cases the e-mail match missed. */
export async function linkPerson(
  tx: AppTransaction,
  ctx: OrgContext,
  personId: string,
  userId: string,
): Promise<Person | null> {
  const person = await personInWorkspace(tx, personId);
  if (!person) return null;
  if (person.userId) throw new Conflict();
  const [member] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.organizationId, ctx.orgId), eq(memberships.userId, userId)))
    .limit(1);
  if (!member) return null;
  const [taken] = await tx
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.orgId, ctx.orgId), eq(people.userId, userId)))
    .limit(1);
  if (taken) throw new Conflict();
  const [row] = await tx.update(people).set({ userId }).where(eq(people.id, personId)).returning();
  return row ?? null;
}

/** The login goes; the person and their assignments stay. */
export async function unlinkPerson(
  tx: AppTransaction,
  _ctx: OrgContext,
  personId: string,
): Promise<Person | null> {
  const [row] = await tx
    .update(people)
    .set({ userId: null })
    .where(eq(people.id, personId))
    .returning();
  return row ?? null;
}

/** The caller's own person, for "my cards" and "assign to me". */
export async function ownPerson(tx: AppTransaction, ctx: OrgContext): Promise<Person | null> {
  const [row] = await tx
    .select()
    .from(people)
    .where(and(eq(people.orgId, ctx.orgId), eq(people.userId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

/** Members without a person, offered by the manual link menu. */
export async function unlinkedMembers(
  tx: AppTransaction,
  ctx: OrgContext,
): Promise<Array<{ userId: string; name: string; email: string }>> {
  return tx
    .select({ userId: memberships.userId, name: users.name, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(
      people,
      and(eq(people.orgId, memberships.organizationId), eq(people.userId, memberships.userId)),
    )
    .where(and(eq(memberships.organizationId, ctx.orgId), isNull(people.id)));
}
