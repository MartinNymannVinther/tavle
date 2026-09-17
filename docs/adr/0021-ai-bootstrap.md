# ADR 0021: The fourth proposal — a starting point from the team's own prose

Status: accepted · Date: 2026-09-14 · Amended by ADR 0037 (the starting
point is offered only while the backlog is still bare; on a backlog the
team has built, an assistant takes the same slot)

## Context

A team standing in front of an empty board knows their product in
prose, not in epics. The owner asked for AI help to get from the one to
the other: write a description, answer a couple of questions about
time, and get a starting point to work on. The AI surface had three
proposals (ADR 0009); this is a fourth, and by far the widest — it
touches areas, themes, epics, features, cards and the roadmap at once.

## Decision

**Propose, prune, apply.** The dialog takes the description, a horizon
in quarters and "what comes first"; the prose is fenced as data in the
prompt, never as instructions. The model answers one JSON tree: areas,
themes, and epics with done-when, one area each, themes, a target
quarter inside the horizon, features and cards. The sanitizer cuts it
to shape — bounded counts (5 epics, 4 features each, 5 cards each),
capped strings, areas resolved to proposed or existing names, quarters
refused outside the horizon. The person then owns the tree before it
exists: every node can be unticked or retitled, and only the kept tree
is written.

**The apply is ordinary writes.** One transaction through the same
services as every hand-made item — existing area and theme names are
reused, never duplicated; inheritance and the eleven rules hold; the
rows and one `ai.bootstrapped` event are marked as the AI's work,
applied because an owner or admin said yes (creating areas and themes
is board shape, so the apply requires manage rights).

**Honest without a model.** The button always shows; without a model
the propose answers with the same wording as the other AI surfaces.

## Trade-offs accepted

- A model can propose a mediocre structure and a person can accept it
  wholesale. The mitigation is the review step being the _default_
  path, not the counts — and everything it makes is ordinary rows that
  the breakdown surface (ADR 0020) exists to reshape.
- Rule 4 lets the proposed done-whens be thin or empty; the marks from
  ADR 0018 carry the debt visibly instead of blocking the start.
