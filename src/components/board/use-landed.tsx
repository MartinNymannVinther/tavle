"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * What just moved, and where it ended up.
 *
 * Every write a board makes is silent when it works: `useBoardActions`
 * speaks up for a refusal and says nothing for a success, so a card put
 * in a sprint simply appears somewhere else between one paint and the
 * next. The drag itself is not the hard part — the drop target outlines
 * itself and the pointer is in the person's own hand — it is the landing
 * that goes by too fast to follow.
 *
 * So the card is marked where it now stands, for about a second. The
 * mark is set by the move rather than by the gesture, which is the point:
 * a card sent to a sprint by the selection bar's button, by a select on
 * its own row or by the arrow keys lands exactly as visibly as one that
 * was dragged. Making only the drag answer would quietly demote every
 * other way of doing it, and the constitution has the drag as the quick
 * path, never the only one.
 *
 * A bulk move marks every card it moved, so a sprint filled from the
 * selection bar shows what it took.
 */

/**
 * How long the mark stands. Long enough for the eye to come back to it
 * after the hand has finished, short enough that it is gone before the
 * next move. The stylesheet's `.landed` animation runs exactly this
 * long — `tests/meta/landed.test.ts` holds the two numbers together.
 */
export const LANDED_MS = 1100;

const NONE: ReadonlySet<string> = new Set();

const LandedContext = createContext<{
  landed: ReadonlySet<string>;
  mark: (ids: string[]) => void;
}>({ landed: NONE, mark: () => {} });

export function LandedProvider({ children }: { children: React.ReactNode }) {
  const [landed, setLanded] = useState(NONE);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const mark = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    // A second move while the first is still lit takes the mark over
    // rather than queueing behind it: the answer belongs to what just
    // happened, not to what happened a moment ago.
    clearTimeout(timer.current);
    setLanded(new Set(ids));
    timer.current = setTimeout(() => setLanded(NONE), LANDED_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return <LandedContext value={{ landed, mark }}>{children}</LandedContext>;
}

/**
 * Outside a board — a settings page, a test — the mark is a no-op and
 * nothing is lit, so a component can ask without knowing where it stands.
 */
export function useLanded(): { mark: (ids: string[]) => void; isLanded: (id: string) => boolean } {
  const { landed, mark } = useContext(LandedContext);
  return { mark, isLanded: (id: string) => landed.has(id) };
}
