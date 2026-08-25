-- Keep durable-history authorization semantics identical while avoiding per-row auth
-- initialization work, and cover the composite cursor foreign key used by point moves.

create index if not exists rheomiq_history_cursor_owner_point_idx
on public.rheomiq_history_cursor(owner_user_id, current_point_id);

drop policy if exists rheomiq_history_points_owner_aal2_select on public.rheomiq_history_points;
drop policy if exists rheomiq_history_points_owner_aal2_insert on public.rheomiq_history_points;
drop policy if exists rheomiq_history_points_owner_aal2_update on public.rheomiq_history_points;
drop policy if exists rheomiq_history_points_owner_aal2_delete on public.rheomiq_history_points;

create policy rheomiq_history_points_owner_aal2_select
on public.rheomiq_history_points for select to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_history_points_owner_aal2_insert
on public.rheomiq_history_points for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_history_points_owner_aal2_update
on public.rheomiq_history_points for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
)
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_history_points_owner_aal2_delete
on public.rheomiq_history_points for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

drop policy if exists rheomiq_history_cursor_owner_aal2_select on public.rheomiq_history_cursor;
drop policy if exists rheomiq_history_cursor_owner_aal2_insert on public.rheomiq_history_cursor;
drop policy if exists rheomiq_history_cursor_owner_aal2_update on public.rheomiq_history_cursor;
drop policy if exists rheomiq_history_cursor_owner_aal2_delete on public.rheomiq_history_cursor;

create policy rheomiq_history_cursor_owner_aal2_select
on public.rheomiq_history_cursor for select to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_history_cursor_owner_aal2_insert
on public.rheomiq_history_cursor for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_history_cursor_owner_aal2_update
on public.rheomiq_history_cursor for update to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
)
with check (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);

create policy rheomiq_history_cursor_owner_aal2_delete
on public.rheomiq_history_cursor for delete to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select public.rheomiq_is_owner_aal2())
);
