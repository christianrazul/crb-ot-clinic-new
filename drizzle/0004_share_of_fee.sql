-- Therapists earn their role's share of each session's own fee, not of a
-- per-role rate (D-119). The role rate is no longer used.
ALTER TABLE "branch_rates" DROP CONSTRAINT "branch_rates_rate_positive";--> statement-breakpoint
ALTER TABLE "branch_rates" DROP COLUMN "rate_centavos";--> statement-breakpoint
-- Sessions already marked attended were snapshotted against the old role
-- rate; re-base them on their fee so payroll follows the clinic's rule.
UPDATE "appointments" SET "payroll_rate_centavos" = "fee_centavos"
  WHERE "status" = 'attended';
