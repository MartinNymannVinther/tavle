# CLAUDE.md — Tavle

Tavle (tavle.haij.dk) is an open source board for Kanban and Scrum teams:
cards in columns, sprints from a backlog, one backlog structure that
holds when the team grows, and the numbers a team wants to see computed
from what actually happened. It is one tool in the Haij
family (haij.dk) and stands on the Haij foundation, taken by way of Ajour.
This file is the project constitution: read it fully at the start of
every session. The non-negotiables below override any default you would
otherwise pick.

## The Haij dogmas (family rules, non-negotiable)

The seven dogmas are written in Danish, in the family's own words, in
README.md. Quote them verbatim; never rephrase them. What they bind this
codebase to:

1. **Real open source.** AGPL-3.0. Everything that runs on tavle.haij.dk
   can be cloned and run elsewhere or locally, 1:1. No feature exists only
   on the hosted instance. A paid edition is fine, but it is the same code.
2. **Self-hosting.** Runs on one server with Docker Compose, one Postgres
   and a local language model through Ollama, without a single cloud key.
   Features that need an external service say so and let the rest work.
   The test: cut the internet, and everything essential still works.
3. **Your data, always.** Everything a workspace owns can be exported with
   one click in open formats (spreadsheet, JSON) and deleted again
   completely. Leaving must take a few clicks and no friction.
4. **EU or self-hosted.** Hosted, everything lives with EU-owned providers
   on EU soil, language models included, and `docs/subprocessors.md` says
   who can see what. Code lives on GitHub, which hosts code, not customer
   data.
5. **The AI helps, the human decides.** The AI may propose and draft, but
   never sends anything out of the house, deletes anything or commits
   anyone without a person saying yes. Everything the AI does is marked
   and can be undone. Content fetched from outside is data, never
   instructions.
6. **Secure from day one.** Workspaces are separated in the database
   (Postgres RLS) with a test proving it, every change lands in an audit
   log that cannot be edited, passkeys and TOTP from the start, a public
   way to report vulnerabilities, and never a secret in the code.
7. **Used for real.** Nothing goes in the window before it has run real
   work. Tavle runs a real team's board before it is shown.

## Product principles

- As few concepts as possible; each one must earn its place. Eleven:
  board, column, card, sprint, comment, the person (the workspace's
  roster — who work is assigned to, with or without a login; ADR 0029),
  the release (what ships together, and the story map's band; ADR
  0032), and the four of the backlog structure — epic, feature, theme,
  area. Everything else — the backlog, the roadmap, backlog care, the
  numbers, "my cards" — is a derived view.
- One backlog structure (ADR 0011). The hierarchy epic → feature → card
  is used only to break the product down; overview, grouping and
  belonging are fields on the item: kind (business/enabler), theme (why)
  and area (where). Two tests decide where a thing belongs and the tool
  enforces them: can it be finished, and does it have exactly one parent.
  The tool never invents a container; items without a parent are shown as
  exactly that. There are no free-text tags and no custom fields. A board
  chooses how much of the structure it shows — the levels down to cards
  alone, and each of the three fields — and the choice changes the view
  only (ADR 0014): what is hidden stays and comes back.
- A board is one team's work. Kanban is a flow with WIP limits that warn
  and never forbid; Scrum is a backlog and one sprint at a time. The
  columns' categories (backlog, todo, doing, done), not their names, are
  what the numbers read.
- Backlog care (ADR 0031) is the product owner's workbench: findings as
  lists that link to the rows behind them, shown only when they have
  something to say, and never a verdict on a state the tool supports.
- Every number on the insight page is computed on request from the record
  of what happened (`card_transitions`, the cards' own clocks, the closed
  sprints' written-down points). Nothing is estimated and nothing is
  cached.
- Everything works on a phone and with a keyboard. Drag-and-drop is the
  quick path; every move also exists as a menu, a select or a button.
- Every kind of thing has one symbol, the same everywhere (ADR 0012): a
  flag for an epic, a puzzle piece for a feature, a note for a card, a
  bug for a bug, a wrench for enabler work, each with its word for
  assistive technology. The backlog is one flat list in its own order
  with the decomposition as a navigator beside it (ADR 0013), and a row
  says only what its heading has not; a level picker can raise the list
  to the feature or epic altitude, where the decomposition folds out as
  the list itself (ADR 0027). The story map is the team's wall
  (ADR 0015, 0016): the features the team has put up, across the top in
  the story's own order (`map_sort`, never the backlog's rank), the
  team's own releases down (ADR 0032) with one band for what none has
  promised, every card in one cell, and a drag on it is the same move
  as anywhere else.
