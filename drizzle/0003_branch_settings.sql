-- Rates and splits, session types and the low-credit reminder become per
-- branch (D-117). Existing values are kept: every branch starts with the
-- clinic-wide rates and reminder it had, session types move to the main branch,
-- and every other branch gets its own copy of them.

-- 1. Rates per branch, seeded from the clinic-wide rates.
CREATE TABLE "branch_rates" (
	"branch_id" text NOT NULL,
	"rate_class_id" text NOT NULL,
	"rate_centavos" integer NOT NULL,
	"therapist_share_pct" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_rates_branch_id_rate_class_id_pk" PRIMARY KEY("branch_id","rate_class_id"),
	CONSTRAINT "branch_rates_rate_positive" CHECK ("branch_rates"."rate_centavos" >= 0),
	CONSTRAINT "branch_rates_share_pct" CHECK ("branch_rates"."therapist_share_pct" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "branch_rates" ADD CONSTRAINT "branch_rates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_rates" ADD CONSTRAINT "branch_rates_rate_class_id_rate_classes_id_fk" FOREIGN KEY ("rate_class_id") REFERENCES "public"."rate_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_rates_rate_class_id_index" ON "branch_rates" USING btree ("rate_class_id");--> statement-breakpoint
INSERT INTO "branch_rates" ("branch_id", "rate_class_id", "rate_centavos", "therapist_share_pct")
  SELECT b."id", rc."id", rc."rate_centavos", rc."therapist_share_pct"
  FROM "branches" b CROSS JOIN "rate_classes" rc;--> statement-breakpoint
ALTER TABLE "rate_classes" DROP CONSTRAINT "rate_classes_rate_positive";--> statement-breakpoint
ALTER TABLE "rate_classes" DROP CONSTRAINT "rate_classes_share_pct";--> statement-breakpoint
ALTER TABLE "rate_classes" DROP COLUMN "rate_centavos";--> statement-breakpoint
ALTER TABLE "rate_classes" DROP COLUMN "therapist_share_pct";--> statement-breakpoint

-- 2. The low-credit reminder per branch, from the clinic-wide value.
ALTER TABLE "branches" ADD COLUMN "low_credit_threshold_centavos" integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
UPDATE "branches" SET "low_credit_threshold_centavos" = cs."low_credit_threshold_centavos"
  FROM "clinic_settings" cs WHERE cs."id" = 'clinic';--> statement-breakpoint
ALTER TABLE "clinic_settings" DROP COLUMN "low_credit_threshold_centavos";--> statement-breakpoint

-- 3. Session types belong to a branch: existing ones to the main branch.
ALTER TABLE "session_types" DROP CONSTRAINT "session_types_name_unique";--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "branch_id" text;--> statement-breakpoint
UPDATE "session_types" SET "branch_id" = (
  SELECT "id" FROM "branches" ORDER BY "is_main" DESC, "code" LIMIT 1
);--> statement-breakpoint

-- Every other branch gets its own copy, with the same allowed roles.
CREATE TEMP TABLE "session_type_copies" ON COMMIT DROP AS
  SELECT st."id" AS "old_id", b."id" AS "branch_id", gen_random_uuid()::text AS "new_id"
  FROM "session_types" st JOIN "branches" b ON b."id" <> st."branch_id";--> statement-breakpoint
INSERT INTO "session_types"
  ("id", "branch_id", "name", "service", "rate_centavos", "any_rate_class", "active", "sort_order", "created_at", "updated_at")
  SELECT c."new_id", c."branch_id", st."name", st."service", st."rate_centavos", st."any_rate_class",
    st."active", st."sort_order", st."created_at", now()
  FROM "session_type_copies" c JOIN "session_types" st ON st."id" = c."old_id";--> statement-breakpoint
INSERT INTO "session_type_rate_classes" ("session_type_id", "rate_class_id")
  SELECT c."new_id", l."rate_class_id"
  FROM "session_type_copies" c JOIN "session_type_rate_classes" l ON l."session_type_id" = c."old_id";--> statement-breakpoint
-- Sessions and series at other branches now point at that branch's copy.
UPDATE "appointments" a SET "session_type_id" = c."new_id"
  FROM "session_type_copies" c
  WHERE a."session_type_id" = c."old_id" AND a."branch_id" = c."branch_id";--> statement-breakpoint
UPDATE "appointment_series" s SET "session_type_id" = c."new_id"
  FROM "session_type_copies" c
  WHERE s."session_type_id" = c."old_id" AND s."branch_id" = c."branch_id";--> statement-breakpoint

ALTER TABLE "session_types" ALTER COLUMN "branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_types" ADD CONSTRAINT "session_types_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_types_branch_name" ON "session_types" USING btree ("branch_id","name");
