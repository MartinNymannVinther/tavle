# ADR 0036: Three places and a door

Status: accepted · Date: 2026-09-17

## Context

A board grew to nine places: the board, the backlog, the breakdown, the
story map, the sprints, the roadmap, backlog care, the insight page and
the board's settings. All nine stood in one segmented track in the
header, in the order they had been built in, and the track was handed to
the page header's actions slot. On a wide screen it was a 749px ribbon
of nine words, every one of them the same size and weight; on a phone it
scrolled sideways inside its own box, with a script to drag the word you
were standing on back into sight.

Two things were wrong with that, and neither is a matter of taste.

Nine equal choices is not a menu, it is a list to read. Three of the
nine carry nearly all the traffic — the board, the backlog and, on a
Scrum board, the sprints — and they were the same size as the roadmap,
which a team looks at once a quarter. The words that matter most were
hidden in a row of words that do not.

And the track was the only thing on the page that said where you were.
No page under a board draws a title of its own: the `<h1>` is the
board's name, drawn once in the layout, on every one of the nine. Take
the lifted segment away and a person on the story map has nothing on
the screen that names the story map. That makes the header's own
marking load-bearing rather than decorative.

The owner asked for a friendlier menu, and for the board's settings to
move down to the left rail with the workspace's.

## Decision

**Three places on the track, and one door for the other six.**

    [ Tavle | Backlog | Sprints | Mere ⌄ ]

    Planlægning → Nedbrydning, Story map, Roadmap
    Opfølgning  → Backlog-styring, Indsigt
    ────────────
    Tavlens indstillinger

The track holds the board, the backlog and — on a Scrum board — the
sprints. The other six stand in a dropdown behind a fourth segment,
divided into the two questions they answer: planning what to build, and
following what happened. The board's own settings stand alone under a
hairline, because they are about the board rather than a place to work
in it.

**The door says where you are.** Standing behind it the trigger drops
the word "Mere" and reads the place's own name — "Story map",
"Indsigt" — lifted onto the card colour with `aria-current`, exactly as
a segment on the track would be. There is always exactly one lifted
segment on a board page, and it always names the page. The active row
inside the menu carries a check and `aria-current="page"`, so the
marking survives the menu being open.

The division lives in `src/components/board/places.ts`, away from any
component, and `tests/boards/places.test.ts` asserts that all nine keys
appear exactly once across the track and the groups. That is the test
that keeps "every place can still be reached" true the day someone adds
a tenth.

On a phone the navigation is drawn a second time, in a sticky band of
its own below the header, where the board's name has the whole line to
itself. Two DOM copies, as `SidebarNav` already has in the rail and in
the mobile sheet; the hidden one is `display:none` and so out of both
the tab order and the accessibility tree.

## Trade-offs accepted

**Five places lose their one-click reach.** The breakdown, the story
map, the roadmap, backlog care and the insight page are now two clicks
from anywhere instead of one. The person who pays that price is the
product owner, who lives in exactly those five; the eight other people
on the team, who use three, get a header they can read without
choosing. That is the trade deliberately: a cost concentrated on one
practised user so the rest need no practice. The product owner keeps
the keyboard: the menu opens on Enter and walks on arrow keys, and the
five have addresses that can be bookmarked.

**Six of the board's nine places now need JavaScript to be reached from
the header.** The old file said, with some satisfaction, that the tabs
were links "so they work without a script". That sentence is now half
true, and the retreat is written down rather than quietly dropped. Two
things soften it and neither erases it: the rows inside the menu are
real `<a href>` elements — Base UI's `render={<Link/>}` — so
middle-click, open-in-new-tab and the browser's own history all still
work once the menu is open, and the six keep their own addresses, which
can be typed and bookmarked. What does not soften it, and was checked
rather than assumed: nothing in the product links to `/structure`,
`/map`, `/roadmap`, `/overview` or `/insight` from anywhere else. With
no script those five have no path through the interface at all — only
an address somebody already knows. The board is a drag-and-drop client
that has needed a script since 0.9, so this changes who the header is
for rather than who the board is for. The honest statement is that the
header used to be better than the page it sits on, and now it is merely
as good.

**The board's settings were not moved to the left rail**, which is what
the owner asked for. The rail is `hidden lg:flex` and foldable by a
cookie read on the server, so a place that lived only there would
vanish on every phone and for everyone who folded it — and putting the
board's settings in the same rail as the workspace's would set two rows
both saying "Indstillinger" 120px apart, which sharpens the very
confusion the move was meant to solve. The word does the work instead:
the board's row now reads **Tavlens indstillinger**, and the four
sentences in the help and the roadmap's empty state that pointed at
"Indstillinger → …" on a board were corrected to match. A rename is
only half done while the prose still says the old word.

## Parked, on purpose

ADR 0031 decided that backlog care speaks only when it has something to
say. If it ever grows a count — "four findings waiting" — that count
would be invisible inside a closed menu, which is the one thing a
dropdown is bad at. The answer is a small dot on the "Mere" button when
something behind it wants attention, the same shape as the pending
count on the sidebar's settings link. It is not built now, because
nothing behind the door counts anything yet and a dot with nothing to
say is worse than no dot. Written down so the next person need not
rediscover the problem before solving it.
