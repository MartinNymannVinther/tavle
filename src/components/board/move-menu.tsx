"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Column } from "@/core/db/schema";
import { useRouter } from "@/i18n/navigation";

/**
 * The card's menu: open it, or move it to any column. Drag and drop does
 * not exist on a phone or for a keyboard, so this menu is the path that
 * always works; on a pointer device it fades in on hover so the board
 * stays quiet.
 */
export function MoveMenu({
  columns,
  currentColumnId,
  onMove,
  href,
}: {
  columns: Column[];
  currentColumnId: string;
  onMove: (columnId: string) => void;
  href: string;
}) {
  const t = useTranslations("boards.card");
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("menu")}
            className="text-meta shrink-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:aria-expanded:opacity-100"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(href)}>{t("open")}</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("moveTo")}</DropdownMenuLabel>
          {columns
            .filter((column) => column.id !== currentColumnId)
            .map((column) => (
              <DropdownMenuItem key={column.id} onClick={() => onMove(column.id)}>
                {column.name}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
