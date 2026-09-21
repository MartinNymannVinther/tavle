import { randomBytes } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { auth } from "@/core/auth/auth";
import { authDb } from "@/core/db/client";
import { demoWorkspaces } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { DEMO_HEADER, demoSignupHeaderValue } from "@/core/auth/signup";
import { env } from "@/core/env";
import { organizationSlug } from "@/lib/slug";
import { MAX_LIVE_DEMOS } from "./quota";
import { seedDemoWorkspace } from "./seed";

/**
 * A demo is a real workspace with a throwaway account in it and a date on
 * which it stops existing. It holds two boards, one Kanban and one Scrum. Everything a visitor touches is the product:
 * the same tables, the same policies, the same services, so nothing shown
 * here can quietly differ from what a customer would get.
 *
 * Nothing here runs unless DEMO=on. On an installation that has not asked
 * for it, the route below answers 404 and this file is dead code.
 */

export const DEMO_TTL_HOURS = 24;

export function demoEnabled(): boolean {
  return env.DEMO === "on";
}

/**
 * Where a new demo lands, as a URL the browser can follow.
 *
 * Built from BETTER_AUTH_URL and never from the request, because behind
 * the proxy the request does not know the public address: Next hands a
 * route handler `https://0.0.0.0:3000/...`, the container's own listen
 * address, and a redirect built on that sends the visitor to a place
 * that does not exist. BETTER_AUTH_URL is the installation's declared
 * public origin, the same one passkeys and share links are bound to.
 */
export function demoLandingUrl(locale: "da" | "en", boardId: string): URL {
  const prefix = locale === "da" ? "" : `/${locale}`;
  return new URL(`${prefix}/boards/${boardId}`, env.BETTER_AUTH_URL);
}

/**
 * Whether the demo's session cookie carries the Secure flag. Decided by
 * the public origin, for the same reason as above: the request's own
 * protocol is `http:` inside the container even when every visitor
 * arrives over TLS, and a session cookie without Secure on a public
 * installation is a cookie that may be sent in the clear.
 */
export function demoCookieSecure(): boolean {
  return env.BETTER_AUTH_URL.startsWith("https://");
}

/**
 * What came of asking for a demo. A refusal says which one, because the
 * three are three different sentences to the visitor: the demo is not on
 * here, the installation is full, or something broke.
 */
export type DemoSession =
  | { ok: true; headers: Headers; boardId: string }
  | { ok: false; reason: "off" | "full" | "failed" };

/** Turns the set-cookie headers of an API response into a cookie header. */
function cookieHeaderFrom(responseHeaders: Headers): Headers {
  const cookie = responseHeaders
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
  return new Headers({ cookie });
}

/**
 * Deletes every demo whose time is up. Called on each visit, so an
 * installation that gets visitors needs no scheduler; `scripts/cleanup-demos.ts`
 * and the endpoint exist for one that does not.
 *
 * The deleting itself is `delete_demo_workspace()` (drizzle/0017), which
 * takes the workspace, the throwaway account and — this is the point of
 * it — the audit rows both of them left. The screen promises the whole
 * thing is gone within the day, account included, and everything the
 * visitor typed passes through the audit triggers on its way into the
 * table. A demo whose card titles outlive it by a year is not the demo
 * the screen described.
 *
 * The rule that the function may only touch a workspace registered in
 * `demo_workspaces`, and only once its time is up, is checked there as
 * well as here: this loop has no session behind it, so the database is
 * where that guard has to be able to stand on its own.
 */
export async function cleanupExpiredDemos(): Promise<number> {
  const expired = await authDb
    .select({ organizationId: demoWorkspaces.organizationId })
    .from(demoWorkspaces)
    .where(lt(demoWorkspaces.expiresAt, new Date()));
  let removed = 0;
  for (const row of expired) {
    try {
      const result = await authDb.execute<{ deleted: boolean }>(
        sql`select delete_demo_workspace(${row.organizationId}) as deleted`,
      );
      if (result.rows[0]?.deleted) removed += 1;
    } catch (error) {
      // One stuck demo must not stop the others being cleaned up.
      console.error("demo: cleanup failed for", row.organizationId, error);
    }
  }
  return removed;
}

async function liveDemoCount(): Promise<number> {
  const [row] = await authDb.select({ n: sql<number>`count(*)::int` }).from(demoWorkspaces);
  return Number(row?.n ?? 0);
}

