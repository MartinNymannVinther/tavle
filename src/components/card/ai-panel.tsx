"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EstimateUnit } from "@/core/db/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CardDetail } from "@/modules/boards/types";
import {
  applyDraftAction,
  applySplitAction,
  proposeDraftAction,
  proposeSplitAction,
} from "@/modules/ai/actions";
import type { CardDraft, SplitProposal } from "@/modules/ai/sanitize";
import type { Run } from "@/components/board/use-board-actions";
import { Link } from "@/i18n/navigation";

/**
 * The AI's two offers on a card, each a proposal in a dialog the person
 * edits before anything is written. Without a model the buttons still
 * exist and say where to configure one, rather than vanishing and
 * leaving people to wonder whether the tool has AI at all.
 */
export function AiPanel({
  card,
  boardId,
  available,
  unit,
  run,
}: {
  card: CardDetail;
  boardId: string;
  available: boolean;
  /** What the board counts in, so the size field is named right (docs/adr/0030). */
  unit: EstimateUnit;
  run: Run;
}) {
  const t = useTranslations("cards.ai");
  const [kind, setKind] = useState<"draft" | "split" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState("");
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [pieces, setPieces] = useState<SplitProposal[]>([]);
  const [keep, setKeep] = useState<boolean[]>([]);

  async function ask(which: "draft" | "split") {
    setKind(which);
    setBusy(true);
    setError(null);
    setDraft(null);
    setPieces([]);
    const ref = { boardId, number: card.number };
    const result =
      which === "draft" ? await proposeDraftAction(ref) : await proposeSplitAction(ref);
    setBusy(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    setEngine(result.engine);
    if (which === "draft") setDraft(result.proposal as CardDraft);
    else {
      const list = result.proposal as SplitProposal[];
      setPieces(list);
      setKeep(list.map(() => true));
    }
  }

  async function applyDraft() {
    if (!draft) return;
    setBusy(true);
    const description = [
      draft.description,
      draft.acceptance.length
        ? `\n${t("acceptanceHeading")}\n${draft.acceptance.map((a) => `- ${a}`).join("\n")}`
        : "",
    ]
      .join("")
      .trim();
    const ok = await run(() =>
      applyDraftAction({ cardId: card.id, description, checklist: draft.checklist, engine }),
    );
    setBusy(false);
    if (ok) setKind(null);
  }

  async function applySplit() {
    const cards = pieces
      .filter((_, i) => keep[i])
      .map((p) => ({ title: p.title, estimate: p.estimate }));
    if (cards.length === 0) return;
    setBusy(true);
    const ok = await run(() => applySplitAction({ cardId: card.id, cards, engine }));
    setBusy(false);
    if (ok) setKind(null);
  }

  if (!available) {
    return (
      <section>
        <p className="text-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-2sm">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">{t("title")}:</span>
          <span>{t("noModelShort")}</span>
          <Link href="/settings/ai" className="text-primary underline-offset-4 hover:underline">
            {t("noModelLink")}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void ask("draft")}>
          <Sparkles data-slot="icon" />
          {t("draft")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void ask("split")}>
          <Sparkles data-slot="icon" />
          {t("split")}
        </Button>
      </div>
      <p className="text-meta text-xs">{t("principle")}</p>

      <Dialog open={kind !== null} onOpenChange={(open) => !open && setKind(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{kind === "split" ? t("splitTitle") : t("draftTitle")}</DialogTitle>
            <DialogDescription>
              {busy && !draft && pieces.length === 0 ? t("thinking") : t("editHint")}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {draft && (
            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("descriptionField")}</span>
                <Textarea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={6}
                />
              </label>
              {draft.acceptance.length > 0 && (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("acceptanceField")}</span>
                  {draft.acceptance.map((line, i) => (
                    <Input
                      key={i}
                      value={line}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          acceptance: draft.acceptance.map((x, n) =>
                            n === i ? event.target.value : x,
                          ),
                        })
                      }
                      className="h-9 text-2sm"
                    />
                  ))}
                </div>
              )}
              {draft.checklist.length > 0 && (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t("checklistField")}</span>
                  {draft.checklist.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={line}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            checklist: draft.checklist.map((x, n) =>
                              n === i ? event.target.value : x,
                            ),
                          })
                        }
                        className="h-9 text-2sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            checklist: draft.checklist.filter((_, n) => n !== i),
                          })
                        }
                      >
                        {t("drop")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {pieces.length > 0 && (
            <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {pieces.map((piece, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={keep[i] ?? true}
                    onChange={(event) =>
                      setKeep(keep.map((k, n) => (n === i ? event.target.checked : k)))
                    }
                    className="mt-2.5 accent-[var(--primary)]"
                    aria-label={t("keep")}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex gap-2">
                      <Input
                        value={piece.title}
                        onChange={(event) =>
                          setPieces(
                            pieces.map((p, n) =>
                              n === i ? { ...p, title: event.target.value } : p,
                            ),
                          )
                        }
                        className="h-9 text-2sm"
                      />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={piece.estimate ?? ""}
                        onChange={(event) =>
                          setPieces(
                            pieces.map((p, n) =>
                              n === i
                                ? {
                                    ...p,
                                    estimate:
                                      event.target.value === "" ? null : Number(event.target.value),
                                  }
                                : p,
                            ),
                          )
                        }
                        aria-label={t("points", { unit })}
                        className="h-9 w-20 text-2sm"
                      />
                    </div>
                    {piece.note && <p className="text-meta text-xs">{piece.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            {draft && (
              <Button type="button" onClick={() => void applyDraft()} disabled={busy}>
                {t("applyDraft")}
              </Button>
            )}
            {pieces.length > 0 && (
              <Button
                type="button"
                onClick={() => void applySplit()}
                disabled={busy || !keep.some(Boolean)}
              >
                {t("applySplit", { count: keep.filter(Boolean).length })}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setKind(null)}
              disabled={busy && !error}
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
          {engine && (draft || pieces.length > 0) && (
            <p className="text-meta text-2xs">{t("engine", { engine })}</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
