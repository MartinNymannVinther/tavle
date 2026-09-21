# Record of processing activities

The record GDPR Article 30 asks a controller to keep, for the hosted
installation at **tavle.haij.dk**. It is written from the schema and the
code rather than from a template, so every row here can be checked
against a file in this repository. Where the honest answer is "nothing
expires today", that is what it says; a period nobody enforces would
read better and be untrue.

A self-hosted Tavle is its own controller and needs its own record. This
one describes what the code does, so most of it will be true there too —
but the entity, the subprocessors and the retention practice are the
operator's, not ours.

- **Controller:** Vinther Consulting, martin@vintherconsulting.dk.
  _Postal address and CVR number to be filled in._
- **Last reviewed:** 2026-09-21.
- **Data protection officer:** none. The processing is neither large
  scale nor of special categories, so Article 37 does not require one.

## The two roles

They are different processing activities with different records, and
mixing them is the mistake this document exists to avoid.

**Controller.** Accounts, applications for access, invitations, sign-in
records and the technical counters behind the rate limits. We decided
these should exist and what they are for.

**Processor.** Everything a workspace writes: boards, cards, comments,
sprints, the roster of people work is assigned to. The customer
organisation is the controller; we store it and show it on their behalf
and do nothing else with it. `docs/data-processing-agreement.md` is the
Article 28 frame, and the processor side of the record is the customer's
to keep.

## 1. Running the service (controller)

