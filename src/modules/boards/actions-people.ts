"use server";

import { revalidatePath } from "next/cache";
import type { Result } from "@/core/result";
import { action, found } from "./action-helpers";
import { createPerson, linkPerson, removePerson, renamePerson, unlinkPerson } from "./people";
import {
  PersonCreateSchema,
  PersonIdSchema,
  PersonLinkSchema,
  PersonRenameSchema,
} from "./validation";

/**
 * The roster's actions (docs/adr/0029). Changing who is on the team is
 * the same class of change as inviting and removing members, so every
 * one takes an owner or an admin; the gate sits in the action helper.
 * The workspace page and every board read the roster, so both refresh.
 */

const ROSTER_PATH = "/settings/workspace";

export async function createPersonAction(raw: unknown): Promise<Result<string>> {
  const result = await action(
    PersonCreateSchema,
    raw,
    async (tx, ctx, input) => (await createPerson(tx, ctx, input)).id,
    { manage: true },
  );
  if (result.ok) revalidatePath(ROSTER_PATH);
  return result;
}

export async function renamePersonAction(raw: unknown): Promise<Result<string>> {
  const result = await action(
    PersonRenameSchema,
    raw,
    async (tx, ctx, input) => found(await renamePerson(tx, ctx, input.personId, input.name)).id,
    { manage: true },
  );
  if (result.ok) revalidatePath(ROSTER_PATH);
  return result;
}

export async function removePersonAction(raw: unknown): Promise<Result<string>> {
  const result = await action(
    PersonIdSchema,
    raw,
    async (tx, ctx, input) => found(await removePerson(tx, ctx, input.personId)).id,
    { manage: true },
  );
  if (result.ok) revalidatePath(ROSTER_PATH);
  return result;
}

export async function linkPersonAction(raw: unknown): Promise<Result<string>> {
  const result = await action(
    PersonLinkSchema,
    raw,
    async (tx, ctx, input) => found(await linkPerson(tx, ctx, input.personId, input.userId)).id,
    { manage: true },
  );
  if (result.ok) revalidatePath(ROSTER_PATH);
  return result;
}

export async function unlinkPersonAction(raw: unknown): Promise<Result<string>> {
  const result = await action(
    PersonIdSchema,
    raw,
    async (tx, ctx, input) => found(await unlinkPerson(tx, ctx, input.personId)).id,
    { manage: true },
  );
  if (result.ok) revalidatePath(ROSTER_PATH);
  return result;
}
