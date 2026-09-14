"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { AddAffordance } from "@/components/ui/add-affordance";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Run } from "@/components/board/use-board-actions";
import { applyDoneWhenAction, proposeDoneWhenAction } from "@/modules/ai/actions-assists";
import { updateItemAction } from "@/modules/boards/actions-structure";
import type { ItemView } from "@/modules/boards/types";

/**
 * The description of an epic or a feature, and its "done when", which
 * cannot be emptied: rule 4 says an item that cannot say when it is done
 * is a category. Same shape as the card's description, on purpose. With
 * a model set up the done-when can start as a proposal (docs/adr/0025):
 * the drafter fills the editor, the person rewrites and saves, and the
 * save is marked as the AI's work in the feed.
 */
export function ItemTextarea({
  item,
  field,
  run,
  assist = false,
}: {
  item: ItemView;
  field: "description" | "doneWhen";
  run: Run;
  /** A model is set up, and this is the done-when: offer the drafter. */
  assist?: boolean;
}) {
  const t = useTranslations(field === "doneWhen" ? "items.doneWhen" : "cards.description");
  const aiErrors = useTranslations("cards.ai.errors");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item[field]);
  const [pending, setPending] = useState(false);
  const [aiDraft, setAiDraft] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Rule 4 bites at the close, not here (docs/adr/0018): the done-when
  // may stand empty while the item is being shaped.

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const ok = await run(() =>
      aiDraft && field === "doneWhen" && value.trim()
        ? applyDoneWhenAction({ itemId: item.id, doneWhen: value })
        : updateItemAction({
            itemId: item.id,
            [field]: value,
            expectedUpdatedAt: item.updatedAt.toISOString(),
          }),
    );
    setPending(false);
    if (ok) {
      setEditing(false);
      setAiDraft(false);
    }
  }

  async function suggest() {
    setPending(true);
    setFailure(null);
    const result = await proposeDoneWhenAction({ itemId: item.id });
    setPending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setValue(result.proposal);
    setAiDraft(true);
    setEditing(true);
  }

  const suggestButton = assist && field === "doneWhen" && !editing && (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-meta"
      disabled={pending}
      onClick={() => void suggest()}
    >
      <Sparkles data-slot="icon" />
      {t("suggest")}
    </Button>
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-1">
          {suggestButton}
          {!editing && item[field] && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-meta"
              onClick={() => {
                setValue(item[field]);
                setAiDraft(false);
                setEditing(true);
              }}
            >
              {t("edit")}
            </Button>
          )}
        </div>
      </div>
      {failure && <p className="text-destructive text-xs">{aiErrors(failure)}</p>}
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
          {aiDraft && <p className="text-meta text-2xs">{t("aiDraft")}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {t("save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setAiDraft(false);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : item[field] ? (
        <p className="text-reading leading-relaxed whitespace-pre-wrap">{item[field]}</p>
      ) : (
        <AddAffordance
          label={t("write")}
          onClick={() => {
            setValue("");
            setAiDraft(false);
            setEditing(true);
          }}
        />
      )}
    </section>
  );
}
