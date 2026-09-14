"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddAffordance } from "@/components/ui/add-affordance";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Run } from "@/components/board/use-board-actions";
import { updateItemAction } from "@/modules/boards/actions-structure";
import type { ItemView } from "@/modules/boards/types";

/**
 * The description of an epic or a feature, and its "done when", which
 * cannot be emptied: rule 4 says an item that cannot say when it is done
 * is a category. Same shape as the card's description, on purpose.
 */
export function ItemTextarea({
  item,
  field,
  run,
}: {
  item: ItemView;
  field: "description" | "doneWhen";
  run: Run;
}) {
  const t = useTranslations(field === "doneWhen" ? "items.doneWhen" : "cards.description");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item[field]);
  const [pending, setPending] = useState(false);
  // Rule 4 bites at the close, not here (docs/adr/0018): the done-when
  // may stand empty while the item is being shaped.

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(() =>
      updateItemAction({
        itemId: item.id,
        [field]: value,
        expectedUpdatedAt: item.updatedAt.toISOString(),
      }),
    );
    setPending(false);
    if (ok) setEditing(false);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        {!editing && item[field] && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-meta"
            onClick={() => {
              setValue(item[field]);
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
            rows={field === "doneWhen" ? 3 : 8}
            maxLength={field === "doneWhen" ? 500 : 8000}
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
      ) : item[field] ? (
        <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">{item[field]}</p>
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
