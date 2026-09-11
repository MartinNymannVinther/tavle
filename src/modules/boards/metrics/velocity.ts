/**
 * Velocity: the points finished per closed sprint, as they were written
 * down when each sprint closed. The forecast is the plain average of the
 * last three, which is what most teams use and what nobody has to explain.
 */

export type VelocityBar = { sprintId: string; name: string; committed: number; completed: number };

export type Velocity = {
  bars: VelocityBar[];
  /** Average completed points over the last three closed sprints, or null with none. */
  average: number | null;
};

export function velocity(
  sprints: Array<{
    id: string;
    name: string;
    number: number;
    state: string;
    committedPoints: number | null;
    completedPoints: number | null;
  }>,
  limit = 8,
): Velocity {
  const closed = sprints
    .filter((s) => s.state === "closed")
    .sort((a, b) => a.number - b.number)
    .slice(-limit);
  const bars = closed.map((s) => ({
    sprintId: s.id,
    name: s.name,
    committed: s.committedPoints ?? 0,
    completed: s.completedPoints ?? 0,
  }));
  const recent = bars.slice(-3);
  const average =
    recent.length === 0
      ? null
      : Math.round((recent.reduce((t, b) => t + b.completed, 0) / recent.length) * 10) / 10;
  return { bars, average };
}
