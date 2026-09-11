"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaChip } from "@/components/board/bits";
import type { Run } from "@/components/board/use-board-actions";
import type { Area } from "@/core/db/schema";
import { createAreaAction, updateAreaAction } from "@/modules/boards/actions-structure";
import type { Member } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { OwnerSelect } from "./list-editor-bits";

/**
 * The board's areas: the parts of the product, as nouns, each with an
 * owner. Deactivated rather than deleted, like themes; an item without a
 * parent must name one of these, so a board keeps at least one active.
 */
export function AreasEditor({
  boardId,
  areas,
  members,
  canManage,
  run,
}: {
  boardId: string;
  areas: Area[];
  members: Member[];
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.areas");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const activeCount = areas.filter((area) => area.active).length;

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() => createAreaAction({ boardId, name, ownerUserId: owner || null }));
    if (ok) setName("");
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-hairline flex flex-col divide-y">
        {areas.map((area) => (
          <AreaRow
            key={area.id}
            area={area}
            members={members}
            canManage={canManage}
            lastActive={area.active && activeCount === 1}
            run={run}
          />
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
          <OwnerSelect value={owner} onChange={setOwner} members={members} label={t("owner")} />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
    </div>
  );
}

function AreaRow({
  area,
  members,
  canManage,
  lastActive,
  run,
}: {
  area: Area;
  members: Member[];
  canManage: boolean;
  lastActive: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.areas");
  const [name, setName] = useState(area.name);
  const [owner, setOwner] = useState(area.ownerUserId ?? "");
  const dirty = name !== area.name || owner !== (area.ownerUserId ?? "");
  const save = (active: boolean) =>
    run(() => updateAreaAction({ areaId: area.id, name, ownerUserId: owner || null, active }));
  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-2", !area.active && "opacity-60")}>
      <AreaChip name={name || area.name} />
      {!area.active && <span className="text-meta text-[0.72rem]">{t("inactive")}</span>}
      {canManage ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label={t("name")}
            className="h-9 w-44 text-[0.8125rem]"
          />
          <OwnerSelect value={owner} onChange={setOwner} members={members} label={t("owner")} />
          {dirty && (
            <Button type="button" size="sm" onClick={() => void save(area.active)}>
              {t("save")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={lastActive}
            title={lastActive ? t("keepOne") : undefined}
            onClick={() => void save(!area.active)}
          >
            {area.active ? t("deactivate") : t("activate")}
          </Button>
        </>
      ) : (
        area.ownerUserId && (
          <span className="text-meta text-[0.72rem]">
            {members.find((m) => m.userId === area.ownerUserId)?.name}
          </span>
        )
      )}
    </li>
  );
}
