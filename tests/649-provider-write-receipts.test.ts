import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  writeFinancialProvider, updateFinancialProvider, setFinancialProviderAssetBinding,
} from '../server/accountMetadataStore.js';

const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
  if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;
});
function config(){
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';
}
const input=()=>({
  id:'owner-bank',displayName:'Owner Bank',shortName:'Owner',
  providerKind:'bank' as const,countryCode:'GR',sortOrder:42,
});
const row=()=>({
  id:'owner-bank',display_name:'Owner Bank',short_name:'Owner',
  provider_kind:'bank',country_code:'GR',sort_order:42,
  logo_asset_key:null,wordmark_asset_key:null,active:true,
});
describe('#649 I19.04 exact provider write and binding receipts',()=>{
  it.each([
    'valid-create','valid-update','empty-receipt','duplicate-receipt',
    'wrong-id','wrong-display','wrong-short','wrong-kind','wrong-country',
    'wrong-order','inactive-create','inactive-update','missing-active','malformed-row',
  ] as const)('does not accept a false-green provider RPC for %s',async scenario=>{
    config();
    const receipt:Record<string,unknown>={...row()};
    if(scenario==='wrong-id')receipt.id='other-bank';
    if(scenario==='wrong-display')receipt.display_name='Other Bank';
    if(scenario==='wrong-short')receipt.short_name='Wrong';
    if(scenario==='wrong-kind')receipt.provider_kind='wallet';
    if(scenario==='wrong-country')receipt.country_code='US';
    if(scenario==='wrong-order')receipt.sort_order=43;
    if(scenario==='inactive-create'||scenario==='inactive-update')receipt.active=false;
    if(scenario==='missing-active')delete receipt.active;
    if(scenario==='malformed-row')receipt.sort_order='42';
    const data=scenario==='empty-receipt'?[]:scenario==='duplicate-receipt'?[receipt,{...receipt}]:[receipt];
    const calls:Array<{url:string;method:string;body:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
      calls.push({url:String(request),method:String(init?.method??'GET'),body:String(init?.body??'')});
      return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
    }));
    const update=scenario==='valid-update'||scenario==='inactive-update';
    const act=update?updateFinancialProvider:writeFinancialProvider;
    if(scenario.startsWith('valid')){
      await expect(act(input(),'owner-jwt')).resolves.toMatchObject({
        id:'owner-bank',displayName:'Owner Bank',shortName:'Owner',providerKind:'bank',
        countryCode:'GR',sortOrder:42,
      });
    }else{
      await expect(act(input(),'owner-jwt')).rejects.toMatchObject({
        status:scenario==='malformed-row'?500:503,
        code:scenario==='malformed-row'?'FINANCIAL_PROVIDER_INVALID_ROW':'FINANCIAL_PROVIDER_WRITE_UNVERIFIED',
      });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/rpc/rheomiq_'+(update?'update':'create')+'_financial_provider');
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_id:'owner-bank',p_display_name:'Owner Bank',p_short_name:'Owner',
      p_provider_kind:'bank',p_country_code:'GR',p_sort_order:42,
    });
  });

  it.each([
    'valid-assign','valid-clear','missing-assignment','stale-key',
    'extra-row','unexpected-clear-row','malformed-response','readback-unavailable',
  ] as const)('verifies idempotent provider image binding for %s with one GET after RPC',async scenario=>{
    config();
    const key='owner-bank-asset-aabbccddeeff';
    const binding={provider_id:'owner-bank',asset_role:'logo',variant:'light',asset_key:key};
    const clear=scenario==='valid-clear'||scenario==='unexpected-clear-row';
    const rows=scenario==='valid-assign'||scenario==='unexpected-clear-row'?[binding]:
      scenario==='extra-row'?[binding,{...binding}]:
        scenario==='stale-key'?[{...binding,asset_key:'old-key'}]:
          scenario==='malformed-response'?{}:scenario==='readback-unavailable'?
            []:[];
    const calls:Array<{url:string;method:string;body:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(request),method=String(init?.method??'GET');
      calls.push({url,method,body:String(init?.body??'')});
      if(url.includes('/rpc/rheomiq_set_financial_provider_asset_binding'))
        return new Response('null',{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/rpc/rheomiq_is_owner_aal2'))
        return new Response('true',{status:200,headers:{'content-type':'application/json'}});
      if(!url.includes('/rheomiq_financial_provider_asset_bindings?'))
        throw new Error('Unexpected binding request');
      if(scenario==='readback-unavailable')
        return new Response('{}',{status:503,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json'}});
    }));
    const call=setFinancialProviderAssetBinding({
      providerId:'owner-bank',role:'logo',variant:'light',assetKey:clear?null:key,
    },'owner-jwt');
    if(scenario==='valid-assign'||scenario==='valid-clear')
      await expect(call).resolves.toBeUndefined();
    else
      await expect(call).rejects.toMatchObject({
        status:503,code:scenario==='readback-unavailable'
          ?'ACCOUNT_METADATA_UNAVAILABLE':'FINANCIAL_PROVIDER_BINDING_UNVERIFIED',
      });
    expect(calls.map(x=>x.method)).toEqual(
      scenario==='valid-assign'||scenario==='valid-clear'
        ?['POST','GET','POST']:['POST','GET']);
    if(calls.length===3)expect(calls[2]?.url).toContain('/rpc/rheomiq_is_owner_aal2');
    expect(calls[1]?.url).toContain('provider_id=eq.owner-bank');
    expect(calls[1]?.url).toContain('asset_role=eq.logo');
    expect(calls[1]?.url).toContain('variant=eq.light');
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_provider_id:'owner-bank',p_asset_role:'logo',p_variant:'light',p_asset_key:clear?null:key,
    });
  });

  it.each([
    'lost-503-assignment','lost-network-clear','missing-assignment',
    'stale-binding','malformed-readback','readback-unavailable',
    'revoked-owner','owner-check-unavailable','definite-forbidden',
  ] as const)('reconciles an uncertain provider binding $scenario without replaying its RPC',async scenario=>{
    config();
    const key='owner-bank-asset-aabbccddeeff';
    const clear=scenario==='lost-network-clear'||scenario==='stale-binding';
    const binding={provider_id:'owner-bank',asset_role:'logo',variant:'light',asset_key:key};
    const calls:Array<{url:string;method:string;body:string}>=[];
    vi.stubGlobal('fetch',vi.fn(async(req:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(req),method=String(init?.method??'GET');
      calls.push({url,method,body:String(init?.body??'')});
      if(url.includes('/rpc/rheomiq_set_financial_provider_asset_binding')){
        if(scenario==='lost-network-clear')throw new TypeError('Synthetic lost postcommit acknowledgement');
        if(scenario==='definite-forbidden')
          return new Response(JSON.stringify({code:'42501',message:'FORBIDDEN'}),{status:403});
        return new Response(JSON.stringify({message:'Write receipt lost'}),{status:503});
      }
      if(url.includes('/rpc/rheomiq_is_owner_aal2')){
        if(scenario==='owner-check-unavailable')return new Response('{}',{status:503});
        return new Response(scenario==='revoked-owner'?'false':'true',{status:200});
      }
      if(url.includes('/rheomiq_financial_provider_asset_bindings?')){
        if(scenario==='readback-unavailable')return new Response('{}',{status:503});
        const rows=scenario==='missing-assignment'?[]:
          scenario==='stale-binding'?[binding]:
            scenario==='malformed-readback'?{}:
              clear?[]:[binding];
        return new Response(JSON.stringify(rows),{status:200});
      }
      throw new Error('Unexpected call '+method+' '+url);
    }));
    const action=setFinancialProviderAssetBinding({
      providerId:'owner-bank',role:'logo',variant:'light',assetKey:clear?null:key,
    },'owner-jwt');
    if(scenario==='lost-503-assignment'||scenario==='lost-network-clear')
      await expect(action).resolves.toBeUndefined();
    else await expect(action).rejects.toMatchObject({
      status:scenario==='definite-forbidden'?403:503,
      code:scenario==='definite-forbidden'?'FORBIDDEN':'FINANCIAL_PROVIDER_BINDING_UNVERIFIED',
    });
    const matchesReadback=['lost-503-assignment','lost-network-clear','revoked-owner','owner-check-unavailable'];
    const expected=scenario==='definite-forbidden'?['POST']:
      matchesReadback.includes(scenario)?['POST','GET','POST']:['POST','GET'];
    expect(calls.map(x=>x.method)).toEqual(expected);
    expect(calls.filter(x=>x.url.includes('/rpc/rheomiq_set_financial_provider_asset_binding'))).toHaveLength(1);
    if(calls.length>1){
      expect(calls[1]?.url).toContain('provider_id=eq.owner-bank');
      expect(calls[1]?.url).toContain('asset_role=eq.logo');
      expect(calls[1]?.url).toContain('variant=eq.light');
    }
    if(calls.length>2)expect(calls[2]?.url).toContain('/rpc/rheomiq_is_owner_aal2');
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_provider_id:'owner-bank',p_asset_role:'logo',p_variant:'light',p_asset_key:clear?null:key,
    });
  });


  it.each([
    'ack200-revoked','ack503-revoked','ack200-unavailable',
    'ack200-malformed','ack200-true','ack503-true',
  ] as const)('never treats RLS-hidden empty binding as confirmed clear: %s',async scenario=>{
    config();
    const calls:Array<{url:string;method:string;authorization:string|null}>=[];
    vi.stubGlobal('fetch',vi.fn(async(req:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(req),method=String(init?.method??'GET');
      calls.push({url,method,authorization:new Headers(init?.headers).get('authorization')});
      if(url.includes('/rpc/rheomiq_set_financial_provider_asset_binding'))
        return new Response(scenario.startsWith('ack503')?'{"message":"ambiguous"}':'null',{
          status:scenario.startsWith('ack503')?503:200,headers:{'content-type':'application/json'}});
      if(url.includes('/rheomiq_financial_provider_asset_bindings?'))
        return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
      if(url.includes('/rpc/rheomiq_is_owner_aal2')){
        if(scenario.endsWith('unavailable'))return new Response('{}',{status:503});
        return new Response(scenario.endsWith('malformed')?'"true"':
          scenario.endsWith('revoked')?'false':'true',{status:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('Unexpected provider binding request: '+url);
    }));
    const outcome=setFinancialProviderAssetBinding({
      providerId:'owner-bank',role:'logo',variant:'light',assetKey:null,
    },'owner-jwt');
    if(scenario.endsWith('true'))await expect(outcome).resolves.toBeUndefined();
    else await expect(outcome).rejects.toMatchObject({
      status:503,code:'FINANCIAL_PROVIDER_BINDING_UNVERIFIED',
    });
    expect(calls.map(x=>x.method)).toEqual(['POST','GET','POST']);
    expect(calls[2]?.url).toContain('/rpc/rheomiq_is_owner_aal2');
    expect(calls.filter(x=>x.url.includes('rheomiq_set_financial_provider_asset_binding'))).toHaveLength(1);
    expect(calls.every(x=>x.authorization==='Bearer owner-jwt')).toBe(true);
  });

  it.each([
    'create-503-committed','update-network-committed',
    'owner-revoked','owner-unavailable','missing-row','duplicate-row',
    'wrong-id','wrong-display','wrong-short','wrong-kind','wrong-country',
    'wrong-order','malformed-row','readback-unavailable',
    'inactive-provider-record','inactive-update-network','missing-active-column','invalid-active-column',
    'definite-conflict','definite-invalid','definite-forbidden',
  ] as const)('reconciles lost provider metadata acknowledgement for %s with no replay',async scenario=>{
    config();
    const intended=row();
    const captured:Array<{url:string;method:string;body:string;authorization:string|null;apiKey:string|null}>=[];
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(request),method=String(init?.method??'GET');
      const headers=new Headers(init?.headers);
      captured.push({url,method,body:String(init?.body??''),
        authorization:headers.get('authorization'),apiKey:headers.get('apikey')});
      if(url.includes('/rpc/rheomiq_create_financial_provider')||
        url.includes('/rpc/rheomiq_update_financial_provider')){
        if(scenario==='update-network-committed'||scenario==='inactive-update-network')
          throw new TypeError('Synthetic committed response lost');
        if(scenario==='definite-conflict')
          return new Response(JSON.stringify({code:'23505',message:'PROVIDER_ID_CONFLICT'}),{status:409});
        if(scenario==='definite-invalid')
          return new Response(JSON.stringify({code:'22023',message:'INVALID_PROVIDER_ID'}),{status:400});
        if(scenario==='definite-forbidden')
          return new Response(JSON.stringify({code:'42501',message:'MFA_REQUIRED'}),{status:403});
        return new Response('{}',{status:503});
      }
      if(url.includes('/rpc/rheomiq_is_owner_aal2')){
        if(scenario==='owner-unavailable')return new Response('{}',{status:503});
        return new Response(scenario==='owner-revoked'?'false':'true',{status:200});
      }
      if(url.includes('/rheomiq_financial_providers?')){
        if(scenario==='readback-unavailable')return new Response('{}',{status:503});
        const record:Record<string,unknown>={...intended};
        if(scenario==='wrong-id')record.id='other-provider';
        if(scenario==='wrong-display')record.display_name='Other Bank';
        if(scenario==='wrong-short')record.short_name='Other';
        if(scenario==='wrong-kind')record.provider_kind='wallet';
        if(scenario==='wrong-country')record.country_code='US';
        if(scenario==='wrong-order')record.sort_order=43;
        if(scenario==='malformed-row')record.sort_order='42';
        if(scenario==='inactive-provider-record'||scenario==='inactive-update-network')record.active=false;
        if(scenario==='missing-active-column')delete record.active;
        if(scenario==='invalid-active-column')record.active='true';
        const records=scenario==='missing-row'?[]:
          scenario==='duplicate-row'?[record,{...record}]:[record];
        return new Response(JSON.stringify(records),{status:200});
      }
      throw new Error('Unexpected provider reconciliation endpoint '+url);
    }));
    const call=scenario==='update-network-committed'||scenario==='inactive-update-network'
      ?updateFinancialProvider:writeFinancialProvider;
    const saved=call(input(),'owner-jwt');
    if(scenario==='create-503-committed'||scenario==='update-network-committed')
      await expect(saved).resolves.toMatchObject({
        id:'owner-bank',displayName:'Owner Bank',shortName:'Owner',
        providerKind:'bank',countryCode:'GR',sortOrder:42,
      });
    else await expect(saved).rejects.toMatchObject({
      status:scenario==='definite-conflict'?409:scenario==='definite-invalid'?400:
        scenario==='definite-forbidden'?403:503,
      code:scenario==='definite-conflict'?'PROVIDER_ID_CONFLICT':
        scenario==='definite-invalid'?'INVALID_PROVIDER_DATA':
          scenario==='definite-forbidden'?'FORBIDDEN':'FINANCIAL_PROVIDER_WRITE_UNVERIFIED',
    });
    const expected=scenario.startsWith('definite-')?['POST']:
      scenario==='owner-revoked'||scenario==='owner-unavailable'?['POST','POST']:
        ['POST','POST','GET'];
    expect(captured.map(x=>x.method)).toEqual(expected);
    expect(captured.filter(x=>/rpc\/rheomiq_(create|update)_financial_provider/.test(x.url))).toHaveLength(1);
    expect(captured.every(x=>x.authorization==='Bearer owner-jwt'&&x.apiKey==='test-public-key')).toBe(true);
    expect(JSON.parse(captured[0]?.body??'{}')).toMatchObject({
      p_id:'owner-bank',p_display_name:'Owner Bank',p_short_name:'Owner',
      p_provider_kind:'bank',p_country_code:'GR',p_sort_order:42,
    });
    if(expected.includes('GET')){
      expect(captured[2]?.url).toContain('id=eq.owner-bank');
      expect(captured[2]?.url).toContain('select=id,display_name,short_name,provider_kind,country_code,sort_order,logo_asset_key,wordmark_asset_key,active');
      expect(captured[2]?.url).toContain('active=eq.true');
    }
  });
});
