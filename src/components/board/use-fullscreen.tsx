"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A surface the size of the window, for the two pages that draw
 * something wider than a column: the breakdown and the story map.
 *
 * A fixed overlay rather than the browser's Fullscreen API, on purpose.
 * Fullscreen shows only the fullscreened element's own subtree, and
 * every dialog and menu in this app portals to the body — so "Ny epic"
 * would open invisibly behind the chart. An overlay keeps every popup
 * alive, and Escape still closes it, which is the one habit the real
 * API would have given us for free.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return {
    fullscreen,
    toggle: () => setFullscreen((current) => !current),
    /** Put on the element that should fill the window when it is open. */
    overlay: fullscreen ? "bg-background fixed inset-0 z-40 overflow-auto p-6" : undefined,
  };
}

/** The button that opens and closes it, saying which way it goes. */
export function FullscreenButton({
  fullscreen,
  onToggle,
  className,
}: {
  fullscreen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const t = useTranslations("boards.fullscreen");
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      // No room for it on a phone, where the surface is already the window.
      className={className ?? "max-sm:hidden"}
      onClick={onToggle}
    >
      {fullscreen ? <Minimize2 data-slot="icon" /> : <Maximize2 data-slot="icon" />}
      {fullscreen ? t("exit") : t("enter")}
    </Button>
  );
}
