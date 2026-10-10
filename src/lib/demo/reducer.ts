import type { AppointmentFixture } from "@/lib/fixtures/appointments";
import type { AppointmentStatus } from "@/lib/appointment-status";
import { DEMO_NOW } from "@/lib/fixtures/demo-clock";
import type { PaymentMethod } from "@/lib/payment-methods";
import { quotePayment, type PaymentInput } from "@/lib/payment";
import type { ServiceKey } from "@/lib/services";

import { type BookingInput, occurrenceDates, validateBooking } from "./booking";
import { fromManilaLocal } from "@/lib/dates";
import { byId, creditBalanceOf, paymentFor, seriesFrom } from "./selectors";
import type { DemoState } from "./state";

export type DemoAction =
  | { type: "appointment/setStatus"; id: string; status: AppointmentStatus; byName: string }
  | { type: "appointment/cancelSeries"; id: string; byName: string }
  | { type: "appointment/book"; input: BookingInput }
  | {
      type: "payment/record";
      appointmentId: string;
      payment: Omit<PaymentInput, "dueCentavos" | "creditBalanceCentavos">;
      receivedByUserId: string;
    }
  | {
      type: "credit/topUp";
      patientId: string;
      amountCentavos: number;
      method: PaymentMethod;
      referenceNo: string;
      receiptNo: string;
      notes: string;
    }
  | { type: "note/add"; appointmentId: string; body: string; authorStaffId: string }
  | {
      type: "patient/add";
      name: string;
      service: Exclude<ServiceKey, "aide" | "none">;
      branchId: string;
    }
  | { type: "patient/setStatus"; id: string; status: "active" | "inactive" }
  | { type: "patient/remove"; id: string }
  | { type: "rateClass/update"; id: string; rateCentavos: number; therapistSharePct: number }
  | { type: "sessionType/add"; name: string; rateCentavos: number }
  | { type: "sessionType/update"; id: string; rateCentavos: number }
  | { type: "sessionType/remove"; id: string }
  | { type: "staff/add"; displayName: string; rateClassId: string }
  | { type: "staff/setActive"; id: string; active: boolean }
  | { type: "branch/add"; name: string; location: string }
  | {
      type: "branch/setHours";
      id: string;
      opensAtHour: number;
      closesAtHour: number;
      openDays: number[];
    };

const now = () => DEMO_NOW.toISOString();
const nextId = (state: DemoState, prefix: string) => `${prefix}_demo_${state.seq}`;

