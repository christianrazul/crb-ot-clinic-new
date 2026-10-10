import type { ServiceKey } from "@/lib/services";

import { APPOINTMENTS } from "./appointments";
import { DEMO_NOW } from "./demo-clock";
import { PATIENTS } from "./patients";

export type SessionNoteFixture = {
  id: string;
  appointmentId: string;
  patientId: string;
  authorStaffId: string;
  body: string;
  createdAt: string;
};

const NOTE_TEXT: Record<Exclude<ServiceKey, "aide" | "none">, string[]> = {
  ot: [
    "Sustained attention on the pencil-grip task for 8 minutes with two prompts. Tolerated the brushing protocol well; slight resistance to the swing at the start.",
    "Introduced a bilateral coordination activity. Needed hand-over-hand support at first, independent by the third trial. Home program reviewed with the mother.",
  ],
  speech: [
    "Produced /s/ blends at the word level with 70% accuracy given a visual cue. Carried over to short phrases in the last five minutes.",
    "Worked on 3-word requests during play. Two spontaneous productions without a model. Sent home a picture card set for daily practice.",
  ],
  sped: [
    "Read a Grade 1 passage with 4 decoding errors, down from 7 last week. Comprehension questions answered correctly with rereading.",
    "Number bonds to 10 using counters; independent on 8 of 10 items. Attention held for the full 45 minutes with one movement break.",
  ],
};

/** Attended sessions left without a note, so the therapist's "Notes due" list has entries. */
const WITHOUT_NOTE = new Set(["apt_20260822_09_delarosa", "apt_20260820_12_delarosa"]);

function buildNotes(): SessionNoteFixture[] {
  const service = Object.fromEntries(PATIENTS.map((p) => [p.id, p.service]));
  const perPatient = new Map<string, number>();
  return APPOINTMENTS.filter(
    (a) => a.status === "attended" && new Date(a.endsAt) <= DEMO_NOW && !WITHOUT_NOTE.has(a.id),
  ).map((a, index) => {
    const texts = NOTE_TEXT[service[a.patientId] ?? "ot"];
    // Alternate texts per patient so consecutive notes read differently.
    const count = perPatient.get(a.patientId) ?? 0;
    perPatient.set(a.patientId, count + 1);
    return {
      id: `note_${String(index + 1).padStart(4, "0")}`,
      appointmentId: a.id,
      patientId: a.patientId,
      authorStaffId: a.staffId,
      body: texts[count % texts.length]!,
      // Written about half an hour after the session ended.
      createdAt: new Date(new Date(a.endsAt).getTime() + 30 * 60 * 1000).toISOString(),
    };
  });
}

export const SESSION_NOTES: SessionNoteFixture[] = buildNotes();
