/**
 * The board's nine places and how they are divided: three on the track,
 * six behind a door. Kept out of the header's components so the division
 * can be tested without a browser, and so the day a tenth place arrives
 * there is one file that decides where it lands (docs/adr/0036).
 */

export type Place = {
  key: string;
  href: string;
  /** Path prefixes that also mean this place; the href alone otherwise. */
  also?: string[];
};

export type PlaceGroup = {
  key: "plan" | "follow" | "settings";
  labelKey?: "groupPlan" | "groupFollow";
  places: Place[];
};

/**
 * The track holds the three a team uses daily; the groups hold the rest.
 * A board without features has no breakdown and no map, and a board
 * without epics no roadmap, so a group can come back empty — an empty
 * one is dropped here rather than guarded at every render.
 */
export function boardPlaces(
  base: string,
  { scrum, map, roadmap }: { scrum: boolean; map: boolean; roadmap: boolean },
): { track: Place[]; groups: PlaceGroup[] } {
  const track: Place[] = [
    { key: "board", href: base, also: [`${base}/cards`] },
    { key: "backlog", href: `${base}/backlog`, also: [`${base}/backlog`, `${base}/items`] },
    ...(scrum ? [{ key: "sprints", href: `${base}/sprints` }] : []),
  ];

  const plan: Place[] = [
    ...(map
      ? [
          { key: "structure", href: `${base}/structure` },
          { key: "map", href: `${base}/map` },
        ]
      : []),
    ...(roadmap ? [{ key: "roadmap", href: `${base}/roadmap` }] : []),
  ];

  const groups: PlaceGroup[] = [
    { key: "plan" as const, labelKey: "groupPlan" as const, places: plan },
    {
      key: "follow" as const,
      labelKey: "groupFollow" as const,
      places: [
        { key: "overview", href: `${base}/overview` },
        { key: "insight", href: `${base}/insight` },
      ],
    },
    // The board's own settings stand apart: no heading, and a hairline
    // above them, because they are about the board rather than a place
    // to work in it.
    { key: "settings" as const, places: [{ key: "settings", href: `${base}/settings` }] },
  ].filter((group) => group.places.length > 0);

  return { track, groups };
}

/** The place the given path is standing in, or undefined for none of them. */
export function activePlace(pathname: string, places: Place[]): string | undefined {
  return places.find(
    (place) =>
      pathname === place.href ||
      (place.also ?? [place.href]).some((prefix) => pathname.startsWith(prefix)),
  )?.key;
}