- A detail page (a card, an epic, a feature) is two surfaces: the reading
  surface on the left, sections divided by hairlines, an empty field
  drawn as a dashed "add" row rather than a button somewhere else; the
  property panel on the right, label left and control right in 32px
  rows, grouped by hairlines (`src/components/ui/property-row.tsx`). The
  board's header steps back to one line on these pages so the thing
  itself is the title.
- The AI writes four kinds of proposal — finish a card, split a card, the
  sprint's story, and a starting point for backlog and roadmap from the
  team's own prose (ADR 0021) — and a person edits and says yes. Beside
  them stand the quiet assists (ADR 0025) and the counsel (ADR 0026):
  a done-when and a sprint goal drafted on request, a placement
  suggestion with a duplicate glance while a card title is typed, the
  close conversation pre-set to a reasoned plan, and a review brief —
  proposals still, writing nothing on their own. Without a model the
  buttons say so and everything else works.
- Deliberately not built: time tracking, custom fields, labels or tags,
  dependencies, automation rules, integrations, attachments,
  notifications by mail, a level above epic. The omissions are the
  product; each one is a later decision, not an oversight. Swimlanes
  left this list with ADR 0017: a Kanban board can split into rows by
  kind, theme, area or the team's own named lanes.

## Architecture (decided — change only via a new ADR)

- Next.js 16 (App Router), TypeScript strict. One app, one database.
- Postgres 16+ with Drizzle ORM. Migrations checked in; hand-written SQL
  for roles, RLS and triggers.
- Multi-tenancy: single database, `org_id` on every domain table, RLS
  policies enforced for the application role. The organization is what
  the UI calls a workspace ("arbejdsrum"); a workspace is a team or a
  company and holds any number of boards. App code never uses a
  superuser/bypass role for domain queries; every domain query goes
  through `withOrgContext()`.
- Auth: Better Auth with organizations, passkeys (WebAuthn) and TOTP.
  Registration closed by default; admission by application and invitation
  (a stranger gets a workspace) and by workspace invitation (a colleague
  joins an existing one, ADR 0008). Session cookies: Secure, HttpOnly,
  SameSite=Lax.
- UI: Tailwind + shadcn/ui with the Haij 2a design tokens (warm paper,
  moss green, Archivo). One palette for the whole family. next-intl with
  `da` default (no URL prefix) and `en` under `/en`. Timezone
  Europe/Copenhagen.
- AI: all model access through `src/core/llm` (Mistral hosted in the EU,
  Ollama for self-hosting). The installation sets the default in `.env`
  and a workspace may choose its own provider, model and key in Settings
  → AI, encrypted at rest; the Ollama address stays with the installation
  (ADR 0006). There is no rules engine: with no model, the AI surface is
  honest about it.
- Deployment: Docker Compose run via Coolify on an EU VPS (Hetzner
  initially; the provider must stay replaceable). Nightly encrypted
  backups to EU object storage.
- Layout: shared kernel (auth, tenancy, audit, llm, team, env) in
  `src/core`; the product in `src/modules/{boards,ai,demo,export}` behind
  services that take an `OrgContext`, the backlog structure's rules and
  services in `src/modules/boards/structure`; server actions next to their
  services as `actions*.ts`; pages in `src/app/[locale]` and components in
  `src/components/{board,card,backlog,map,item,roadmap,overview,sprint,charts,settings,structure}`.
- Trade-off accepted: the foundation is a copy of Ajour's copy of Haij's,
  not a shared package. Three products, three lifecycles, one set of rules
  (ADR 0001).

## Security rules

- Every new table ships with `org_id`, forced RLS, an audit trigger and an
  automated test proving workspace A cannot read or write workspace B's
  rows. The meta-test in `tests/rls` fails any table without forced RLS.
