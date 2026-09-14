"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Run } from "@/components/board/use-board-actions";
import type { Swimlane } from "@/core/db/schema";
import { createSwimlaneAction, updateSwimlaneAction } from "@/modules/boards/actions-swimlanes";
import { cn } from "@/lib/utils";

/**
 * The board's manual swimlanes: the rows the team named itself, in the
 * order they were made. Deactivated rather than deleted, like the closed
 * lists; the cards in a deactivated lane keep standing where they stood.
 */
export function SwimlanesEditor({
  boardId,
  swimlanes,
  canManage,
  run,
}: {
  boardId: string;
  swimlanes: Swimlane[];
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.swimlanes");
  const [name, setName] = useState("");

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => createSwimlaneAction({ boardId, name }));
    if (ok) setName("");
  }

  return (
    <div className="flex flex-col gap-3">
      {swimlanes.length === 0 && <p className="text-meta text-[0.8125rem]">{t("empty")}</p>}
      <ul className="divide-hairline flex flex-col divide-y">
        {swimlanes.map((lane) => (
          <SwimlaneRow key={lane.id} lane={lane} canManage={canManage} run={run} />
        ))}
      </ul>
      {canManage && (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
            placeholder={t("placeholder")}
            aria-label={t("name")}
            className="h-9 w-44 text-[0.8125rem]"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
    </div>
  );
}

function SwimlaneRow({ lane, canManage, run }: { lane: Swimlane; canManage: boolean; run: Run }) {
  const t = useTranslations("boardSettings.swimlanes");
  const [name, setName] = useState(lane.name);
  const dirty = name !== lane.name;
  const save = (active: boolean) =>
    run(() => updateSwimlaneAction({ swimlaneId: lane.id, name, active }));
  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-2", !lane.active && "opacity-60")}>
      {canManage ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label={t("name")}
            className="h-9 w-44 text-[0.8125rem]"
          />
          {dirty && (
            <Button type="button" size="sm" onClick={() => void save(lane.active)}>
              {t("save")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => void save(!lane.active)}
          >
            {lane.active ? t("deactivate") : t("activate")}
          </Button>
        </>
      ) : (
        <span className="text-sm">{lane.name}</span>
      )}
      {!lane.active && <span className="text-meta text-[0.72rem]">{t("inactive")}</span>}
    </li>
  );
}
