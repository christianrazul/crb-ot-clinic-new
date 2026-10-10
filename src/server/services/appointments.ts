import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { getAppointment } from "@/server/db/queries/appointments";
import { appointments, rateClasses, staff } from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";

export const statusChangeInput = z.object({
  appointmentId: z.string().min(1),
  status: z.enum(["scheduled", "checked_in", "attended", "no_show", "cancelled"]),
});

/**
 * Check in, mark attended, no-show or cancel (one session). Owner and front
 * desk only. Marking attended snapshots the therapist's rate and share for
 * payroll, so later rate changes never rewrite history.
 */
export async function setAppointmentStatus(db: DbExecutor, actor: Actor, raw: unknown) {
  const input = statusChangeInput.parse(raw);
  const before = await getAppointment(db, input.appointmentId);
  if (!before) throw new NotFoundError();
  assertCan(actor, "appointment:status", { branchId: before.branchId });
  if (before.status === "rescheduled") {
    throw new ValidationError(
      "This session was moved to a make-up session. Change that one instead.",
    );
  }

  let payrollRateCentavos = before.payrollRateCentavos;
  let payrollSharePct = before.payrollSharePct;
  if (input.status === "attended" && before.status !== "attended") {
    const [snapshot] = await db
      .select({ rate: rateClasses.rateCentavos, share: rateClasses.therapistSharePct })
      .from(staff)
      .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
      .where(eq(staff.id, before.staffId));
    payrollRateCentavos = snapshot?.rate ?? null;
    payrollSharePct = snapshot?.share ?? null;
  } else if (input.status !== "attended") {
    payrollRateCentavos = null;
    payrollSharePct = null;
  }

  const [after] = await db
    .update(appointments)
    .set({
      status: input.status,
      payrollRateCentavos,
      payrollSharePct,
      statusChangedByUserId: actor.userId,
      statusChangedAt: new Date(),
    })
    .where(eq(appointments.id, before.id))
    .returning();

  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "appointment.status",
    entity: "appointment",
    entityId: before.id,
    before: { status: before.status },
    after: { status: input.status },
    ip: actor.ip,
  });
  return after!;
}
