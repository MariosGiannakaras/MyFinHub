import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const real=readFileSync(new URL('../scripts/real-stack-e2e.ts',import.meta.url),'utf8');
const direct=readFileSync(new URL('../scripts/real-stack-receivable-rpc.ts',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/real-stack-e2e.yml',import.meta.url),'utf8');
describe('#649 I22.05 actual local Supabase owner+AAL2 direct PostgREST test',()=>{
  it('runs inside the established single isolated real-stack suite',()=>{
    expect(real).toContain("import { runDirectReceivableRpcProof }");
    expect(real).toContain('await runDirectReceivableRpcProof({');
    expect(real).toContain('generation:initialGeneration');
    expect(workflow).toContain('npm run qa:real-stack');
    expect(workflow).toContain("<!-- run-real-stack-e2e -->");
  });
  it('uses only loopback local Auth and owner session with no secret logging',()=>{
    expect(direct).toContain("http:\\/\\/127\\.0\\.0\\.1");
    expect(direct).toContain("aal1Claims.aal==='aal1'");
    expect(direct).toContain("aal2Claims.aal==='aal2'");
    expect(direct).toContain('/rest/v1/myfinhub_device_sessions');
    expect(direct).toContain('rheomiq_save_mutable_state_history');
    expect(direct).toContain('rheomiq_read_history');
    expect(direct).toContain("dated overpayment");
    expect(direct).toContain("future lending masks an intermediate deficit");
    expect(direct).toContain("forged receivable delta");
    expect(direct).toContain("nonownerClaims.aal==='aal2'");
    expect(direct).toContain("method:'rheomiq_upsert_account_metadata'");
    expect(direct).toContain("p_expected_revision:0");
    expect(direct).toContain("await selectMetadata(aal2Token)");
    expect(direct).toContain("await selectMetadata(token)");
    expect(direct).toContain("denied.body.length===0");
    expect(direct).toContain("prefer:'return=representation'");
    expect(direct).toContain("removed.length===1");
    expect(direct).toContain("nonownerUserId!==userId");
    expect(direct).toContain("await register(nonownerClaims.session_id!,nonownerUserId)");
    expect(direct).toContain("['rheomiq_read_state','rheomiq_read_history','rheomiq_save_mutable_state_history']");
    expect(direct).toContain("denied.status===403&&String(denied.body?.code)==='42501'");
    expect(real).toContain("totpCodeForSecret:(factorSecret,previousCode)=>nextTotp(factorSecret,previousCode)");
    expect(direct).toContain("JSON.stringify(after.body)===JSON.stringify(before.body)");
    expect(direct).toContain("new URLSearchParams({session_id:'eq.'+aal2Claims.session_id!,user_id:'eq.'+userId,revoked_at:'is.null'})");
    expect(direct).toContain("revokedRows.length===1");
    expect(direct).toContain("for(const method of ['rheomiq_read_state','rheomiq_read_history'])");
    expect(direct).toContain("deniedWrite.status===403&&String(deniedWrite.body?.code)==='42501'");
    expect(direct).toContain("revokedRead.body.length===0");
    expect(direct.indexOf("const revokedRead=await selectMetadata(aal2Token)")).toBeLessThan(
      direct.indexOf("const cleanup=await fetch(")
    );
    expect(direct).toContain("return aal1Claims.session_id===aal2Claims.session_id?[]:[aal1Claims.session_id!]");
    expect(real).toContain("for(const sessionId of directRpcSessions)");
    expect(real).toContain("action:'revoke',sessionId");
    expect(real).toContain("afterDirectDevices.body?.count===1");
    expect(real).toContain("devices.body?.count===2");
    expect(direct).not.toMatch(/console\.(?:log|error).*token|process\.env\.SUPABASE_SECRET/);
  });
  it('pins direct Supabase Storage positive and negative AAL2 owner controls',()=>{
    expect(direct).toContain("newStoragePath('financial-provider-assets')");
    expect(direct).toContain("newStoragePath('recurring-service-assets')");
    expect(direct).toContain("const svgBytes=Buffer.from(");
    expect(direct).toContain("const inserted=await storageRequest('POST',aal2Token,fixture)");
    expect(direct).toContain("[200,201].includes(inserted.status)&&await storageExists(fixture)");
    expect(direct).toContain("await assertDeniedStorage('owner AAL1',aal1Token)");
    expect(direct).toContain("await assertDeniedStorage('nonowner AAL2',nonownerAal2)");
    expect(direct).toContain("await assertDeniedStorage('revoked owner AAL2',aal2Token)");
    expect(direct).toContain("const deniedInsert=await storageRequest('POST',token,candidate)");
    expect(direct).toContain("assert(!(await storageExists(candidate))");
    expect(direct).toContain("const deniedDelete=await storageRequest('DELETE',token,fixture)");
    expect(direct).toContain("assert(await storageExists(fixture)");
    expect(direct).toContain("for(const fixture of syntheticStoragePaths)");
    expect(direct).toContain("const response=await storageRequest('DELETE',serviceRole,fixture)");
    expect(direct).toContain("assert(!(await storageExists(fixture))");
    expect(direct).toContain("apikey:token===serviceRole?serviceRole:publishable");
    expect(direct).toContain("apiUrl+'/storage/v1/object/list/'+fixture.bucket");
    expect(direct.indexOf("await assertDeniedStorage('nonowner AAL2',nonownerAal2)"))
      .toBeLessThan(direct.indexOf("const revokedDevice=await fetch"));
    expect(direct.indexOf("await assertDeniedStorage('revoked owner AAL2',aal2Token)"))
      .toBeGreaterThan(direct.indexOf("const revokedDevice=await fetch"));
  });
  it('enforces direct real-JWT provider SELECT RLS for AAL1, nonowner AAL2 and revoked AAL2',()=>{
    expect(direct).toContain("apiUrl+'/rest/v1/rheomiq_financial_providers?'+query");
    expect(direct).toContain("authorization:'Bearer '+token");
    expect(direct).toContain('const ownerCatalog=await selectProvider(aal2Token)');
    expect(direct).toContain("ownerCatalog.body[0]?.active===true");
    expect(direct).toContain("['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]");
    expect(direct).toContain('const deniedProvider=await selectProvider(token,protectedProviderId)');
    expect(direct).toContain('deniedProvider.body.length===0');
    expect(direct).toContain('const revokedProviderRead=await selectProvider(aal2Token,protectedProviderId)');
    expect(direct).toContain('revokedProviderRead.body.length===0');
    expect(direct.indexOf('const ownerCatalog=await selectProvider(aal2Token)'))
      .toBeLessThan(direct.indexOf('const revokedDevice=await fetch'));
    expect(direct.indexOf('const revokedProviderRead=await selectProvider(aal2Token,protectedProviderId)'))
      .toBeGreaterThan(direct.indexOf('const revokedDevice=await fetch'));
  });
  it('proves asset registry direct SELECT RLS with a real owner-registered Storage-backed row',()=>{
    expect(direct).toContain("apiUrl+'/rest/v1/rheomiq_financial_provider_assets?'+query");
    expect(direct).toContain('const registeredAssetStorage=newStoragePath(');
    expect(direct).toContain('const registeredAssetKey=registeredAssetStorage.path');
    expect(direct).toContain("const storedAsset=await storageRequest('POST',aal2Token,registeredAssetStorage)");
    expect(direct).toContain("const registered=await rpc('rheomiq_register_financial_provider_asset',aal2Token,{");
    expect(direct).toContain("p_make_primary:false");
    expect(direct).toContain("const ownerAssetRead=await selectProviderAsset(aal2Token,registeredAssetKey)");
    expect(direct).toContain("ownerAssetRead.body[0]?.storage_path===registeredAssetStorage.path");
    expect(direct).toContain("const deniedAssetRead=await selectProviderAsset(token,registeredAssetKey)");
    expect(direct).toContain("deniedAssetRead.body.length===0");
    expect(direct).toContain("const revokedAssetRead=await selectProviderAsset(aal2Token,registeredAssetKey)");
    expect(direct).toContain("revokedAssetRead.body.length===0");
    expect(direct).toContain('for(const assetKey of syntheticRegisteredAssets)');
    expect(direct).toContain("rows.every((row:{asset_key?:unknown})=>row.asset_key===assetKey)");
    expect(direct.indexOf("const registered=await rpc('rheomiq_register_financial_provider_asset',aal2Token,{"))
      .toBeLessThan(direct.indexOf("const deniedAssetRead=await selectProviderAsset(token,registeredAssetKey)"));
    expect(direct.indexOf("const revokedAssetRead=await selectProviderAsset(aal2Token,registeredAssetKey)"))
      .toBeGreaterThan(direct.indexOf('const revokedDevice=await fetch'));
    expect(direct.indexOf('for(const assetKey of syntheticRegisteredAssets)'))
      .toBeLessThan(direct.indexOf('for(const fixture of syntheticStoragePaths)'));
  });
  it('proves direct recurring service asset SELECT owner/AAL2 RLS with a real Storage-backed registry row',()=>{
    expect(direct).toContain("apiUrl+'/rest/v1/rheomiq_recurring_service_assets?'+query");
    expect(direct).toContain("const recurringStorage=protectedStorage.find(fixture=>fixture.bucket==='recurring-service-assets')");
    expect(direct).toContain("const registeredRecurring=await rpc('rheomiq_register_recurring_service_asset',aal2Token,{");
    expect(direct).toContain("registeredRecurring.body[0]?.owner_user_id===userId");
    expect(direct).toContain("const ownerRecurringRead=await selectRecurringAsset(aal2Token,recurringAssetKey)");
    expect(direct).toContain("ownerRecurringRead.body[0]?.storage_path===recurringStorage.path");
    expect(direct).toContain("const deniedRecurringRead=await selectRecurringAsset(token,recurringAssetKey)");
    expect(direct).toContain('deniedRecurringRead.body.length===0');
    expect(direct).toContain("const revokedRecurringRead=await selectRecurringAsset(aal2Token,recurringAssetKey)");
    expect(direct).toContain('revokedRecurringRead.body.length===0');
    expect(direct).toContain('for(const assetKey of syntheticRegisteredRecurringAssets)');
    expect(direct).toContain("rows.every((row:{owner_user_id?:unknown;asset_key?:unknown})=>");
    expect(direct.indexOf("const registeredRecurring=await rpc('rheomiq_register_recurring_service_asset',aal2Token,{"))
      .toBeLessThan(direct.indexOf("const deniedRecurringRead=await selectRecurringAsset(token,recurringAssetKey)"));
    expect(direct.indexOf("const revokedRecurringRead=await selectRecurringAsset(aal2Token,recurringAssetKey)"))
      .toBeGreaterThan(direct.indexOf('const revokedDevice=await fetch'));
    expect(direct.indexOf('for(const assetKey of syntheticRegisteredRecurringAssets)'))
      .toBeLessThan(direct.indexOf('for(const fixture of syntheticStoragePaths)'));
  });
  it('also denies every metadata, provider and Storage registry RPC to a revoked AAL2 owner session',()=>{
    expect(direct).toContain('const protectedMetadataMutations=[');
    expect(direct).toContain('for(const entry of protectedMetadataMutations){');
    expect(direct).toContain('const denied=await rpc(entry.method,aal2Token,entry.params)');
    expect(direct).toContain("denied.status===403&&String(denied.body?.code)==='42501'");
    expect(direct).toContain("'Revoked owner AAL2 retained direct '+entry.method+' mutation access.");
    expect(direct.indexOf('const denied=await rpc(entry.method,aal2Token,entry.params)'))
      .toBeGreaterThan(direct.indexOf('const revokedDevice=await fetch'));
    expect(direct).toContain("await assertDeniedStorage('revoked owner AAL2',aal2Token)");
    expect(direct).toContain("method:'rheomiq_register_financial_provider_asset'");
    expect(direct).toContain("method:'rheomiq_set_financial_provider_asset_binding'");
    expect(direct).toContain("method:'rheomiq_upsert_account_metadata'");
  });
  it('rejects direct provider metadata create/update by nonowner and AAL1 at the real RPC boundary',()=>{
    expect(direct).toContain("method:'rheomiq_create_financial_provider'");
    expect(direct).toContain("method:'rheomiq_update_financial_provider'");
    expect(direct).toContain("p_provider_kind:'bank',p_country_code:'GR',p_sort_order:42");
    expect(direct).toContain("['owner AAL1',aal1Token],['nonowner AAL2',nonownerAal2]");
    expect(direct).toContain("denied.status===403&&denied.body?.code==='42501'");
    expect(direct).toContain("await register(nonownerClaims.session_id!,nonownerUserId)");
  });
});
