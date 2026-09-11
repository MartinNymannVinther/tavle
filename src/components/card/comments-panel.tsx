"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Initials } from "@/components/board/bits";
import type { CommentView } from "@/modules/boards/types";
import { addCommentAction, deleteCommentAction } from "@/modules/boards/actions-cards";
import type { Run } from "@/components/board/use-board-actions";

/**
 * The conversation on a card, oldest first, with the form at the bottom
 * where the next line goes. A comment is plain text kept as written; the
 * author or a manager can remove it.
 */
export function CommentsPanel({
  cardId,
  comments,
  currentUserId,
  canManage,
  run,
}: {
  cardId: string;
  comments: CommentView[];
  currentUserId: string;
  canManage: boolean;
  run: Run;
}) {
  const t = useTranslations("cards.comments");
  const format = useFormatter();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setPending(true);
    const ok = await run(() => addCommentAction({ cardId, text }));
    setPending(false);
    if (ok) setDraft("");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">
        {t("title")}
        {comments.length > 0 && (
          <span className="text-meta ml-2 font-normal tabular-nums">{comments.length}</span>
        )}
      </h2>
      {comments.length === 0 && <p className="text-meta text-sm">{t("empty")}</p>}
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <Initials name={comment.authorName ?? "?"} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.78rem]">
                <span className="font-semibold">{comment.authorName ?? t("unknown")}</span>
                <span className="text-meta ml-2">
                  {format.dateTime(comment.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </p>
              <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
              {(comment.authorUserId === currentUserId || canManage) && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="text-meta h-auto px-0"
                  onClick={() => void run(() => deleteCommentAction({ commentId: comment.id }))}
                >
                  {t("remove")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("title")}
          rows={3}
          maxLength={4000}
        />
        <div>
          <Button type="submit" size="sm" disabled={pending || !draft.trim()}>
            {t("send")}
          </Button>
        </div>
      </form>
    </section>
  );
}
