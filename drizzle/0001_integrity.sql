-- Rules the database enforces itself, so no code path can break them.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- A staff member cannot have two overlapping appointments. Cancelled and
-- rescheduled appointments no longer hold their slot.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_staff_overlap"
  EXCLUDE USING gist ("staff_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" NOT IN ('cancelled', 'rescheduled'));
--> statement-breakpoint

-- A patient cannot have two overlapping appointments either.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_patient_overlap"
  EXCLUDE USING gist ("patient_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" NOT IN ('cancelled', 'rescheduled'));
--> statement-breakpoint

-- Clinical and financial history is append-only: mistakes are corrected with
-- new rows (a superseding note, an adjustment entry), never by editing.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only (% refused)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER session_notes_append_only BEFORE UPDATE OR DELETE ON "session_notes"
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER credit_ledger_append_only BEFORE UPDATE OR DELETE ON "credit_ledger"
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
