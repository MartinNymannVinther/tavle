# Tech debt

What we know is not right yet, why it is not right, and what fixing it
would take. A debt item is written down when it is discovered and struck
out when it is paid — an item nobody can find is an item nobody pays.

CLAUDE.md's ways of working point at this file; this is it.

Opened at 0.9, September 2026, when the product was complete and had not
yet run a real board. Two kinds of item are here: what Tavle inherited
from the Ajour foundation and chose not to fix while copying it, and what
the way 0.9 was built left behind.

## How 0.9 was built, and what that leaves open

### The Next build has not been run

0.9 was written in a workspace that could not run `next build`, `next
dev`, vitest or drizzle-kit: the platform-native packages (swc,
lightningcss, oxide, rolldown, esbuild) were not installable there. What
was verified instead: `tsc --noEmit` and eslint on the whole tree,
prettier, the migrations applied from zero and re-applied, and the test
suite run under bun with a thin vitest shim — 250 of 257 tests green,
the seven that fail being Ajour foundation tests that use
`vi.doMock`/`vi.resetModules`/`vi.unstubAllEnvs` or load the swc binding,
none of which bun's runner has. They pass under vitest and should pass
in CI unchanged.

So the first `pnpm install && pnpm build` on a machine with the natives
is a verification step, not a formality, and so is the first walk through
the interface in a browser. Expect to find rendering and hydration
details that a typecheck cannot: a server component importing a client
hook, a `Suspense` boundary missing around `useSearchParams`, a drag
handler that behaves differently in Safari. The code was written for
those rules; it has not been run against them.

### The lockfile was pruned by hand

`pnpm-lock.yaml` had `nodemailer`, `@types/nodemailer` and
`@react-pdf/renderer` removed by editing the importers block and the
direct package entries, because `pnpm install --lockfile-only` needs the
registry and the registry was not reachable. `pnpm install
--frozen-lockfile` reported the lockfile up to date after the edit, which
is the check that matters, and the first `pnpm install` on a connected
machine agreed and rewrote nothing. The transitive entries those three
packages pulled in may still be listed as orphans; `pnpm dedupe` on a
connected machine is the one-line way to find out, committed on its own
so the diff is readable.

### The cumulative flow reads one seed row per card older than the window

`cumulativeFlow()` in `src/modules/boards/metrics/flow.ts` replays the
last 35 days of `card_transitions` and seeds every older card from its
last transition before the window. A board with years of history reads a
little more each year. ADR 0010 accepts it; the query to narrow when it
matters is the seed query, which could stop at cards whose last
transition is `done` or `archived` more than a window ago, since those
never move again.

### Files over 300 lines

Three in `src`, all inherited from the foundation, against a rule of one
responsibility per file and no file over roughly 300 lines (the demo's
`words.ts` is over it too, and is content, not code):

| lines | file                               | the seam                                                      |
| ----- | ---------------------------------- | ------------------------------------------------------------- |
| 332   | `settings/access/access-admin.tsx` | three components in one: requests, invite form, issued banner |
| 318   | `src/core/access/service.ts`       | applications vs invitations                                   |
| 304   | `src/core/db/schema/foundation.ts` | auth tables vs audit tables                                   |

Two tests are over the line as well (`tests/access/admission.test.ts`,
`tests/rls/tenant-isolation.test.ts`); tests are exempt in spirit but
not in the rule's wording. `src/modules/boards/write-cards.ts` was the
product's one offender and was split at 0.9 into the card's fields, its
lists (`write-card-details.ts`) and its lifecycle
(`write-card-lifecycle.ts`).

### The Archivo files in `public/fonts` have no reader

Ajour used them for its PDF renderer; Tavle has no PDF and the web UI
takes Archivo from `next/font/google` (see the build item below). The
files ship, the README attributes them, and nothing opens them. Either
switch the UI to `next/font/local` and give them a job, or remove them
and the attribution together. Not removed at 0.9 because deleting is a
decision the owner makes, and because the local switch is the better of
the two outcomes.

## Security

### The content policy still allows inline scripts

`next.config.ts` sends a Content-Security-Policy, and it blocks
everything Tavle never uses: no external scripts, no framing, no
`<base>`, no form posting off-site. But `script-src` keeps
`'unsafe-inline'`, because Next.js writes its own bootstrap inline and
next-themes writes the one that sets the theme before first paint.

Closing it means a per-request nonce, set on the _request_ headers in
`src/proxy.ts` so Next stamps it onto its own scripts — and composed with
`next-intl`'s middleware, which builds its own response and will not
carry modified request headers by itself. It also forces every page to
render dynamically, which `src/app/[locale]/layout.tsx` currently avoids
with `generateStaticParams` and `setRequestLocale`.

That is a real trade with a real cost. It deserves its own change, with a
test, not a line in a hardening pass.

### GitHub Actions are pinned to moving tags

`.github/workflows/ci.yml` uses `actions/checkout@v4` and friends. `v4` is
a pointer somebody else can move. The gitleaks binary the secrets job
downloads is checksum-verified, which was the sharper end of this, but
the actions themselves should be pinned to full commit SHAs with the
version in a trailing comment. `.github/dependabot.yml` watches the
`github-actions` ecosystem, which is what will keep SHA pins current once
they exist. Pin them in one pass and let Dependabot maintain them.

### The migrator image ships the whole development tree

