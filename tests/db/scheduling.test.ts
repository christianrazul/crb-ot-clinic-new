import { and, eq, gte } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { fromManilaLocal } from "@/lib/dates";
import { ForbiddenError } from "@/server/auth/permissions";
import { appointmentSeries, appointments, patients } from "@/server/db/schema";
import { setAppointmentStatus } from "@/server/services/appointments";
import {
  bookAppointment,
  cancelSeriesFrom,
  getAppointmentDetail,
  getDaySchedule,
  materializeSeries,
} from "@/server/services/scheduling";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const book = (values: Record<string, unknown>) => ({
  branchId: "br_bangkal",
  values: {
    patientId: "pat_12",
    staffId: "stf_tan",
    sessionTypeId: "st_ot",
    date: "2026-08-25",
    hour: 16,
    recurring: false,
    ...values,
  },
});

describe("booking", () => {
  it("books a one-off session with the session type's fee", () =>
    inRollback(async (tx) => {
      const { appointmentIds } = await bookAppointment(tx, ACTORS.desk, book({}));
      const [row] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentIds[0]!));
      expect(row).toMatchObject({
        patientId: "pat_12",
        staffId: "stf_tan",
        status: "scheduled",
        feeCentavos: 70_000,
        createdByUserId: "usr_desk",
      });
    }));

  it("rejects double booking with a clear message", () =>
    inRollback(async (tx) => {
      // Tan already has Gab Torres today at 10:00.
      await expect(
        bookAppointment(tx, ACTORS.desk, book({ date: "2026-08-22", hour: 10 })),
      ).rejects.toThrow(
        "Tan already has a session at 10:00 AM on Sat, Aug 22. Pick another time or therapist.",
      );
      // Liam Santos is with Dela Rosa today at 9:00.
      await expect(
        bookAppointment(
          tx,
          ACTORS.desk,
          book({ patientId: "pat_01", date: "2026-08-22", hour: 9 }),
        ),
      ).rejects.toThrow(/Liam Santos already has a session at 9:00 AM/);
    }));

  it("enforces opening days, hours, the past, rate classes and inactive patients", () =>
    inRollback(async (tx) => {
      await expect(bookAppointment(tx, ACTORS.desk, book({ date: "2026-08-23" }))).rejects.toThrow(
        /closed on Sundays/,
      );
      await expect(bookAppointment(tx, ACTORS.desk, book({ hour: 17 }))).rejects.toThrow(
        /run from 9:00 AM to 4:00 PM/,
      );
      await expect(bookAppointment(tx, ACTORS.desk, book({ date: "2026-08-21" }))).rejects.toThrow(
        /date has passed/,
      );
      await expect(
        bookAppointment(
          tx,
          ACTORS.desk,
          book({ staffId: "stf_ramos", sessionTypeId: "st_ot_eval" }),
        ),
      ).rejects.toThrow(/can't run ot evaluations/);
      await tx.update(patients).set({ status: "inactive" }).where(eq(patients.id, "pat_12"));
      await expect(bookAppointment(tx, ACTORS.desk, book({}))).rejects.toThrow(
        /inactive and can't be booked/,
      );
    }));

  it("therapists cannot book", () =>
    inRollback(async (tx) => {
      await expect(bookAppointment(tx, ACTORS.therapist, book({}))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }));

  it("a recurring booking creates a series and 8 weekly sessions", () =>
    inRollback(async (tx) => {
      const { seriesId, appointmentIds } = await bookAppointment(
        tx,
        ACTORS.desk,
        book({ recurring: true }),
      );
      expect(appointmentIds).toHaveLength(8);
      const [series] = await tx
        .select()
        .from(appointmentSeries)
        .where(eq(appointmentSeries.id, seriesId!));
      expect(series).toMatchObject({
        weekday: 2,
        startHour: 16,
        startsOn: "2026-08-25",
        materializedUntil: "2026-10-13",
        endsOn: null,
      });
    }));

  it("can add a new patient while booking", () =>
    inRollback(async (tx) => {
      const { patientId } = await bookAppointment(
        tx,
        ACTORS.desk,
        book({ patientId: null, newPatientName: "Rina Uy" }),
      );
      const [row] = await tx.select().from(patients).where(eq(patients.id, patientId));
      expect(row).toMatchObject({
        firstName: "Rina",
        lastName: "Uy",
        status: "active",
        primaryStaffId: "stf_tan",
      });
    }));
});

