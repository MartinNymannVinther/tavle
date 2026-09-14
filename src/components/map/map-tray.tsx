"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { TypeIcon } from "@/components/board/type-icon";
import type { ItemView } from "@/modules/boards/types";

/**
 * The tray under the map's header: the open features that are not on
 * the map yet, in the backlog's rank, each with how many cards wait
 * under it. A click puts the feature up at the right end of the
 * backbone, like taking a note from the pad and sticking it on the
 * wall. An empty tray says so in a line, and a map with nothing on it
 * points here.
 */
export function MapTray({
  features,
  countOf,
  onPutUp,
}: {
  features: ItemView[];
  countOf: (featureId: string) => number;
  onPutUp: (featureId: string) => void;
}) {
  const t = useTranslations("map");
  return (
    <div className="border-hairline flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
      <span className="text-label text-xs font-medium tracking-[0.02em] uppercase">
        {t("tray")}
      </span>
      {features.length === 0 ? (
        <span className="text-meta text-2sm">{t("trayEmpty")}</span>
      ) : (
        features.map((feature) => (
          <button
            key={feature.id}
            type="button"
            onClick={() => onPutUp(feature.id)}
            title={t("putUp")}
            className="bg-sticky/60 text-sticky-ink hover:bg-sticky inline-flex max-w-72 items-center gap-1.5 rounded-xs px-2.5 py-1 text-2sm shadow-[var(--note-shadow)] transition"
          >
            <TypeIcon type="feature" className="size-4 rounded-xs bg-white/40" />
            <span className="truncate">{feature.title}</span>
            <span className="tabular-nums opacity-70">{countOf(feature.id)}</span>
            <Plus className="size-3.5 opacity-70" aria-hidden />
          </button>
        ))
      )}
    </div>
  );
}
