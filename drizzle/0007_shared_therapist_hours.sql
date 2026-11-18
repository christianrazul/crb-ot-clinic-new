-- A therapist can support several patients in the same hour (a make up session
-- with no other free slot, or a group session). A patient still cannot be in
-- two places at once, so appointments_no_patient_overlap stays.
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_staff_overlap";
