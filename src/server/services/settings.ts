import "server-only";

import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";

import { fromManilaLocal, manilaWeekday } from "@/lib/dates";
import {
  branchInput,
  hoursInput,
  rateClassesInput,
  sessionTypeInput,
  staffEditInput,
  staffInput,
} from "@/lib/validation/settings";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import { clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { ratesForBranch } from "@/server/db/queries/rates";
import { listSessionTypes } from "@/server/db/queries/session-types";
import {
  appointments,
  branchRates,
  branches,
  rateClasses,
  receiptCounters,
  sessionTypeRateClasses,
  sessionTypes,
  staff,
  userBranches,
  users,
} from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";
import { createAccount, setAccountActive } from "./users";

const monthRange = (today: string) => {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { first, next, from: fromManilaLocal(first, "00:00"), to: fromManilaLocal(next, "00:00") };
};

/** Bookable one-hour slots in a month for one person, from the branch's hours. */
function monthCapacity(
  branch: { openDays: number[]; opensAtHour: number; closesAtHour: number },
  first: string,
  next: string,
) {
  let days = 0;
  for (
    let d = new Date(`${first}T04:00:00Z`);
    d < new Date(`${next}T04:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    if (branch.openDays.includes(manilaWeekday(d))) days += 1;
  }
  return days * (branch.closesAtHour - branch.opensAtHour);
}

/**
 * Staff at a branch with this month's load: sessions held, distinct patients,
 * and utilization (booked hours out of open hours this month).
 */
export async function staffWithLoad(db: DbExecutor, branchId: string) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
  if (!branch) throw new NotFoundError();
  const { first, next, from, to } = monthRange(clinicToday());
  const rows = await db
    .select({ staff, rateClass: rateClasses })
    .from(staff)
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(and(eq(staff.branchId, branchId), isNull(staff.deletedAt)))
    .orderBy(asc(staff.sortOrder), asc(staff.displayName));
  const load = await db
    .select({
      staffId: appointments.staffId,
      held: sql<number>`count(*) filter (where ${appointments.status} = 'attended')`.mapWith(
        Number,
      ),
      booked: count(),
      patients: countDistinct(appointments.patientId),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.branchId, branchId),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
        inArray(appointments.status, ["scheduled", "checked_in", "attended", "no_show"]),
      ),
    )
    .groupBy(appointments.staffId);
  const capacity = monthCapacity(branch, first, next);
  return rows.map(({ staff: member, rateClass }) => {
    const l = load.find((x) => x.staffId === member.id);
    return {
      ...member,
      rateClass,
      monthSessions: l?.held ?? 0,
      monthPatients: l?.patients ?? 0,
      utilizationPct: l && capacity ? Math.round((l.booked / capacity) * 100) : null,
    };
  });
}

export async function loadSettings(db: DbExecutor, actor: Actor, branchId: string) {
  assertCan(actor, "settings:manage", { branchId });
  const [rates, types, staffRows, branchRows] = await Promise.all([
    ratesForBranch(db, branchId),
    listSessionTypes(db, { branchId }),
    staffWithLoad(db, branchId),
    db
      .select()
      .from(branches)
      .where(inArray(branches.id, actor.branchIds))
      .orderBy(asc(branches.code)),
  ]);
  return { rateClasses: rates, sessionTypes: types, staff: staffRows, branches: branchRows };
}

/** A session type for editing, which must belong to the branch being edited. */
async function sessionTypeIn(db: DbExecutor, actor: Actor, id: string, branchId: string) {
  assertCan(actor, "settings:manage", { branchId });
  const [type] = await db.select().from(sessionTypes).where(eq(sessionTypes.id, id));
  if (!type || type.branchId !== branchId) {
    throw new NotFoundError("That session type isn't at this branch. Reload the page.");
  }
  return type;
}

/**
 * New therapist shares for one branch. A therapist earns their role's share of
 * each session's fee. Applies to sessions marked attended from now on;
 * attended sessions keep their payroll snapshot, so past payroll never changes.
 */
export async function updateRateClasses(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; rows: unknown },
) {
  assertCan(actor, "settings:manage", { branchId: input.branchId });
  const rows = rateClassesInput.parse(input.rows);
  const current = await ratesForBranch(db, input.branchId);
  for (const row of rows) {
    const before = current.find((c) => c.id === row.id);
    if (!before) throw new NotFoundError("That role no longer exists. Reload the page.");
    if (before.therapistSharePct === row.therapistSharePct) continue;
    await db
      .insert(branchRates)
      .values({
        branchId: input.branchId,
        rateClassId: row.id,
        therapistSharePct: row.therapistSharePct,
      })
      .onConflictDoUpdate({
        target: [branchRates.branchId, branchRates.rateClassId],
        set: { therapistSharePct: row.therapistSharePct, updatedAt: new Date() },
      });
    await writeAudit(db, {
      actorUserId: actor.userId,
      action: "rate_class.update",
      entity: "rate_class",
      entityId: row.id,
      before: { branchId: input.branchId, therapistSharePct: before.therapistSharePct },
      after: { branchId: input.branchId, therapistSharePct: row.therapistSharePct },
      ip: actor.ip,
    });
  }
}

/** Adds a session type to one branch (or brings back one removed there). */
export async function createSessionType(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; values: unknown },
) {
  assertCan(actor, "settings:manage", { branchId: input.branchId });
  const values = sessionTypeInput.parse(input.values);
  const [existing] = await db
    .select()
    .from(sessionTypes)
    .where(
      and(
        eq(sessionTypes.branchId, input.branchId),
        eq(sql`lower(${sessionTypes.name})`, values.name.toLowerCase()),
      ),
    );
  if (existing?.active)
    throw new ValidationError(`There is already a session type called ${existing.name}.`);
  if (existing) {
    // Re-adding a removed type brings it back with the new rate.
    await db
      .update(sessionTypes)
      .set({ active: true, rateCentavos: values.ratePesos * 100 })
      .where(eq(sessionTypes.id, existing.id));
    await writeAudit(db, {
      actorUserId: actor.userId,
      action: "session_type.restore",
      entity: "session_type",
      entityId: existing.id,
      after: { branchId: input.branchId, ...values },
      ip: actor.ip,
    });
    return existing.id;
  }
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${sessionTypes.sortOrder}), 0)`.mapWith(Number) })
    .from(sessionTypes)
    .where(eq(sessionTypes.branchId, input.branchId));
  const [created] = await db
    .insert(sessionTypes)
    .values({
      branchId: input.branchId,
      name: values.name,
      rateCentavos: values.ratePesos * 100,
      anyRateClass: true,
      sortOrder: max + 1,
    })
    .returning();
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "session_type.create",
    entity: "session_type",
    entityId: created!.id,
    after: { branchId: input.branchId, ...values },
    ip: actor.ip,
  });
  return created!.id;
}

