"use client";

import * as React from "react";

import { useViewer } from "@/components/app/shell/viewer-context";

import { AdvancePaymentDialog } from "./advance-payment-dialog";
import { type BookingDraft, BookingDialog } from "./booking-dialog";
import { HistoryDialog } from "./history-dialog";
import { PaymentDialog } from "./payment-dialog";
import { SessionDialog } from "./session-dialog";
import { SessionNoteDialog } from "./session-note-dialog";
import type { ServiceKey } from "@/lib/services";
import type { AppointmentDetail } from "@/server/services/scheduling";

export type DialogRequest =
  | { kind: "booking"; draft?: Partial<BookingDraft>; reschedule?: AppointmentDetail }
  | { kind: "session"; appointmentId: string }
  | { kind: "payment"; appointmentId: string }
  | { kind: "advance"; patient?: { id: string; name: string; service: ServiceKey } }
  | { kind: "history"; appointmentId: string };

type DialogsApi = { openDialog: (request: DialogRequest) => void; closeDialog: () => void };

const DialogsContext = React.createContext<DialogsApi | null>(null);

export function useDialogs(): DialogsApi {
  const context = React.useContext(DialogsContext);
  if (!context) throw new Error("useDialogs must be used inside <DialogHost>");
  return context;
}

/**
 * Renders whichever dialog is open. Any screen can open one through
 * useDialogs(). Each request gets a fresh key, so form state never leaks
 * between openings, and closing keeps the dialog mounted for its exit
 * animation.
 */
export function DialogHost({ children, today }: { children: React.ReactNode; today: string }) {
  const viewer = useViewer();
  const [request, setRequest] = React.useState<DialogRequest | null>(null);
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);

  const api = React.useMemo<DialogsApi>(
    () => ({
      openDialog: (next) => {
        setRequest(next);
        setKey((k) => k + 1);
        setOpen(true);
      },
      closeDialog: () => setOpen(false),
    }),
    [],
  );

  const shared = { open, onOpenChange: (next: boolean) => !next && setOpen(false) };

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {request?.kind === "booking" && (
        <BookingDialog
          key={key}
          {...shared}
          draft={request.draft}
          original={request.reschedule}
          defaultDate={request.draft?.date ?? today}
        />
      )}
      {request?.kind === "session" &&
        (viewer.role === "therapist" ? (
          <SessionNoteDialog key={key} {...shared} appointmentId={request.appointmentId} />
        ) : (
          <SessionDialog
            key={key}
            {...shared}
            appointmentId={request.appointmentId}
            branchName={viewer.branchName}
          />
        ))}
      {request?.kind === "payment" && viewer.role !== "therapist" && (
        <PaymentDialog key={key} {...shared} appointmentId={request.appointmentId} />
      )}
      {request?.kind === "advance" && viewer.role !== "therapist" && (
        <AdvancePaymentDialog key={key} {...shared} patient={request.patient} today={today} />
      )}
      {request?.kind === "history" && (
        <HistoryDialog key={key} {...shared} appointmentId={request.appointmentId} />
      )}
    </DialogsContext.Provider>
  );
}
