-- Durable history moves are normal audited finance mutations. Preserve the existing
-- audit vocabulary and add the two canonical cursor-move actions used by Undo/Redo.

alter table public.rheomiq_audit_log
  drop constraint if exists rheomiq_audit_log_action_check;

alter table public.rheomiq_audit_log
  add constraint rheomiq_audit_log_action_check
  check (action = any (array['save'::text, 'import'::text, 'backup'::text, 'undo'::text, 'redo'::text]));
