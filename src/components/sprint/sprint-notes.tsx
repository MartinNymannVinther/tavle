"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useBoardActions } from "@/components/board/use-board-actions";
import type { Sprint } from "@/core/db/schema";
import { applySummaryAction, proposeSummaryAction } from "@/modules/ai/actions";
import { saveRetroAction, saveSummaryAction } from "@/modules/boards/actions-sprints";
import { Link } from "@/i18n/navigation";

/**
 * What the team writes about a sprint: the account of it, which the
 * model can draft from the cards and the person then edits and keeps,
 * and the retro in its three classic questions. Both save on the button;
 * these are texts people think about, not fields they flick.
 */
export function SprintNotes({
  sprint,
  boardId,
  aiAvailable,
}: {
  sprint: Sprint;
  boardId: string;
  aiAvailable: boolean;
}) {
  const t = useTranslations("sprints.notes");
  const { run } = useBoardActions();
  const [summary, setSummary] = useState(sprint.summary);
  const [engine, setEngine] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retro, setRetro] = useState(sprint.retro ?? { wentWell: "", improve: "", actions: "" });
  const dirty = summary !== sprint.summary;

  async function draft() {
    setBusy(true);
    setError(null);
    const result = await proposeSummaryAction({ boardId, sprintId: sprint.id });
    setBusy(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    const { proposal } = result;
    const text = [
      proposal.summary,
      proposal.highlights.length
        ? `\n${t("highlights")}\n${proposal.highlights.map((h) => `- ${h}`).join("\n")}`
        : "",
      proposal.risks.length
        ? `\n${t("risks")}\n${proposal.risks.map((r) => `- ${r}`).join("\n")}`
        : "",
    ]
      .join("\n")
      .trim();
    setSummary(text);
    setEngine(result.engine);
  }

  async function saveSummary() {
    setBusy(true);
    await run(() =>
      engine
        ? applySummaryAction({ sprintId: sprint.id, summary, engine })
        : saveSummaryAction({ sprintId: sprint.id, summary }),
    );
    setBusy(false);
    setEngine("");
  }

  return (
    <div className="grid gap-5 @3xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("summaryTitle")}</CardTitle>
          <CardDescription>{t("summaryBody")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={8}
            maxLength={6000}
            placeholder={t("summaryPlaceholder")}
            aria-label={t("summaryTitle")}
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {engine && <p className="text-meta text-xs">{t("drafted", { engine })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void saveSummary()}
              disabled={busy || !dirty}
            >
              {t("save")}
            </Button>
            {aiAvailable ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void draft()}
                disabled={busy}
              >
                <Sparkles data-slot="icon" />
                {busy ? t("thinking") : t("draft")}
              </Button>
            ) : (
              <p className="text-meta self-center text-2sm">
                {t("noModel")}{" "}
                <Link
                  href="/settings/ai"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("noModelLink")}
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("retroTitle")}</CardTitle>
          <CardDescription>{t("retroBody")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(["wentWell", "improve", "actions"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t(`retro.${key}`)}</span>
              <Textarea
                value={retro[key]}
                onChange={(event) => setRetro({ ...retro, [key]: event.target.value })}
                rows={3}
                maxLength={2000}
              />
            </label>
          ))}
          <div>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => saveRetroAction({ sprintId: sprint.id, ...retro }))}
            >
              {t("saveRetro")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