/**
 * Builds a demo and returns the cookie that signs the visitor into it.
 * The account is created through the ordinary sign-up path rather than by
 * writing rows, so a demo session is a session like any other and every
 * guard behaves the way it will for a real user.
 *
 * The expired demos are cleared before the live ones are counted, so the
 * ceiling is a ceiling on demos that still exist rather than on demos
 * that were ever made. Like the AI's ceilings it is read and then acted
 * on, so two visitors arriving at the same moment can both find room and
 * both be let in: it overshoots by the number of demos in flight and
 * never by more, and serialising the front door to close that would cost
 * every visitor a queue.
 */
export async function createDemoWorkspace(locale: "da" | "en"): Promise<DemoSession> {
  if (!demoEnabled()) return { ok: false, reason: "off" };
  await cleanupExpiredDemos();
  if ((await liveDemoCount()) >= MAX_LIVE_DEMOS) return { ok: false, reason: "full" };

  const key = randomBytes(9).toString("hex");
  const email = `demo-${key}@demo.invalid`;
  const password = randomBytes(24).toString("base64url");
  const name = locale === "da" ? "Gæst" : "Guest";
  const workspaceName = locale === "da" ? "Demo-arbejdsrum" : "Demo workspace";

  let sessionHeaders: Headers;
  let userId: string;
  try {
    const { headers: responseHeaders, response } = await auth.api.signUpEmail({
      body: { name, email, password },
      // The demo bypasses the admission gate on purpose: this account is
      // not a person asking to be let in, it is a session that expires.
      headers: new Headers({ [DEMO_HEADER]: demoSignupHeaderValue() }),
      returnHeaders: true,
    });
    sessionHeaders = cookieHeaderFrom(responseHeaders);
    userId = response.user!.id;
  } catch (error) {
    console.error("demo: could not create the visitor's account", error);
    return { ok: false, reason: "failed" };
  }

  let organizationId: string | null = null;
  try {
    const organization = await auth.api.createOrganization({
      body: { name: workspaceName, slug: organizationSlug(`${workspaceName}-${key}`) },
      headers: sessionHeaders,
    });
    if (!organization) throw new Error("the workspace was not created");
    organizationId = organization.id;
    await auth.api.setActiveOrganization({
      body: { organizationId: organization.id },
      headers: sessionHeaders,
    });

    await authDb.insert(demoWorkspaces).values({
      organizationId: organization.id,
      userId,
      expiresAt: new Date(Date.now() + DEMO_TTL_HOURS * 60 * 60 * 1000),
    });

    const boardId = await withOrgContext({ orgId: organization.id, userId }, (tx) =>
      seedDemoWorkspace(tx, { orgId: organization.id, userId }, locale),
    );

    return { ok: true, headers: sessionHeaders, boardId };
  } catch (error) {
    console.error("demo: could not build the workspace", error);
    await abandonHalfBuiltDemo(userId, organizationId);
    return { ok: false, reason: "failed" };
  }
}

/**
 * Takes back what a build that failed halfway left behind. The account is
 * made first and is covered by nothing on its own: no demo row names it,
 * so no cleanup would ever come for it, and it would sit in the users
 * table for good.
 *
 * Where the demo did get as far as being registered, its own expiry is
 * brought forward and the ordinary cleanup runs it, so the half-built
 * thing leaves exactly as little behind as a finished one does. The two
 * deletes after that are for the case where it did not get that far, and
 * are no-ops when it did.
 */
async function abandonHalfBuiltDemo(userId: string, organizationId: string | null): Promise<void> {
  try {
    if (organizationId) {
      await authDb
        .update(demoWorkspaces)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(demoWorkspaces.organizationId, organizationId));
      await authDb.execute(sql`select delete_demo_workspace(${organizationId})`);
      await authDb.execute(sql`delete from organizations where id = ${organizationId}`);
    }
    await authDb.execute(sql`delete from users where id = ${userId}`);
  } catch (error) {
    console.error("demo: could not take back a half-built demo", error);
  }
}

/** True when the workspace the caller is in is a demo. */
export async function isDemoWorkspace(orgId: string): Promise<boolean> {
  const [row] = await authDb
    .select({ id: demoWorkspaces.id })
    .from(demoWorkspaces)
    .where(sql`${demoWorkspaces.organizationId} = ${orgId}`)
    .limit(1);
  return Boolean(row);
}
