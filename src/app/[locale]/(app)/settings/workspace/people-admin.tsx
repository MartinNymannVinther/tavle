"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createPersonAction,
  linkPersonAction,
  removePersonAction,
  renamePersonAction,
  unlinkPersonAction,
} from "@/modules/boards/actions-people";
import { useRouter } from "@/i18n/navigation";

export type PersonRow = {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
  /**
   * Every card pointing at this person, archived ones included; all of
   * them fall to unassigned if the person goes, so all of them are said.
   */
  cards: number;
};
export type LinkableMember = { userId: string; name: string; email: string };

/**
 * The roster (docs/adr/0029): who work is assigned to, login or not. A
 * colleague is named here before they ever sign in; the invitation's
 * e-mail hands them their person on arrival, and the odd case is linked
 * by hand from the menu on the row.
 */
export function PeopleAdmin({
  people,
  linkable,
  canManage,
}: {
  people: PersonRow[];
  linkable: LinkableMember[];
  canManage: boolean;
}) {
  const t = useTranslations("settings.people");
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  async function act(fn: () => Promise<{ ok: boolean }>) {
    const result = await fn();
    if (!result.ok) toast.error(t("errors.generic"));
    router.refresh();
    return result.ok;
  }

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    const ok = await act(() => createPersonAction({ name, email }));
    setPending(false);
    if (ok) {
      setName("");
      setEmail("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("login")}</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">
                  {editing?.id === person.id ? (
                    <form
                      className="flex items-center gap-1.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!editing.name.trim()) return;
                        void act(() =>
                          renamePersonAction({ personId: person.id, name: editing.name }),
                        ).then(() => setEditing(null));
                      }}
                    >
                      <Input
                        autoFocus
                        value={editing.name}
                        onChange={(event) =>
                          setEditing({ id: person.id, name: event.target.value })
                        }
                        className="h-7 w-40 text-2sm"
                        aria-label={t("rename")}
                      />
                      <Button type="submit" size="xs" variant="outline">
                        {t("save")}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </form>
                  ) : (
                    person.name
                  )}
                </TableCell>
                <TableCell className="text-meta">{person.email ?? "—"}</TableCell>
                <TableCell>
                  {person.userId ? (
                    <span className="text-2sm">{t("linked")}</span>
                  ) : (
                    <span className="text-meta text-2sm italic">{t("unlinked")}</span>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <span className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditing({ id: person.id, name: person.name })}
                      >
                        {t("rename")}
                      </Button>
                      {person.userId ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            void act(() => unlinkPersonAction({ personId: person.id }))
                          }
                        >
                          {t("unlink")}
                        </Button>
                      ) : (
                        <>
                          {linkable.length > 0 && (
                            <NativeSelect
                              variant="xs"
                              value=""
                              aria-label={t("link")}
                              onChange={(event) => {
                                if (!event.target.value) return;
                                void act(() =>
                                  linkPersonAction({
                                    personId: person.id,
                                    userId: event.target.value,
                                  }),
                                );
                              }}
                            >
                              <option value="">{t("link")}</option>
                              {linkable.map((member) => (
                                <option key={member.userId} value={member.userId}>
                                  {member.name} · {member.email}
                                </option>
                              ))}
                            </NativeSelect>
                          )}
                          {/* Removing lets every card the person carries
                              fall back to unassigned — the archived with
                              the rest, and they keep their assignee until
                              then — and writes no event to undo, so the
                              question says how much. */}
                          <ConfirmButton
                            variant="ghost"
                            size="xs"
                            title={t("removeTitle", { name: person.name })}
                            body={t("removeBody", { count: person.cards })}
                            confirmLabel={t("removeConfirm")}
                            onConfirm={() => act(() => removePersonAction({ personId: person.id }))}
                          >
                            <span className="text-destructive">{t("remove")}</span>
                          </ConfirmButton>
                        </>
                      )}
                    </span>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canManage && (
          <form onSubmit={add} className="flex flex-wrap items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("addName")}
              aria-label={t("addName")}
              className="h-8 w-44 text-2sm"
            />
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("addEmail")}
              aria-label={t("addEmail")}
              className="h-8 w-56 text-2sm"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending || !name.trim()}>
              {t("add")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