/** A new default fee for future bookings at this branch. Booked sessions keep their fee. */
export async function updateSessionTypeRate(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; id: string; ratePesos: unknown },
) {
  const ratePesos = sessionTypeInput.shape.ratePesos.parse(input.ratePesos);
  const before = await sessionTypeIn(db, actor, input.id, input.branchId);
  await db
    .update(sessionTypes)
    .set({ rateCentavos: ratePesos * 100 })
    .where(eq(sessionTypes.id, input.id));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "session_type.update",
    entity: "session_type",
    entityId: input.id,
    before: { branchId: input.branchId, rateCentavos: before.rateCentavos },
    after: { branchId: input.branchId, rateCentavos: ratePesos * 100 },
    ip: actor.ip,
  });
}

/** Removing hides the type from booking; past sessions keep it. */
export async function removeSessionType(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; id: string },
) {
  await sessionTypeIn(db, actor, input.id, input.branchId);
  const activeCount = await db
    .select({ n: count() })
    .from(sessionTypes)
    .where(and(eq(sessionTypes.branchId, input.branchId), eq(sessionTypes.active, true)));
  if ((activeCount[0]?.n ?? 0) <= 1)
    throw new ValidationError("Keep at least one session type so the desk can book.");
  await db.update(sessionTypes).set({ active: false }).where(eq(sessionTypes.id, input.id));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "session_type.remove",
    entity: "session_type",
    entityId: input.id,
    ip: actor.ip,
  });
}

