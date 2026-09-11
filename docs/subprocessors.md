# Subprocessors

Per the Haij dogmas, every subprocessor must be EU-owned and EU-hosted,
and must be listed here **before** it is taken into use. This is the
public list of who can see what for the installation at tavle.haij.dk. A
self-hosted Tavle with `LLM_PROVIDER=ollama` or `none` has no
subprocessor at all beyond the machine it runs on.

| Subprocessor        | Purpose                                                                    | Data                                                                                                                                 | Location                                      | Added      |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------- |
| Hetzner Online GmbH | Hosting: the VPS running Docker and the database                           | Everything the installation holds                                                                                                    | Nuremberg, DE                                 | 2026-09-11 |
| Mistral AI          | LLM adapter: the three proposals (finish a card, split a card, the sprint) | The card or sprint the feature works on: titles, descriptions, checklists, a sprint's goal and its cards' titles. Written out below. | EU/EFTA data centres, via `api.eu.mistral.ai` | 2026-09-11 |

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

Mistral receives what a prompt contains and nothing else. Written out
rather than summarised, because "the card" is vague and the point of this
list is that it is not:

- **Finishing a card**: the board's name, the card's title, its existing
  description and the titles of its existing checklist items. Not the
  assignee, the comments, the labels or any other card.
- **Splitting a card**: the card's title, its description and its current
  estimate. Nothing else.
- **The sprint's story**: the sprint's name, dates, state and goal, its
  committed and completed points, and one line per card in it — its
  title, its estimate and whether it is done, blocked or open. Not the
  descriptions, not the comments, not who did what.

No prompt carries a person's name. The assignee is not in any of them,
and comments — where people write to each other by name — are never
sent. What is sent is what the team wrote on its cards, and a team whose
cards must not leave the machine runs `LLM_PROVIDER=ollama` or "none",
which is the reason those options exist.

## A workspace can choose a different one

Since ADR 0006, a workspace may set its own provider, model and API key in
Settings → AI. Mistral is the default on tavle.haij.dk and the one this
list covers, and it is what every workspace uses until it says otherwise.
A workspace that chooses differently has chosen its own processor: its
card text then goes to the provider named on its own settings page, under
whatever agreement it has with them, and this list no longer describes
it. A workspace that sets the provider to "none" sends nothing to any
model at all; the three AI buttons say so and everything else works.

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
