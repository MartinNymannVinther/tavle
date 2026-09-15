"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import type { Run } from "@/components/board/use-board-actions";
import type { Area } from "@/core/db/schema";
import { proposeCloseAdviceAction } from "@/modules/ai/actions-advice";
import { closeItemAction } from "@/modules/boards/actions-structure";
import type { OpenChild } from "@/modules/boards/structure/close";
import type { ChildDecision } from "@/modules/boards/structure/validation";
import type { ItemView } from "@/modules/boards/types";

/**
 * Rule 10 as a conversation. The button asks the server to close; if
 * the item has open children the server answers with them, and this
 * dialog asks what to do with each — close a feature that has nothing
 * open under it, archive a story, move it to another parent, or keep it
 * without one — and sends the plan back. Nothing closes on its own.
 * With a model set up the selects arrive pre-set to a reasoned plan
 * (docs/adr/0026), each with its one-line why; every choice remains the
 * person's, and confirm still re-validates everything on the server.
 */
export function CloseItemButton({
  item,
  boardKey,
  targets,
  areas,
  run,
  aiAvailable = false,
}: {
  item: ItemView;
  boardKey: string;
  /** Other open items one level down from the item's level: epics for a feature's stories' sake, features for an epic's. */
  targets: ItemView[];
  areas: Area[];
  run: Run;
  /** A model is set up: ask it for a starting plan when the dialog opens. */
  aiAvailable?: boolean;
}) {
  const t = useTranslations("items.close");
  const [children, setChildren] = useState<OpenChild[] | null>(null);
  const [plan, setPlan] = useState<Record<string, ChildDecision>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  // One ticket per dialog opening, so a slow answer for a closed dialog
  // is dropped; a child the person already touched is never overridden.
  const ticket = useRef(0);
  const touched = useRef(new Set<string>());

  async function advise() {
    const mine = ++ticket.current;
    const result = await proposeCloseAdviceAction({ itemId: item.id });
    if (mine !== ticket.current || !result.ok) return;
    setPlan((prev) => {
      const next = { ...prev };
      for (const advice of result.proposal) {
        if (next[advice.id] && !touched.current.has(advice.id)) {
          next[advice.id] = { id: advice.id, action: advice.action, targetId: advice.targetId };
        }
      }
      return next;
    });
    setReasons(Object.fromEntries(result.proposal.map((a) => [a.id, a.reason])));
  }

  async function attempt(withPlan?: ChildDecision[]) {
    setPending(true);
    const ok = await run(
      () => closeItemAction({ itemId: item.id, plan: withPlan }),
      (outcome) => {
        if (outcome.closed) setChildren(null);
        else {
          setChildren(outcome.openChildren);
          touched.current = new Set();
          setReasons({});
          setPlan(
            Object.fromEntries(
              outcome.openChildren.map((child) => [
                child.id,
                {
                  id: child.id,
                  action: child.level === "feature" ? "orphan" : "orphan",
                } as ChildDecision,
              ]),
            ),
          );
          if (aiAvailable) void advise();
        }
      },
    );
    setPending(false);
    return ok;
  }

  const complete =
    children?.every((child) => {
      const decision = plan[child.id];
      if (!decision) return false;
      if (decision.action === "move") return Boolean(decision.targetId);
      if (decision.action === "orphan")
        return Boolean(child.areaId || decision.areaId || item.areaId);
      return true;
    }) ?? false;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={pending}
        onClick={() => void attempt(undefined)}
      >
        {t("button")}
      </Button>
      <Dialog
        open={children !== null}
        onOpenChange={(open) => {
          if (!open) {
            ticket.current += 1;
            setChildren(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("title", { key: `${boardKey}-${item.number}` })}</DialogTitle>
            <DialogDescription>{t("body", { count: children?.length ?? 0 })}</DialogDescription>
          </DialogHeader>
          <ol className="divide-hairline flex flex-col divide-y">
            {children?.map((child) => {
              const decision = plan[child.id]!;
              const set = (patch: Partial<ChildDecision>) => {
                touched.current.add(child.id);
                setPlan({ ...plan, [child.id]: { ...decision, ...patch } });
              };
              return (
                <li key={child.id} className="flex flex-col gap-2 py-3">
                  <p className="text-sm">
                    <span className="text-meta mr-2 tabular-nums">{child.key}</span>
                    <span className="font-medium">{child.title}</span>
                    {child.level === "feature" && child.openStories > 0 && (
                      <span className="text-meta ml-2 text-2sm">
                        {t("openStories", { count: child.openStories })}
                      </span>
                    )}
                    {child.columnName && (
                      <span className="text-meta ml-2 text-2sm">{child.columnName}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <NativeSelect
                      variant="sm"
                      value={decision.action}
                      onChange={(event) =>
                        set({ action: event.target.value as ChildDecision["action"] })
                      }
                      aria-label={t("decision")}
                      className="w-48"
                    >
                      {child.level === "feature" ? (
                        <option value="close" disabled={child.openStories > 0}>
                          {t("actions.close")}
                        </option>
                      ) : (
                        <option value="archive">{t("actions.archive")}</option>
                      )}
                      <option value="move">
                        {t(child.level === "feature" ? "actions.moveEpic" : "actions.moveFeature")}
                      </option>
                      <option value="orphan">{t("actions.orphan")}</option>
                    </NativeSelect>
                    {decision.action === "move" && (
                      <NativeSelect
                        variant="sm"
                        value={decision.targetId ?? ""}
                        onChange={(event) => set({ targetId: event.target.value || undefined })}
                        aria-label={t("target")}
                        className="w-60"
                      >
                        <option value="">{t("chooseTarget")}</option>
                        {targets
                          .filter((target) => target.id !== item.id)
                          .map((target) => (
                            <option key={target.id} value={target.id}>
                              {boardKey}-{target.number} · {target.title}
                            </option>
                          ))}
                      </NativeSelect>
                    )}
                    {decision.action === "orphan" && !child.areaId && !item.areaId && (
                      <NativeSelect
                        variant="sm"
                        value={decision.areaId ?? ""}
                        onChange={(event) => set({ areaId: event.target.value || undefined })}
                        aria-label={t("area")}
                        className="w-48"
                      >
                        <option value="">{t("chooseArea")}</option>
                        {areas
                          .filter((area) => area.active)
                          .map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                            </option>
                          ))}
                      </NativeSelect>
                    )}
                  </div>
                  {reasons[child.id] && (
                    <p className="text-meta flex items-center gap-1 text-2xs">
                      <Sparkles className="size-3 shrink-0" aria-hidden />
                      {reasons[child.id]}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <DialogFooter>
            <Button
              type="button"
              disabled={pending || !complete}
              onClick={() => void attempt(Object.values(plan))}
            >
              {t("confirm")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setChildren(null)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