function updateAppointment(
  state: DemoState,
  id: string,
  patch: Partial<AppointmentFixture>,
): DemoState {
  return {
    ...state,
    appointments: state.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

function book(state: DemoState, input: BookingInput): DemoState {
  if (validateBooking(state, input)) return state;

  let next = { ...state };
  let patientId = input.patientId;
  if (!patientId) {
    const service = byId(state.sessionTypes, input.sessionTypeId)?.service;
    next = addPatient(
      next,
      input.newPatientName!.trim(),
      service && service !== "none" ? service : "ot",
      input.branchId,
    );
    patientId = next.patients.at(-1)!.id;
  }

  const type = byId(next.sessionTypes, input.sessionTypeId)!;
  const seriesId = input.recurring ? nextId(next, "ser") : null;
  const created: AppointmentFixture[] = occurrenceDates(input).map((date, index) => {
    const startsAt = fromManilaLocal(date, `${String(input.hour).padStart(2, "0")}:00`);
    return {
      id: `${nextId(next, "apt")}_${index}`,
      branchId: input.branchId,
      patientId: patientId!,
      staffId: input.staffId,
      sessionTypeId: type.id,
      seriesId,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      // Snapshot: later rate changes never touch this appointment.
      feeCentavos: type.rateCentavos,
      isMakeUp: Boolean(input.rescheduleFromId),
      rescheduledToId: null,
      statusChangedBy: null,
      statusChangedAt: null,
    };
  });

  next = { ...next, appointments: [...next.appointments, ...created], seq: next.seq + 1 };
  if (input.rescheduleFromId) {
    next = updateAppointment(next, input.rescheduleFromId, {
      status: "rescheduled",
      rescheduledToId: created[0]!.id,
    });
  }
  return next;
}

function addPatient(
  state: DemoState,
  name: string,
  service: Exclude<ServiceKey, "aide" | "none">,
  branchId: string,
): DemoState {
  const [firstName = name, ...rest] = name.split(/\s+/);
  return {
    ...state,
    seq: state.seq + 1,
    patients: [
      ...state.patients,
      {
        id: nextId(state, "pat"),
        firstName,
        lastName: rest.join(" "),
        dateOfBirth: "",
        gender: "female",
        diagnosis: "",
        enrolledOn: "2026-08-22",
        service,
        primaryStaffId: "",
        backupStaffId: null,
        status: "active",
        recurringSlot: "Unscheduled",
        attendancePct: 0,
        balanceOwedCentavos: 0,
        goalsNotes: "New patient. Intake pending.",
        guardian: { name: "", relationship: "", phone: "", email: "" },
        branchId,
        deletedAt: null,
      },
    ],
  };
}

function recordPayment(
  state: DemoState,
  action: Extract<DemoAction, { type: "payment/record" }>,
): DemoState {
  const appointment = byId(state.appointments, action.appointmentId);
  // One payment per appointment: the database enforces this with a unique constraint.
  if (!appointment || paymentFor(state, appointment.id)) return state;

  const quote = quotePayment({
    ...action.payment,
    dueCentavos: appointment.feeCentavos,
    creditBalanceCentavos: creditBalanceOf(state, appointment.patientId),
  });
  if (!quote.canConfirm) return state;

  const receiptNo = `CRB-${state.nextReceiptNo}`;
  const id = nextId(state, "pay");
  const type = byId(state.sessionTypes, appointment.sessionTypeId);
  const staff = byId(state.staff, appointment.staffId);

  // Payment and credit deduction happen together, like one database transaction.
  return {
    ...state,
    seq: state.seq + 1,
    nextReceiptNo: state.nextReceiptNo + 1,
    payments: [
      ...state.payments,
      {
        id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        amountCentavos: appointment.feeCentavos,
        creditAppliedCentavos: quote.creditAppliedCentavos,
        method: quote.needsMethod ? action.payment.method : null,
        referenceNo:
          quote.needsMethod && action.payment.method !== "cash"
            ? action.payment.referenceNo.trim()
            : null,
        cashReceivedCentavos:
          quote.needsMethod && action.payment.method === "cash"
            ? action.payment.cashReceivedCentavos
            : null,
        receiptNo,
        receivedByUserId: action.receivedByUserId,
        createdAt: now(),
      },
    ],
    creditLedger:
      quote.creditAppliedCentavos > 0
        ? [
            ...state.creditLedger,
            {
              id: nextId(state, "crd"),
              patientId: appointment.patientId,
              type: "deduction",
              amountCentavos: -quote.creditAppliedCentavos,
              description: `${type?.name ?? "Session"}, ${staff?.shortName ?? ""}`,
              method: null,
              referenceNo: null,
              receiptNo,
              notes: null,
              createdAt: now(),
            },
          ]
        : state.creditLedger,
  };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "appointment/setStatus":
      return updateAppointment(state, action.id, {
        status: action.status,
        statusChangedBy: action.byName,
        statusChangedAt: now(),
      });

    case "appointment/cancelSeries": {
      const appointment = byId(state.appointments, action.id);
      if (!appointment) return state;
      const ids = new Set(
        seriesFrom(state, appointment)
          .filter((a) => a.status === "scheduled" || a.id === appointment.id)
          .map((a) => a.id),
      );
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          ids.has(a.id)
            ? { ...a, status: "cancelled", statusChangedBy: action.byName, statusChangedAt: now() }
            : a,
        ),
      };
    }

    case "appointment/book":
      return book(state, action.input);

    case "payment/record":
      return recordPayment(state, action);

    case "credit/topUp": {
      const nonCashWithoutRef = action.method !== "cash" && !action.referenceNo.trim();
      if (action.amountCentavos <= 0 || nonCashWithoutRef) return state;
      const autoReceipt = !action.receiptNo.trim();
      return {
        ...state,
        seq: state.seq + 1,
        nextReceiptNo: autoReceipt ? state.nextReceiptNo + 1 : state.nextReceiptNo,
        creditLedger: [
          ...state.creditLedger,
          {
            id: nextId(state, "crd"),
            patientId: action.patientId,
            type: "top_up",
            amountCentavos: action.amountCentavos,
            description: "Advance payment",
            method: action.method,
            referenceNo: action.referenceNo.trim() || null,
            receiptNo: autoReceipt ? `CRB-${state.nextReceiptNo}` : action.receiptNo.trim(),
            notes: action.notes.trim() || null,
            createdAt: now(),
          },
        ],
      };
    }

    case "note/add": {
      const appointment = byId(state.appointments, action.appointmentId);
      if (!appointment || !action.body.trim()) return state;
      // Append-only: a new note never replaces an earlier one.
      return {
        ...state,
        seq: state.seq + 1,
        notes: [
          ...state.notes,
          {
            id: nextId(state, "note"),
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            authorStaffId: action.authorStaffId,
            body: action.body.trim(),
            createdAt: now(),
          },
        ],
      };
    }

    case "patient/add":
      return addPatient(state, action.name, action.service, action.branchId);

    case "patient/setStatus":
      return {
        ...state,
        patients: state.patients.map((p) =>
          p.id === action.id ? { ...p, status: action.status } : p,
        ),
      };

    case "patient/remove":
      // Soft delete: clinical and financial history stays.
      return {
        ...state,
        patients: state.patients.map((p) => (p.id === action.id ? { ...p, deletedAt: now() } : p)),
      };

    case "rateClass/update":
      return {
        ...state,
        rateClasses: state.rateClasses.map((r) =>
          r.id === action.id
            ? {
                ...r,
                rateCentavos: action.rateCentavos,
                therapistSharePct: action.therapistSharePct,
              }
            : r,
        ),
      };

    case "sessionType/add":
      return {
        ...state,
        seq: state.seq + 1,
        sessionTypes: [
          ...state.sessionTypes,
          {
            id: nextId(state, "st"),
            name: action.name,
            service: null,
            rateCentavos: action.rateCentavos,
            allowedRateClassIds: null,
            active: true,
          },
        ],
      };

    case "sessionType/update":
      return {
        ...state,
        sessionTypes: state.sessionTypes.map((t) =>
          t.id === action.id ? { ...t, rateCentavos: action.rateCentavos } : t,
        ),
      };

    case "sessionType/remove":
      return {
        ...state,
        sessionTypes: state.sessionTypes.map((t) =>
          t.id === action.id ? { ...t, active: false } : t,
        ),
      };

    case "staff/add": {
      const [first = action.displayName, ...rest] = action.displayName.split(/\s+/);
      const surname = (rest.join(" ") || first).split(",")[0]!.trim();
      return {
        ...state,
        seq: state.seq + 1,
        staff: [
          ...state.staff,
          {
            id: nextId(state, "stf"),
            displayName: action.displayName,
            shortName: action.displayName,
            surname,
            rateClassId: action.rateClassId,
            userId: null,
            active: true,
            monthSessions: 0,
            monthPatients: 0,
            utilizationPct: null,
          },
        ],
      };
    }

    case "staff/setActive":
      return {
        ...state,
        staff: state.staff.map((s) => (s.id === action.id ? { ...s, active: action.active } : s)),
      };

    case "branch/add":
      return {
        ...state,
        seq: state.seq + 1,
        branches: [
          ...state.branches,
          {
            id: nextId(state, "br"),
            code: `B${state.branches.length + 1}`,
            name: action.name,
            location: action.location || "Not set",
            isMain: false,
            opensAtHour: 9,
            closesAtHour: 17,
            openDays: [1, 2, 3, 4, 5, 6],
          },
        ],
      };

    case "branch/setHours":
      return {
        ...state,
        branches: state.branches.map((b) =>
          b.id === action.id
            ? {
                ...b,
                opensAtHour: action.opensAtHour,
                closesAtHour: action.closesAtHour,
                openDays: action.openDays,
              }
            : b,
        ),
      };
  }
}
