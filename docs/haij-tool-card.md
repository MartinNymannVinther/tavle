# Tavle on haij.dk

Copy for the tool card on the family's front page, and a note on the entry
in the site's own `tools.ts`. Nothing here is code for this repository:
haij.dk is its own repo, and this file is the proposal to paste from.

## The card

**Tavle** · tavle.haij.dk

**Danish, one line**

> Teamets tavle, uden abonnementet. Kanban og Scrum med tal der er regnet
> ud fra det der faktisk skete. AI'en foreslår, teamet bestemmer.

**English, one line**

> The team's board, without the subscription. Kanban and Scrum with numbers
> computed from what actually happened. The AI proposes, the team decides.

**Danish, the paragraph under it**

> Et board skal ikke være et system. Tavle har seks begreber, og ikke ét
> mere: tavle, kolonne, kort, label, sprint og kommentar. Kør Kanban med
> WIP-grænser der advarer og aldrig forbyder, eller Scrum med en backlog og
> ét sprint ad gangen. Burndown, velocity, gennemløb og cyklustid regnes ud
> fra kortenes egne ure hver gang du kigger, ikke fra et skøn. AI'en kan
> skrive kortet færdigt, foreslå en opdeling og fortælle sprintets
> historie, og du retter og siger ja. Til teams på to til femten:
> produktteamet, driftsteamet, foreningens app-projekt.

**English, the paragraph under it**

> A board should not be a system. Tavle has six concepts and not one more:
> board, column, card, label, sprint and comment. Run Kanban with WIP
> limits that warn and never forbid, or Scrum with a backlog and one sprint
> at a time. Burndown, velocity, throughput and cycle time are computed
> from the cards' own clocks every time you look, never from an estimate.
> The AI can finish writing a card, suggest a split and tell the sprint's
> story, and you edit and say yes. For teams of two to fifteen: the product
> team, the ops team, the association's app project.

**Chips, if the card has them**

Kanban · Scrum · Backlog · Sprints · Indsigt · Mine kort · Team

**Buttons**

- Primary: _Prøv demoen_ → `https://tavle.haij.dk/demo`
- Secondary: _Ansøg om adgang_ → `https://tavle.haij.dk/register`
- Tertiary, if the card carries one: _Koden_ → `https://github.com/MartinNymannVinther/tavle`

**Status label**

`Klar til brug · v1` in Danish, `Ready to use · v1` in English, once
dogma seven has been met. Until a real team has run a real board on it,
the card waits (`docs/launch.md`, step 8); the label is never "beta" —
either it does what it says, or it is not on the card.

## The entry in the site's tools list

The site keeps its tools in a `tools.ts`. The proposed shape, matching the
existing entries rather than inventing a new one:

```ts
{
  id: "tavle",
  name: "Tavle",
  href: "https://tavle.haij.dk",
  repo: "https://github.com/MartinNymannVinther/tavle",
  demo: "https://tavle.haij.dk/demo",
  status: "live",
  tagline: {
    da: "Teamets tavle, uden abonnementet.",
    en: "The team's board, without the subscription.",
  },
  // …description and chips from the copy above
}
```

Two things worth checking against the site rather than assuming: whether
`demo` is a field the card already understands, and whether `status: "live"`
is the value the other tools use for something in production. Match what is
there; do not add a field for one tool.

## What the card should not say

No "powered by AI" as the headline. The AI is how it works, not what it is
for, and every second tool says it. No promises about uptime — the terms
page is honest that there is none, and the card should not contradict it.
No feature list longer than the chips: the omissions are the product, and a
card that lists twenty things is describing a different tool. And no
comparison with the tool everybody has a subscription to: the card says
what Tavle is, not what it is not.
