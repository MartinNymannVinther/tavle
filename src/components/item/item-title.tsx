"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Run } from "@/components/board/use-board-actions";
import { updateItemAction } from "@/modules/boards/actions-structure";
import { titleWarnings } from "@/modules/boards/structure/rules";
import type { ItemView } from "@/modules/boards/types";
import { cn } from "@/lib/utils";

/**
 * The title of an epic or a feature, edited in place, with the "looks
 * like a theme" warning shown while typing rather than after.
 */
export function ItemTitle({
  item,
  categoryNames,
  run,
}: {
  item: ItemView;
  categoryNames: string[];
  run: Run;
}) {
  const t = useTranslations("cards.title");
  const s = useTranslations("boards.structure");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title);
  const [pending, setPending] = useState(false);
  const warnings = titleWarnings(editing ? value : item.title, categoryNames);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim();
    if (!title || title === item.title) {
      setEditing(false);
      setValue(item.title);
      return;
    }
    setPending(true);
    const ok = await run(() =>
      updateItemAction({ itemId: item.id, title, expectedUpdatedAt: item.updatedAt.toISOString() }),
    );
    setPending(false);
    if (ok) setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1">
      {editing ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditing(false);
                setValue(item.title);
              }
            }}
            maxLength={160}
            aria-label={t("label")}
            className="max-w-2xl flex-1 text-lg font-semibold"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {t("save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setValue(item.title);
            }}
          >
            {t("cancel")}
          </Button>
        </form>
      ) : (
        <div className="group/title flex items-start gap-2">
          <h1
            className={cn(
              "text-[1.5rem] leading-tight font-semibold tracking-[-0.02em] text-balance",
              item.state === "closed" && "text-secondary-foreground",
            )}
          >
            {item.title}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t("edit")}
            className="text-meta mt-1 shrink-0"
            onClick={() => {
              setValue(item.title);
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
        </div>
      )}
      {warnings.length > 0 && (
        <p className="text-warning text-[0.78rem] font-medium">{s("looksLikeTheme")}</p>
      )}
    </div>
  );
}
