import { and, eq } from "drizzle-orm";
import { memberships, users } from "@/core/db/schema";
import type { AppTransaction, OrgContext } from "@/core/db/tenant";

/**
 * The caller's role in the *active* workspace. Both halves of the where
 * clause matter: RLS on memberships lets a user see their own rows in
 * every workspace they belong to, so filtering on the user alone would
 * return an arbitrary one.
 */
export async function roleOf(tx: AppTransaction, ctx: OrgContext): Promise<string> {
  const [row] = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, ctx.userId), eq(memberships.organizationId, ctx.orgId)))
    .limit(1);
  return row?.role ?? "member";
}

/** Owners and admins may change what the whole team works inside: boards, columns, members. */
export function canManage(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** A member of the workspace by id, or null; the members policy makes anyone else invisible. */
export async function memberInWorkspace(
  tx: AppTransaction,
  userId: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!userId) return null;
  const [row] = await tx
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
