# ADR 0034: An AI read is a route, not an action

Status: accepted · Date: 2026-09-16

## Context

The quiet assists (ADR 0025) and the counsel (ADR 0026) promise that an
assist "writes nothing" and that without a model it "degrades to
nothing, not to broken". Two of them were server actions, and Next runs
the server actions of one client strictly one at a time. A local model
thinking for twenty seconds therefore did not only make the assist slow
— it made the page slow. Measured on the dev installation with Ollama:

- The quick add's placement assist left at 3.8 s; "Flyt ned" was clicked
  at 4.5 s and its reorder was not _sent_ until 15.5 s, when the assist
  answered. The click was accepted, the arrows stayed enabled, nothing
  said a word. With "Tilføj" instead: clicked at 4.2 s, the card created
  at 18.2 s.
- The close conversation (rule 10) asks for advice when it opens. The
  confirm click at 4.8 s issued no request at all; "Annuller" at 6.8 s
  closed the dialog as if nothing had happened — and at 27.9 s, when the
  model finally answered, the queued close landed: the item closed and
  its child lost its feature, with nothing on screen saying so.

A read had taken a write hostage, and a cancelled dialog could still
close an item half a minute later. That is not a slow assist; it is the
AI deciding, which is dogma five upside down.

## Decision

**A read-only AI proposal is served from a route handler, not a server
action.** `POST /api/ai/quick-assist` and `POST /api/ai/close-advice`,
both through one door — `aiRead` in `src/modules/ai/read-route.ts` — and
that door keeps everything the actions kept: `requireOrgContext()`
first, so no session and no workspace means no model call; zod at the
boundary; the ceilings per user and per workspace counted in
`askForJson`; user prose fenced as data; the sanitizers resolving the
answer against the board's own rows. The locale is named by the page and
validated against the two we have, as the roadmap export already does.
The transport changed; nothing else did.

**A write is never behind a read.** The person's own act — adding a
card, moving one, closing an item — is a server action as before, and
now leaves the moment it is clicked whatever the model is doing.

**A call that is no longer wanted is abandoned.** Every read carries an
`AbortController`: a new keystroke drops the previous question, closing
the quick add drops it, confirming or cancelling the close dialog drops
it. The dialog says while it is thinking, and the confirm stays live
throughout.

**The remaining reads stay actions for now** — the done-when drafter,
the sprint-goal drafter and the review brief are each asked for by a
button the person then waits at, with nothing else in flight. The door
is there the day that stops being true.

## Trade-off accepted

Two doors into the AI instead of one: the propose/apply pairs stay
actions, the pure reads are routes, and a reader has to know which is
which. We chose that over the alternative reading of the same facts —
that the assists were too slow and should be hurried — because the queue
is not a speed problem. Any model will one day be slower than the person
typing, and a page that stops while it thinks is broken at any speed.

The second cost: a route returns data, not a revalidation, so an AI read
can never refresh the page on its own. That is right for a read and
would be wrong for anything else, which is exactly why the boundary is
drawn at "writes nothing".

Aborting reaches only as far as the browser: the server finishes the
model call it started, and the call is already counted against the
ceilings. Passing the request's signal through `LlmProvider.complete`
would let a cancelled dialog free the model too; it is a change to
`src/core/llm`, and it is not needed to keep the promise this ADR makes.
