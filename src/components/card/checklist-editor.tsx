"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChecklistItem } from "@/core/db/schema";
import type { CardDetail } from "@/modules/boards/types";
import { updateChecklistAction } from "@/modules/boards/actions-cards";
import type { Run } from "@/components/board/use-board-actions";
import { cn } from "@/lib/utils";

/**
 * The checklist: the steps inside a card, ticked off one by one. Every
 * change writes the whole list, which is small, so a tick is one round
 * trip and the order is whatever the person made it.
 */
export function ChecklistEditor({ card, run }: { card: CardDetail; run: Run }) {
  const t = useTranslations("cards.checklist");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const items = card.checklist;
  const done = items.filter((item) => item.done).length;

  async function write(next: ChecklistItem[]) {
    setPending(true);
    const ok = await run(() => updateChecklistAction({ cardId: card.id, checklist: next }));
    setPending(false);
    return ok;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    const ok = await write([...items, { id: `${Date.now().toString(36)}`, title, done: false }]);
    if (ok) setDraft("");
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {t("title")}
          {items.length > 0 && (
            <span className="text-meta ml-2 font-normal tabular-nums">
              {done}/{items.length}
            </span>
          )}
        </h2>
      </div>
      {items.length > 0 && (
        <div className="bg-muted h-1 overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="group/item flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id={`check-${item.id}`}
              checked={item.done}
              disabled={pending}
              onChange={() =>
                void write(items.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))
              }
              className="accent-[var(--primary)]"
            />
            <label
              htmlFor={`check-${item.id}`}
              className={cn("flex-1 text-sm", item.done && "text-meta line-through")}
            >
              {item.title}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("remove", { title: item.title })}
              className="text-meta [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/item:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
              disabled={pending}
              onClick={() => void write(items.filter((x) => x.id !== item.id))}
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      {items.length < 50 && (
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("placeholder")}
            aria-label={t("add")}
            maxLength={200}
            className="h-9 text-2sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending || !draft.trim()}>
            {t("add")}
          </Button>
        </form>
      )}
    </section>
  );
}
