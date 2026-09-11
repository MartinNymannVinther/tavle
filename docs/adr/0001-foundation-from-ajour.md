# ADR 0001: Tavle stands on a copy of the Ajour foundation

Status: accepted · Date: 2026-09-11

## Context

The Haij family has a foundation that is proven twice over: Haij, the
business platform, built it — Better Auth with passkeys and TOTP,
organizations with Postgres RLS enforced through two confined database
roles, an append-only audit log written by triggers, admission by
application and invitation, CI with dependency audit and secrets
scanning, Docker Compose deployed through Coolify, the 2a design system —
and Ajour, the project tool, took a copy of it (Ajour's ADR 0001), added
what a product built on it needs (per-workspace model settings, the demo
workspace per visit, a self-explaining migrator, the security headers,
the deploy and launch guides) and ran it through a pre-release review.

Tavle is the third tool: a board for Kanban and Scrum teams. It needs the
same foundation and nothing Ajour's product added on top of it.

## Decision

Tavle is its own repository and its own application, deployed as its own
compose stack on tavle.haij.dk. Its foundation is a copy of Ajour's,
taken at Ajour commit `6bbc526` and adapted: the same stack (Next.js 16,
Postgres 16, Drizzle, Better Auth, Tailwind + shadcn/ui, next-intl, pnpm,
Vitest), the same tenancy model (ADR 0002), the same audit model (ADR
0003), the same admission model (ADR 0004), the same demo mechanics (ADR
0005), the same workspace-chosen models (ADR 0006), the same design tokens
and shell, the same CI gates and deployment shape. Every Ajour-specific
module (projects, reports, share links, the rules engine, mail) was
removed rather than disabled; the schema starts from four migrations that
contain the foundation, its security, the product and the product's
security.

The runtime roles are `tavle_app` and `tavle_auth`, the environment
variables `TAVLE_*`, the invitation headers `x-tavle-*`, so two of the
family's tools can share one Postgres cluster without their roles
colliding.

One thing the foundation did not have was added to it, because a team
board cannot do without it: a colleague joining an existing workspace by
invitation (ADR 0008). Ajour's admission gives a stranger a workspace of
their own; Tavle needs both doors.

## Alternatives rejected

- **A module inside Ajour.** A board is already a view Ajour has of a
  project. Rejected: Ajour's board is a view of a plan with dates and
  milestones, and a team board has neither; the concepts overlap in name
  only, and the two products have different people at the door.
- **A shared `haij-core` package.** Three consumers is where a package
  boundary starts to pay for itself, and it may yet be extracted. Not
  now: the copy is confined to `src/core`, the migrations and the tests,
  drift can be reviewed by diff, and a foundation that has to serve three
  products at once changes more carefully than one that serves each on
  its own. This ADR names the commit the copy was taken from so the diff
  has a base.
- **An existing open source board.** Several exist and some are good.
  Rejected for the same reason Ajour was built rather than adopted: the
  dogmas are the product, and a foundation that already keeps them is
  worth more than a feature list that does not.

## Trade-offs accepted

- **Three copies of the foundation.** A fix in Haij's or Ajour's auth,
  tenancy or audit code does not reach Tavle by itself. The cost is
  bounded by keeping the copied code unchanged where possible and naming
  the Ajour commit it came from; the escape hatch is the shared package.
- **Three databases and three auth systems on one server.** A person who
  uses Haij, Ajour and Tavle has three accounts. Accepted for now: a
  shared identity across the family is a later decision that must not be
  forced by an implementation shortcut.
- **Better Auth's vocabulary leaks.** Tables are named organizations and
  memberships while the UI says workspace. Accepted: renaming the
  library's tables buys nothing and costs every future upgrade.
