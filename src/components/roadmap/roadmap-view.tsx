"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NativeSelect } from "@/components/ui/native-select";
import { ThemeChip } from "@/components/board/bits";
import { themeSwatch } from "@/components/board/tokens";
import { roadmap, type RoadmapRow } from "@/modules/boards/structure/roadmap";
import type { BoardFull } from "@/modules/boards/types";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The roadmap: epics as bars across quarters, coloured by their first
 * theme, filtered by area. Drawn as a table of rows with a bar in each,
 * not as one SVG, so every title is a link, the page reads on a phone
 * and a screen reader gets a list rather than a picture. An epic due
 * for review says so on its bar; an epic with no target quarter is
 * listed underneath as unplanned rather than drawn to nowhere.
 */
export function RoadmapView({ full }: { full: BoardFull }) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  const [areaId, setAreaId] = useState("");
  const data = roadmap(full);
  const rows = areaId ? data.rows.filter((r) => r.epic.areaId === areaId) : data.rows;
  const unplanned = areaId
    ? data.unplanned.filter((r) => r.epic.areaId === areaId)
    : data.unplanned;
  const areas = full.areas.filter((a) => a.active);
  const columns = data.quarters.length;
  const themesUsed = [...new Set(rows.map((r) => r.theme?.id).filter(Boolean))].map((id) =>
    full.themes.find((theme) => theme.id === id)!,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        {areas.length > 1 && (
          <NativeSelect
            variant="sm"
            value={areaId}
            onChange={(event) => setAreaId(event.target.value)}
            aria-label={t("areaFilter")}
            className="w-44"
          >
            <option value="">{t("allAreas")}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {themesUsed.map((theme) => (
            <ThemeChip key={theme.id} theme={theme} />
          ))}
        </div>
      </div>

      <section className="border-border bg-card overflow-x-auto rounded-xl border shadow-[var(--surface-shadow)]">
        <div className="min-w-[44rem]">
          <div
            className="border-hairline grid border-b"
            style={{ gridTemplateColumns: `16rem repeat(${columns}, minmax(0, 1fr))` }}
          >
            <div className="text-label px-4 py-2 text-[0.72rem] font-medium">{t("epic")}</div>
            {data.quarters.map((quarter) => (
              <div
                key={quarter}
                className={cn(
                  "border-hairline border-l px-2 py-2 text-center text-[0.72rem] font-medium tabular-nums",
                  quarter === data.current ? "text-foreground bg-secondary/60" : "text-label",
                )}
              >
                {quarter}
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="text-meta px-4 py-6 text-sm">{t("empty")}</p>
          ) : (
            <ol>
              {rows.map((row) => (
                <RoadmapLine
                  key={row.epic.id}
                  row={row}
                  quarters={data.quarters}
                  current={data.current}
                  boardId={full.board.id}
                  boardKey={full.board.key}
                />
              ))}
            </ol>
          )}
        </div>
      </section>

      {unplanned.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{t("unplanned", { count: unplanned.length })}</h2>
          <p className="text-meta text-sm">{t("unplannedHint")}</p>
          <ul className="border-hairline divide-hairline divide-y rounded-lg border">
            {unplanned.map((row) => (
              <li key={row.epic.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-meta w-16 shrink-0 text-[0.72rem] tabular-nums">
                  {full.board.key}-{row.epic.number}
                </span>
                <Link
                  href={`/boards/${full.board.id}/items/${row.epic.number}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {row.epic.title}
                </Link>
                {row.reviewDue && (
                  <span className="bg-warning-tint text-warning rounded-full px-2 py-0.5 text-[0.69rem] font-medium">
                    {s("forReview")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RoadmapLine({
  row,
  quarters,
  current,
  boardId,
  boardKey,
}: {
  row: RoadmapRow;
  quarters: string[];
  current: string;
  boardId: string;
  boardKey: string;
}) {
  const t = useTranslations("roadmap");
  const s = useTranslations("boards.structure");
  const start = Math.max(0, quarters.indexOf(row.startQuarter));
  const end = Math.max(start, quarters.indexOf(row.endQuarter));
  const closed = row.epic.state === "closed";
  const total = row.openStories + row.doneStories;
  const progress = total > 0 ? row.doneStories / total : 0;
  return (
    <li
      className="border-hairline grid items-center border-b last:border-b-0"
      style={{ gridTemplateColumns: `16rem repeat(${quarters.length}, minmax(0, 1fr))` }}
    >
      <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2">
        <Link
          href={`/boards/${boardId}/items/${row.epic.number}`}
          className={cn("truncate text-sm font-medium hover:underline", closed && "text-meta")}
        >
          {row.epic.title}
        </Link>
        <p className="text-meta flex flex-wrap items-center gap-2 text-[0.69rem] tabular-nums">
          <span>
            {boardKey}-{row.epic.number}
          </span>
          {row.theme && <span>{row.theme.name}</span>}
          <span>{t("counts", { features: row.features, done: row.doneStories, total })}</span>
        </p>
      </div>
      {quarters.map((quarter, index) => (
        <div
          key={quarter}
          className={cn(
            "border-hairline relative h-12 border-l",
            quarter === current && "bg-secondary/40",
          )}
        >
          {index === start && (
            <div
              className={cn(
                "absolute inset-y-3 left-1 flex items-center overflow-hidden rounded-md px-2 text-[0.69rem] font-medium text-white",
                closed && "opacity-60",
              )}
              style={{
                width: `calc(${(end - start + 1) * 100}% - 0.5rem)`,
                background: row.theme ? themeSwatch(row.theme.color) : "var(--label)",
              }}
              title={`${row.startQuarter} – ${row.endQuarter}`}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
              <span className="relative truncate">
                {closed ? t("closed") : row.reviewDue ? s("forReview") : row.epic.targetQuarter}
              </span>
            </div>
          )}
        </div>
      ))}
    </li>
  );
}
