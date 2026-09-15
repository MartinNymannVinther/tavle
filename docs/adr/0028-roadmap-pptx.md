# ADR 0028: The roadmap leaves the house as one slide

Status: accepted · Date: 2026-09-15

## Context

The owner wants the roadmap downloadable "som ppt format hvor der
præsenteres en flot roadmap på en enkelt side" — the artefact a
steering meeting actually passes around. Dogma three already promises
the data in open formats; a .pptx is one more open format (OOXML),
and it must work without a cloud service (dogma two).

## Decision

**One 16:9 slide, drawn server-side with `pptxgenjs`** (MIT, pure
Node, no network) — the dependency the owner's ask implies, recorded
here per working rule 9. A "Hent som PowerPoint" button on the
roadmap calls `GET /api/boards/[id]/roadmap-pptx`, which resolves the
caller's workspace like every page and feeds the same `roadmap()`
computation the screen uses: epics as rounded bars on the quarter
axis in their first theme's colour, the current quarter banded, at
most nine rows with a "+N" note beyond, the unplanned named in the
footer, dated. A test proves the artefact is a real zip and that a
foreign workspace gets nothing.

## Trade-off accepted

The 2a palette is written into the exporter as hex — a .pptx cannot
read CSS variables, so a palette change must touch two places; the
constants sit beside a comment saying so. The slide draws the epic
axis only: the features-on-sprints view is a working surface, and a
deck's roadmap is quarters. Archivo renders only where the viewer has
the font; PowerPoint's fallback is accepted.
