"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { addNote, editNote, getHistoryDetail, getNoteContext } from "@/server/services/notes";

const id = z.string().min(1).max(64);

export async function getNoteContextAction(appointmentId: unknown) {
  return runAction(({ db, actor }) => getNoteContext(db, actor, id.parse(appointmentId)), {
    transaction: false,
  });
}

export async function getHistoryDetailAction(appointmentId: unknown) {
  return runAction(({ db, actor }) => getHistoryDetail(db, actor, id.parse(appointmentId)), {
    transaction: false,
  });
}

export async function addNoteAction(appointmentId: unknown, body: unknown) {
  const result = await runAction(async ({ db, actor }) => {
    await addNote(db, actor, { appointmentId: id.parse(appointmentId), body });
    return getNoteContext(db, actor, id.parse(appointmentId));
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function editNoteAction(noteId: unknown, appointmentId: unknown, body: unknown) {
  const result = await runAction(async ({ db, actor }) => {
    await editNote(db, actor, { noteId: id.parse(noteId), body });
    return getNoteContext(db, actor, id.parse(appointmentId));
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
