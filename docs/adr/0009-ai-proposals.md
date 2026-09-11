# ADR 0009: The AI writes proposals, and only proposals

Status: accepted · Date: 2026-09-11

## Context

Dogma five says the AI helps and the human decides. Ajour took that as
far as a chat that acts on the whole plan with a snapshot first, backed
by a deterministic rules engine so the product works without a model at
all. A team board is a different thing: its work is moving cards, and a
model moving cards is exactly the kind of help nobody asked for. What a
model is good at on a board is words.

## Decision

Three features, all proposals, all the same shape:

1. **Finish writing the card.** From a title and whatever description
   exists, a description, acceptance criteria and a checklist.
2. **Suggest a split.** From a card that is too big, two to six smaller
   cards with a title, an optional estimate and a one-line note.
3. **The sprint's story.** From a sprint's goal, its cards and their
   state, an account of what got done and what did not, highlights and
   risks.

Each is two server actions. The **propose** action calls the model
through the one door in `src/modules/ai/service.ts` — the workspace's
provider (ADR 0006), the call counted against the ceilings, the wait
bounded, the answer parsed as JSON — cuts the answer to shape with the
sanitizers, and returns it. The interface shows it in a dialog where
every word can be edited and every piece can be dropped. The **apply**
action writes what the person kept through the ordinary services, marked
`actor_kind = 'ai'` in the event log, so the activity feed always shows
which lines a model wrote.

There is no rules engine. Without a model the buttons say so and point at
Settings → AI; the board, the sprints and the numbers need none.

What enters a prompt is fenced (`fenceUntrusted`): control characters
stripped, the length capped, the fence unclosable from inside, and a
standing instruction that everything inside the fence is data written by
people, never instructions. What leaves the model is never trusted: the
sanitizers keep strings within the product's lengths, points within the
board's range, lists within a count, and drop everything else. The apply
actions validate ids against the caller's workspace like every other
action, and the AI has no action that deletes, moves or assigns.

## Alternatives rejected

- **A chat that acts on the board.** The most impressive demo and the
  least useful feature: a board's actions are one click each, and a
  sentence is a slower click. Left out; may return for questions ("what
  is stuck?") rather than commands.
- **Automatic estimates or automatic assignment.** Both are the team's
  judgement and a model's guess; a guess that lands in a field looks like
  a fact.
- **A rules engine as a fallback**, as in Ajour. Ajour's flows produce
  plans and statuses that must exist with or without a model; Tavle's
  three proposals are optional by nature, and a deterministic "draft"
  would be a template pretending to be help.

## Trade-offs accepted

- A team on a self-hosted installation with a slow local model waits up
  to four minutes for a proposal. The dialog says so.
- Card text reaches the model provider the workspace chose. The terms and
  `docs/subprocessors.md` say so, and a workspace that wants nothing to
  leave the server sets `LLM_PROVIDER=ollama` or "none".
