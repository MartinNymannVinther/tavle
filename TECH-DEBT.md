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

### Files over 300 lines

One responsibility per file and no file over roughly 300 lines. At 0.9
this was three files, all inherited. It is eighteen now, and the ones
that grew are ours — the files the product keeps changing are the files
that keep growing, which is the whole reason for the rule.

| lines | file                                      | the seam                                                        |
| ----- | ----------------------------------------- | --------------------------------------------------------------- |
| 460   | `components/backlog/item-backlog.tsx`     | the epic altitude, the feature altitude, the row shared by both |
| 454   | `components/backlog/backlog-view.tsx`     | the page's state vs. the two layouts it draws                   |
| 402   | `core/db/schema/boards.ts`                | the board's own tables vs. the backlog structure's              |
| 385   | `components/structure/decompose-tree.tsx` | the tree, the drag, and the row                                 |
| 371   | `modules/demo/seed.ts`                    | the two boards it seeds                                         |
| 355   | `components/board/board-view.tsx`         | the board vs. the swimlane rows                                 |
| 355   | `components/map/story-map-view.tsx`       | the wall's state vs. the handlers it hands down                 |
| 345   | `components/map/map-headers.tsx`          | the feature note, the loose head, the row label                 |
| 333   | `modules/boards/write-sprints.ts`         | the sprint's life vs. what a card's promise to one costs        |

