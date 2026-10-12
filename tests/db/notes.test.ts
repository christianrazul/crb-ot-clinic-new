import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { sessionNotes } from "@/server/db/schema";
import {
  addNote,
  editNote,
  getHistoryDetail,
  getMyDay,
  getNoteContext,
  latestNotesForPatient,
  notesDue,
} from "@/server/services/notes";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const NOW = new Date("2026-08-22T02:20:00Z"); // 10:20 AM in Manila

describe("session notes", () => {
  it("a therapist adds a note to their own attended session", () =>
    inRollback(async (tx) => {
      const note = await addNote(tx, ACTORS.therapist, {
        appointmentId: "apt_20260822_09_delarosa",
        body: "Good focus today.",
      });
      expect(note).toMatchObject({
        version: 1,
        authorStaffId: "stf_delarosa",
        patientId: "pat_01",
      });
    }));

  it("refuses notes on other therapists' sessions, from the desk, and before the session happens", () =>
    inRollback(async (tx) => {
      await expect(
        addNote(tx, ACTORS.therapist, { appointmentId: "apt_20260822_09_ramos", body: "x" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        addNote(tx, ACTORS.desk, { appointmentId: "apt_20260822_09_delarosa", body: "x" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        addNote(tx, ACTORS.therapist, { appointmentId: "apt_20260822_11_delarosa", body: "x" }),
      ).rejects.toThrow(/check the patient in first/);
      await expect(
        addNote(tx, ACTORS.therapist, { appointmentId: "apt_20260822_09_delarosa", body: "   " }),
      ).rejects.toThrow(/Write the note/);
    }));

  it("editing writes a new version and keeps the old one", () =>
    inRollback(async (tx) => {
      const first = await addNote(tx, ACTORS.therapist, {
        appointmentId: "apt_20260822_09_delarosa",
        body: "First draft.",
      });
      const second = await editNote(tx, ACTORS.therapist, { noteId: first.id, body: "Corrected." });
      expect(second).toMatchObject({ version: 2, supersedesId: first.id });
      const all = await tx
        .select()
        .from(sessionNotes)
        .where(eq(sessionNotes.appointmentId, "apt_20260822_09_delarosa"));
      expect(all.map((n) => n.body).sort()).toEqual(["Corrected.", "First draft."]);
      // Lists only show the latest version.
      const latest = await latestNotesForPatient(tx, "pat_01", 1);
      expect(latest[0]).toMatchObject({ body: "Corrected.", version: 2 });
      await expect(
        editNote(tx, ACTORS.therapist, { noteId: first.id, body: "Again." }),
      ).rejects.toThrow(/already edited/);
    }));
});

describe("reading notes", () => {
  it("the note dialog shows context and the two latest notes", async () => {
    const context = await getNoteContext(testDb(), ACTORS.therapist, "apt_20260822_09_delarosa");
    expect(context.patient).toMatchObject({
      name: "Liam Santos",
      age: 3,
      diagnosis: "Global developmental delay",
    });
    expect(context.notes).toHaveLength(2);
    expect(context.canWrite).toBe(true);
    await expect(
      getNoteContext(testDb(), ACTORS.therapist, "apt_20260822_09_ramos"),
    ).rejects.toThrow(/couldn't find/);
  });

  it("history detail shows the latest note to the desk and to other therapists", async () => {
    const detail = await getHistoryDetail(testDb(), ACTORS.desk, "apt_20260819_10_delarosa");
    expect(detail.note?.authorName).toBe("J. Dela Rosa, OTRP");
    // Another therapist's session with another therapist's patient.
    await expect(
      getHistoryDetail(testDb(), ACTORS.therapist, "apt_20260822_09_garcia"),
    ).resolves.toBeTruthy();
  });

  it("notes due: Liam today is on time, Althea's Thursday session is two days late", async () => {
    const due = await notesDue(testDb(), "stf_delarosa", NOW);
    expect(due.map((d) => [d.patientName, d.daysLate])).toEqual([
      ["Althea Mendoza", 2],
      ["Liam Santos", 0],
    ]);
  });

  it("My day has today's sessions and this month's earnings from snapshots", async () => {
    const day = await getMyDay(testDb(), ACTORS.therapist);
    expect(day.sessions.map((s) => s.patientName)).toEqual([
      "Liam Santos",
      "Franco Lee",
      "Althea Mendoza",
    ]);
    expect(day.earnings.sharePct).toBe(70);
    expect(day.earnings.totalCentavos).toBe(day.earnings.sessions * 49_000);
    await expect(getMyDay(testDb(), ACTORS.desk)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
