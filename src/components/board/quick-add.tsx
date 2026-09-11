"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * A new card in one line. A title is all a card needs to exist; the rest
 * is filled in on its page when it matters. The field keeps what was
 * typed if the write fails, so a sentence is never lost to a blink.
 */
export function QuickAdd({
  onAdd,
  placeholder,
}: {
  onAdd: (title: string) => Promise<boolean>;
  placeholder?: string;
}) {
  const t = useTranslations("boards.quickAdd");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setPending(true);
    const ok = await onAdd(trimmed);
    setPending(false);
    if (ok) setTitle("");
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-meta w-full justify-start"
        onClick={() => setOpen(true)}
      >
        <Plus data-slot="icon" />
        {t("open")}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder={placeholder ?? t("placeholder")}
        maxLength={160}
        aria-label={t("label")}
        className="h-9 text-[0.8125rem]"
      />
      <div className="flex gap-1.5">
        <Button type="submit" size="sm" disabled={pending || !title.trim()}>
          {t("add")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