Two were taken at 0.11.3: the backlog page gave up what a gesture writes
to `use-backlog-moves.ts` (548 → 444, and back to 454 since: the seam was
right, the file is simply still the page's own state), and `undo.ts` gave the card's
eight reverses to `undo-cards.ts` (416 → 307, which is still seven over
and is counted below).
Both were split along the seam named here rather than by moving lines
about, which is the only kind of split worth the churn.

Seven more sit between 300 and 332: `access-admin.tsx`, `ai-panel.tsx`,
`core/access/service.ts`, `card-side-panel.tsx`, `events.ts`,
`schema/foundation.ts` and `undo.ts`, which came down from 416 to 307
and is over the line by seven. The demo's `words-da.ts` and `words-en.ts` are
content rather than code and exempt in spirit; `demo/seed.ts` at 371 is
code, and is the eighteenth. Two tests are over the line as well
(`tests/access/admission.test.ts`, `tests/rls/tenant-isolation.test.ts`);
tests are exempt in spirit but not in the rule's wording.

Worth doing along the named seams, worst first, not as a sweep — a split
that only moves lines about buys nothing.

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

### Two AI features share one label in `ai_calls`

The backlog assistant (docs/adr/0037) counts its model calls under the
existing `assist` kind, together with the quiet placement assist that
runs while a card title is typed. The ceilings are unaffected — they
count calls, not kinds — but an installation reading `ai_calls` cannot
tell a paragraph-long proposal from a one-line suggestion. A new kind in
`modules/ai/limits.ts` is the whole fix, and it was left out rather than
widened on the way past.

### The story map's release dialog is keyed on the band's id alone

`components/map/story-map-view.tsx` keys `ReleaseForm` on the release id,
so a band whose date changed behind an open dialog would hand back the
day it was opened with. Inert today: nothing on the map changes a date
except that dialog. The roadmap's strip, where a drag does exactly that,
keys on the id and the date together — that is the shape to copy the day
the map grows a second way in.

### The "no model configured" paragraph is written twice

`bootstrap-dialog.tsx` and `assist-dialog.tsx` each carry their own copy
of the eight lines that say, honestly, that no model is set up and point
at Settings → AI. The two were written a release apart and will drift.
One small component, used by both.

### Nothing gates `main`, and the deploy does not wait for CI

At 0.11.3 every one of the 121 commits went straight to `main` with no
pull request, there is no branch protection, and Coolify redeploys on
push regardless of what CI says. A commit that fails `pnpm test` is on
tavle.haij.dk before the run goes red; the only signal is an email after
the fact.

This is a decision, not an oversight: the repository has one developer,
and a pull request to oneself is a ceremony that buys nothing while that
is true. It stops being true the day a second person has push rights, or
the day a team other than ours has a board on the hosted instance —
whichever comes first. At that point both halves are wanted: a required
green check before merge, and a deploy that waits for the check rather
than for the push.

Written down here rather than left to be discovered, because the failure
mode is silent and the first person to meet it will be the one who did
not choose it.

### The demo quota's day window has no test

`tests/demo/quota.test.ts` exercises the per-address hour window and the
installation ceiling. It does not exercise the day window, which is the
bound that actually stops a script: the hour's allowance of three is
spent long before the day's ten can be reached, and `resetRateLimits()`
clears both at once, so reaching the day in isolation needs a seam for
time that `src/core/rate-limit.ts` does not have.

It was one of three launch guards that read as testing more than they
tested. The other two were paid the same day — the privacy notice's
retention figures are now read out of `scripts/backup-tavle.sh` and
`DEMO_TTL_HOURS` rather than trusted as prose, and the source offer's
stray-URL check walks all of `src` rather than the two files the offer
lives in. This is the one that needs a change to the rate limiter first,
which is why it is still here.

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

### ~~The postal address and CVR number were missing from the privacy notice~~

`/terms` named Vinther Consulting and gave an e-mail, which is identity
and contact enough for the letter of Article 13, but Danish practice is a
registered address and a CVR number too — and the notice, the record of
processing and the data processing agreement each carried a marked slot
waiting for them. Filled 2026-09-22: Jens Bornøs Vej 1, CVR 30769201.
The one thing here nobody could write from the code.

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

### ~~AI call ceilings are per workspace, with no installation-wide roof~~

Every demo visitor got a workspace and every workspace its own 600 calls
a day, so the model spend behind the demo door had no roof at all. There
is one now, counted across every workspace in a rolling 24 hours and set
by the installation (`AI_DAILY_CALL_CAP`, 2000 by default, `0` to take it
off). The count crosses the tenant boundary and the rows do not: a
`SECURITY DEFINER` function that takes no arguments and answers one
question, which `tests/rls` now holds to an allowlist so the next one has
to be argued for. docs/adr/0035.

### ~~The migrator image ships the whole development tree~~

`tsx` and `dotenv` are dependencies now, because the migration step runs
them in production on every deploy, and the migrator stage installs
`--prod`: 1.48 GB → 1.25 GB, and eslint, vitest, prettier and the shadcn
CLI are out of the one image that holds the Postgres superuser
connection string. `pnpm audit --prod` is clean; plain `pnpm audit`
reports three advisories that all used to sit in that image and no
longer do. What is left is `next` and its native binaries, which the
migrator has no use for either — shedding those needs a workspace split,
which is a bigger decision than this was.

### ~~Error handling coupled to a Postgres message string~~

The owner refusal is raised with `ERRCODE = '42501'` and read from the
error's SQLSTATE. The message match is gone rather than kept as a
fallback: a fallback would have let the test pass on the old path while
claiming the new one, which is the failure mode the item was about.

### ~~The lockfile was pruned by hand~~

Answered: `pnpm dedupe` found no orphans from the three hand-removed
packages — pnpm prunes unreferenced entries on every install, so the
first connected install had already cleaned up. It did collapse a
pre-existing duplicate esbuild (drizzle-kit on 0.25.12 beside tsx and
vite on 0.28.2), 27 entries gone, nothing added.

### ~~The web UI's font comes from Google at build time~~

Both typefaces are files in the repository now, harvested from what the
build was already downloading and checked byte-for-byte against what
`fonts.gstatic.com` serves, so the rendering could not change — computed
styles and full-page screenshots agree to the pixel outside the version
stamp. `pnpm build` was run under a sandbox denying every outbound
connection and succeeded, with a control proving the old path genuinely
needed the network. The `@font-face` rules are declared by hand in
`globals.css` rather than through `next/font/local`, because that helper
applies one `declarations` block to every source and so cannot carry a
per-subset `unicode-range`: the choice was nine juggled font variables,
or losing Vietnamese and Cyrillic to a silent Arial fallback. Files in
`public/` are served without a long cache, so `next.config.ts` gained a
second headers rule giving `/fonts/*` a year.

### ~~Cards cannot be ticked at the Epics and Features altitudes~~

The tick box is on the story row at every altitude now, and the
selection bar moved out of the flat list's branch to stand over the
whole page — so "put in a sprint" and "place under a feature" are
reachable wherever the cards are read. The selection is one set of card
ids and survives a change of altitude, which is the answer to the
question the item left open: you tick three under one epic, switch to
the flat list, and the bar still counts three.

### ~~The Archivo files in `public/fonts` had no reader~~

Ajour's PDF renderer read them; Tavle has no PDF, and when the
typefaces moved into the repository they came as `.woff2` subsets
harvested from what the build was already downloading, so the two
`.ttf` files were the last of the inheritance with nothing opening
them. Deleted on the owner's word. `OFL.txt` stays: it is the licence
of the Archivo the interface is actually set in.

The sweep in `tests/meta/fonts.test.ts` now covers every font file in
the directory rather than only the ones a rule names, so the next
leftover is caught by the suite rather than by a reader a release
later.
