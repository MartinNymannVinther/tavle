# Subprocessors

Per the Haij dogmas, every subprocessor must be EU-owned and EU-hosted,
and must be listed here **before** it is taken into use. This is the
public list of who can see what for the installation at tavle.haij.dk. A
self-hosted Tavle with `LLM_PROVIDER=ollama` or `none` has no
subprocessor at all beyond the machine it runs on.

| Subprocessor        | Purpose                                                                                                                                                                                                                                                                                                                                                             | Data                                                                                                                                                                                                                                                                                                                                                                                                                     | Location                                      | Added      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------- |
| Hetzner Online GmbH | Hosting: the VPS running Docker and the database                                                                                                                                                                                                                                                                                                                    | Everything the installation holds                                                                                                                                                                                                                                                                                                                                                                                        | Nuremberg, DE                                 | 2026-09-11 |
| Mistral AI          | LLM adapter: the ten AI features — the five proposals (finish a card, split a card, the sprint's story, a backlog and roadmap from the team's own prose, an assistant for a backlog that already exists), the three quiet assists (a done-when, a sprint goal, a placement with a duplicate glance) and the two counsels (the close conversation, the review brief) | The board's own text for the feature at hand: titles, descriptions, checklists, done-whens, estimates, sprint and column names, the board's feature, theme and area names, its activity lines, and the prose and tasks a team types into the bootstrap and assistant dialogs. No field holding a person's name, and never a comment — but titles and descriptions are free text and may name someone. Written out below. | EU/EFTA data centres, via `api.eu.mistral.ai` | 2026-09-11 |
| Backup storage      | The nightly encrypted backup (`scripts/backup-tavle.sh`)                                                                                                                                                                                                                                                                                                            | Every table, once a night, encrypted with `age` before it leaves the machine — so what the provider holds is ciphertext and no readable row                                                                                                                                                                                                                                                                              | _Named per installation; must be in the EU_   | 2026-09-21 |

The backup row is the one an installation has to complete for itself.
`REMOTE` in `scripts/backup-tavle.sh` decides who holds the copy, and a
copy of everything is a subprocessor even when it is unreadable. For
tavle.haij.dk the provider goes in this row before the first real
workspace does.

Tavle sends no mail, so there is no mail provider on this list and there
will not be one without a row here first.

## What each one does and does not see

**Hetzner** hosts the machine, so it holds everything by definition: the
database, the backups on their way out, the logs. That is unavoidable for
any hosted deployment and is why the choice of provider matters and why
the exit plan in `docs/deploy.md` is a design requirement rather than a
nicety.

**Mistral** is a French company, and that is not by itself the answer to
where the data goes. Mistral runs three endpoints: `api.mistral.ai`,
`api.eu.mistral.ai` and `api.us.mistral.ai`, and they state that they do
not commit to any particular inference location for the first of them.
Tavle calls the EU one, and `MISTRAL_BASE_URL` in the environment is what
decides it, so it is an installation's choice and not a workspace's. The
regional endpoints cost 1.1x list price; that is what this row costs.
Ajour's list once said "Paris, FR" while its code called the endpoint
with no location commitment; Tavle inherits the correction, not the
mistake.

Mistral receives what a prompt contains and nothing else. There are ten
prompts, and each is written out here rather than summarised, because
"the card" is vague and the point of this list is that it is not. Five of
them are the proposals a person asks for by pressing a button:

- **Finishing a card**: the board's name, the card's title, its existing
  description and the titles of its existing checklist items. Not the
  assignee, the comments or any other card.
- **Splitting a card**: the card's title, its description and its current
  estimate. Nothing else.
- **The sprint's story**: the sprint's name, dates, state and goal, its
  committed and completed points, and one line per card in it — its
  title, its estimate and whether it is done, blocked or open. Not the
  descriptions, not the comments, not who did what.
- **A backlog and a roadmap from the team's own prose** (ADR 0021): the
  board's name, the names of the areas and themes it already has, the
  description of the product the team types into the dialog, the line
  about what should come first, and the quarters the chosen horizon
  covers. Nothing else that is already on the board — no cards, no
  features, no epics.
- **An assistant for a backlog that already exists** (ADR 0037): this one
  carries the board's whole open decomposition, and it is the only
  proposal that does. The board's name, the names of its active areas and
  themes, and one line for every open epic and feature on it — its key,
  whether it is an epic or a feature, its title, the key of the epic a
  feature sits under, its area, its themes, its target quarter, and a
  mark saying "done-when: MISSING" where the item has none. The
  done-when's own text is not sent, only whether one is there; nor are
  descriptions, cards, comments or who anything is assigned to. Then the
  task the person types, capped at a thousand characters. The list of
  lines is cut off at six thousand characters, so a very large backlog
  goes out in part rather than whole.