- Every server action resolves the caller's session and workspace first
  and validates that every id it receives belongs to that workspace.
  Never trust an id from the client. Changing a board's shape (columns,
  themes, areas, archiving, deleting), inviting and removing members takes
  an owner or an admin; the check lives in the action helper, not the
  form. The structure's blocking rules are refused in the service, and
  rules 1, 4 and 5 again in the database.
- Validate all input at the boundary (zod). Parameterized queries only.
- Rate limiting on auth and all public endpoints, and a ceiling on AI
  calls per user and on prompt length. Generic auth error messages, no
  stack traces or version info in responses.
- The AI surface: user-written content (titles, descriptions, checklists)
  is fenced as data in every prompt, never as instructions; model output
  is cut to shape by the sanitizers before it is shown and validated
  against the board's own ids at the write boundary; the AI cannot delete
  and cannot move a card; everything it writes is marked `actorKind: ai`
  in the event log.
- Invitation links are Better Auth invitation ids: single-purpose, bound
  to one address, expiring after 48 hours, revocable.
- GDPR by design: per-workspace export and deletion, record of processing,
  EU-only subprocessors listed in `docs/subprocessors.md`.
- `SECURITY.md` with responsible disclosure. CI runs dependency audit and
  secrets scanning on every push.

## Ways of working (how Claude Code operates here)

1. Plan first. For every task: present a short plan, the schema changes and
   the API surface, get approval, then implement.
2. Vertical slices. Ship end-to-end features; keep the app deployable at
   every commit.
3. Run `pnpm test`, `pnpm lint`, `pnpm typecheck` and `pnpm format` after
   code changes and keep them green. Tests where they matter: domain
   logic, RLS isolation, AI output validation, date arithmetic, the
   metrics.
4. One responsibility per file; no file over roughly 300 lines.
5. Conventional commits. Every significant decision gets an ADR in
   `docs/adr/` that names the trade-off accepted, not just the choice.
6. Never weaken tenancy, auth or audit logging to make a feature easier.
7. Never delete files without explicit approval.
8. Code, comments and docs in English. UI copy in Danish first through
   i18n (`messages/da.json`) with an English translation; never hardcode
   UI strings. Structured events in the data layer, rendered sentences in
   the UI layer.
9. Ask before adding any dependency not implied by this file.

## Roadmap

- 0.9: the foundation from Ajour; boards in two modes with columns and
  WIP limits; cards with assignee, estimate, priority, due date,
  checklist, comments and activity; the backlog with sprint planning, one
  active sprint, close with carry-over and velocity written down; the
  insight page (burndown, velocity, throughput, cycle time, cumulative
  flow); my cards; workspace invitations; the three AI proposals; the
  demo with two boards; export and deletion; the help page with the
  board's ABC.
- 0.10: the backlog structure (ADR 0011) — epics and features
  with "done when", kind and enabler type, themes and areas as closed
  lists with owners, the eleven rules, inheritance, one order per level,
  the close conversation; the backlog with grouping and filters on both
  board types; the roadmap in quarters; the overview with the five health
  measures; labels removed. 0.10.2: the type symbols (ADR 0012). 0.10.3:
  the backlog as a navigator and a flat list (ADR 0013). 0.10.7: the
  structure's levels and fields chosen per board, view only (ADR 0014).
- 0.11 (this): the story map — features across, stories in the cells —
  as the decomposition's own view (ADR 0015). 0.11.1: the backbone is
  the team's — chosen features in the story's order, a tray for the
  rest, sticky notes (ADR 0016). 0.11.2: the bands down are the team's
  own releases, on both board types (ADR 0032); the roster of people
  work is assigned to (ADR 0029); estimation in points, hours or
  T-shirt sizes (ADR 0030); the overview becomes backlog care (ADR
  0031).
- Before 1.0: dogma seven — a real team runs a real board on it; the
  screenshots for the README; the tool card on haij.dk; whatever the
  first team asks for that the omissions list did not foresee.
- Later, each as its own decision: swimlanes, card links, attachments,
  notifications, a public read-only board link.
