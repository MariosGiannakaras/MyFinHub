import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const productionApplied=[
  "20260817063947_create_rheomiq_state.sql",
  "20260817070649_enable_pg_net.sql",
  "20260817084023_secure_single_owner_access.sql",
  "20260817085117_enforce_owner_rls_invoker.sql",
  "20260817091858_require_aal2_finance_access.sql",
  "20260817094500_enforce_expected_revision.sql",
  "20260817094600_remove_import_artifacts.sql",
  "20260817165000_enforce_backup_integrity.sql",
  "20260817191500_add_mutable_state_save.sql",
  "20260818173209_add_card_secret_vault.sql",
  "20260818173321_optimize_card_secret_rls.sql",
  "20260819072000_tighten_card_secret_grants.sql",
  "20260824205000_add_account_metadata.sql",
  "20260825192943_add_durable_history.sql",
  "20260825194121_harden_durable_history.sql",
  "20260825194135_bound_durable_history_pruning.sql",
  "20260825194146_allow_history_audit_actions.sql",
  "20260825194447_tighten_history_metadata_grants.sql",
  "20260825194800_optimize_durable_history_rls.sql",
  "20260825195120_tighten_account_metadata_function_grants.sql",
  "20260901133549_fix_account_metadata_upsert_conflict.sql",
  "20260903141314_add_private_android_releases.sql",
  "20260904144018_add_android_release_channels.sql",
  "20260904193923_add_financial_provider_registry.sql",
  "20260905004603_add_financial_provider_assets.sql",
  "20260905010544_add_financial_provider_assets_bucket.sql",
  "20260905011145_fix_history_parent_fk_delete.sql",
  "20260904083000_add_device_session_registry.sql",
  "20260905020000_refresh_financial_provider_brand_assets.sql",
  "20260930062504_harden_active_device_sensitive_rls.sql",
  "20260930062619_move_active_device_rls_helper_private.sql"
] as const;
const pending=[] as const;

describe('production migration ledger source contract',()=>{
  it('keeps every production-applied migration represented by the exact applied version/name',()=>{
    const local=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort();
    expect(local).toEqual([...productionApplied,...pending].sort());
  });

  it('keeps current production security hardening represented by the exact applied ledger',()=>{
    const device=readFileSync('supabase/migrations/20260904083000_add_device_session_registry.sql','utf8');
    const brandRefresh=readFileSync('supabase/migrations/20260905020000_refresh_financial_provider_brand_assets.sql','utf8');
    const hardening=readFileSync('supabase/migrations/20260930062504_harden_active_device_sensitive_rls.sql','utf8');
    const privateHelper=readFileSync('supabase/migrations/20260930062619_move_active_device_rls_helper_private.sql','utf8');
    expect(device).toContain('create table if not exists public.myfinhub_device_sessions');
    expect(device).toContain('and public.myfinhub_session_is_active()');
    expect(brandRefresh).toContain("when 'piraeus' then 'generic'");
    expect(brandRefresh).toContain("when 'eurobank' then 'generic'");
    expect(hardening).toContain('rheomiq_card_secrets_owner_aal2_select');
    expect(hardening).toContain('rheomiq_account_metadata_owner_aal2_select');
    expect(privateHelper).toContain('create or replace function private.myfinhub_session_is_active()');
    expect(privateHelper).toContain('drop function if exists public.myfinhub_session_is_active()');
  });

  it('back-syncs the production-only provider asset registry schema without embedding production asset bytes',()=>{
    const assets=readFileSync('supabase/migrations/20260905004603_add_financial_provider_assets.sql','utf8');
    expect(assets).toContain('create table if not exists public.rheomiq_financial_provider_assets');
    expect(assets).toContain('content bytea not null');
    expect(assets).toContain('enable row level security');
    expect(assets).toContain('grant select on table public.rheomiq_financial_provider_assets to authenticated');
    expect(assets).not.toMatch(/insert\s+into\s+public\.rheomiq_financial_provider_assets/i);
  });
});
