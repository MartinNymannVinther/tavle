import { callerKey, rateLimit, type RateLimit } from "@/core/rate-limit";

/**
 * What the demo door will hand out, and to whom.
 *
 * The door is the one place in Tavle where somebody with no account at
 * all makes the application write: a workspace, a membership, two seeded
 * boards and the audit rows under all of it. So it gets two bounds, the
 * same pair as the AI surface (docs/adr/0035) — one that names the
 * caller's own doing, and one that is the installation's.
 *
 * **Per address, two windows.** A person trying the product needs one
 * workspace, and perhaps another when they come back tomorrow. An office
 * that all leaves by one address needs a handful in an afternoon, and
 * that is what the hour allows. What neither needs is a hundred, and the
 * day is what a script runs into: three an hour would otherwise be
 * seventy-two a day from one address, which is enough to fill the
 * installation on its own.
 *
 * **Across the installation, the demos that are alive.** A demo holds its
 * place for the whole day it lives (`DEMO_TTL_HOURS`), so the ceiling on
 * how many exist at once is also, within a day, the ceiling on how many
 * the installation will ever build: at most `MAX_LIVE_DEMOS` in any 24
 * hours, whoever asks and from wherever. That is the number that stands
 * between a public front door and a database nobody chose to fill.
 *
 * **What survives a restart.** The per-address windows are counted in
 * memory (`src/core/rate-limit.ts`), so a deploy forgets every address
 * and hands each of them their allowance again. That is honest for what
 * they are — a brake on one caller, not a quota anybody has bought. The
 * installation's ceiling is counted in the database and survives
 * everything, which is the right way round: the bound that has to hold
 * is the one that holds.
 */

export const MAX_DEMOS_PER_ADDRESS_PER_HOUR = 3;
export const MAX_DEMOS_PER_ADDRESS_PER_DAY = 10;
export const MAX_LIVE_DEMOS = 200;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Counts this address's request against both windows and says whether the
 * demo may be built. The hour is asked first: it is the tighter of the
 * two, and a caller already over it never reaches the day's count, so an
 * address that keeps knocking does not spend an allowance it is not being
 * given anyway.
 */
export function reserveDemoForAddress(headers: Headers): RateLimit {
  const hour = rateLimit(callerKey(headers, "demo"), MAX_DEMOS_PER_ADDRESS_PER_HOUR, HOUR_MS);
  if (!hour.allowed) return hour;
  return rateLimit(callerKey(headers, "demo-day"), MAX_DEMOS_PER_ADDRESS_PER_DAY, DAY_MS);
}
