alter table public.rheomiq_history_points
  drop constraint if exists rheomiq_history_parent_owner_fk;

alter table public.rheomiq_history_points
  add constraint rheomiq_history_parent_owner_fk
  foreign key (owner_user_id, parent_point_id)
  references public.rheomiq_history_points(owner_user_id, id)
  on delete set null (parent_point_id);
