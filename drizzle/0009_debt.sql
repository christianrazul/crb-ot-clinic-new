CREATE TYPE "public"."debt_entry_type" AS ENUM('charge', 'settlement');--> statement-breakpoint
CREATE TABLE "debt_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"type" "debt_entry_type" NOT NULL,
	"amount_centavos" integer NOT NULL,
	"description" text NOT NULL,
	"method" "payment_method",
	"reference_no" text,
	"receipt_no" text NOT NULL,
	"notes" text,
	"related_payment_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" text,
	"void_reason" text,
	CONSTRAINT "debt_ledger_sign" CHECK (("debt_ledger"."type" = 'charge' and "debt_ledger"."amount_centavos" > 0 and "debt_ledger"."related_payment_id" is not null) or ("debt_ledger"."type" = 'settlement' and "debt_ledger"."amount_centavos" < 0 and "debt_ledger"."method" is not null)),
	CONSTRAINT "debt_ledger_settlement_reference" CHECK ("debt_ledger"."type" <> 'settlement' or "debt_ledger"."method" = 'cash' or length(trim(coalesce("debt_ledger"."reference_no", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_amounts";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_method_when_due";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_cash_covers";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "debt_centavos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "debt_ledger" ADD CONSTRAINT "debt_ledger_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_ledger" ADD CONSTRAINT "debt_ledger_related_payment_id_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_ledger" ADD CONSTRAINT "debt_ledger_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_ledger" ADD CONSTRAINT "debt_ledger_voided_by_user_id_users_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "debt_ledger_patient_id_created_at_index" ON "debt_ledger" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "debt_ledger_related_payment_id_index" ON "debt_ledger" USING btree ("related_payment_id");--> statement-breakpoint
CREATE INDEX "debt_ledger_created_by_user_id_index" ON "debt_ledger" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amounts" CHECK ("payments"."amount_centavos" >= 0 and "payments"."credit_applied_centavos" >= 0 and "payments"."debt_centavos" >= 0 and "payments"."credit_applied_centavos" + "payments"."debt_centavos" <= "payments"."amount_centavos");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_method_when_due" CHECK (("payments"."credit_applied_centavos" + "payments"."debt_centavos" = "payments"."amount_centavos") or "payments"."method" is not null);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_cash_covers" CHECK ("payments"."method" <> 'cash' or "payments"."cash_received_centavos" >= "payments"."amount_centavos" - "payments"."credit_applied_centavos" - "payments"."debt_centavos");--> statement-breakpoint
-- Debt entries are append-only like payments and credit: void once, with a
-- reason, never edited or deleted (D-121, D-129).
CREATE TRIGGER debt_ledger_append_only BEFORE UPDATE OR DELETE ON "debt_ledger"
  FOR EACH ROW EXECUTE FUNCTION void_once_guard();
