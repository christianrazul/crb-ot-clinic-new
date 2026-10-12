ALTER TABLE "payments" DROP CONSTRAINT "payments_appointmentId_unique";--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "replaces_entry_id" text;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "voided_by_user_id" text;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "replaces_payment_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "voided_by_user_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_replaces_entry_id_credit_ledger_id_fk" FOREIGN KEY ("replaces_entry_id") REFERENCES "public"."credit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_replaces_payment_id_payments_id_fk" FOREIGN KEY ("replaces_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_live_per_appointment" ON "payments" USING btree ("appointment_id") WHERE "payments"."voided_at" is null;--> statement-breakpoint
-- Payments and credit entries stay append-only, with one exception: a row can
-- be voided once, by a named user, with a reason, and nothing else may change.
-- Deletes are still refused. Corrections are new rows (D-121).
CREATE OR REPLACE FUNCTION void_once_guard() RETURNS trigger AS $$
DECLARE
  void_columns text[] := ARRAY['voided_at', 'voided_by_user_id', 'void_reason'];
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.voided_at IS NULL
     AND NEW.voided_at IS NOT NULL
     AND NEW.voided_by_user_id IS NOT NULL
     AND length(trim(coalesce(NEW.void_reason, ''))) > 0
     AND (to_jsonb(NEW) - void_columns) = (to_jsonb(OLD) - void_columns)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% rows are append-only (% refused); void them instead', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER payments_append_only ON "payments";
--> statement-breakpoint
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION void_once_guard();
--> statement-breakpoint
DROP TRIGGER credit_ledger_append_only ON "credit_ledger";
--> statement-breakpoint
CREATE TRIGGER credit_ledger_append_only BEFORE UPDATE OR DELETE ON "credit_ledger"
  FOR EACH ROW EXECUTE FUNCTION void_once_guard();
