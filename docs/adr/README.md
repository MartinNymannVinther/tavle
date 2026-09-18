# Decisions

Every significant decision in Tavle is written down here, numbered in the
order it was taken, and says what trade-off was accepted rather than only
what was chosen. A decision is never rewritten once it is accepted: a
later one amends it and says so in both directions, so a reader who
arrives at the old number is told where the story continues.

This index is the way in. It is generated from the files' own titles and
status lines, so it cannot say something they do not — but it is checked
in, which means it has to be re-read when an ADR is added. The number of
the next one is the highest here plus one.

Where the product's own words live instead: **README.md** has the seven
dogmas in the family's voice, **CLAUDE.md** is the constitution every
session reads, and **TECH-DEBT.md** is what we know is not right yet.

| #                                                  | Decision                                                                        | Relations                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| [0001](0001-foundation-from-ajour.md)              | Tavle stands on a copy of the Ajour foundation                                  |                                             |
| [0002](0002-tenancy-rls.md)                        | Multi-tenancy enforced with RLS and two runtime roles                           |                                             |
| [0003](0003-audit-logging.md)                      | Trigger-based, append-only audit log                                            |                                             |
| [0004](0004-admission-by-invitation.md)            | Admission by application and invitation                                         |                                             |
| [0005](0005-demo-workspaces.md)                    | A demo workspace per visitor                                                    |                                             |
| [0006](0006-workspace-chosen-models.md)            | A workspace can choose its own model                                            |                                             |
| [0007](0007-product-data-model.md)                 | The product's data model — six concepts and a record of moves                   | Amended by 0011, 0033                       |
| [0008](0008-workspace-invitations.md)              | A colleague joins a workspace by invitation link                                |                                             |
| [0009](0009-ai-proposals.md)                       | The AI writes proposals, and only proposals                                     |                                             |
| [0010](0010-numbers-from-the-record.md)            | Every number is computed from the record, on request                            |                                             |
| [0011](0011-one-backlog-structure.md)              | One backlog structure — a hierarchy that finishes, categories that never do     | Amended by 0018, 0019                       |
| [0012](0012-backlog-reads-as-sections.md)          | The backlog reads as sections, and every kind of thing has a symbol             | Amended by 0018, Superseded in part by 0013 |
| [0013](0013-backlog-is-a-list-with-a-navigator.md) | The backlog is one list; the decomposition is a navigator beside it             | Amended by 0033, Supersedes 0012            |
| [0014](0014-structure-view-per-board.md)           | A board chooses how much of the structure it shows, and only shows              |                                             |
| [0015](0015-story-map.md)                          | The story map is the decomposition's own view, computed from the board          | Amended by 0016, 0032                       |
| [0016](0016-story-map-backbone.md)                 | The story map has its own backbone — chosen features, in the story's order      | Amends 0015, Amended by 0032                |
| [0017](0017-swimlanes.md)                          | Swimlanes on a Kanban board — three views and one field                         |                                             |
| [0018](0018-backlog-building-flow.md)              | Building the backlog is one surface, and rule 4 bites at the close              | Amends 0011, 0012                           |
| [0019](0019-roadmap-interactive-spans.md)          | The roadmap's bars are the plan — a chosen start, moved and stretched in place  | Amends 0011                                 |
| [0020](0020-decomposition-build-surface.md)        | The breakdown is a surface of its own — containment, a tray, and the same moves |                                             |
| [0021](0021-ai-bootstrap.md)                       | The fourth proposal — a starting point from the team's own prose                | Amended by 0037                             |
| [0022](0022-undo.md)                               | Undo — every event carries its own reverse                                      |                                             |
| [0023](0023-feature-plan-on-sprints.md)            | Features plan on sprints — and sprints can be laid ahead                        |                                             |
| [0024](0024-design-scale-and-tokens.md)            | A named small-text scale, and the last hard-coded values become tokens          |                                             |
| [0025](0025-quiet-assists.md)                      | The quiet assists — AI woven into the moment, still under dogma five            |                                             |
| [0026](0026-ai-counsel.md)                         | The AI as counsel — a goal, a plan, a brief                                     |                                             |
| [0027](0027-backlog-altitudes.md)                  | The backlog at three altitudes                                                  | Amended by 0033                             |
| [0028](0028-roadmap-pptx.md)                       | The roadmap leaves the house as one slide                                       |                                             |
| [0029](0029-people-roster.md)                      | A person is not a login                                                         |                                             |
| [0030](0030-estimate-units.md)                     | A T-shirt size is a label on a weight                                           |                                             |
| [0031](0031-backlog-care.md)                       | The overview becomes a workbench                                                |                                             |
| [0032](0032-releases.md)                           | A release is the story map's band                                               | Amends 0015, 0016                           |
| [0033](0033-one-rank-one-number.md)                | One rank, one number — a move writes one row                                    | Amends 0007, 0013, 0027                     |
| [0034](0034-ai-reads-on-their-own-route.md)        | An AI read is a route, not an action                                            |                                             |
| [0035](0035-ai-installation-roof.md)               | The installation's own roof over the AI                                         |                                             |
| [0036](0036-three-places-and-a-door.md)            | Three places and a door                                                         |                                             |
| [0037](0037-backlog-assistant.md)                  | The fifth proposal — an assistant for a backlog that exists                     | Amends 0021                                 |
| [0038](0038-the-landing-mark.md)                   | The landing mark — motion answers a move, not a gesture                         |                                             |
