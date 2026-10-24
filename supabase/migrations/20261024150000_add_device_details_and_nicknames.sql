-- Optional owner-controlled device names and bounded, non-sensitive system descriptors.
-- Nicknames are never overwritten by periodic client metadata refresh.
alter table public.myfinhub_device_sessions
  add column if not exists nickname text,
  add column if not exists system_name text,
  add column if not exists browser_name text,
  add column if not exists device_type text;

alter table public.myfinhub_device_sessions
  add constraint myfinhub_device_sessions_nickname_length
    check (nickname is null or char_length(nickname) between 1 and 60),
  add constraint myfinhub_device_sessions_system_name_length
    check (system_name is null or char_length(system_name) <= 80),
  add constraint myfinhub_device_sessions_browser_name_length
    check (browser_name is null or char_length(browser_name) <= 80),
  add constraint myfinhub_device_sessions_device_type_length
    check (device_type is null or device_type in ('desktop', 'phone', 'tablet', 'unknown'));

-- Existing owner+AAL2 RLS and session-revocation protections remain unchanged.
grant update (nickname, system_name, browser_name, device_type)
  on table public.myfinhub_device_sessions to authenticated;
