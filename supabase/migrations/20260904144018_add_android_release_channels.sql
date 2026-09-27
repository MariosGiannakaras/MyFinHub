-- Keep Phase 6 test APK metadata isolated from the future production update channel.
-- Runtime access remains owner + AAL2 SELECT-only; publishing stays an admin/offline operation.

alter table public.rheomiq_android_releases
  add column if not exists channel text not null default 'production';

alter table public.rheomiq_android_releases
  drop constraint if exists rheomiq_android_releases_version_code_key;

alter table public.rheomiq_android_releases
  drop constraint if exists rheomiq_android_releases_channel_check;

alter table public.rheomiq_android_releases
  add constraint rheomiq_android_releases_channel_check
  check (channel in ('production', 'phase6-test'));

alter table public.rheomiq_android_releases
  drop constraint if exists rheomiq_android_releases_channel_version_code_key;

alter table public.rheomiq_android_releases
  add constraint rheomiq_android_releases_channel_version_code_key
  unique (channel, version_code);

alter table public.rheomiq_android_releases
  drop constraint if exists rheomiq_android_releases_channel_storage_path_check;

alter table public.rheomiq_android_releases
  add constraint rheomiq_android_releases_channel_storage_path_check
  check (
    (channel = 'production' and storage_path !~ '^phase6-test/')
    or (channel = 'phase6-test' and storage_path ~ '^phase6-test/')
  );

create index if not exists rheomiq_android_releases_channel_latest_idx
  on public.rheomiq_android_releases (channel, enabled, version_code desc);

comment on column public.rheomiq_android_releases.channel is
  'Isolates the future production update feed from the temporary Phase 6 non-production test feed.';
