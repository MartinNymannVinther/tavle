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
 * Acceptance criteria: optional on a story, and shown only when written
 * or asked for, so a card that does not need them is not a form with an
 * empty box. Same shape as the description, on purpose.
 */
export function CardAcceptance({ card, run }: { card: CardDetail; run: Run }) {
  const t = useTranslations("cards.acceptance");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(card.acceptance);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(() =>
      updateCardAction({
        cardId: card.id,
        acceptance: value,
        expectedUpdatedAt: card.updatedAt.toISOString(),
      }),
    );
    setPending(false);
    if (ok) setEditing(false);
  }

  if (!editing && !card.acceptance) {
    return (
      <section>
        <AddAffordance
          label={t("write")}
          onClick={() => {
            setValue("");
            setEditing(true);
          }}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(card.acceptance);
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
            rows={5}
            maxLength={4000}
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
      ) : (
        <p className="text-reading leading-relaxed whitespace-pre-wrap">{card.acceptance}</p>
      )}
    </section>
  );
}
