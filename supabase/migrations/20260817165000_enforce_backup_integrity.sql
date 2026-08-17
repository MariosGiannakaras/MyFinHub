alter table public.rheomiq_backups
  add constraint rheomiq_backups_reason_check
    check (reason in ('manual', 'pre-import', 'automatic')),
  add constraint rheomiq_backups_schema_version_positive
    check (schema_version > 0),
  add constraint rheomiq_backups_revision_positive
    check (revision > 0);
