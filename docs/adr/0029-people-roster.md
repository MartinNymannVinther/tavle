# ADR 0029: A person is not a login

Status: accepted · Date: 2026-09-15

## Context

The owner's ask: team members must exist without being users of the
system, and be attachable when the login arrives. The team a board
plans for is rarely the set of accounts that have accepted an
invitation — work is assigned while people are still on their way in.
Until now `cards.assignee_user_id` pointed straight at the login, so a
colleague without an account could not carry a card, and removing a
login silently unassigned their work.

## Decision

**A `people` table becomes the workspace's roster, and the card's
assignee points at it.** A person is a name, an optional e-mail, and
optionally the login that stands behind them (`user_id`, one person
per login per workspace). The concept count grows to ten and the
person earns the place: it replaces the member as the thing work is
assigned to, and "my cards" means the person my login stands behind.

The boundary: **actors stay users.** Who did something — comments,
events, the audit trail — is an authenticated login; only
responsibility is a person. Owners of themes and areas stay users for
now; moving them is its own later decision.

Arrival is automatic at the one common door: a database trigger on
`memberships` adopts an unlinked person whose e-mail matches the new
login (case-insensitively), else makes a fresh linked person — so
invitation, admission and the demo all behave the same without any of
them knowing. The settings page adds the rest: create, rename, link by
hand, unlink, and remove — the last only for a person without a login,
because a linked person leaves through the workspace door. The
migration backfills one linked person per member and carries every
existing assignment across; undo steps written before this decision
name the assignee by login and are mapped to the person at apply time,
refusing honestly when no person remains.

## Trade-off accepted

Assignee filters and pickers now speak person ids while owner pickers
still speak user ids — two vocabularies until owners follow. The
adoption trigger is `SECURITY DEFINER` SQL living outside the service
layer; that is the price of catching every door Better Auth writes
memberships through, and it is the same trade rules 1, 4 and 5 of the
structure already made.
