# Tavle

Tavle ([tavle.haij.dk](https://tavle.haij.dk)) is an open source board for
Kanban and Scrum teams of two to fifteen: the product team, the ops team,
the association's app project. Cards in columns with WIP limits, or a
backlog and sprints; one backlog structure — epics, features and cards
that finish, themes and areas that never do — that holds when the team
grows; and the numbers a team wants to see — burndown, velocity,
throughput, cycle time, cumulative flow — computed from what actually
happened to the cards, never from an estimate. An AI can finish writing a
card, suggest a split and tell the sprint's story; every one of those is
a proposal a person edits and says yes to.

Tavle is one tool in the [Haij](https://haij.dk) family and stands on the
Haij foundation, taken by way of [Ajour](https://github.com/MartinNymannVinther/ajour):
Danish-first, EU-sovereign, secure by design. The project constitution —
dogmas, principles, architecture and rules — lives in [CLAUDE.md](CLAUDE.md).
Decisions and their trade-offs live in [docs/adr](docs/adr/).

## Status

Version 0.11: complete as a product, not yet run in anger. What it holds:
the foundation (auth with passkeys and TOTP, workspaces separated in the
database, admission by application, the audit log, CI, Docker), boards in
two modes, cards with everything a card needs, the backlog structure with
its eleven rules enforced by the tool, the backlog with sprint planning
and one sprint at a time, the roadmap, the overview, the insight page, my
cards, inviting colleagues into a workspace with a link, the three AI
proposals, a demo with two boards in full swing, export and deletion, and
the help page with the board's ABC. Dogma seven is the one still open: a
real team runs a real board before Tavle goes in the window, and 1.0 is
what that team leaves behind.

What that means for you: the code is public and you are welcome to run it,
read it, report what you find and send changes. The instance at
tavle.haij.dk admits people by application; there is a demo at `/demo` if
the installation has turned it on. Before 1.0 a migration may still change
its mind.

Much of the code is written together with Claude Code, under the rules in
[CLAUDE.md](CLAUDE.md). Every change is reviewed, tested and deployed by a
person; the tests for tenancy isolation are the part of the codebase that
is trusted least to good intentions.

## What it is

**A board is one team's work.** When you create it you choose how the
team works. Kanban gives you a flow — Backlog, Ready, In progress, Done to
begin with — with a WIP limit on the columns where work happens; a full
column changes colour and says so, and never refuses a card. Scrum gives
you a backlog and sprints: plan one, put cards in it, start it, and the
board shows only that sprint until you close it. Closing writes the
velocity down and carries the unfinished cards to the top of the backlog
or into the next sprint.

**A card needs only a title and a place to exist.** Open it for the rest:
assignee, estimate, priority, due date, acceptance criteria, a checklist,
comments, and the history of everything that happened to it. Every field
saves as it is changed. A blocked card gets a red edge and a reason; a
bug is a card with a flag.

**One backlog structure, and the tool keeps it.** Above the cards sit
features and epics, each of which says when it is done and closes when
that is reached; a card belongs to at most one feature, a feature to at
most one epic, and nothing sits above an epic. Everything else a team
wants to know — why a thing is done, which part of the product it
touches, whether it is business or enabler work — is a field on the
item: themes (a closed list of five to eight, each with an owner), areas
(a closed list with owners), the kind. Two tests decide what goes where
and Tavle enforces them: can it be finished, then it is in the hierarchy;
does it have exactly one parent, then it is in the hierarchy; otherwise
it is a category. There is no "Diverse" epic and the tool will not make
one: what has no parent is shown as exactly that. A board decides how
much of this it shows — all three levels or just cards, with or without
kind, themes and areas — and the choice is a view: switch a part off and
it waits, switch it on and it is back. The backlog is one
list in its own order, with the decomposition beside it as a navigator:
click an epic or a feature and the list narrows to it, every kind of
thing carrying its own symbol. The list also groups by theme, area or
kind; the story map is the team's wall — the features they put up,
across in the story's order, the sprints down, every card in the cell
where the two meet — and a card dragged on it is moved for real; the roadmap draws epics on quarters; the overview says
how the open work is spread and whether the structure is being kept.

**The numbers come from the record.** Every move a card makes is written
down, so the insight page can say how many cards were finished per week,
how long a card takes once somebody picks it up, how the work is spread
across the columns day by day, and for Scrum boards how the sprint is
burning down and what the team's velocity has been.

**Everything works without a drag.** Every move on the board also exists
as a menu on the card; the backlog reorders with arrows; every field is a
real control. It works on a phone and with a keyboard.

**The team is a workspace.** Invite a colleague under Settings →
Workspace: you get a link, you send it, and the colleague either registers
through it or accepts with one click. Owners and admins shape the boards
and the team; everyone does the work.

## Haij-dogmerne

Tavle lever efter familiens syv dogmer. De står her i Haijs egne ord.

1. **Ægte open source.** Al kode ligger offentligt under AGPL-3.0. Alt vi driver, kan hentes 1:1 og køres et andet sted eller lokalt, og der findes ingen funktioner der kun kan fås på haij.dk. En betalt udgave er i orden, men den bygger på den samme kode. Kloner man repoet, får man præcis det der kører på haij.dk.

2. **Egen drift.** Hvert værktøj kan køre i eget driftsmiljø på én server med Docker Compose, en Postgres og en lokal sprogmodel gennem Ollama, uden en eneste nøgle til en sky. Funktioner der forudsætter en ekstern tjeneste, som CVR-opslag eller e-faktura, siger det direkte og lader resten virke i stedet for at gå i stykker. Testen er enkel: afbryd forbindelsen til internettet, og alt væsentligt skal stadig virke.

3. **Dine data, altid.** Alt en organisation ejer kan hentes ud med ét klik i åbne formater (regneark, JSON, PDF) uden at spørge nogen, og slettes helt igen. At forlade Haij skal kunne gøres med få klik uden unødvendig friktion, og vi hjælper gerne med flytningen frem for at gøre den besværlig.

4. **EU eller egen drift.** Når vi hoster, ligger alt hos EU-ejede leverandører på EU-jord, sprogmodeller inklusive, og hvert værktøj har en offentlig liste over hvem der kan se hvad. Ingen amerikansk sky i driften. Koden ligger på GitHub, som er kodehosting og ikke kundedata; et spejl hos en europæisk forge kommer den dag det giver mening.

5. **AI'en hjælper, mennesket bestemmer.** AI må foreslå, skrive udkast og rette i planer, men aldrig sende noget ud af ”huset”, slette noget eller forpligte nogen uden at et menneske har sagt ja. Alt AI gør, kan fortrydes. Indhold hentet udefra behandles som data, aldrig som instruktioner.

6. **Sikkerhed fra første dag.** Organisationers data er adskilt i databasen, ikke kun i koden, og der skal være en test der beviser det. Alle ændringer registreres i en log der ikke kan redigeres. Passkeys og totrinslogin er der fra start, der er en offentlig vej til at melde sikkerhedshuller, og der ligger aldrig hemmeligheder i koden.

7. **Brugt i virkeligheden.** Intet af det vi selv har bygget kommer i vinduet før det har kørt rigtigt arbejde, hos os selv eller hos en kunde vi sidder tæt på. Værktøjer fra andre skal have et rigtigt brugssted vi kan pege på. Vi skal ikke have værktøjer liggende som ikke har skabt reel værdi i virkeligheden.

## Quickstart

## Quickstart

Requirements: Node 22+, pnpm 10+ (`brew install pnpm`; newer Node builds no longer bundle corepack), Docker.

```bash
git clone https://github.com/MartinNymannVinther/tavle.git && cd tavle
pnpm install
cp .env.example .env                            # defaults work for local dev
docker compose -f docker-compose.dev.yml up -d --wait  # Postgres 16 + runtime roles, ready
pnpm db:migrate                                 # tables, RLS, audit triggers
pnpm dev                                        # http://localhost:3000
```

Register at `/register` — signup creates your user and your workspace —
then add a passkey under Indstillinger → Sikkerhed. Registration is closed
by default (`SIGNUP=closed`): an empty installation always lets the first
person in, the door shuts by itself once that account exists, and everyone
after that applies at `/register` and is admitted by the installation's
owner with a single-use link (Indstillinger → Adgang). Colleagues do not
apply: a member of a workspace invites them with a link from Indstillinger
→ Arbejdsrum.

```bash
pnpm test        # RLS isolation, the board and sprint flows, the metrics, the gates
pnpm lint && pnpm typecheck
```

The tests run against the database from the compose file and never call
an AI model, so they pass offline and without keys.

Two things the first run can trip over, both of which `pnpm db:migrate`
names when they happen. The Postgres image has to be pulled and the
cluster initialised the first time, so `--wait` matters; a migrate fired
before that is done fails and leaves an empty database behind. And if
another Postgres already holds port 5432 on your machine (Haij's or
Ajour's dev database, a local install), Tavle's container comes up
without its port and the migration talks to the wrong server: set
`POSTGRES_PORT=5434` in `.env` and change the three URLs to match.

## Running it for real

[docs/launch.md](docs/launch.md) is the ordered checklist for taking an
installation live the first time, including the two steps that are painful
to get wrong: the public URL passkeys bind to, and creating the first
account before anybody else finds the address.
[docs/deploy.md](docs/deploy.md) is the deployment guide behind it: Docker
Compose on an EU VPS, with Coolify doing the plumbing. Which third parties can
see data, and what, is listed in
[docs/subprocessors.md](docs/subprocessors.md) — today that is the
hosting provider and the AI provider you choose. With `LLM_PROVIDER=ollama`
nothing leaves the server at all.

## Contributing and security

[CONTRIBUTING.md](CONTRIBUTING.md) explains how changes are made here:
plan first, vertical slices, tests where they matter, an ADR for every
decision worth arguing about later.
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) covers how we talk to each
other. Found a security problem? Please report it privately as described
in [SECURITY.md](SECURITY.md) rather than in a public issue.

What we know is not right yet is written down rather than hoped away:
[TECH-DEBT.md](TECH-DEBT.md) lists it, with the reason it is still there
and what fixing it would take.

License: [AGPL-3.0](LICENSE). The Archivo typeface in `public/fonts` is by the Archivo Project Authors under the [SIL Open Font License 1.1](public/fonts/OFL.txt).
