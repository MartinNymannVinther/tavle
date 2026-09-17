# ADR 0037: The fifth proposal — an assistant for a backlog that exists

Status: accepted · Date: 2026-09-17 · Amends ADR 0021 (the starting
point is offered only while the backlog is still bare)

## Context

"Byg et udgangspunkt" (ADR 0021) stood in the backlog's header and on
the breakdown surface unconditionally, on every board, forever. It is a
midwife: it proposes areas, themes and a whole tree of epics, features
and cards at once, drawn from a prose description of the product. On an
empty board that is exactly right. On a board with forty items it would
lay a second structure down beside the one the team has spent a quarter
building, and the person would have to prune a whole tree to keep the
two or three rows they actually wanted.

The owner named the miss: once the team has built its backlog and is
working it, the AI in that slot should be an assistant you can give a
direct task about adjusting and extending what is already there.

## Decision

**One slot, two offers, and the board decides which.**
`isBareDecomposition` in `src/modules/ai/bare-backlog.ts` answers one
question — fewer than three epics and features together — and both call
sites ask it and nothing else. Under the threshold the starting point
stands as before; at or above it the assistant takes the slot, under the
same Sparkles, so a person who has learned where the AI lives does not
have to learn it twice.

Zero would be too strict: one epic jotted down by hand is not a backlog,
and the person who jotted it is exactly who a starting point helps.
Closed items count, because a team that finished its first epics has
built a backlog and worked it. The number lives in one file with its
reason beside it.

**The assistant proposes four things and has no word for anything
else.** The person writes the task in their own words; the model is
given the decomposition as it stands — keys, titles, levels, parents,
areas, themes, target quarters and which items have no done-when — and
may answer with new epics (a done-when, one existing area, existing
themes, a quarter in the horizon), new features under an epic that
already exists, new cards under a feature that already exists, and text
edits to an existing title or done-when. Bounded: 3, 6, 12 and 10, with
the instruction capped at 1000 characters.

It cannot delete, close, archive, move a card between columns or change
the ranking. That is the constitution's own line — "the AI cannot delete
and cannot move a card" — and being handy is not an argument for bending
it. There is no field in the answer's shape that could say those things,
so a model that tries has nowhere to put it.

**It never proposes a new area or theme.** Areas and themes are the
board's shape, and shaping a board takes an owner or an admin. By
leaving them out, the assistant's apply needs no manage right —
`createItemAction` and `updateItemAction` do not require one either, and
the assistant writes nothing they do not — so the whole team can use it,
not only the two people who may change the board's shape. That is the
reason for the omission, not a corner cut.

**Propose, prune, apply, as everywhere else.** The prose and the task
are fenced as data with `fenceUntrusted`; the sanitizer resolves every
parent key, area and theme against this board's own rows and drops what
does not resolve; the apply re-resolves every key inside the
transaction, so a key from the client naming another board's item
resolves to nothing. Everything written goes through `createItem`,
`createCard` and `updateItem` marked `actorKind: ai`, lands in the
activity feed, and can be undone row by row like any other edit; one
`ai.assisted` event counts what the apply wrote. Without a model the
button says so and the rest of the page works.

## Alternatives rejected

- **Keeping the starting point everywhere and telling people not to use
  it.** The dialog cannot know what it would collide with; only the
  board does. A warning is a threshold with the decision handed to the
  person who has the least information.
- **One dialog that switches mode inside itself.** Two different asks —
  "describe your product" and "here is a task" — with two different
  answers and two different reviews. The threshold is the honest place
  for the fork, and two small components read better than one that is
  two.
- **Letting the assistant propose areas and themes when the caller
  happens to be an admin.** An AI surface whose vocabulary depends on
  who is looking is a surface nobody can reason about, and it would put
  the manage check back on the apply for everyone.

## Trade-offs accepted

- **The threshold is a judgement call.** Three is not derived from
  anything; a team on its second epic gets the assistant when the
  starting point might still have served them, and a team with two
  enormous epics gets the starting point when it should not. The
  mitigation is that neither offer is destructive: the starting point's
  tree is pruned before it is written, and the assistant is always one
  ordinary "new epic" button away from being unnecessary. The number is
  in one place so the next board that proves it wrong costs one line.
- **The bounded vocabulary means the assistant cannot do the thing a
  person most often wants**: "this epic is dead, close it" or "move
  these three cards". It will describe what it would do in a done-when
  edit at best, and mostly it will say nothing. We chose an assistant
  that is trusted over one that is capable — the surfaces for closing
  and moving already exist, they are one click away, and they are the
  person's own act.
- **A team can accept a mediocre proposal wholesale.** The review is the
  only path to the write and every row arrives ticked, which is the same
  bet ADR 0021 made; unticking is one click and the texts are editable
  in place. Beyond that: the counts are small enough that reading them
  all is realistic, everything written is marked as the AI's and shows
  as such in the feed, and every row is an ordinary row the breakdown
  surface (ADR 0020) exists to reshape. A proposal that is quietly wrong
  is still the risk; nothing in the design removes it.
- **The propose is a server action, not a route (ADR 0034).** It is a
  read, and a slow model therefore holds this client's other writes
  while the person waits at the dialog — which is what they are doing
  anyway, as with the starting point. The door in `read-route.ts` is
  there the day the assistant is asked from somewhere a person keeps
  working.
- **The model counts against the `assist` ceiling** together with the
  quick-add assist. Two rather different calls share one label in
  `ai_calls`; the ceilings are about spend, and spend does not care
  which of them it was.
