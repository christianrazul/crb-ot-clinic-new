"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { setAppointmentStatus } from "@/server/services/appointments";
import {
  bookAppointment,
  cancelSeriesFrom,
  getAppointmentDetail,
  getBookingOptions,
} from "@/server/services/scheduling";
import { currentBranchId } from "@/server/session/shell";

const id = z.string().min(1).max(64);
const refreshed = <T extends { ok: boolean }>(result: T) => {
  if (result.ok) revalidatePath("/", "layout");
  return result;
};

export async function getBookingOptionsAction() {
  const branchId = await currentBranchId();
  return runAction(({ db, actor }) => getBookingOptions(db, actor, branchId), {
    transaction: false,
  });
}

export async function bookAction(values: unknown) {
  const branchId = await currentBranchId();
  return refreshed(
    await runAction(({ db, actor }) => bookAppointment(db, actor, { branchId, values })),
  );
}

export async function setStatusAction(appointmentId: unknown, status: unknown) {
  return refreshed(
    await runAction(async ({ db, actor }) => {
      const after = await setAppointmentStatus(db, actor, {
        appointmentId: id.parse(appointmentId),
        status,
      });
      return { status: after.status };
    }),
  );
}

export async function cancelSeriesAction(appointmentId: unknown) {
  return refreshed(
    await runAction(({ db, actor }) =>
      cancelSeriesFrom(db, actor, { appointmentId: id.parse(appointmentId) }),
    ),
  );
}

export async function getAppointmentAction(appointmentId: unknown) {
  return runAction(({ db, actor }) => getAppointmentDetail(db, actor, id.parse(appointmentId)), {
    transaction: false,
  });
}
