-- Supabase default privileges can grant newly created tables/sequences more operations
-- than these owner-only domains require. RLS does not protect TRUNCATE, so make the
-- authenticated surface explicit and least-privilege instead of relying on defaults.

revoke all on table public.rheomiq_account_metadata from public, anon, authenticated;
grant select, insert, update on table public.rheomiq_account_metadata to authenticated;

revoke all on table public.rheomiq_history_points from public, anon, authenticated;
grant select, insert, update, delete on table public.rheomiq_history_points to authenticated;

revoke all on table public.rheomiq_history_cursor from public, anon, authenticated;
grant select, insert, update, delete on table public.rheomiq_history_cursor to authenticated;

revoke all on sequence public.rheomiq_history_points_id_seq from public, anon, authenticated;
grant usage, select on sequence public.rheomiq_history_points_id_seq to authenticated;
