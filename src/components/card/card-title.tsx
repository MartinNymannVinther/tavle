"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CardDetail } from "@/modules/boards/types";
import { updateCardAction } from "@/modules/boards/actions-cards";
import type { Run } from "@/components/board/use-board-actions";

/**
 * The title, edited in place. The heading stays a heading until the
 * pencil is pressed; the save carries the row's timestamp so an edit made
 * on top of somebody else's is refused rather than overwritten.
 */
export function CardTitle({ card, run }: { card: CardDetail; run: Run }) {
  const t = useTranslations("cards.title");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.title);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim();
    if (!title || title === card.title) {
      setEditing(false);
      setValue(card.title);
      return;
    }
    setPending(true);
    const ok = await run(() =>
      updateCardAction({ cardId: card.id, title, expectedUpdatedAt: card.updatedAt.toISOString() }),
    );
    setPending(false);
    if (ok) setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setEditing(false);
              setValue(card.title);
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
            setValue(card.title);
          }}
        >
          {t("cancel")}
        </Button>
      </form>
    );
  }

  return (
    <div className="group/title flex items-start gap-2">
      <h1 className="text-[1.5rem] leading-tight font-semibold tracking-[-0.02em] text-balance">
        {card.title}
      </h1>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("edit")}
        className="text-meta mt-1 shrink-0"
        onClick={() => {
          setValue(card.title);
          setEditing(true);
        }}
      >
        <Pencil />
      </Button>
    </div>
  );
}
