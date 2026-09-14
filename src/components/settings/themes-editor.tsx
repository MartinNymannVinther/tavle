"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeChip } from "@/components/board/bits";
import type { Run } from "@/components/board/use-board-actions";
import type { Theme, ThemeColor } from "@/core/db/schema";
import { createThemeAction, updateThemeAction } from "@/modules/boards/actions-structure";
import { MAX_ACTIVE_THEMES } from "@/modules/boards/structure/rules";
import type { Member } from "@/modules/boards/types";
import { cn } from "@/lib/utils";
import { OwnerSelect, Swatches } from "./list-editor-bits";

/**
 * The board's themes: a closed list of five to eight, each with a name
 * that is a noun, a colour for the roadmap and an owner. A theme is never
 * deleted, only deactivated, so the history keeps its name; a deactivated
 * one can come back as long as there is room.
 */
export function ThemesEditor({
  boardId,
  themes,
  members,
  canManage,
  run,
}: {
  boardId: string;
  themes: Theme[];
  members: Member[];
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.themes");
  const [name, setName] = useState("");
  const [color, setColor] = useState<ThemeColor>("moss");
  const [owner, setOwner] = useState("");
  const activeCount = themes.filter((theme) => theme.active).length;

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await run(() =>
      createThemeAction({ boardId, name, color, ownerUserId: owner || null }),
    );
    if (ok) setName("");
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-hairline flex flex-col divide-y">
        {themes.map((theme) => (
          <ThemeRow
            key={theme.id}
            theme={theme}
            members={members}
            canManage={canManage}
            roomToActivate={activeCount < MAX_ACTIVE_THEMES}
            run={run}
          />
        ))}
        {themes.length === 0 && <li className="text-meta py-2 text-sm">{t("empty")}</li>}
      </ul>
      {canManage && activeCount < MAX_ACTIVE_THEMES && (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={40}
            placeholder={t("placeholder")}
            aria-label={t("name")}
            className="h-9 w-44 text-2sm"
          />
          <Swatches value={color} onChange={setColor} />
          <OwnerSelect value={owner} onChange={setOwner} members={members} label={t("owner")} />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
      {canManage && activeCount >= MAX_ACTIVE_THEMES && (
        <p className="text-meta text-sm">{t("full", { max: MAX_ACTIVE_THEMES })}</p>
      )}
    </div>
  );
}

function ThemeRow({
  theme,
  members,
  canManage,
  roomToActivate,
  run,
}: {
  theme: Theme;
  members: Member[];
  canManage: boolean;
  roomToActivate: boolean;
  run: Run;
}) {
  const t = useTranslations("boardSettings.themes");
  const [name, setName] = useState(theme.name);
  const [color, setColor] = useState<ThemeColor>(theme.color as ThemeColor);
  const [owner, setOwner] = useState(theme.ownerUserId ?? "");
  const dirty = name !== theme.name || color !== theme.color || owner !== (theme.ownerUserId ?? "");
  const save = (active: boolean) =>
    run(() =>
      updateThemeAction({ themeId: theme.id, name, color, ownerUserId: owner || null, active }),
    );
  return (
    <li className={cn("flex flex-wrap items-center gap-2 py-2", !theme.active && "opacity-60")}>
      <ThemeChip theme={{ name: name || theme.name, color }} />
      {!theme.active && <span className="text-meta text-xs">{t("inactive")}</span>}
      {canManage ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            aria-label={t("name")}
            className="h-9 w-44 text-2sm"
          />
          <Swatches value={color} onChange={setColor} />
          <OwnerSelect value={owner} onChange={setOwner} members={members} label={t("owner")} />
          {dirty && (
            <Button type="button" size="sm" onClick={() => void save(theme.active)}>
              {t("save")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={!theme.active && !roomToActivate}
            onClick={() => void save(!theme.active)}
          >
            {theme.active ? t("deactivate") : t("activate")}
          </Button>
        </>
      ) : (
        theme.ownerUserId && (
          <span className="text-meta text-xs">
            {members.find((m) => m.userId === theme.ownerUserId)?.name}
          </span>
        )
      )}
    </li>
  );
}
