"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Sprint } from "@/core/db/schema";
import type { ItemView } from "@/modules/boards/types";

/** "Move to …" as a menu: the path that needs no pointer. */
export function MoveTo({
  label,
  options,
  keyOf,
  onMove,
  withNone,
  plan,
}: {
  label: string;
  options: ItemView[];
  keyOf: (item: ItemView) => string;
  onMove: (id: string | null) => void;
  withNone: boolean;
  /** A feature's planned sprint (docs/adr/0023): pick one, or take the plan away. */
  plan?: { sprints: Sprint[]; current: string | null; onPlan: (sprintId: string | null) => void };
}) {
  const t = useTranslations("decompose");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="text-meta shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/box:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:aria-expanded:opacity-100"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onClick={() => onMove(option.id)}>
            <span className="text-meta mr-1 font-mono text-xs">{keyOf(option)}</span>
            {option.title}
          </DropdownMenuItem>
        ))}
        {withNone && (
          <DropdownMenuItem onClick={() => onMove(null)}>{t("noParent")}</DropdownMenuItem>
        )}
        {plan && plan.sprints.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("planSprint")}</DropdownMenuLabel>
            {plan.sprints.map((sprint) => (
              <DropdownMenuItem
                key={sprint.id}
                onClick={() => plan.onPlan(sprint.id)}
                className={sprint.id === plan.current ? "font-semibold" : undefined}
              >
                {sprint.name}
              </DropdownMenuItem>
            ))}
            {plan.current && (
              <DropdownMenuItem onClick={() => plan.onPlan(null)}>{t("noPlan")}</DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A feature from a title alone; it inherits the epic's area and themes. */
export function NewFeature({ onAdd }: { onAdd: (title: string) => Promise<boolean> }) {
  const t = useTranslations("decompose");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        setPending(true);
        void onAdd(title.trim()).then((ok) => {
          setPending(false);
          if (ok) setTitle("");
        });
      }}
      className="flex items-center gap-1.5"
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("newFeaturePlaceholder")}
        aria-label={t("newFeature")}
        maxLength={160}
        className="h-8 text-2sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || !title.trim()}>
        {t("add")}
      </Button>
    </form>
  );
}