describe("cancelling and rescheduling", () => {
  it("'this and all future' ends the series and leaves the past alone", () =>
    inRollback(async (tx) => {
      // Liam's Saturday 9:00 series with Dela Rosa.
      await cancelSeriesFrom(tx, ACTORS.desk, { appointmentId: "apt_20260829_09_delarosa" });
      const rows = await tx
        .select({ id: appointments.id, status: appointments.status })
        .from(appointments)
        .where(eq(appointments.seriesId, "ser_pat_01_delarosa_6_09"));
      const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
      expect(byId["apt_20260822_09_delarosa"]).toBe("attended");
      expect(byId["apt_20260829_09_delarosa"]).toBe("cancelled");
      expect(byId["apt_20260905_09_delarosa"]).toBe("cancelled");
      const [series] = await tx
        .select()
        .from(appointmentSeries)
        .where(eq(appointmentSeries.id, "ser_pat_01_delarosa_6_09"));
      expect(series!.endsOn).toBe("2026-08-28");

      // The job does not bring it back.
      const { created } = await materializeSeries(tx, { today: "2026-08-22" });
      const after = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.seriesId, "ser_pat_01_delarosa_6_09"),
            gte(appointments.startsAt, fromManilaLocal("2026-09-06", "00:00")),
          ),
        );
      expect(after).toHaveLength(0);
      expect(created).toBeGreaterThan(0);
    }));

  it("rescheduling marks the original and links a make-up session", () =>
    inRollback(async (tx) => {
      const { appointmentIds } = await bookAppointment(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        values: {
          patientId: "pat_05",
          staffId: "stf_delarosa",
          sessionTypeId: "st_makeup",
          date: "2026-08-25",
          hour: 15,
          rescheduleFromId: "apt_20260822_13_delarosa",
        },
      });
      const [original] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, "apt_20260822_13_delarosa"));
      expect(original).toMatchObject({ status: "rescheduled", rescheduledToId: appointmentIds[0] });
      const [makeUp] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentIds[0]!));
      expect(makeUp).toMatchObject({ isMakeUp: true, patientId: "pat_05" });
      // The moved session can't be changed any more.
      await expect(
        setAppointmentStatus(tx, ACTORS.desk, { appointmentId: original!.id, status: "attended" }),
      ).rejects.toThrow(/moved to a make-up/);
    }));

  it("rescheduling into the original's own slot is fine", () =>
    inRollback(async (tx) => {
      await bookAppointment(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        values: {
          patientId: "pat_05",
          staffId: "stf_tan",
          sessionTypeId: "st_makeup",
          date: "2026-08-22",
          hour: 13,
          rescheduleFromId: "apt_20260822_13_delarosa",
        },
      });
    }));
});

describe("reading the schedule", () => {
  it("therapists see only their own column and sessions, with no fees", async () => {
    const day = await getDaySchedule(testDb(), ACTORS.therapist, {
      branchId: "br_bangkal",
      date: "2026-08-22",
    });
    expect(day.columns.map((c) => c.id)).toEqual(["stf_delarosa"]);
    expect(day.appointments.every((a) => a.staffId === "stf_delarosa")).toBe(true);
    expect(day.canBook).toBe(false);
    const detail = await getAppointmentDetail(
      testDb(),
      ACTORS.therapist,
      "apt_20260822_09_delarosa",
    );
    expect(detail.feeCentavos).toBeNull();
    await expect(
      getAppointmentDetail(testDb(), ACTORS.therapist, "apt_20260822_10_tan"),
    ).rejects.toThrow(/couldn't find/);
  });

  it("the desk sees every column on a full day", async () => {
    const day = await getDaySchedule(testDb(), ACTORS.desk, {
      branchId: "br_bangkal",
      date: "2026-08-22",
    });
    expect(day.columns).toHaveLength(5);
    expect(day.appointments).toHaveLength(14);
    expect(day.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });
});

describe("materialization job", () => {
  it("extends open series to 8 weeks ahead and never double-books", () =>
    inRollback(async (tx) => {
      const first = await materializeSeries(tx, { today: "2026-08-22" });
      expect(first.created).toBeGreaterThan(0);
      // Running it again the same day adds nothing.
      const second = await materializeSeries(tx, { today: "2026-08-22" });
      expect(second.created).toBe(0);
      const [series] = await tx
        .select()
        .from(appointmentSeries)
        .where(eq(appointmentSeries.id, "ser_pat_01_delarosa_6_09"));
      expect(series!.materializedUntil).toBe("2026-10-17");
    }));
});
