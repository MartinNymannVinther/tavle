"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ALL, parseSelection, selectionKey, type Selection } from "./backlog-selection";

/**
 * The navigator's choice, kept in the URL (`?valg=`), so the way back
 * from a card page lands where the person left rather than on "all
 * cards". Written with replaceState: a way of looking, not a navigation.
 */
export function useChosen(): [Selection, (next: Selection) => void] {
  const params = useSearchParams();
  const [chosen, setChosen] = useState<Selection>(() => {
    const raw = params.get("valg");
    return raw ? parseSelection(raw) : ALL;
  });
  function choose(next: Selection) {
    setChosen(next);
    const url = new URL(window.location.href);
    if (selectionKey(next) === "all") url.searchParams.delete("valg");
    else url.searchParams.set("valg", selectionKey(next));
    window.history.replaceState(null, "", url);
  }
  return [chosen, choose];
}
