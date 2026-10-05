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
  "20260904083000_add_device_session_registry.sql",
  "20260904144018_add_android_release_channels.sql",
  "20260904193923_add_financial_provider_registry.sql",
  "20260905004603_add_financial_provider_assets.sql",
  "20260905010544_add_financial_provider_assets_bucket.sql",
  "20260905011145_fix_history_parent_fk_delete.sql",
  "20260905020000_refresh_financial_provider_brand_assets.sql",
  "20260930062504_harden_active_device_sensitive_rls.sql",
  "20260930062619_move_active_device_rls_helper_private.sql",
  "20260930075049_align_financial_provider_brand_assets.sql",
  "20260930095835_backfill_verified_piraeus_wordmark.sql",
  "20260930100713_backfill_canonical_payzy_viva_assets.sql",
  "20260930103651_provider_asset_storage_metadata.sql",
  "20260930104343_rename_payzy_provider_to_magenta_pay.sql",
  "20260930104535_add_database_health_check.sql",
  "20260930104721_remove_empty_legacy_provider_assets.sql",
  "20260930105145_make_state_writes_history_atomic.sql",
  "20260930105508_index_provider_asset_foreign_keys.sql",
  "20260930114105_add_database_health_check.sql",
  "20260930114624_merge_database_health_contract.sql",
  "20260930115252_fix_database_health_history_state_check.sql",
  "20260930122054_relational_finance_ledger_cutover.sql",
  "20260930122418_index_relational_finance_foreign_keys.sql",
  "20260930195848_enable_user_managed_provider_assets.sql",
  "20261001192135_manage_financial_provider_assets.sql",
  "20261001220945_reject_cross_account_id_collisions.sql"
] as const;

const releasePending=[] as const;

describe('production migration ledger source contract',()=>{
  it('keeps every production-applied migration represented by the exact applied version/name',()=>{
    const local=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort();
    expect(local).toEqual([...productionApplied,...releasePending].sort());
  });

  it('tracks the relational cutover and provider management as production-applied history',()=>{
    expect(productionApplied).toContain('20260930122054_relational_finance_ledger_cutover.sql');
    expect(productionApplied).toContain('20260930195848_enable_user_managed_provider_assets.sql');
    expect(productionApplied).toContain('20261001192135_manage_financial_provider_assets.sql');
    expect(releasePending).toEqual([]);
  });

  it('keeps formerly release-pending migrations represented as production-applied history',()=>{
    const device=readFileSync('supabase/migrations/20260904083000_add_device_session_registry.sql','utf8');
    const brandRefresh=readFileSync('supabase/migrations/20260905020000_refresh_financial_provider_brand_assets.sql','utf8');
    expect(device).toContain('create table if not exists public.myfinhub_device_sessions');
    expect(device).toContain('and public.myfinhub_session_is_active()');
    expect(brandRefresh).toContain("when 'piraeus' then 'generic'");
    expect(brandRefresh).toContain("when 'eurobank' then 'generic'");
  });

  it('back-syncs the production-only provider asset registry schema without embedding production asset bytes in its original schema migration',()=>{
    const assets=readFileSync('supabase/migrations/20260905004603_add_financial_provider_assets.sql','utf8');
    expect(assets).toContain('create table if not exists public.rheomiq_financial_provider_assets');
    expect(assets).toContain('content bytea not null');
    expect(assets).toContain('enable row level security');
    expect(assets).toContain('grant select on table public.rheomiq_financial_provider_assets to authenticated');
    expect(assets).not.toMatch(/insert\s+into\s+public\.rheomiq_financial_provider_assets/i);
  });

  it('tracks provider artwork as user-managed Storage assets without mandatory provenance',()=>{
    const assets=readFileSync('supabase/migrations/20260930195848_enable_user_managed_provider_assets.sql','utf8');
    expect(assets).toContain("alter column legacy_content drop not null");
    expect(assets).toContain("'user-managed'");
    expect(assets).toContain("'card-mark'::text");
    expect(assets).toContain("storage_bucket = 'financial-provider-assets'");
    expect(assets).toContain("source/provenance metadata is optional");
    expect(assets).toContain("magenta-pay-logo-universal");
  });

  it('keeps the final provider/history health contract represented as a forward migration',()=>{
    const health=readFileSync('supabase/migrations/20260930115252_fix_database_health_history_state_check.sql','utf8');
    expect(health).toContain("'productionReady'");
    expect(health).toContain("'unbalanced_internal_events'");
    expect(health).toContain("'history_current_point_state_mismatches'");
    expect(health).not.toContain('security definer');
  });
});
