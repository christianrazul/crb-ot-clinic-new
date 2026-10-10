import { describe, expect, it } from "vitest";

import { type BookingInput, validateBooking } from "@/lib/demo/booking";
import { demoReducer } from "@/lib/demo/reducer";
import { byId, creditBalanceOf, paymentFor } from "@/lib/demo/selectors";
import { initialDemoState } from "@/lib/demo/state";

const booking = (patch: Partial<BookingInput> = {}): BookingInput => ({
  branchId: "br_bangkal",
  patientId: "pat_12", // Franco Lee
  staffId: "stf_tan",
  sessionTypeId: "st_ot",
  date: "2026-08-25", // a Tuesday
  hour: 16,
  recurring: false,
  ...patch,
});

describe("booking rules", () => {
  it("books a valid one-off session with a fee snapshot", () => {
    const state = demoReducer(initialDemoState(), { type: "appointment/book", input: booking() });
    const created = state.appointments.at(-1)!;
    expect(created).toMatchObject({
      patientId: "pat_12",
      staffId: "stf_tan",
      status: "scheduled",
      feeCentavos: 70_000,
    });
  });

  it("rejects double-booking a therapist", () => {
    // Tan has Gab Torres on Saturday at 10:00.
    expect(validateBooking(initialDemoState(), booking({ date: "2026-08-22", hour: 10 }))).toMatch(
      /Tan already has a session at 10:00 AM/,
    );
  });

  it("rejects double-booking a patient", () => {
    // Liam Santos is with Dela Rosa on Saturday at 9:00.
    expect(
      validateBooking(
        initialDemoState(),
        booking({ patientId: "pat_01", date: "2026-08-22", hour: 9 }),
      ),
    ).toMatch(/Liam Santos already has a session/);
  });

  it("rejects closed days and hours outside opening times", () => {
    expect(validateBooking(initialDemoState(), booking({ date: "2026-08-23" }))).toMatch(
      /closed on Sundays/,
    );
    expect(validateBooking(initialDemoState(), booking({ hour: 17 }))).toMatch(
      /run from 9:00 AM to 4:00 PM/,
    );
  });

  it("only allows therapists whose rate class fits the session type", () => {
    expect(
      validateBooking(
        initialDemoState(),
        booking({ staffId: "stf_ramos", sessionTypeId: "st_ot_eval" }),
      ),
    ).toMatch(/can't run ot evaluations/);
  });

  it("inactive patients cannot be booked", () => {
    const state = demoReducer(initialDemoState(), {
      type: "patient/setStatus",
      id: "pat_12",
      status: "inactive",
    });
    expect(validateBooking(state, booking())).toMatch(/inactive/);
  });

  it("invalid bookings never reach the state", () => {
    const before = initialDemoState();
    const after = demoReducer(before, {
      type: "appointment/book",
      input: booking({ date: "2026-08-23" }),
    });
    expect(after).toBe(before);
  });

  it("recurring bookings create a series on an 8-week horizon", () => {
    const state = demoReducer(initialDemoState(), {
      type: "appointment/book",
      input: booking({ recurring: true }),
    });
    const created = state.appointments.filter(
      (a) => a.seriesId === state.appointments.at(-1)!.seriesId,
    );
    expect(created).toHaveLength(8);
  });

  it("can add a new patient while booking", () => {
    const state = demoReducer(initialDemoState(), {
      type: "appointment/book",
      input: booking({ patientId: null, newPatientName: "Rina Uy" }),
    });
    const patient = state.patients.at(-1)!;
    expect(patient).toMatchObject({ firstName: "Rina", lastName: "Uy", status: "active" });
    expect(state.appointments.at(-1)!.patientId).toBe(patient.id);
  });
});

describe("cancelling and rescheduling", () => {
  it("cancelling this and all future sessions leaves the past alone", () => {
    const state0 = initialDemoState();
    const target = byId(state0.appointments, "apt_20260822_09_delarosa")!; // Liam, today (attended)
    const future = byId(state0.appointments, "apt_20260829_09_delarosa")!;
    const past = byId(state0.appointments, "apt_20260815_09_delarosa")!;
    const state = demoReducer(state0, {
      type: "appointment/cancelSeries",
      id: future.id,
      byName: "Jo Lauron",
    });
    expect(byId(state.appointments, future.id)!.status).toBe("cancelled");
    expect(byId(state.appointments, "apt_20260905_09_delarosa")!.status).toBe("cancelled");
    expect(byId(state.appointments, target.id)!.status).toBe("attended");
    expect(byId(state.appointments, past.id)!.status).toBe("attended");
  });

  it("rescheduling marks the original and links a make-up session", () => {
    const state = demoReducer(initialDemoState(), {
      type: "appointment/book",
      input: booking({
        patientId: "pat_05",
        staffId: "stf_delarosa",
        sessionTypeId: "st_makeup",
        rescheduleFromId: "apt_20260822_13_delarosa",
      }),
    });
    const original = byId(state.appointments, "apt_20260822_13_delarosa")!;
    const makeUp = byId(state.appointments, original.rescheduledToId)!;
    expect(original.status).toBe("rescheduled");
    expect(makeUp).toMatchObject({ isMakeUp: true, patientId: "pat_05", status: "scheduled" });
    // Nothing is deleted.
    expect(state.appointments.length).toBe(initialDemoState().appointments.length + 1);
  });
});

describe("payments and credit", () => {
  const enzoToday = "apt_20260822_09_ramos";

  it("applies credit and writes the deduction in the same step", () => {
    const before = initialDemoState();
    expect(creditBalanceOf(before, "pat_03")).toBe(490_000);
    const state = demoReducer(before, {
      type: "payment/record",
      appointmentId: enzoToday,
      payment: {
        useCredit: true,
        creditRequestedCentavos: null,
        method: "cash",
        cashReceivedCentavos: null,
        referenceNo: "",
      },
      receivedByUserId: "usr_desk",
    });
    expect(paymentFor(state, enzoToday)).toMatchObject({
      creditAppliedCentavos: 70_000,
      method: null,
      receiptNo: "CRB-1100",
    });
    expect(creditBalanceOf(state, "pat_03")).toBe(420_000);
    expect(state.creditLedger.at(-1)).toMatchObject({
      type: "deduction",
      amountCentavos: -70_000,
      receiptNo: "CRB-1100",
    });
  });

  it("an appointment can only be paid once", () => {
    const pay = {
      type: "payment/record" as const,
      appointmentId: enzoToday,
      payment: {
        useCredit: false,
        creditRequestedCentavos: null,
        method: "cash" as const,
        cashReceivedCentavos: 70_000,
        referenceNo: "",
      },
      receivedByUserId: "usr_desk",
    };
    const once = demoReducer(initialDemoState(), pay);
    const twice = demoReducer(once, pay);
    expect(twice).toBe(once);
    expect(once.payments.filter((p) => p.appointmentId === enzoToday)).toHaveLength(1);
  });

  it("receipt numbers are gapless", () => {
    let state = initialDemoState();
    for (const id of ["apt_20260822_09_ramos", "apt_20260822_10_tan"]) {
      state = demoReducer(state, {
        type: "payment/record",
        appointmentId: id,
        payment: {
          useCredit: false,
          creditRequestedCentavos: null,
          method: "cash",
          cashReceivedCentavos: 100_000,
          referenceNo: "",
        },
        receivedByUserId: "usr_desk",
      });
    }
    expect(state.payments.slice(-2).map((p) => p.receiptNo)).toEqual(["CRB-1100", "CRB-1101"]);
  });

  it("advance payments add credit; non-cash needs a reference", () => {
    const base = {
      type: "credit/topUp" as const,
      patientId: "pat_02",
      amountCentavos: 350_000,
      receiptNo: "",
      notes: "",
    };
    const rejected = demoReducer(initialDemoState(), { ...base, method: "gcash", referenceNo: "" });
    expect(creditBalanceOf(rejected, "pat_02")).toBe(0);
    const state = demoReducer(initialDemoState(), {
      ...base,
      method: "gcash",
      referenceNo: "1234",
    });
    expect(creditBalanceOf(state, "pat_02")).toBe(350_000);
  });

  it("changing a rate never rewrites existing appointment fees", () => {
    const state = demoReducer(initialDemoState(), {
      type: "sessionType/update",
      id: "st_ot",
      rateCentavos: 80_000,
    });
    expect(byId(state.appointments, enzoToday)!.feeCentavos).toBe(70_000);
    const booked = demoReducer(state, { type: "appointment/book", input: booking() });
    expect(booked.appointments.at(-1)!.feeCentavos).toBe(80_000);
  });
});

describe("notes and records", () => {
  it("notes are append-only", () => {
    let state = initialDemoState();
    const add = (body: string) =>
      demoReducer(state, {
        type: "note/add",
        appointmentId: "apt_20260822_09_delarosa",
        body,
        authorStaffId: "stf_delarosa",
      });
    state = add("First");
    state = add("Second");
    expect(
      state.notes.filter((n) => n.appointmentId === "apt_20260822_09_delarosa").map((n) => n.body),
    ).toEqual(["First", "Second"]);
  });

  it("removing a patient is a soft delete", () => {
    const state = demoReducer(initialDemoState(), { type: "patient/remove", id: "pat_16" });
    expect(byId(state.patients, "pat_16")!.deletedAt).not.toBeNull();
    expect(state.appointments.some((a) => a.patientId === "pat_16")).toBe(true);
  });
});
