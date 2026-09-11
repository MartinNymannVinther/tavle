"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Which sections of the backlog are folded out. The page opens with only
 * the epics visible, and what the person folds out is remembered per
 * board in the browser they did it in — a way of looking, kept where the
 * looking happens, never on the server. Storage can be missing or
 * refused (a private window, a locked-down browser); then the page
 * simply opens closed each time.
 */
const NONE: ReadonlySet<string> = new Set();
const snapshots = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();

const storageKey = (boardId: string) => `tavle.backlog.${boardId}.open`;

function read(boardId: string): ReadonlySet<string> {
  const cached = snapshots.get(boardId);
  if (cached) return cached;
  let loaded: ReadonlySet<string> = NONE;
  try {
    const raw = window.localStorage.getItem(storageKey(boardId));
    if (raw) loaded = new Set(JSON.parse(raw) as string[]);
  } catch {
    // Nothing remembered; the page opens closed.
  }
  snapshots.set(boardId, loaded);
  return loaded;
}

function write(boardId: string, next: ReadonlySet<string>) {
  snapshots.set(boardId, next);
  try {
    window.localStorage.setItem(storageKey(boardId), JSON.stringify([...next]));
  } catch {
    // Kept for this page only.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useFolded(boardId: string) {
  const open = useSyncExternalStore(
    subscribe,
    () => read(boardId),
    () => NONE,
  );
  const isOpen = useCallback((id: string) => open.has(id), [open]);
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(open);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      write(boardId, next);
    },
    [boardId, open],
  );
  const openAll = useCallback((ids: string[]) => write(boardId, new Set(ids)), [boardId]);
  const closeAll = useCallback(() => write(boardId, NONE), [boardId]);
  return { isOpen, toggle, openAll, closeAll, anyOpen: open.size > 0 };
}
