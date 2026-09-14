"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Run } from "@/components/board/use-board-actions";
import { proposeBootstrapAction, applyBootstrapAction } from "@/modules/ai/actions-bootstrap";
import type { BootstrapProposal } from "@/modules/ai/bootstrap";
import { BootstrapReview, keepChecked, toEditable, type Editable } from "./bootstrap-review";

/**
 * The starting point, asked for in the team's own words (docs/adr/0021):
 * a prose description, a horizon, and what should come first. The model
 * answers with a tree the person prunes and edits before anything is
 * written — the AI proposes, the person decides.
 */
export function BootstrapDialog({ boardId, run }: { boardId: string; run: Run }) {
  const t = useTranslations("aiBootstrap");
  const errors = useTranslations("cards.ai.errors");
  // A fresh board can arrive asking for the starting point (?ai=start
  // from the new-board dialog); the dialog then opens from birth.
  const params = useSearchParams();
  const [open, setOpen] = useState(() => params.get("ai") === "start");
  const [description, setDescription] = useState("");
  const [horizon, setHorizon] = useState("4");
  const [focus, setFocus] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [engine, setEngine] = useState("");
  const [tree, setTree] = useState<Editable | null>(null);
  // The ask is consumed, so a reload does not reopen the dialog.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("ai")) return;
    url.searchParams.delete("ai");
    window.history.replaceState(null, "", url);
  }, []);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    const result = await proposeBootstrapAction({
      boardId,
      description,
      horizonQuarters: Number(horizon),
      focus,
    });
    setPending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setEngine(result.engine);
    setTree(toEditable(result.proposal));
  }

  async function apply() {
    if (!tree) return;
    const kept: BootstrapProposal = keepChecked(tree);
    if (kept.epics.length === 0) return;
    setPending(true);
    const ok = await run(() => applyBootstrapAction({ boardId, engine, ...kept }));
    setPending(false);
    if (ok) {
      setOpen(false);
      setTree(null);
      setDescription("");
      setFocus("");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFailure(null);
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Sparkles data-slot="icon" />
            {t("cta")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{tree ? t("reviewSubtitle") : t("subtitle")}</DialogDescription>
        </DialogHeader>
        {tree ? (
          <div className="flex flex-col gap-4">
            <BootstrapReview tree={tree} onChange={setTree} />
            {/* What the AI made is marked in the activity feed and can be pruned here first. */}
            <p className="text-meta text-[0.72rem]">{t("marked", { engine })}</p>
            <DialogFooter>
              <Button type="button" onClick={() => void apply()} disabled={pending}>
                {t("apply")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setTree(null)}>
                {t("back")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={ask} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="bootstrap-description">{t("description")}</FieldLabel>
              <Textarea
                id="bootstrap-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={20}
                maxLength={4000}
                rows={6}
                placeholder={t("descriptionPlaceholder")}
              />
              <FieldDescription>{t("descriptionHint")}</FieldDescription>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bootstrap-horizon">{t("horizon")}</FieldLabel>
                <NativeSelect
                  id="bootstrap-horizon"
                  value={horizon}
                  onChange={(event) => setHorizon(event.target.value)}
                >
                  {[2, 4, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {t("quarters", { count: n })}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="bootstrap-focus">{t("focus")}</FieldLabel>
                <Input
                  id="bootstrap-focus"
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                  maxLength={300}
                  placeholder={t("focusPlaceholder")}
                />
              </Field>
            </div>
            {failure && (
              <p role="alert" className="text-destructive text-sm">
                {["noModel", "rateLimited", "unreachable", "badAnswer"].includes(failure)
                  ? errors(failure)
                  : errors("generic")}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending || description.trim().length < 20}>
                {pending ? t("thinking") : t("propose")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