Three are the quiet assists (ADR 0025), drafted where a person already
stands:

- **A done-when**: the board's name, the item's level, its title and its
  description, the title of what it is part of, and the titles of up to
  thirty items or cards standing underneath it.
- **A sprint goal**: the sprint's name and dates, the points planned for
  it and the team's recent average velocity, and one line per card in it
  — its title, its feature's title and its estimate.
- **A placement, and the duplicate glance beside it**: the card title as
  it is being typed, the titles of every open feature on the board, the
  names of every active area, and the number and title of the board's two
  hundred newest cards. Two things about this one are worth saying
  outright. It is the only prompt that carries cards other than the one
  at hand, and that is what it is for: a duplicate cannot be noticed
  without something to notice it against. And it is the only one that is
  not a button: where a new card is typed with a place still to choose —
  a column on the board, the field on the backlog — it goes out by
  itself, 800 milliseconds after the typing stops, once the title has
  reached eight characters. Nothing is written either way, and with no
  model configured it is never asked at all.

Two are the counsel (ADR 0026), which reads a state and says what it
would do:

- **The close conversation**: the item being closed — its level, its
  title and its done-when — one line per open child with its key, its
  title, whether it is a feature or a story, how many open stories a
  feature still has and which column a story sits in, and the key and
  title of every open item at the same level it could be moved to
  instead.
- **The review brief**: the item's level and title, its done-when and the
  date it was last confirmed as still worth pursuing; one line for each
  feature or story underneath it, with its state or its column and how
  many of its stories are done; and up to thirty lines of that item's own
  activity feed — a date, the kind of event, and the title written into
  it. Not the audit log, which is a different record and is never sent.

There is an eleventh call, and it carries nothing from the board: the
connection test under Settings → AI asks the provider for its health
without a token and then sends one fixed sentence — "Svar med præcis ét
ord: OK" — so that "configured" and "working" can be told apart.

No _field_ holding a person's name is sent — the assignee is not in any
prompt and a person on the workspace's roster is a row the AI never
reads — and comments, where people write to each other by name, are
never sent. But titles, descriptions and done-whens are free text, and a
colleague or a customer named in one of those goes with it. Saying "no
person's name" flatly would be a promise the product cannot keep.

Eight of the ten carry the thing at hand and what stands immediately
above or below it. Two carry more, and both say so above: the duplicate
glance carries the titles of up to two hundred of the board's cards, and
the backlog assistant carries a line for every open epic and feature on
the board. So what leaves the machine is
what the team wrote on its cards and in its backlog, and a team whose
titles must not leave it runs `LLM_PROVIDER=ollama` or "none", which is
the reason those options exist.

## A workspace can choose a different one

Since ADR 0006, a workspace may set its own provider, model and API key in
Settings → AI. Mistral is the default on tavle.haij.dk and the one this
list covers, and it is what every workspace uses until it says otherwise.
A workspace that chooses differently has chosen its own processor: its
card text then goes to the provider named on its own settings page, under
whatever agreement it has with them, and this list no longer describes
it. A workspace that sets the provider to "none" sends nothing to any
model at all; every AI surface says so and everything else works.

The Ollama address is not part of that choice — it belongs to the
installation — so on the hosted instance the real options are Mistral or
no model. The key a workspace stores is encrypted at rest and is never
readable from the interface; the settings page says which key is in force,
the installation's or the workspace's own.

Passwords, passkeys, session tokens, the audit log, invitation ids and
anything belonging to another workspace are never sent. Everything a
person has written is placed in the prompt as data, never as instructions,
which is the prompt-injection defence rather than a privacy measure —
both matter, for different reasons.

## Not subprocessors, but worth naming

**GitHub** holds the source repository. It processes no installation
data, so it is a development dependency rather than a subprocessor, but
it is US-owned and that is worth stating plainly rather than leaving for
a reader to discover. Nothing about the installation's operation depends
on it: the deployment runs from a Docker image, and the repository can be
mirrored or moved without touching production.

**Let's Encrypt** issues the TLS certificate and therefore learns the
hostname, which is public in DNS anyway.

Adding anything to this list is a decision, not a formality. Before a new
row goes in: what data does it receive, could the feature work without
sending it, and what happens to the installation the day that provider
disappears.