`Dockerfile`'s `migrator` stage copies the full `node_modules`, so the one
image holding the Postgres superuser connection string also contains
eslint, vitest, prettier and the shadcn CLI. Ajour tried a `--prod`
install and reverted it the same hour: `pnpm db:migrate` runs through
tsx, tsx is a development dependency, and a `--prod` install leaves
`sh: tsx: not found` to be discovered at deploy time. The likeliest real
fix is to stop calling tsx a development dependency — the migration step
runs it in production, on every deploy — and to check `pnpm audit
--prod` afterwards, because tsx brings esbuild with it. CI runs the built
migrator image against a port nobody listens on and requires it to reach
its own connection error, which is the check that would catch a
regression.

### The migrator downloads pnpm from npmjs every time it starts

The base image enables corepack but never fetches pnpm, so the migration
step reaches out to npmjs at container start. On a host without that
egress the migrations do not run, and dogma two says cut the internet and
everything essential still works. The fix is one line in the `base`
stage, `corepack prepare pnpm@10.28.0 --activate` after `corepack
enable`, so the binary is baked into the image at build time. Do it with
CI's migrator-run step watching.

### Rate limiting is per process

`src/core/rate-limit.ts` counts in memory, which is correct for one
container behind one proxy and says so. An installation scaled to several
instances gets a limit per instance rather than a limit. The file is
written so that it is the only one to replace; the call sites do not
change.

### AI call ceilings are per workspace, with no installation-wide roof

`src/modules/ai/limits.ts` counts 60 calls per user per hour and 600 per
workspace per day, both scoped by the tenant context. A user who belongs
to several workspaces therefore gets 60 × N, and an installation running
`DEMO=on` has no total ceiling at all — and every demo visitor gets a
workspace. Worth an installation-level daily cap read outside the tenant
context before the demo is pointed at from haij.dk.

### The workspace model key is bound to its workspace, but old ciphertexts are not

`src/core/crypto/secret-box.ts` seals as `v2` with the workspace id as
additional authenticated data, so a stored key only opens for the
workspace it was stored for. `v1` values are still read, without that
binding, for installations upgraded from an older foundation. Tavle has
never written a `v1` value; the read path can go the day the family's
other tools no longer need it.

## Product decisions parked

### The roadmap draws an epic from its creation quarter

An open epic's bar starts in the quarter it was created and ends in its
target quarter (ADR 0011). Creation is a fact, but an epic written down
in March that nobody touches until September draws a bar over two idle
quarters. The transition log knows when the first story under it was
picked up; starting the bar there, with creation as the fallback, is a
small change to `structure/roadmap.ts` and a better picture. Left for a
real team to say whether the honest start is creation or first work.

### Features rank in one order across epics, shown split under them

One order per level is the rule, and the hierarchy view shows features
under their epics, so the arrows move a feature past its neighbour under
the same epic and the server computes the position in the whole lane. A
feature cannot be ranked above one under another epic without moving
both epics. Fine for tens of features; a team with a hundred will want
a flat feature ranking view, which the grouped views could grow into.

### WIP limits count cards, not points, and never refuse

A column's limit is compared with the number of cards in it, and a
column over the limit is shown in the warning colour with the count in
red. That is the Kanban rule as most
teams use it and it is what ADR 0007 says. Two teams will ask for more:
a limit that counts points rather than cards, and a limit that blocks a
move rather than warning. The first is a display choice on the column;
the second is a policy the product principles are against, and should
stay a request until a real team explains why the warning was not
enough.

### Cycle time is measured from the clocks, not per column

`started_at` and `done_at` give pick-up to done. "How long do cards sit
in review" is a question the transition log can already answer and the
insight page does not ask. ADR 0010 names it as the likely next metric.

### The backlog's Scrum card sits nominally in the first column

A card with no sprint has a `column_id` like every other card, and on a
Scrum board that column is meaningless until the card joins a sprint.
ADR 0007 accepts it; the alternative — a nullable column — costs a null
check in every lane query for the sake of a value nobody reads.

## Code quality

### Error handling coupled to a Postgres message string

`src/modules/export/workspace.ts` decides "not the owner" by matching the
text `only the workspace owner` against the exception raised in
`drizzle/0003_product_rls_audit.sql`. A later `CREATE OR REPLACE` that
rewords the message would silently degrade the branch to a generic
failure, and no test would notice. Raise with `ERRCODE = '42501'` and
match `error.code` instead. Inherited from Ajour, and worth fixing in
both.

### The web UI's font comes from Google at build time

`src/app/[locale]/layout.tsx` uses `next/font/google` for Archivo and
Geist Mono. Next downloads and self-hosts them, so there is no runtime
call to Google — but `pnpm build` and every `docker build` reaches out to
`fonts.googleapis.com`, which makes the build non-hermetic and puts a US
dependency in the build path of a product whose second dogma is that
cutting the internet must leave everything essential working. The fix
pairs with the `public/fonts` item above: `next/font/local` with the
files already in the repository, plus a decision about weight 500 and a
local Geist Mono.

### The about page still builds its own date

`src/core/dates.ts` now holds the product's three date formats
(`formatPlanDate`, `formatDay`, `formatStamp`), and every page goes
through them — except `settings/about/page.tsx`, which builds a long
date with a clock from scratch for the build stamp. It is locale-correct
and nobody's plan date, so it is the one place left rather than a bug;
fold it in when `dates.ts` grows a fourth format worth naming.

### Cards cannot be ticked at the Epics and Features altitudes

`ItemBacklog` is never given `selected`/`onSelect`, so at those two
altitudes no card has a tick box and the selection bar's bulk actions —
put in a sprint, place under a feature — are out of reach; the flat list
has them. Ranking works everywhere since docs/adr/0033. Wiring it needs
a prop through `backlog-view.tsx` and `item-backlog.tsx`, and a decision
about whether a selection survives a change of altitude.
