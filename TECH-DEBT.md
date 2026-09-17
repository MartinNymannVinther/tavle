# Tech debt

What we know is not right yet, why it is not right, and what fixing it
would take. A debt item is written down when it is discovered and moved
to **Paid** when it is done — an item nobody can find is an item nobody
pays.

CLAUDE.md's ways of working point at this file; this is it.

Opened at 0.9, September 2026, when the product was complete and had not
yet run a real board. Rewritten at 0.11.2 after it was read against the
code and found to have drifted: two items had been paid without being
moved, and the list of oversized files named three when there were
eighteen. **Check an item against the code before acting on it.** A debt
file that is trusted without being checked is worse than no file, and
the way to keep that from happening is to read it the way it was just
read — with the repository open beside it.

Four kinds of item live here, and they are kept apart on purpose. What
is **open** is wrong and worth fixing. What is **accepted** is a
boundary we chose, written down so nobody re-discovers it as a bug.
What is **waiting for a real team** is a product question we refuse to
answer from the armchair (dogma seven). What is **paid** is history.

## Open

The five below are being paid as this is written; they stay here until
the work lands, because a file that describes the future is the same
kind of wrong as one that describes the past.

### AI call ceilings are per workspace, with no installation-wide roof

`src/modules/ai/limits.ts` counts 60 calls per user per hour and 600 per
workspace per day, both scoped by the tenant context. A user who belongs
to several workspaces therefore gets 60 × N, and an installation running
`DEMO=on` has no total ceiling at all — and every demo visitor gets a
workspace. The demo's own door is throttled (five workspaces per address
per hour, `src/app/[locale]/demo/route.ts`), but the model spend behind
it is not. Worth an installation-level daily cap read outside the tenant
context before the demo is pointed at from haij.dk. `ai_calls` has forced
RLS with an org-scoped policy, so the count has to cross the tenant
boundary without the rows doing so.

### The web UI's font comes from Google at build time, and the files that ship have no reader

`src/app/[locale]/layout.tsx` uses `next/font/google` for Archivo and
Geist Mono. Next downloads and self-hosts them, so there is no runtime
call to Google — but `pnpm build` and every `docker build` reaches out to
`fonts.googleapis.com`, which makes the build non-hermetic and puts a US
dependency in the build path of a product whose second dogma is that
cutting the internet must leave everything essential working. Meanwhile
`public/fonts` carries Archivo as `.ttf` files that nothing opens: Ajour
used them for its PDF renderer and Tavle has no PDF. The two are one
fix — `next/font/local` pointed at files in the repository — with a
decision about weight 500, which `font-medium` asks for in a hundred
places, and about a local Geist Mono.

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

### Error handling coupled to a Postgres message string

`src/modules/export/workspace.ts` decides "not the owner" by matching the
text `only the workspace owner` against the exception raised in
`drizzle/0003_product_rls_audit.sql`. A later `CREATE OR REPLACE` that
rewords the message would silently degrade the branch to a generic
failure, and no test would notice. Raise with `ERRCODE = '42501'` and
match `error.code` instead. Inherited from Ajour, and worth fixing in
both.

### The lockfile was pruned by hand

`pnpm-lock.yaml` had `nodemailer`, `@types/nodemailer` and
`@react-pdf/renderer` removed by editing the importers block and the
direct package entries, because `pnpm install --lockfile-only` needs the
registry and the registry was not reachable. `pnpm install
--frozen-lockfile` reported the lockfile up to date after the edit, which
is the check that matters. The transitive entries those three packages
pulled in may still be listed as orphans; `pnpm dedupe` is the one-line
way to find out, committed on its own so the diff is readable.

### Files over 300 lines

One responsibility per file and no file over roughly 300 lines. At 0.9
this was three files, all inherited. It is eighteen now, and the ones
that grew are ours — the files the product keeps changing are the files
that keep growing, which is the whole reason for the rule.

| lines | file                                      | the seam                                                        |
| ----- | ----------------------------------------- | --------------------------------------------------------------- |
| 548   | `components/backlog/backlog-view.tsx`     | the page's state, the drag's nine callbacks, the two layouts    |
| 453   | `components/backlog/item-backlog.tsx`     | the epic altitude, the feature altitude, the row shared by both |
| 416   | `modules/boards/undo.ts`                  | the step catalogue vs. the one switch that applies them         |
| 397   | `core/db/schema/boards.ts`                | the board's own tables vs. the backlog structure's              |
| 385   | `components/structure/decompose-tree.tsx` | the tree, the drag, and the row                                 |
| 350   | `components/board/board-view.tsx`         | the board vs. the swimlane rows                                 |
| 345   | `components/map/map-headers.tsx`          | the feature note, the loose head, the row label                 |
| 334   | `components/map/story-map-view.tsx`       | the wall's state vs. the handlers it hands down                 |
| 333   | `modules/boards/write-sprints.ts`         | the sprint's life vs. what a card's promise to one costs        |

Six more sit between 300 and 332: `access-admin.tsx`, `ai-panel.tsx`,
`core/access/service.ts`, `card-side-panel.tsx`, `events.ts` and
`schema/foundation.ts`. The demo's `words-da.ts` and `words-en.ts` are
content rather than code and exempt in spirit; `demo/seed.ts` at 371 is
code, and is the eighteenth. Two tests are over the line as well
(`tests/access/admission.test.ts`, `tests/rls/tenant-isolation.test.ts`);
tests are exempt in spirit but not in the rule's wording.

Worth doing along the named seams, worst first, not as a sweep — a split
that only moves lines about buys nothing.

### Cards cannot be ticked at the Epics and Features altitudes

