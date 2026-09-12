"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { SegmentedFilter } from "@/components/ui/segmented";

/**
 * The board's places: the board, the backlog, the sprints on a Scrum
 * board, the roadmap, the overview, the insight page and the settings.
 * Links, so they work without a script and the active one is known from
 * the URL.
 */
export function BoardTabs({
  boardId,
  scrum,
  roadmap = true,
}: {
  boardId: string;
  scrum: boolean;
  roadmap?: boolean;
}) {
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
    {
      key: "backlog",
      label: t("backlog"),
      href: `${base}/backlog`,
      active: pathname.startsWith(`${base}/backlog`) || pathname.startsWith(`${base}/items`),
    },
    ...(scrum
      ? [
          {
            key: "sprints",
            label: t("sprints"),
            href: `${base}/sprints`,
            active: pathname.startsWith(`${base}/sprints`),
          },
        ]
      : []),
    ...(roadmap
      ? [
          {
            key: "roadmap",
            label: t("roadmap"),
            href: `${base}/roadmap`,
            active: pathname.startsWith(`${base}/roadmap`),
          },
        ]
      : []),
    {
      key: "overview",
      label: t("overview"),
      href: `${base}/overview`,
      active: pathname.startsWith(`${base}/overview`),
    },
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
