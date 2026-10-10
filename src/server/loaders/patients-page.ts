import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { PatientListParams } from "@/lib/validation/patient";
import { can } from "@/server/auth/permissions";
import { getDb } from "@/server/db/client";
import { rateClasses, sessionTypes, staff } from "@/server/db/schema";
import { NotFoundError } from "@/server/services/errors";
import { getPatientDetail, patientListPage } from "@/server/services/patients";
import type { ShellSession } from "@/server/session/shell";

export type PatientDetailData = Awaited<ReturnType<typeof loadPatientDetail>>;

async function loadPatientDetail(session: ShellSession, patientId: string) {
  const db = getDb();
  const detail = await getPatientDetail(db, session.actor, patientId);
  const [types, staffRows] = await Promise.all([
    db.select({ id: sessionTypes.id, name: sessionTypes.name }).from(sessionTypes),
    db.select({ id: staff.id, shortName: staff.shortName }).from(staff),
  ]);
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const staffName = new Map(staffRows.map((s) => [s.id, s.shortName]));
  return {
    ...detail,
    history: detail.history.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      status: a.status,
      sessionTypeName: typeName.get(a.sessionTypeId) ?? "Session",
      staffName: staffName.get(a.staffId) ?? "",
    })),
  };
}

/** Everything the patients page renders, read on the server with the actor's permissions. */
export async function loadPatientsPage(session: ShellSession, params: PatientListParams) {
  const db = getDb();
  const { actor, branch } = session;
  const list = await patientListPage(db, actor, {
    branchId: branch.id,
    query: params.q,
    service: params.service === "all" ? undefined : params.service,
    status: params.status === "all" ? undefined : params.status,
    sort: actor.role === "therapist" && params.sort === "balance" ? "name" : params.sort,
    page: params.page,
  });

  let detail: PatientDetailData | null = null;
  const selectedId = params.patient ?? list.rows[0]?.id;
  if (selectedId) {
    try {
      detail = await loadPatientDetail(session, selectedId);
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }

  const staffOptions = await db
    .select({ id: staff.id, displayName: staff.displayName, service: rateClasses.service })
    .from(staff)
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(and(eq(staff.branchId, branch.id), eq(staff.active, true), isNull(staff.deletedAt)))
    .orderBy(staff.sortOrder);

  const activeCount = await patientListPage(db, actor, {
    branchId: branch.id,
    status: "active",
    sort: "name",
    pageSize: 1,
  }).then((r) => r.total);

  return {
    list,
    detail,
    activeCount,
    staffOptions,
    canWrite: can(actor, "patient:write", { branchId: branch.id }),
    canSeeMoney: can(actor, "credit:read", { branchId: branch.id }),
  };
}
