import { describe, expect, it } from "vitest";
import { activePlace, boardPlaces } from "@/components/board/places";

const BASE = "/boards/b1";

const all = (shape: { scrum: boolean; map: boolean; roadmap: boolean }) => {
  const { track, groups } = boardPlaces(BASE, shape);
  return [...track, ...groups.flatMap((group) => group.places)];
};

describe("the board's places", () => {
  it("names every place exactly once on a full Scrum board", () => {
    const keys = all({ scrum: true, map: true, roadmap: true }).map((place) => place.key);
    expect([...keys].sort()).toEqual(
      [
        "backlog",
        "board",
        "insight",
        "map",
        "overview",
        "roadmap",
        "settings",
        "sprints",
        "structure",
      ].sort(),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps the track to the three daily places, whatever the board shows", () => {
    for (const map of [true, false]) {
      for (const roadmap of [true, false]) {
        expect(boardPlaces(BASE, { scrum: true, map, roadmap }).track.map((p) => p.key)).toEqual([
          "board",
          "backlog",
          "sprints",
        ]);
        expect(boardPlaces(BASE, { scrum: false, map, roadmap }).track.map((p) => p.key)).toEqual([
          "board",
          "backlog",
        ]);
      }
    }
  });

  it("drops the planning group entirely on a board of cards alone", () => {
    const { groups } = boardPlaces(BASE, { scrum: false, map: false, roadmap: false });
    expect(groups.some((group) => group.key === "plan")).toBe(false);
    expect(groups.some((group) => group.labelKey === "groupPlan")).toBe(false);
    expect(groups.map((group) => group.places.map((place) => place.key))).toEqual([
      ["overview", "insight"],
      ["settings"],
    ]);
  });

  it("leaves the board's settings on their own, off the track", () => {
    for (const scrum of [true, false]) {
      const { track, groups } = boardPlaces(BASE, { scrum, map: true, roadmap: true });
      expect(track.some((place) => place.key === "settings")).toBe(false);
      const settings = groups.find((group) => group.key === "settings");
      expect(settings?.places.map((place) => place.key)).toEqual(["settings"]);
      expect(settings?.labelKey).toBeUndefined();
    }
  });
});

describe("the place a path is standing in", () => {
  const places = all({ scrum: true, map: true, roadmap: true });

  it.each([
    [BASE, "board"],
    [`${BASE}/cards/WEB-1`, "board"],
    [`${BASE}/backlog`, "backlog"],
    [`${BASE}/items/9`, "backlog"],
    [`${BASE}/sprints/abc`, "sprints"],
    [`${BASE}/structure`, "structure"],
    [`${BASE}/map`, "map"],
    [`${BASE}/roadmap`, "roadmap"],
    [`${BASE}/overview`, "overview"],
    [`${BASE}/insight`, "insight"],
    [`${BASE}/settings/columns`, "settings"],
  ])("resolves %s to %s", (pathname, key) => {
    expect(activePlace(pathname, places)).toBe(key);
  });

  it("knows when it is nowhere on the board", () => {
    expect(activePlace("/boards", places)).toBeUndefined();
  });
});
