import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { ratesForBranch } from "@/server/db/queries/rates";
import { listSessionTypes } from "@/server/db/queries/session-types";
import { branches, sessionTypes } from "@/server/db/schema";
import { setAppointmentStatus } from "@/server/services/appointments";
import { lowCreditThreshold, setLowCreditThreshold } from "@/server/services/payments";
import { bookAppointment, getBookingOptions } from "@/server/services/scheduling";
import {
  createBranch,
  createSessionType,
  removeSessionType,
  updateRateClasses,
  updateSessionTypeRate,
} from "@/server/services/settings";

import { ACTORS } from "../support/actors";
import { inRollback } from "./support";

const rateOf = async (tx: Parameters<typeof ratesForBranch>[0], branchId: string, id: string) =>
  (await ratesForBranch(tx, branchId)).find((r) => r.id === id)!;

describe("branch-specific settings", () => {
  it("rates and splits change for one branch only, and payroll snapshots use the session's branch", () =>
    inRollback(async (tx) => {
      await updateRateClasses(tx, ACTORS.owner, {
        branchId: "br_panabo",
        rows: [{ id: "rc_ot", therapistSharePct: 60 }],
      });
      expect(await rateOf(tx, "br_panabo", "rc_ot")).toMatchObject({ therapistSharePct: 60 });
      expect(await rateOf(tx, "br_bangkal", "rc_ot")).toMatchObject({ therapistSharePct: 70 });
      // A Bangkal session marked attended still snapshots Bangkal's share.
      const attended = await setAppointmentStatus(tx, ACTORS.desk, {
        appointmentId: "apt_20260822_11_delarosa",
        status: "attended",
      });
      expect(attended).toMatchObject({ payrollRateCentavos: 70_000, payrollSharePct: 70 });
    }));

  it("each branch has its own session types; one branch's can't be edited or booked from another", () =>
    inRollback(async (tx) => {
      const id = await createSessionType(tx, ACTORS.owner, {
        branchId: "br_panabo",
        values: { name: "Sensory gym", ratePesos: 600 },
      });
      const panabo = await listSessionTypes(tx, { branchId: "br_panabo" });
      const bangkal = await listSessionTypes(tx, { branchId: "br_bangkal" });
      expect(panabo.map((t) => t.name)).toContain("Sensory gym");
      expect(bangkal.map((t) => t.name)).not.toContain("Sensory gym");
      // The same name may exist at both branches.
      await createSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: { name: "Sensory gym", ratePesos: 650 },
      });

      await expect(
        updateSessionTypeRate(tx, ACTORS.owner, { branchId: "br_bangkal", id, ratePesos: 1 }),
      ).rejects.toThrow(/isn't at this branch/);
      await expect(
        removeSessionType(tx, ACTORS.owner, { branchId: "br_bangkal", id }),
      ).rejects.toThrow(/isn't at this branch/);

      // A Bangkal fee change leaves Panabo's copy of the same type alone.
      await updateSessionTypeRate(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id: "st_ot",
        ratePesos: 800,
      });
      const [panaboOt] = await tx
        .select()
        .from(sessionTypes)
        .where(eq(sessionTypes.id, "st_ot_panabo"));
      expect(panaboOt!.rateCentavos).toBe(70_000);

      const options = await getBookingOptions(tx, ACTORS.owner, "br_bangkal");
      expect(options.sessionTypes.map((t) => t.id)).not.toContain(id);
      await expect(
        bookAppointment(tx, ACTORS.desk, {
          branchId: "br_bangkal",
          values: {
            patientId: "pat_12",
            staffId: "stf_tan",
            sessionTypeId: "st_ot_panabo",
            date: "2026-08-25",
            hour: 16,
            recurring: false,
          },
        }),
      ).rejects.toThrow(/no longer offered/);
    }));

  it("the low-credit reminder is per branch", () =>
    inRollback(async (tx) => {
      await setLowCreditThreshold(tx, ACTORS.owner, { branchId: "br_panabo", value: 300_000 });
      expect(await lowCreditThreshold(tx, "br_panabo")).toBe(300_000);
      expect(await lowCreditThreshold(tx, "br_bangkal")).toBe(100_000);
    }));

  it("a new branch starts with a copy of the main branch's setup", () =>
    inRollback(async (tx) => {
      await updateRateClasses(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        rows: [{ id: "rc_speech", therapistSharePct: 75 }],
      });
      const created = await createBranch(tx, ACTORS.owner, {
        name: "CRB Toril",
        location: "Davao",
      });
      expect(await rateOf(tx, created.id, "rc_speech")).toMatchObject({ therapistSharePct: 75 });
      const types = await listSessionTypes(tx, { branchId: created.id });
      expect(types.map((t) => t.name).sort()).toEqual(
        (await listSessionTypes(tx, { branchId: "br_bangkal" })).map((t) => t.name).sort(),
      );
      expect(types.find((t) => t.name === "OT session")?.allowedRateClassIds?.sort()).toEqual([
        "rc_ot",
        "rc_ot_aide",
      ]);
      const [branch] = await tx.select().from(branches).where(eq(branches.id, created.id));
      expect(branch).toMatchObject({ opensAtHour: 9, closesAtHour: 17 });
    }));

  it("owners can only change branches they belong to; the desk can't change settings", () =>
    inRollback(async (tx) => {
      const bangkalOnly = { ...ACTORS.owner, branchIds: ["br_bangkal"] };
      await expect(
        updateRateClasses(tx, bangkalOnly, {
          branchId: "br_panabo",
          rows: [{ id: "rc_ot", therapistSharePct: 1 }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        createSessionType(tx, bangkalOnly, {
          branchId: "br_panabo",
          values: { name: "X", ratePesos: 1 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        setLowCreditThreshold(tx, ACTORS.desk, { branchId: "br_bangkal", value: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});