|                        |                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**            | Giving a person an account, signing them in, and keeping a workspace theirs.                                                                                                                                                                                                                                                                                                                   |
| **Legal basis**        | Article 6(1)(b), performance of the contract.                                                                                                                                                                                                                                                                                                                                                  |
| **Data subjects**      | Users of the installation.                                                                                                                                                                                                                                                                                                                                                                     |
| **Categories of data** | Name, e-mail address, password hash (scrypt, Better Auth's default), passkey public keys and their device metadata, TOTP secret and backup codes, session rows with IP address and user agent, workspace membership and role.                                                                                                                                                                  |
| **Where**              | `users`, `accounts`, `passkeys`, `two_factors`, `sessions`, `memberships`, `organizations`, `invitations` — `src/core/db/schema/foundation.ts`.                                                                                                                                                                                                                                                |
| **Retention**          | For the life of the account. A session expires after seven days (Better Auth's default; nothing in `src/core/auth/auth.ts` overrides it). Deleting a workspace removes the workspace and everything in it at once (`delete_workspace()`, `drizzle/0016_owner_errcode.sql`) but leaves the account standing: there is no self-service account deletion yet, so removing one is a request to us. |
| **Recipients**         | Nobody outside the installation.                                                                                                                                                                                                                                                                                                                                                               |

## 2. Admission: applying for access (controller)

|                        |                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**            | Letting a stranger ask to use a closed installation, and letting the owner decide.                                                                                                                                                               |
| **Legal basis**        | Article 6(1)(b), steps taken at the data subject's own request before a contract; Article 6(1)(f) for the IP address and user agent, which exist to stop the form being abused.                                                                  |
| **Data subjects**      | People who have applied and are not (yet) users.                                                                                                                                                                                                 |
| **Categories of data** | Name, e-mail address, organisation name, the free-text message, IP address, user agent, the decision and who made it.                                                                                                                            |
| **Where**              | `access_requests` and `access_invitations` in `src/core/db/schema/foundation.ts`; written by `submitAccessRequest()` in `src/core/access/service.ts`.                                                                                            |
| **Retention**          | **No expiry today.** A declined application stays as the record of the decision until somebody asks for it to be deleted. An invitation is single-purpose, bound to one address and dead after 48 hours, but its row stays. This is a known gap. |
| **Recipients**         | The installation's owner, who reads the application and replies by ordinary e-mail from their own mailbox. Tavle itself sends no mail.                                                                                                           |

## 3. Security logging and the audit trail (controller, and processor)

|                        |                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**            | Being able to see what happened: who changed what, who signed in, who was admitted. It is a security measure and a dogma (six), not an analytics feed.                                                                                                                                                                                                                   |
| **Legal basis**        | Article 6(1)(f), our legitimate interest in the integrity of the installation. For rows about a workspace's own content the workspace is the controller and this is processing on its instruction.                                                                                                                                                                       |
| **Data subjects**      | Users, and people who have applied.                                                                                                                                                                                                                                                                                                                                      |
| **Categories of data** | Actor, action, entity, before/after values of the changed row, IP address and user agent on sign-in and admission events, timestamp.                                                                                                                                                                                                                                     |
| **Where**              | `audit_log` (`src/core/db/schema/foundation.ts`), written by database triggers plus `recordAuthEvent()` in `src/core/audit/events.ts`.                                                                                                                                                                                                                                   |
| **Retention**          | For the life of the workspace. The log cannot be updated or deleted — the application role has no privilege to, and a trigger rejects both — and it goes only when the workspace does: `delete_workspace()` purges the rows for that `org_id` and leaves one context-free row saying it happened. Rows with no `org_id` (sign-ins, admissions) have **no expiry today**. |
| **Recipients**         | Nobody outside the installation. It is never sent to a model.                                                                                                                                                                                                                                                                                                            |

## 4. Rate limiting and ceilings on model calls (controller)

|                        |                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**            | Keeping a public form and a paid model API from being used as somebody else's resource.                                                                                                                                                                                                                                                               |
| **Legal basis**        | Article 6(1)(f).                                                                                                                                                                                                                                                                                                                                      |
| **Data subjects**      | Users; anyone calling a public endpoint.                                                                                                                                                                                                                                                                                                              |
| **Categories of data** | For AI: one row per call with the workspace, the user, the kind of call and the time — never the prompt or the answer (`ai_calls`, `src/core/db/schema/ai.ts`). For public endpoints: a counter in memory keyed by the caller's address (`src/core/rate-limit.ts`), lost on restart. For Better Auth's own endpoints: a counter row in `rate_limits`. |
| **Retention**          | `ai_calls` has **no expiry today**; the rows follow the workspace out when it is deleted (`org_id` cascades). The in-memory buckets live minutes.                                                                                                                                                                                                     |
| **Recipients**         | Nobody.                                                                                                                                                                                                                                                                                                                                               |

## 5. A workspace's own content (processor)

|                        |                                                                                                                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**            | Being the board: storing and showing what the team writes.                                                                                                                                                                                                                                                     |
| **Legal basis**        | The customer organisation's, not ours. We act on documented instruction under the data processing agreement.                                                                                                                                                                                                   |
| **Data subjects**      | Members of the workspace, the people on its roster, and anyone the team happens to name in a card title, a description or a comment.                                                                                                                                                                           |
| **Categories of data** | Board and column names; card titles, descriptions, checklists, estimates, due dates and blocked reasons; comments and their authors; the roster (`people`: name, optional e-mail, optional link to a login); sprints and releases; the movement history (`card_transitions`) and the activity feed (`events`). |
| **Where**              | `src/core/db/schema/boards.ts` and `structure.ts`. Every table carries `org_id` with forced row-level security; `tests/rls` fails any table without it.                                                                                                                                                        |
| **Retention**          | The workspace's own choice. Deletion is immediate and self-service and takes the audit rows with it. Abandoned workspaces do **not** expire today.                                                                                                                                                             |
| **Recipients**         | The model provider, for the text a feature sends — see section 6 and `docs/subprocessors.md`. Nobody else.                                                                                                                                                                                                     |

## 6. The AI features (processor)

The model sees what a prompt contains and nothing else, and
`docs/subprocessors.md` writes out all ten prompts field by field
rather than summarising them. Three things belong in this record:

- Eight of the ten go out because a person pressed a button, and carry
  the thing being asked about.
- Two carry more. The placement suggestion with its duplicate glance
  goes out by itself 800 ms after typing stops
  (`src/components/board/quick-add.tsx`) and carries the titles of up to
  two hundred of the board's cards. The backlog assistant (ADR 0037)
  is pressed, but carries a line for every open epic and feature on the
  board. The privacy notice says both in those words.
- No field holding a person's name is sent — the assignee is in no
  prompt and comments are never sent — but titles, descriptions and
  done-whens are free text and may name a colleague or a customer.
  Nothing is written without a person saying yes, and everything the
  model writes is marked `actorKind: ai` in the event log.

A workspace may set its own provider and key in Settings → AI (ADR
0006), which makes that provider its own processor and takes it outside
this record. `LLM_PROVIDER=none` sends nothing at all.

## 7. The demo (controller)

A demo workspace is created with no e-mail and no sign-up, and deleted
entirely 24 hours later, throwaway account included
(`src/modules/demo/service.ts`). It holds whatever a visitor types into
it, which is why the terms page asks visitors not to type anything real.
Legal basis: Article 6(1)(f), our interest in showing the product.
Nothing survives the sweep.

## Recipients and transfers

Two subprocessors, both EU-owned and EU-hosted, listed in
`docs/subprocessors.md` before they were taken into use:

- **Hetzner Online GmbH** (Nuremberg, DE) — the VPS and therefore
  everything the installation holds.
- **Mistral AI** (EU/EFTA data centres, via `api.eu.mistral.ai`) — the
  board text carried by the ten prompts.
- **The object storage holding the nightly backups** — every table, once
  a night. Which provider that is, is the installation's own choice
  (`REMOTE` in `scripts/backup-tavle.sh`), so it is named per
  installation rather than here. It has to be named: a backup is a copy
  of everything, and whoever holds it is a subprocessor even though what
  they hold is ciphertext. The dump is encrypted with `age` before it
  leaves the machine, so the provider sees no readable row — which
  reduces the risk, not the role.

**Nothing leaves the EU/EEA**, and the backup remote must be chosen to
keep that true. GitHub holds the source code and processes no
installation data; Let's Encrypt learns the hostname, which is public in
DNS. Neither is a subprocessor.

## Security measures (Article 32)

- Tenancy in the database, not in the queries: `org_id` on every domain
  table, row-level security enabled **and forced**, and every domain
  query through `withOrgContext()` on an application role that has no
  bypass. A meta-test fails any table that arrives without it.
- An append-only audit log: no UPDATE or DELETE privilege, and a trigger
  that rejects both.
- Passkeys (WebAuthn) and TOTP from the start; passwords hashed, minimum
  twelve characters; session cookies Secure, HttpOnly, SameSite=Lax.
- Registration closed by default; admission by application and
  invitation, invitations single-purpose and expiring after 48 hours.
- A workspace's model API key encrypted at rest with AES-256-GCM
  (`src/core/crypto/secret-box.ts`) and never readable from the
  interface.
- Rate limits on auth and every public endpoint, and three ceilings on
  model calls — per user, per workspace and over the whole installation
  (ADR 0035).
- User-written text is fenced as data in every prompt, never as
  instructions; model output is sanitised and validated against the
  board's own ids before anything is written.
- TLS on the public origin; nightly database backups encrypted with
  `age` before they leave the machine and rolled off after 30 days at
  both ends (`scripts/backup-tavle.sh`).
- Dependency audit and secrets scanning in CI on every push;
  responsible disclosure in `SECURITY.md`.

## Known gaps

Written down because a record that hides them is worth less than one
that names them.

1. Nothing expires on its own except demo workspaces, backups and
   invitation validity. Accounts, abandoned workspaces, `ai_calls`,
   access requests and the `org_id`-less audit rows are kept until
   somebody acts.
2. There is no self-service account deletion; erasure of an account is a
   request handled by hand.
3. Name and e-mail cannot be corrected from the settings pages, so
   rectification also runs through us.
