# ADR 0035: The installation's own roof over the AI

Status: accepted · Date: 2026-09-17

## Context

`src/modules/ai/limits.ts` has counted model calls since the first AI
slice: 60 per user per hour, 600 per workspace per day. Both are counted
inside `withOrgContext`, which is right — every domain query goes through
the tenant context, and `ai_calls` carries forced RLS with an org-scoped
policy (drizzle/0001). It also means neither number is what its name
says. A count run there can only ever see one workspace's rows:

- A person in three workspaces has 180 calls an hour, not 60. The
  ceiling is per user _per workspace_, and nothing counts the person.
- An installation has 600 a day multiplied by however many workspaces
  exist. There is no number anywhere that is the installation's.

The second one has a date on it. `DEMO=on` gives every visitor to
`/demo` their own workspace, and that door is throttled: five workspaces
per address per hour, counted in memory (`src/core/rate-limit.ts`). That
bounds the workspaces. It does not bound the model — each new workspace
arrives with an untouched 600 a day, so five an hour is 3000 calls an
hour of ceiling handed to whoever asked. tavle.haij.dk runs `DEMO=on`,
and haij.dk is about to point at it.

Dogma 2 is the other half of the problem. On a self-hosted installation
with Ollama the same script costs no money at all; it costs somebody's
machine an evening. A roof that the hosted instance needs and that a
self-hoster cannot take off would be this tool deciding how much of
someone else's hardware they may use.

## Decision

**A third ceiling, on the installation, checked before the model is
asked.** `AI_DAILY_CALL_CAP` — default 2000 — is how many model calls the
whole installation may make in any rolling 24 hours, across every
workspace. `reserveAiCall` checks it after the caller's own two: those
are index lookups on one workspace's rows and they name the caller's own
doing, and putting them first means the count across the installation is
only paid for by a call that would otherwise have gone through.

**The count crosses the tenant boundary; the rows never do.**
`ai_calls_last_day()` (drizzle/0015) is `SECURITY DEFINER`, owned by the
migration role, `STABLE`, `SET search_path = public`, and takes no
arguments at all, so there is nothing to aim it with — it can answer one
question and only that one. `tavle_app` may execute it; `PUBLIC` and
`tavle_auth` may not. It returns a single `bigint`. Nothing about the
application role's view of `ai_calls` changes: the forced RLS policy
still shows it one workspace's rows. `tests/ai/limits.test.ts` asserts
both halves inside one transaction as `tavle_app` — seven rows from the
table, twelve from the function — so a slip in either direction fails
rather than goes quiet.

**The refusal reuses the word the AI surface already has.** The same
`RateLimited`, the same `classifyAiError`, the same `rateLimited` that
every dialog already renders ("Der er kaldt modellen for mange gange.
Prøv igen om lidt."). An installation over its roof _is_ a rate limit. A
second failure mode would be a new sentence in two languages and a new
branch in every surface, to tell a person something they can do nothing
about either way.

**A rolling 24 hours, not a calendar day.** A midnight reset hands a
script a fresh budget ten minutes after it emptied the last one. The
per-workspace ceiling is already a rolling day; this is the same window,
so the two read the same clock.

**0 takes the roof off, and only the roof.** A self-hoster whose model
runs on their own machine sets `AI_DAILY_CALL_CAP=0` and the
installation-wide check is skipped entirely. The two ceilings underneath
stay exactly where they were: they are not about spend, they are about a
page in a loop, and no installation wants that.

## Alternatives rejected

- **An in-memory counter, like `src/core/rate-limit.ts`.** It matches
  the deployment this repo documents — one container, one process, one
  installation — and costs nothing. It also resets on every restart, and
  a roof on spend that a deploy lifts is not a roof in a week with four
  deploys. The demo door can afford to be in memory because what it
  protects is a row that expires within the day; a model bill is not
  that.
- **A counter table outside tenancy.** The meta-test in `tests/rls`
  fails any table without forced RLS, and it is right to: "this one is
  different" is the argument that test exists to stop. Giving it a
  policy that lets every workspace increment one shared row is
  cross-tenant write access wearing a schema, which is strictly worse
  than a read-only count the app cannot aim.
- **A second connection on a role that bypasses RLS, used for this one
  query.** CLAUDE.md: app code never uses a superuser or bypass role for
  domain queries, and `tests/rls` proves neither runtime role has
  `BYPASSRLS`. A named function that does one thing is the narrow
  version of the same idea, and the narrowness is the entire argument.
- **Counting at the demo door instead.** It is already counted there,
  and it is the wrong thing to count: workspaces created, not calls
  made. It reaches only demo visitors, while a real workspace with a
  script in it can run away just as fast, and it would leave the hosted
  instance's total depending on how many addresses a visitor has.
- **A ceiling on tokens, or on money.** More honest about what is being
  protected and not available: usage is reported after the fact, and the
  two providers report it differently. A call is the thing that can be
  counted before it is made, which is where a ceiling has to stand.

## Trade-offs accepted

- **A shared roof is a shared fate.** A workspace that has spent nothing
  can be refused because another spent everything, and the sentence it
  gets does not say which. That is what an installation-wide ceiling is;
  the alternative is no ceiling. The per-workspace ceiling underneath is
  what keeps one workspace from reaching the roof alone — 600 of 2000,
  so it takes four busy workspaces, or a script with four workspaces.
- **It is a ceiling, not a quota.** Two calls landing together can both
  read the count below the line and both go through. The overshoot is
  bounded by the number of calls in flight and never by more.
  Serialising the whole AI surface to close that would cost every user a
  queue to save the installation a handful of calls, which is ADR 0034's
  mistake in a different coat.
- **A member learns one number about the installation.** Somebody with a
  login can, one refusal at a time, infer roughly how busy the whole
  installation is. It is an aggregate with no workspace, no person and
  no text in it, and it is the smallest thing that can be known for the
  roof to exist at all.
- **`ai_calls` is still never pruned**, and the new
  `ai_calls_created_idx` is there because a count over the last day
  would otherwise scan a table that only grows. Once the roof holds, the
  rows inside the window are bounded by the roof itself, so the count
  stays small even as the table does not. Retention on `ai_calls` is a
  separate decision nobody has needed yet.
- **The roof depends on the migration role bypassing RLS.** It does in
  every deployment this repo ships — `docker-compose.yml` migrates as
  the Postgres superuser — but an installation that migrated as a
  non-superuser owner of tables under `FORCE ROW LEVEL SECURITY` would
  get a function that returns 0 and a roof that never speaks. That is a
  silent failure, so it is a test: `tests/ai/limits.test.ts` drives the
  counter past the cap and asserts the refusal, and it runs in CI
  against a database built by the same migrations.
- **2000 is a guess until dogma 7 has had its say.** The sizing: the
  heaviest surface is the quick add's placement assist, which asks once
  per pause in typing, so a team of eight adding forty cards on a busy
  day is a few hundred calls with every draft, split, summary and review
  brief on top. 2000 is several times that and about three full
  workspace-days, which is the shape wanted — a real team never meets
  it, a scripted visitor meets it in an afternoon. A hosted installation
  that finds it tight raises one number in the environment; the first
  team that finds it in the way is the reason to change the default.
