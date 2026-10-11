-- Anonymizing a patient (data subject erasure) must also remove their
-- identifiers from old audit entries. The audit log stays append-only with one
-- narrow exception: inside a transaction that sets crb.audit_redaction = 'on',
-- an UPDATE may replace before/after with {"redacted": true} and change
-- nothing else. Deletes are still refused.
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('crb.audit_redaction', true) = 'on'
     AND NEW.id = OLD.id
     AND NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id
     AND NEW.action = OLD.action
     AND NEW.entity = OLD.entity
     AND NEW.entity_id = OLD.entity_id
     AND NEW.ip IS NOT DISTINCT FROM OLD.ip
     AND NEW.created_at = OLD.created_at
     AND (NEW.before IS NULL OR NEW.before = '{"redacted": true}'::jsonb)
     AND (NEW.after IS NULL OR NEW.after = '{"redacted": true}'::jsonb)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% rows are append-only (% refused)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER audit_log_append_only ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();
