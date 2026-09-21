# Data processing agreement

**This is a template, not legal advice.** It is written to be read by the
people who will live under it, and it should be confirmed by counsel
before it is signed. Where it is thinner than a lawyer would like, the
fix is to say more here — not to sign something nobody in either
organisation has read.

It covers what GDPR Article 28(3) requires an agreement between a
controller and a processor to cover, for the hosted installation at
**tavle.haij.dk**. A self-hosted Tavle needs no agreement with us at
all: nothing reaches us, and the operator is the controller.

- **Controller:** the customer organisation — the workspace's own
  company, team or association.
- **Processor:** Vinther Consulting, martin@vintherconsulting.dk.
  _Postal address and CVR number to be filled in._
- **Version:** 2026-09-21.

## 1. What this covers, and what it does not

We are the processor for everything a workspace writes in Tavle: its
boards, cards, comments, sprints, releases and the roster of people work
is assigned to. The controller decides what goes in there; we store it
and show it back.

We are **not** the processor but the controller for the account layer —
name, e-mail, IP address and user agent on sign-in, and an application
for access. That is our own processing for our own purpose, described in
the privacy notice at `/terms` and recorded in
`docs/processing-record.md`. It is outside this agreement, and no
instruction under this agreement changes it.

## 2. Subject matter, duration, nature and purpose

- **Subject matter:** hosting the Tavle service so the controller's team
  can plan and track its work.
- **Duration:** for as long as the controller has a workspace on the
  installation. The agreement ends when the workspace is deleted.
- **Nature and purpose:** storage, display, search, computation of the
  board's own numbers, export, and — only where the controller uses
  them — the AI features described in section 7.

## 3. Types of personal data and categories of data subjects

**Data subjects:** the controller's own members and the people on its
roster, plus anyone the controller's people happen to name in a card, a
description or a comment.

**Types of data:** names and e-mail addresses on the roster and on
memberships; free text written into card titles, descriptions,
checklists, comments and sprint goals; who did what and when, in the
activity feed and the audit trail; attribution of work through
assignment.

Tavle asks for no special categories of data under Article 9 and has no
field for them, but free text is free text. The controller decides what
its team writes; if the work itself is about health, union membership or
anything else of that kind, that is a decision for the controller to
make deliberately.

## 4. Our obligations

1. **Instruction only.** We process the controller's data only on its
   documented instruction — using the product is the instruction — and
   never for our own purposes. We do not look at a workspace's content
   unless asked for help with a specific problem.
2. **Confidentiality.** Everyone with access is bound to keep it
   confidential.
3. **Security.** We keep the measures listed in Article 32 of the
   regulation and set out in `docs/processing-record.md`: tenancy
   enforced in the database with forced row-level security and a test
   proving it, an append-only audit log, passkeys and TOTP, encryption
   in transit, encrypted nightly backups, rate limits and ceilings on
   model calls.
4. **No transfers outside the EU/EEA.** Every subprocessor is EU-owned
   and EU-hosted, language models included.
5. **Breach notification.** We tell the controller without undue delay
   after becoming aware of a personal data breach affecting its data,
   with what we know at the time and the rest as we learn it.
6. **Deletion of our copies.** We keep no copy of a deleted workspace
   beyond the nightly encrypted backups, which roll off after 30 days at
   both ends.

## 5. Subprocessors

The current list is `docs/subprocessors.md` in this repository, and it
is public. Today it is Hetzner (hosting) and Mistral (the language
model, on its EU endpoint).

The controller gives general authorisation to the subprocessors on that
list. Before a new one is added, the row goes into that file and the
controller is told, so there is time to object before anything is taken
into use — the list is version-controlled, so what changed and when is
visible to anyone. If the controller objects and we cannot run the
service without the new subprocessor, either side may end the agreement
and the controller exports and leaves.

A workspace that sets its own model provider in Settings → AI has chosen
a processor of its own, under whatever agreement it has with them; that
choice falls outside this agreement and outside our subprocessor list.
Setting the provider to "none" sends nothing to any model.

## 6. Helping the controller

- **Data subject rights.** The product answers two of them by itself:
  export under Settings → Data gives everything as a spreadsheet and
  JSON, and the workspace's owner can delete the workspace and
  everything in it immediately. For anything else — access,
  rectification, restriction, objection — we help the controller answer
  within the time the regulation gives it. We do not answer a data
  subject ourselves; we point them at the controller.
- **Articles 32–36.** We assist with security, breach notification and
  any impact assessment, in proportion to the nature of the processing
  and what we can see from our side.

## 7. The AI features

If the controller uses them, text from its board goes to the model
provider named in `docs/subprocessors.md` — that provider is a
subprocessor for that processing. What each of the ten prompts carries
is written out field by field in that file. Three things the controller
should know when deciding whether to use them:

- Eight of the ten go out only when somebody presses a button, and carry
  the thing being asked about.
- Two carry more. The placement suggestion with its duplicate glance
  goes out by itself while a card title is being typed and carries the
  titles of up to two hundred of the board's cards; the backlog
  assistant carries a line for every open epic and feature on the board.
- No field holding a person's name is sent, and comments are never sent
  — but titles, descriptions and done-whens are free text and may name
  someone. The model proposes; nothing is written without a person
  saying yes, and everything it writes is marked as the AI's in the
  activity feed.

The controller can turn the whole surface off for its workspace by
choosing "none" as the provider.

## 8. When it ends

On deletion of the workspace, everything it holds is deleted at once,
the audit trail included, and nothing is retained. The controller should
take an export first, because there is no grace period and no copy we
can restore from except a backup that is a point in time and not a
selection.

Deleting the workspace does not delete the accounts of the people in it:
those are ours as controller, and a person removes their own account by
writing to us.

## 9. Audit

We make the information needed to show compliance with this agreement
available to the controller, and allow an audit or inspection carried
out by the controller or an auditor it mandates, on reasonable notice
and at reasonable intervals.

Most of what an audit would ask for can be read without asking us: Tavle
is AGPL-3.0 and the whole of it is in this repository, including the
tenancy migrations, the row-level-security tests, the audit triggers and
the deployment. That is the point of dogma one, and it is what makes
"show me" cheaper here than it usually is.

---

Signed for the controller: ............................................

Signed for the processor: .............................................
