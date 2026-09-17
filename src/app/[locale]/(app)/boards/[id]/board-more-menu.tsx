"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { segmentedSegment } from "@/components/ui/segmented";
import type { PlaceGroup } from "@/components/board/places";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The door at the end of the track: the board's six less-trodden places.
 * None of the board's subpages draws a title of its own — the page's H1
 * is the board's name — so standing behind the door the trigger has to
 * say so itself, with the place's own word instead of "Mere" and the
 * same lift the track's segments carry (docs/adr/0036).
 */
export function BoardMoreMenu({ groups, active }: { groups: PlaceGroup[]; active?: string }) {
  const t = useTranslations("boards.tabs");
  const activeInMenu = groups.some((group) => group.places.some((place) => place.key === active));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-current={activeInMenu ? "true" : undefined}
            className={cn(
              segmentedSegment(activeInMenu),
              "focus-visible:outline-ring flex items-center gap-1 outline-none focus-visible:outline-2",
            )}
          >
            <span>{activeInMenu && active ? t(active) : t("more")}</span>
            <ChevronDown aria-hidden className="size-3.5 opacity-60" />
          </button>
        }
      />
      {/* `w-auto` undoes the popup's own `w-(--anchor-width)`: anchored to a
          narrow trigger, the content would otherwise be cut to its width and
          the labels clipped by `overflow-x-hidden`. */}
      <DropdownMenuContent align="end" sideOffset={6} className="w-auto min-w-52">
        {groups.map((group, index) => {
          // The hairline belongs to the board's settings, and only when
          // something stands above it to be divided from — boardPlaces has
          // already dropped the groups a board has nothing for, so an index
          // above zero is that something.
          const separator = index > 0 && group.key === "settings";
          return (
            <Fragment key={group.key}>
              {separator ? <DropdownMenuSeparator /> : null}
              {/* Base UI: a GroupLabel must live inside a Group. */}
              <DropdownMenuGroup>
                {group.labelKey ? <DropdownMenuLabel>{t(group.labelKey)}</DropdownMenuLabel> : null}
                {group.places.map((place) => (
                  <DropdownMenuItem
                    key={place.key}
                    className="min-h-11 py-2.5 lg:min-h-0 lg:py-1"
                    render={
                      <Link
                        href={place.href}
                        aria-current={place.key === active ? "page" : undefined}
                      />
                    }
                  >
                    <span className="flex-1">{t(place.key)}</span>
                    {place.key === active ? <Check data-slot="icon" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
