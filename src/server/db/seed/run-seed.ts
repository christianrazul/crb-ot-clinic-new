import "server-only";

import { sql } from "drizzle-orm";

import { hashPassword } from "better-auth/crypto";

import type { Database } from "../client";
import * as t from "../schema";
import { buildSeedRows } from "./seed-data";

const TABLES = [
  "audit_log",
  "credit_ledger",
  "payments",
  "session_notes",
  "appointments",
  "appointment_series",
  "guardians",
  "patient_backup_staff",
  "patients",
  "session_type_rate_classes",
  "session_types",
  "staff",
  "rate_classes",
  "receipt_counters",
  "expenses",
  "clinic_settings",
  "user_branches",
  "verifications",
  "accounts",
  "sessions",
  "rate_limits",
  "users",
  "branches",
];

/** Empties every table. Row triggers do not fire on TRUNCATE, so append-only tables clear too. */
export async function truncateAll(db: Database) {
  await db.execute(
    sql.raw(`TRUNCATE ${TABLES.map((name) => `"${name}"`).join(", ")} RESTART IDENTITY CASCADE`),
  );
}

/** Default password for the demo accounts outside production; override with SEED_PASSWORD. */
export const DEFAULT_SEED_PASSWORD = "crb-demo-password";

/** Loads the demo clinic into an empty database, in one transaction. */
export async function seed(db: Database, options: { password?: string } = {}) {
  const rows = buildSeedRows();
  const passwordHash = await hashPassword(options.password ?? DEFAULT_SEED_PASSWORD);
  await db.transaction(async (tx) => {
    await tx.insert(t.branches).values(rows.branches);
    await tx.insert(t.users).values(rows.users);
    // Credential accounts in Better Auth's format: provider "credential", hashed password.
    await tx.insert(t.accounts).values(
      rows.users.map((u) => ({
        id: `acc_${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: passwordHash,
      })),
    );
    await tx.insert(t.userBranches).values(rows.userBranches);
    await tx.insert(t.rateClasses).values(rows.rateClasses);
    await tx.insert(t.staff).values(rows.staff);
    await tx.insert(t.sessionTypes).values(rows.sessionTypes);
    await tx.insert(t.sessionTypeRateClasses).values(rows.sessionTypeRateClasses);
    await tx.insert(t.patients).values(rows.patients);
    await tx.insert(t.patientBackupStaff).values(rows.patientBackupStaff);
    await tx.insert(t.guardians).values(rows.guardians);
    await tx.insert(t.appointmentSeries).values(rows.series);
    await tx.insert(t.appointments).values(rows.appointments);
    await tx.insert(t.sessionNotes).values(rows.sessionNotes);
    await tx.insert(t.payments).values(rows.payments);
    await tx.insert(t.creditLedger).values(rows.creditLedger);
    await tx.insert(t.expenses).values(rows.expenses);
    await tx.insert(t.receiptCounters).values(rows.receiptCounters);
    await tx.insert(t.clinicSettings).values({ id: "clinic" });
  });
  return rows;
}
