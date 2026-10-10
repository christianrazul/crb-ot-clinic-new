CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'checked_in', 'attended', 'no_show', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."credit_entry_type" AS ENUM('top_up', 'deduction', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."patient_service" AS ENUM('ot', 'speech', 'sped');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'gcash', 'maya', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('superadmin', 'secretary', 'therapist');--> statement-breakpoint
CREATE TYPE "public"."service" AS ENUM('ot', 'speech', 'sped', 'aide');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_branches" (
	"user_id" text NOT NULL,
	"branch_id" text NOT NULL,
	CONSTRAINT "user_branches_user_id_branch_id_pk" PRIMARY KEY("user_id","branch_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" DEFAULT 'therapist' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"type" "credit_entry_type" NOT NULL,
	"amount_centavos" integer NOT NULL,
	"description" text NOT NULL,
	"method" "payment_method",
	"reference_no" text,
	"receipt_no" text NOT NULL,
	"notes" text,
	"related_payment_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_sign" CHECK (("credit_ledger"."type" = 'top_up' and "credit_ledger"."amount_centavos" > 0) or ("credit_ledger"."type" = 'deduction' and "credit_ledger"."amount_centavos" < 0) or ("credit_ledger"."type" = 'adjustment' and "credit_ledger"."amount_centavos" <> 0)),
	CONSTRAINT "credit_ledger_top_up_reference" CHECK ("credit_ledger"."type" <> 'top_up' or "credit_ledger"."method" = 'cash' or length(trim(coalesce("credit_ledger"."reference_no", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"category" text NOT NULL,
	"amount_centavos" integer NOT NULL,
	"spent_on" date NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_centavos" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"amount_centavos" integer NOT NULL,
	"credit_applied_centavos" integer DEFAULT 0 NOT NULL,
	"method" "payment_method",
	"reference_no" text,
	"cash_received_centavos" integer,
	"receipt_no" text NOT NULL,
	"received_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_appointmentId_unique" UNIQUE("appointment_id"),
	CONSTRAINT "payments_receiptNo_unique" UNIQUE("receipt_no"),
	CONSTRAINT "payments_amounts" CHECK ("payments"."amount_centavos" >= 0 and "payments"."credit_applied_centavos" between 0 and "payments"."amount_centavos"),
	CONSTRAINT "payments_method_when_due" CHECK (("payments"."credit_applied_centavos" = "payments"."amount_centavos") or "payments"."method" is not null),
	CONSTRAINT "payments_cash_covers" CHECK ("payments"."method" <> 'cash' or "payments"."cash_received_centavos" >= "payments"."amount_centavos" - "payments"."credit_applied_centavos"),
	CONSTRAINT "payments_reference_for_non_cash" CHECK ("payments"."method" is null or "payments"."method" = 'cash' or length(trim(coalesce("payments"."reference_no", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "receipt_counters" (
	"branch_id" text PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"opens_at_hour" smallint DEFAULT 9 NOT NULL,
	"closes_at_hour" smallint DEFAULT 17 NOT NULL,
	"open_days" smallint[] DEFAULT '{1,2,3,4,5,6}' NOT NULL,
	"timezone" text DEFAULT 'Asia/Manila' NOT NULL,
	"receipt_prefix" text DEFAULT 'CRB' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_code_unique" UNIQUE("code"),
	CONSTRAINT "branches_name_unique" UNIQUE("name"),
	CONSTRAINT "branches_hours_valid" CHECK ("branches"."opens_at_hour" >= 0 and "branches"."closes_at_hour" <= 24 and "branches"."opens_at_hour" < "branches"."closes_at_hour"),
	CONSTRAINT "branches_open_days_valid" CHECK ("branches"."open_days" <@ '{0,1,2,3,4,5,6}'::smallint[])
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" text PRIMARY KEY DEFAULT 'clinic' NOT NULL,
	"low_credit_threshold_centavos" integer DEFAULT 100000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinic_settings_singleton" CHECK ("clinic_settings"."id" = 'clinic')
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"name" text NOT NULL,
	"relationship" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_backup_staff" (
	"patient_id" text NOT NULL,
	"staff_id" text NOT NULL,
	CONSTRAINT "patient_backup_staff_patient_id_staff_id_pk" PRIMARY KEY("patient_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" date,
	"gender" "gender" DEFAULT 'unspecified' NOT NULL,
	"diagnosis" text DEFAULT '' NOT NULL,
	"enrolled_on" date NOT NULL,
	"service" "patient_service" NOT NULL,
	"primary_staff_id" text,
	"status" "patient_status" DEFAULT 'active' NOT NULL,
	"recurring_slot" text DEFAULT 'Unscheduled' NOT NULL,
	"goals_notes" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_classes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"service" "service" NOT NULL,
	"rate_centavos" integer NOT NULL,
	"therapist_share_pct" smallint NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_classes_name_unique" UNIQUE("name"),
	CONSTRAINT "rate_classes_rate_positive" CHECK ("rate_classes"."rate_centavos" >= 0),
	CONSTRAINT "rate_classes_share_pct" CHECK ("rate_classes"."therapist_share_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "session_type_rate_classes" (
	"session_type_id" text NOT NULL,
	"rate_class_id" text NOT NULL,
	CONSTRAINT "session_type_rate_classes_session_type_id_rate_class_id_pk" PRIMARY KEY("session_type_id","rate_class_id")
);
--> statement-breakpoint
CREATE TABLE "session_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"service" "patient_service",
	"rate_centavos" integer NOT NULL,
	"any_rate_class" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_types_name_unique" UNIQUE("name"),
	CONSTRAINT "session_types_rate_positive" CHECK ("session_types"."rate_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"branch_id" text NOT NULL,
	"display_name" text NOT NULL,
	"short_name" text NOT NULL,
	"surname" text NOT NULL,
	"rate_class_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "appointment_series" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"session_type_id" text NOT NULL,
	"weekday" smallint NOT NULL,
	"start_hour" smallint NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"materialized_until" date NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_weekday" CHECK ("appointment_series"."weekday" between 0 and 6),
	CONSTRAINT "series_hour" CHECK ("appointment_series"."start_hour" between 0 and 23),
	CONSTRAINT "series_dates" CHECK ("appointment_series"."ends_on" is null or "appointment_series"."ends_on" >= "appointment_series"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"session_type_id" text NOT NULL,
	"series_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"rescheduled_to_id" text,
	"is_make_up" boolean DEFAULT false NOT NULL,
	"fee_centavos" integer NOT NULL,
	"payroll_rate_centavos" integer,
	"payroll_share_pct" smallint,
	"status_changed_by_user_id" text,
	"status_changed_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_ends_after_start" CHECK ("appointments"."ends_at" > "appointments"."starts_at"),
	CONSTRAINT "appointments_on_the_hour" CHECK (extract(minute from "appointments"."starts_at") = 0 and extract(second from "appointments"."starts_at") = 0),
	CONSTRAINT "appointments_fee_positive" CHECK ("appointments"."fee_centavos" >= 0),
	CONSTRAINT "appointments_payroll_snapshot" CHECK (("appointments"."status" <> 'attended') or ("appointments"."payroll_rate_centavos" is not null and "appointments"."payroll_share_pct" is not null))
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"appointment_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"author_staff_id" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_notes_body" CHECK (length(trim("session_notes"."body")) > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branches" ADD CONSTRAINT "user_branches_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_related_payment_id_payments_id_fk" FOREIGN KEY ("related_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_counters" ADD CONSTRAINT "receipt_counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_backup_staff" ADD CONSTRAINT "patient_backup_staff_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_backup_staff" ADD CONSTRAINT "patient_backup_staff_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_primary_staff_id_staff_id_fk" FOREIGN KEY ("primary_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_type_rate_classes" ADD CONSTRAINT "session_type_rate_classes_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_type_rate_classes" ADD CONSTRAINT "session_type_rate_classes_rate_class_id_rate_classes_id_fk" FOREIGN KEY ("rate_class_id") REFERENCES "public"."rate_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_rate_class_id_rate_classes_id_fk" FOREIGN KEY ("rate_class_id") REFERENCES "public"."rate_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_series_id_appointment_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."appointment_series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_rescheduled_to_id_appointments_id_fk" FOREIGN KEY ("rescheduled_to_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_status_changed_by_user_id_users_id_fk" FOREIGN KEY ("status_changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_author_staff_id_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_supersedes_id_session_notes_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."session_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_entity_id_index" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_index" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_index" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_branches_branch_id_index" ON "user_branches" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "credit_ledger_patient_id_created_at_index" ON "credit_ledger" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_related_payment_id_index" ON "credit_ledger" USING btree ("related_payment_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_created_by_user_id_index" ON "credit_ledger" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "expenses_branch_id_spent_on_index" ON "expenses" USING btree ("branch_id","spent_on");--> statement-breakpoint
CREATE INDEX "expenses_created_by_user_id_index" ON "expenses" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "payments_patient_id_index" ON "payments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "payments_branch_id_created_at_index" ON "payments" USING btree ("branch_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_received_by_user_id_index" ON "payments" USING btree ("received_by_user_id");--> statement-breakpoint
CREATE INDEX "guardians_patient_id_index" ON "guardians" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_one_primary" ON "guardians" USING btree ("patient_id") WHERE "guardians"."is_primary";--> statement-breakpoint
CREATE INDEX "patient_backup_staff_staff_id_index" ON "patient_backup_staff" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "patients_branch_id_index" ON "patients" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "patients_primary_staff_id_index" ON "patients" USING btree ("primary_staff_id");--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree (lower("last_name"),lower("first_name"));--> statement-breakpoint
CREATE INDEX "session_type_rate_classes_rate_class_id_index" ON "session_type_rate_classes" USING btree ("rate_class_id");--> statement-breakpoint
CREATE INDEX "staff_branch_id_index" ON "staff" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "staff_rate_class_id_index" ON "staff" USING btree ("rate_class_id");--> statement-breakpoint
CREATE INDEX "appointment_series_branch_id_index" ON "appointment_series" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "appointment_series_patient_id_index" ON "appointment_series" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "appointment_series_staff_id_index" ON "appointment_series" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "appointment_series_session_type_id_index" ON "appointment_series" USING btree ("session_type_id");--> statement-breakpoint
CREATE INDEX "appointments_branch_id_starts_at_index" ON "appointments" USING btree ("branch_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_staff_starts_idx" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_patient_starts_idx" ON "appointments" USING btree ("patient_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_session_type_id_index" ON "appointments" USING btree ("session_type_id");--> statement-breakpoint
CREATE INDEX "appointments_series_id_index" ON "appointments" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "appointments_rescheduled_to_id_index" ON "appointments" USING btree ("rescheduled_to_id");--> statement-breakpoint
CREATE INDEX "appointments_status_changed_by_user_id_index" ON "appointments" USING btree ("status_changed_by_user_id");--> statement-breakpoint
CREATE INDEX "appointments_created_by_user_id_index" ON "appointments" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "session_notes_appointment_id_index" ON "session_notes" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "session_notes_patient_id_created_at_index" ON "session_notes" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "session_notes_author_staff_id_index" ON "session_notes" USING btree ("author_staff_id");--> statement-breakpoint
CREATE INDEX "session_notes_supersedes_id_index" ON "session_notes" USING btree ("supersedes_id");