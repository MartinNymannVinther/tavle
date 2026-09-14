"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddAffordance } from "@/components/ui/add-affordance";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CardDetail } from "@/modules/boards/types";
import { updateCardAction } from "@/modules/boards/actions-cards";
import type { Run } from "@/components/board/use-board-actions";

/**
 * What the card is about, as plain text with its line breaks kept. Shown
 * as text until somebody wants to write; a textarea the whole time would
 * make every card look like a form waiting to be filled in.
 */
export function CardDescription({ card, run }: { card: CardDetail; run: Run }) {
  const t = useTranslations("cards.description");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.description);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(() =>
      updateCardAction({
        cardId: card.id,
        description: value,
        expectedUpdatedAt: card.updatedAt.toISOString(),
      }),
    );
    setPending(false);
    if (ok) setEditing(false);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        {!editing && card.description && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-meta"
            onClick={() => {
              setValue(card.description);
              setEditing(true);
            }}
          >
            {t("edit")}
          </Button>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2">
          <Textarea
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={8}
            maxLength={8000}
            placeholder={t("placeholder")}
            aria-label={t("title")}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : card.description ? (
        <p className="text-reading leading-relaxed whitespace-pre-wrap">{card.description}</p>
      ) : (
        <AddAffordance
          label={t("write")}
          onClick={() => {
            setValue("");
            setEditing(true);
          }}
        />
      )}
    </section>
  );
}
