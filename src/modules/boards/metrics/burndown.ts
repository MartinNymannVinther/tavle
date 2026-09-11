import { addDaysIso, diffDays } from "@/core/dates";

/**
 * The sprint's burndown, from the cards' own clocks. Remaining on a day is
 * the points on the sprint's cards that were not done by the end of that
 * day; the ideal line runs straight from the committed points to zero.
 * Days after today are left open rather than drawn at zero.
 *
 * Scope added after the start shows up as a bump — the line goes up — and
 * that is deliberate: a burndown that hides scope creep is decoration.
 */

export type BurndownCard = { estimate: number | null; doneAt: Date | null; createdAt: Date };

export type BurndownPoint = {
  date: string;
  /** Null for days that have not happened yet. */
  remaining: number | null;
  ideal: number;
};

export type Burndown = {
  committed: number;
  remainingNow: number;
  points: BurndownPoint[];
};

/** Copenhagen's offset from UTC, in minutes, on a given instant (60 or 120). */
function copenhagenOffsetMinutes(at: Date): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Copenhagen",
    timeZoneName: "shortOffset",
  })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(label ?? "");
  if (!match) return 60;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** The instant a Copenhagen calendar day ends, for comparing with timestamps. */
export function endOfDayCopenhagen(dateIso: string): Date {
  const next = addDaysIso(dateIso, 1);
  const [y, m, d] = next.split("-").map(Number);
  const midnightUtc = Date.UTC(y!, m! - 1, d!);
  // Midnight in Copenhagen is earlier than midnight UTC by the offset.
  const offset = copenhagenOffsetMinutes(new Date(midnightUtc));
  return new Date(midnightUtc - offset * 60_000 - 1);
}

export function burndown(
  sprint: { startDate: string; endDate: string; committedPoints: number | null },
  cards: BurndownCard[],
  today: string,
): Burndown {
  const committed = sprint.committedPoints ?? cards.reduce((t, c) => t + (c.estimate ?? 0), 0);
  const length = Math.max(1, diffDays(sprint.startDate, sprint.endDate));
  const points: BurndownPoint[] = [];
  const remainingAt = (day: string) => {
    const end = endOfDayCopenhagen(day);
    return cards.reduce(
      (total, card) =>
        total + (card.doneAt && card.doneAt.getTime() <= end.getTime() ? 0 : (card.estimate ?? 0)),
      0,
    );
  };
  for (let day = sprint.startDate, i = 0; day <= sprint.endDate; day = addDaysIso(day, 1), i++) {
    points.push({
      date: day,
      remaining: day <= today ? remainingAt(day) : null,
      ideal: Math.max(0, Math.round((committed * (length - i)) / length)),
    });
  }
  return { committed, remainingNow: remainingAt(today), points };
}
