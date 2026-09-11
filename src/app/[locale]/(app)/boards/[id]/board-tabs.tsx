"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { SegmentedFilter } from "@/components/ui/segmented";

/**
 * The board's places: the board, the backlog and sprints on a Scrum
 * board, the insight page and the settings. Links, so they work without
 * a script and the active one is known from the URL.
 */
export function BoardTabs({ boardId, scrum }: { boardId: string; scrum: boolean }) {
  const t = useTranslations("boards.tabs");
  const pathname = usePathname();
  const base = `/boards/${boardId}`;
  const items = [
    {
      key: "board",
      label: t("board"),
      href: base,
      active: pathname === base || pathname.startsWith(`${base}/cards`),
    },
    ...(scrum
      ? [
          {
            key: "backlog",
            label: t("backlog"),
            href: `${base}/backlog`,
            active: pathname.startsWith(`${base}/backlog`),
          },
          {
            key: "sprints",
            label: t("sprints"),
            href: `${base}/sprints`,
            active: pathname.startsWith(`${base}/sprints`),
          },
        ]
      : []),
    {
      key: "insight",
      label: t("insight"),
      href: `${base}/insight`,
      active: pathname.startsWith(`${base}/insight`),
    },
    {
      key: "settings",
      label: t("settings"),
      href: `${base}/settings`,
      active: pathname.startsWith(`${base}/settings`),
    },
  ];
  return <SegmentedFilter items={items} />;
}
