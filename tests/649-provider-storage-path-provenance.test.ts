import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const sql=readFileSync('supabase/migrations/20261120001000_guard_provider_asset_path_provenance.sql','utf8');
const direct=readFileSync('scripts/real-stack-receivable-rpc.ts','utf8');
const real=readFileSync('scripts/real-stack-e2e.ts','utf8');

describe('#649 I19.04/I22.02 direct provider image provenance',()=>{
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
    expect(real).toContain('nulledProviderBucket.status===400');
    expect(real).toContain('forgedProviderRows.length===1');
  });
});
