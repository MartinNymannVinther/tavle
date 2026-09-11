# ADR 0008: A colleague joins a workspace by invitation link

Status: accepted · Date: 2026-09-11

## Context

Admission (ADR 0004) answers one question: how a stranger gets a
workspace of their own on a closed installation. It does not answer the
question a team board raises on day one: how the second person gets into
the first person's workspace. Ajour never needed the answer, because its
users could share a project through a link without accounts. A board is
edited by everybody on it, so everybody needs an account and the same
workspace.

## Decision

A workspace's owner or admin types a colleague's address under Settings →
Workspace and gets a link. The link is `/join/<invitation id>`, where the
id is a Better Auth organization invitation: single-purpose, bound to
that address, expiring after 48 hours, revocable, and subject to the
plugin's own rules — one open invitation per address, no inviting
somebody who is already a member, only owners and admins may invite,
nobody may invite an owner.

Whoever opens the link is handled by what they are:

- A stranger registers with the invitation's address — the form shows it
  locked and the server uses the invitation's copy, never the form's —
  and the account is created **without a workspace of its own** and
  accepts the invitation with its fresh session, which makes the
  workspace its active one. The signup gate (`src/core/auth/signup.ts`)
  admits the address through a second header, `x-tavle-team-invitation`,
  checked against the invitation row in the same way the admission key is.
- The person it was sent to, signed in, accepts with one click. Better
  Auth checks that the session's address matches.
- Somebody signed in as anyone else is told so and offered to sign out.
  The invitation is not accepted on their behalf.

No mail is sent. The person who invites copies the link and sends it the
way they talk to their colleague anyway. A mail provider is a dependency
the tool does not need to have, and the family's rule for external
services is that they say so and let the rest work — here the rest is
everything.

Roles and removal use the plugin's own endpoints (`updateMemberRole`,
`removeMember`, `leaveOrganization`), with the request's headers, so the
plugin's permission checks are the ones that decide. The last owner
cannot leave; that too is the plugin's rule.

## Alternatives rejected

- **Our own invitation table**, like the admission keys. It would have
  meant a second copy of what Better Auth already enforces: expiry,
  uniqueness per address, role, the acceptance rules. The admission
  table exists because it describes people who are not users yet and a
  workspace that does not exist yet; a workspace invitation describes
  neither.
- **Open workspaces by domain** (everyone at `@example.dk` joins
  automatically). Convenient and wrong for associations, freelancers and
  consultants, who are half of the audience.
- **Mail with the link in it.** Cleaner to use and a dependency for every
  installation. Later, and optional, if a real team asks.

## Trade-offs accepted

- The invitation id travels in the URL. It is a random opaque id with the
  same entropy class as a session token and expires in two days; the
  page it opens shows only the workspace's name, the inviter's name and
  the address it was sent to, which are the three things the recipient
  already knows.
- A person with accounts in several workspaces still has one account per
  Haij tool (ADR 0001). Nothing here changes that.