`ItemBacklog` is never given `selected`/`onSelect`, so at those two
altitudes no card has a tick box and the selection bar's bulk actions —
put in a sprint, place under a feature — are out of reach; the flat list
has them. Ranking and dragging work everywhere since docs/adr/0033.
Wiring it needs a prop through `backlog-view.tsx` and
`item-backlog.tsx`, and a decision about whether a selection survives a
change of altitude.

## Accepted, with the reason written down

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

### Rate limiting is per process

`src/core/rate-limit.ts` counts in memory, which is correct for one
container behind one proxy and says so. An installation scaled to several
instances gets a limit per instance rather than a limit. The file is
written so that it is the only one to replace; the call sites do not
change.

### The workspace model key is bound to its workspace, but old ciphertexts are not

`src/core/crypto/secret-box.ts` seals as `v2` with the workspace id as
additional authenticated data, so a stored key only opens for the
workspace it was stored for. `v1` values are still read, without that
binding, for installations upgraded from an older foundation. Tavle has
never written a `v1` value; the read path can go the day the family's
other tools no longer need it.

### The cumulative flow reads one seed row per card older than the window

`cumulativeFlow()` in `src/modules/boards/metrics/flow.ts` replays the
last 35 days of `card_transitions` and seeds every older card from its
last transition before the window. A board with years of history reads a
little more each year. ADR 0010 accepts it; the query to narrow when it
matters is the seed query, which could stop at cards whose last
transition is `done` or `archived` more than a window ago, since those
never move again.

### The four native date fields show the machine's format, not the page's

`src/core/dates.ts` holds the product's three date formats
(`formatPlanDate`, `formatDay`, `formatStamp`) and every rendered date
goes through them. Four controls cannot: the card's due date, a
release's target date and a sprint's start and end are
`<input type="date">`, and a native date field is drawn by the browser
in the operating system's format. No stylesheet or script reaches it.
So an English page on a Danish machine shows `12.02.2026` in the field
beside `12 Feb 2026` in the text around it.

The reasoning is at the foot of `src/core/dates.ts`: the format in the
field is the one that person reads dates in everywhere else on their own
machine, and a second spelling of the same date beside it would be worse
than the mismatch. The way out is a date picker of our own — a keyboard
grid, a screen-reader contract and a mobile picker — which is a feature
with its own ADR, not a formatting fix. If a real team reports it, the
cheaper half-step is one quiet line under the field stating the chosen
date in the page's language.

### The backlog's Scrum card sits nominally in the first column

A card with no sprint has a `column_id` like every other card, and on a
Scrum board that column is meaningless until the card joins a sprint.
ADR 0007 accepts it; the alternative — a nullable column — costs a null
check in every lane query for the sake of a value nobody reads.

### A redirect from a board page arrives as a meta refresh

The story map, the decomposition and the roadmap send you back to the
board when the board's levels leave them nothing to draw. Because
`src/app/[locale]/(app)/loading.tsx` gives the group a streaming
boundary, Next has already flushed the shell by the time the redirect is
thrown, so the response is a 200 carrying `<meta http-equiv="refresh">`
rather than a 307, and a bare shell shows for about a second. What the
person sees is right — the page never again claims the board has no
features — so this is a blemish on a URL nobody types, not a defect.
Fixing it means deciding the redirect before the boundary: a cheap
header read in the layout, or dropping the loading file for these
routes. Neither is worth doing on its own.

### A card's rank can tie with another's

Ranks written before docs/adr/0033 came from two independent
numberings, so a free row and a sprint-committed one can hold the same
`sort`. `mergeByRank` breaks such a tie on the card number, which is
creation order and means nothing to a reader. Nothing new ties — a
placement always lands strictly between its neighbours — and moving
either row settles it, so this drains as boards are used.

## Waiting for a real team

Not debt: product questions the tool refuses to answer from the armchair
(dogma seven). Each one is a decision somebody will ask for, and the
answer should come from a team that ran into it.

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
red. That is the Kanban rule as most teams use it and it is what ADR
0007 says. Two teams will ask for more: a limit that counts points
rather than cards, and a limit that blocks a move rather than warning.
The first is a display choice on the column; the second is a policy the
product principles are against, and should stay a request until a real
team explains why the warning was not enough.

### Cycle time is measured from the clocks, not per column

`started_at` and `done_at` give pick-up to done. "How long do cards sit
in review" is a question the transition log can already answer and the
insight page does not ask. ADR 0010 names it as the likely next metric.

## Paid

### ~~The Next build has not been run~~

0.9 was written in a workspace that could not run `next build`, `next
dev`, vitest or drizzle-kit, so the first real build was a verification
step rather than a formality. CI has built the app and both Docker
targets on every push since, the interface has been walked end to end in
a browser, and what that walk turned up — hydration, drag behaviour,
layout at phone widths — was found and fixed rather than guessed at.

### ~~The migrator downloads pnpm from npmjs every time it starts~~

The base image enabled corepack but never fetched pnpm, so the migration
step reached out to npmjs at container start, and on a host without that
egress the migrations did not run. Node 26 no longer ships corepack at
all, and the Dockerfile now installs pnpm outright in the `base` stage,
which closes it from the other side: the binary is in the image.

### ~~GitHub Actions are pinned to moving tags~~

`.github/workflows/ci.yml` used `actions/checkout@v7` and friends — a
pointer somebody else can move, in the pipeline that reads the whole
repository. Every action is pinned to a commit now, with the version it
was at in a trailing comment, and `.github/dependabot.yml` watches the
`github-actions` ecosystem so the pins move as pull requests that get
read.
