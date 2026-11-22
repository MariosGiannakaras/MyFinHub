import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const sql=readFileSync('supabase/migrations/20261120001000_guard_provider_asset_path_provenance.sql','utf8');
const direct=readFileSync('scripts/real-stack-receivable-rpc.ts','utf8');
const real=readFileSync('scripts/real-stack-e2e.ts','utf8');

describe('#649 I19.04/I22.02 direct provider image provenance',()=>{
  it('prevents direct owner AAL2 deactivation of artwork with a live binding, while allowing unbound edits',()=>{
    const guard=readFileSync('supabase/migrations/20261122225000_guard_bound_provider_artwork_active.sql','utf8');
    expect(guard).toContain('security invoker');
    expect(guard).toContain("current_user <> 'authenticated'");
    expect(guard).toContain('old.active is not true or new.active is not false');
    expect(guard).toContain('from public.rheomiq_financial_provider_asset_bindings b');
    expect(guard).toContain('from public.rheomiq_financial_providers p');
    expect(guard).toContain("message='FINANCIAL_PROVIDER_ASSET_IN_USE'");
    expect(guard).toContain('before update of active on public.rheomiq_financial_provider_assets');
    expect(guard).not.toMatch(/security definer|delete from|truncate table|drop table|drop schema/i);
    expect(direct).toContain('const boundAssetBefore=await selectProviderAsset(serviceRole,registeredAssetKey)');
    expect(direct).toContain('headers:{apikey:token===serviceRole?serviceRole:publishable,');
    expect(direct).toContain("deniedBoundDeactivate.status===409&&String(deniedBoundBody?.code)==='23503'");
    expect(direct).toContain('JSON.stringify(boundAssetAfter.body)===JSON.stringify(boundAssetBefore.body)');
    expect(direct).toContain('JSON.stringify(boundBindingAfter.body)===JSON.stringify(originalCrossBaseline.body)');
    expect(direct).toContain('const unboundAssetBefore=await selectProviderAsset(serviceRole,crossAssetKey)');
    expect(direct).toContain('[200,204].includes(unboundDeactivate.status)');
    expect(direct).toContain('unboundAssetAfter.body[0]?.active===false');
    expect(direct.indexOf('const deniedBoundDeactivate=await fetch('))
      .toBeGreaterThan(direct.indexOf("const bound=await rpc('rheomiq_set_financial_provider_asset_binding'"));
    expect(direct.indexOf('const unboundDeactivate=await fetch('))
      .toBeGreaterThan(direct.indexOf('const foreignPatch=await fetch('));
  });

  it('requires binding asset provenance at the table FK even when owner AAL2 directly writes',()=>{
    const constraint=readFileSync('supabase/migrations/20261122211000_guard_provider_binding_cross_provider.sql','utf8');
    expect(constraint).toContain('create unique index if not exists rheomiq_provider_assets_provider_key_unique_idx');
    expect(constraint).toContain('on public.rheomiq_financial_provider_assets(provider_id,asset_key)');
    expect(constraint).toContain('rheomiq_provider_binding_same_provider_fk');
    expect(constraint).toContain('foreign key (provider_id,asset_key)');
    expect(constraint).toContain('references public.rheomiq_financial_provider_assets(provider_id,asset_key)');
    expect(constraint).toContain('EXISTING_PROVIDER_BINDING_CROSS_PROVIDER');
    expect(constraint).toContain('not valid;');
    expect(constraint).toContain('validate constraint rheomiq_provider_binding_same_provider_fk');
    expect(constraint).not.toMatch(/security definer|drop table|delete from|truncate table|drop schema/i);
    expect(direct).toContain("const crossProviderId='qa-cross-provider-'+randomUUID()");
    expect(direct).toContain("const crossCreated=await rpc('rheomiq_create_financial_provider',aal2Token,{");
    expect(direct).toContain("const crossStored=await storageRequest('POST',aal2Token,crossStorage)");
    expect(direct).toContain("const crossAsset=await rpc('rheomiq_register_financial_provider_asset',aal2Token,{");
    expect(direct).toContain("const originalCrossBaseline=await selectProviderBinding(serviceRole,protectedProviderId)");
    expect(direct).toContain("const crossSlotBefore=await selectProviderBinding(serviceRole,crossProviderId)");
    expect(direct).toContain("const foreignInsert=await fetch(");
    expect(direct).toContain("foreignInsert.status===409&&String(foreignInsertBody?.code)==='23503'");
    expect(direct).toContain("const foreignPatch=await fetch(");
    expect(direct).toContain("foreignPatch.status===409&&String(foreignPatchBody?.code)==='23503'");
    expect(direct).toContain("JSON.stringify(originalCrossAfter.body)===JSON.stringify(originalCrossBaseline.body)");
    expect(direct).toContain("crossSlotAfter.body.length===0");
    expect(direct).toContain('for(const providerId of syntheticCrossProviderIds)');
    expect(direct.indexOf('for(const binding of syntheticRegisteredBindings)'))
      .toBeLessThan(direct.indexOf('for(const assetKey of syntheticRegisteredAssets)'));
    expect(direct.indexOf('for(const assetKey of syntheticRegisteredAssets)'))
      .toBeLessThan(direct.indexOf('for(const providerId of syntheticCrossProviderIds)'));
  });

  it('binds server-issued immutable keys, owner directory and MIME at row level while retaining curated legacy keys',()=>{
    expect(sql).toContain('rheomiq_provider_server_asset_exact_storage_path');
    expect(sql).toContain("asset_key ~ '^[a-z][a-z0-9-]{0,63}-asset-[a-f0-9]{12}$'");
    expect(sql).toContain("asset_key ~ ('^' || provider_id || '-asset-[a-f0-9]{12}$')");
    expect(sql).toContain("coalesce(storage_bucket,'') = 'financial-provider-assets'");
    expect(sql).toContain("'providers/' || provider_id || '/' || asset_key");
    expect(sql).toContain('else true');
    expect(sql).toContain('not valid');
    expect(sql).toContain('validate constraint rheomiq_provider_server_asset_exact_storage_path');
    for(const mime of ['image/png','image/jpeg','image/webp','image/svg+xml'])
      expect(sql).toContain("when '"+mime+"'");
    expect(sql).not.toMatch(/security definer|drop table|delete from|truncate table|drop schema/i);
  });
  it('preserves the existing invoker/owner security boundary and rejects direct registration bypasses',()=>{
    expect(sql).toContain('create or replace function public.rheomiq_register_financial_provider_asset(');
    expect(sql).toContain('security invoker');
    expect(sql).toContain('if not public.rheomiq_is_owner_aal2() then');
    expect(sql).toContain('INVALID_PROVIDER_ASSET_PROVENANCE');
    expect(sql).toContain("p_storage_path is distinct from (");
    expect(sql).toContain("o.bucket_id='financial-provider-assets' and o.name=p_storage_path");
    expect(direct).toContain("method:'rheomiq_register_financial_provider_asset'");
    expect(direct).toContain("method:'rheomiq_set_financial_provider_asset_binding'");
    expect(real).toContain('[real-stack] stage provider-direct-rpc-path-provenance');
    expect(real).toContain('differentKey.status===400');
    expect(real).toContain('wrongProviderMime.status===400');
    expect(real).toContain('noncanonicalProviderKey.status===400');
    expect(real).toContain('modifiedProviderMime.status===400');
    expect(real).toContain('Owner update acknowledged changed provider asset provenance.');
    expect(real).toContain('serviceGuardPatch.status===400');
    expect(real).toContain("serviceGuardBody?.code==='23514'");
    expect(real).toContain("storage_bucket==='financial-provider-assets'");
    expect(real).toContain("active===true");
    expect(real).toContain('forgedProviderRows.length===1');
  });
});