/** "Rita Cruz, OTRP" gives surname Cruz and short name "R. Cruz, OTRP" (credentials default to the role). */
function staffNames(displayName: string, roleShortName: string) {
  const surname =
    (displayName.split(",")[0] ?? displayName).trim().split(/\s+/).at(-1) ?? displayName;
  const initial = displayName.trim()[0]?.toUpperCase() ?? "";
  const credentials = displayName.includes(",")
    ? displayName.slice(displayName.indexOf(","))
    : `, ${roleShortName}`;
  return { surname, shortName: `${initial}. ${surname}${credentials}` };
}

/** Adds a staff member; with a login email, also creates their account. */
export async function createStaff(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; values: unknown },
) {
  assertCan(actor, "settings:manage", { branchId: input.branchId });
  const values = staffInput.parse(input.values);
  const [rateClass] = await db
    .select()
    .from(rateClasses)
    .where(eq(rateClasses.id, values.rateClassId));
  if (!rateClass) throw new ValidationError("Pick a role.");
  const { surname, shortName } = staffNames(values.displayName, rateClass.shortName);
  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${staff.sortOrder}), 0)`.mapWith(Number) })
    .from(staff);
  const [created] = await db
    .insert(staff)
    .values({
      branchId: input.branchId,
      displayName: values.displayName,
      shortName,
      surname,
      rateClassId: values.rateClassId,
      sortOrder: max + 1,
    })
    .returning();
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "staff.create",
    entity: "staff",
    entityId: created!.id,
    after: values,
    ip: actor.ip,
  });
  let account: { userId: string; email: string } | null = null;
  if (values.loginEmail) {
    account = await createAccount(db, actor, {
      name: values.displayName.split(",")[0]!.trim(),
      email: values.loginEmail,
      role: "therapist",
      branchIds: [input.branchId],
      staffId: created!.id,
    });
  }
  return { staffId: created!.id, account };
}

/**
 * Renames a staff member or changes their role. Sessions already marked
 * attended keep the rate they were paid at (payroll snapshots); the new role's
 * rate applies from the next one. A linked login's name follows.
 */
export async function updateStaff(db: DbExecutor, actor: Actor, raw: unknown) {
  const input = staffEditInput.parse(raw);
  const [before] = await db.select().from(staff).where(eq(staff.id, input.id)).for("update");
  if (!before) throw new NotFoundError();
  assertCan(actor, "settings:manage", { branchId: before.branchId });
  const [rateClass] = await db
    .select()
    .from(rateClasses)
    .where(eq(rateClasses.id, input.rateClassId));
  if (!rateClass) throw new ValidationError("Pick a role.");
  const { surname, shortName } = staffNames(input.displayName, rateClass.shortName);
  await db
    .update(staff)
    .set({ displayName: input.displayName, shortName, surname, rateClassId: input.rateClassId })
    .where(eq(staff.id, input.id));
  if (before.userId) {
    await db
      .update(users)
      .set({ name: input.displayName.split(",")[0]!.trim() })
      .where(eq(users.id, before.userId));
  }
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "staff.update",
    entity: "staff",
    entityId: input.id,
    before: { displayName: before.displayName, rateClassId: before.rateClassId },
    after: { displayName: input.displayName, rateClassId: input.rateClassId },
    ip: actor.ip,
  });
}

/**
 * Inactive staff can't be booked. Their login, if any, follows: someone who
 * leaves is signed out and can't sign in; setting them active again restores it.
 */
export async function setStaffActive(
  db: DbExecutor,
  actor: Actor,
  input: { id: string; active: boolean },
) {
  const [before] = await db.select().from(staff).where(eq(staff.id, input.id));
  if (!before) throw new NotFoundError();
  assertCan(actor, "settings:manage", { branchId: before.branchId });
  await db.update(staff).set({ active: input.active }).where(eq(staff.id, input.id));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "staff.status",
    entity: "staff",
    entityId: input.id,
    before: { active: before.active },
    after: { active: input.active },
    ip: actor.ip,
  });
  if (before.userId && before.userId !== actor.userId) {
    await setAccountActive(db, actor, { userId: before.userId, active: input.active });
    return { loginChanged: true };
  }
  return { loginChanged: false };
}

/**
 * A new branch starts with the main branch's rates, session types (with their
 * allowed roles), hours and low-credit reminder. Each can then be changed for
 * the new branch alone.
 */
async function copyBranchSetup(db: DbExecutor, branchId: string) {
  const [main] = await db
    .select()
    .from(branches)
    .where(ne(branches.id, branchId))
    .orderBy(desc(branches.isMain), asc(branches.code))
    .limit(1);
  if (!main) return;
  await db
    .update(branches)
    .set({
      opensAtHour: main.opensAtHour,
      closesAtHour: main.closesAtHour,
      openDays: main.openDays,
      lowCreditThresholdCentavos: main.lowCreditThresholdCentavos,
    })
    .where(eq(branches.id, branchId));
  const rates = await db.select().from(branchRates).where(eq(branchRates.branchId, main.id));
  if (rates.length) {
    await db
      .insert(branchRates)
      .values(rates.map((r) => ({ ...r, branchId, updatedAt: new Date() })));
  }
  const types = await listSessionTypes(db, { branchId: main.id });
  for (const type of types) {
    const [copy] = await db
      .insert(sessionTypes)
      .values({
        branchId,
        name: type.name,
        service: type.service,
        rateCentavos: type.rateCentavos,
        anyRateClass: type.anyRateClass,
        sortOrder: type.sortOrder,
      })
      .returning({ id: sessionTypes.id });
    if (type.allowedRateClassIds?.length) {
      await db
        .insert(sessionTypeRateClasses)
        .values(
          type.allowedRateClassIds.map((rateClassId) => ({ sessionTypeId: copy!.id, rateClassId })),
        );
    }
  }
}

/** A new branch with its own receipt counter; the owner who adds it joins it. */
export async function createBranch(db: DbExecutor, actor: Actor, raw: unknown) {
  assertCan(actor, "settings:manage");
  const input = branchInput.parse(raw);
  const all = await db.select({ code: branches.code, name: branches.name }).from(branches);
  if (all.some((b) => b.name.toLowerCase() === input.name.toLowerCase())) {
    throw new ValidationError(`There is already a branch called ${input.name}.`);
  }
  const code = `B${all.length + 1}`;
  const word = input.name
    .replace(/^CRB\s+/i, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const [created] = await db
    .insert(branches)
    .values({
      code,
      name: input.name,
      location: input.location || "Not set",
      receiptPrefix: `CRB${word.slice(0, 1) || code}`,
    })
    .returning();
  await db.insert(receiptCounters).values({ branchId: created!.id, nextNumber: 1 });
  await db.insert(userBranches).values({ userId: actor.userId, branchId: created!.id });
  await copyBranchSetup(db, created!.id);
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "branch.create",
    entity: "branch",
    entityId: created!.id,
    after: input,
    ip: actor.ip,
  });
  return created!;
}

/** Opening days and hours for one branch. Existing bookings are not moved. */
export async function updateBranchHours(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; values: unknown },
) {
  assertCan(actor, "settings:manage", { branchId: input.branchId });
  const values = hoursInput.parse(input.values);
  const [before] = await db.select().from(branches).where(eq(branches.id, input.branchId));
  if (!before) throw new NotFoundError();
  const openDays = [...new Set(values.openDays)].sort();
  await db
    .update(branches)
    .set({ openDays, opensAtHour: values.opensAtHour, closesAtHour: values.closesAtHour })
    .where(eq(branches.id, input.branchId));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "branch.hours",
    entity: "branch",
    entityId: input.branchId,
    before: {
      openDays: before.openDays,
      opensAtHour: before.opensAtHour,
      closesAtHour: before.closesAtHour,
    },
    after: { openDays, opensAtHour: values.opensAtHour, closesAtHour: values.closesAtHour },
    ip: actor.ip,
  });
}
