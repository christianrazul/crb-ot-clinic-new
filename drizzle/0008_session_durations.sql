ALTER TABLE "appointments" DROP CONSTRAINT "appointments_on_the_hour";--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "duration_minutes" smallint DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD COLUMN "start_minute" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_types" ADD CONSTRAINT "session_types_duration" CHECK ("session_types"."duration_minutes" in (30, 60));--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "series_minute" CHECK ("appointment_series"."start_minute" in (0, 30));--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_on_the_half_hour" CHECK (extract(minute from "appointments"."starts_at") in (0, 30) and extract(second from "appointments"."starts_at") = 0);