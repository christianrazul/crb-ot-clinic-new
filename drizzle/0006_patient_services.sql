ALTER TABLE "patients" ADD COLUMN "services" "patient_service"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "patients" SET "services" = ARRAY["service"];--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_services_include_main" CHECK ("patients"."service" = any("patients"."services"));