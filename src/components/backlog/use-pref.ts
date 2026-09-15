"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * One remembered way of looking — which altitude the backlog shows,
 * whether the sprints stand beside it — kept per board in the browser
 * the looking happens in, like the folds (use-folded.ts). Storage can
 * be missing or refused; then the page simply opens on the default.
 */
const snapshots = new Map<string, string>();
const listeners = new Set<() => void>();

function read(key: string, fallback: string): string {
  const cached = snapshots.get(key);
  if (cached !== undefined) return cached;
  let loaded = fallback;
  try {
    loaded = window.localStorage.getItem(key) ?? fallback;
  } catch {
    // Nothing remembered; the default stands.
  }
  snapshots.set(key, loaded);
  return loaded;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePref<T extends string>(key: string, fallback: T): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T) => {
      snapshots.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Kept for this page only.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value as T, set];
}
