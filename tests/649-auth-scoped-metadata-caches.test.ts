import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(()=>{
  vi.resetModules();
  vi.stubGlobal('window',new EventTarget());
});
afterEach(()=>vi.unstubAllGlobals());

const iso='2026-11-19T21:45:00Z';
const acc=(id:string)=>({accountId:id,iban:null,revision:1,updatedAt:iso});
const provider=(id:string)=>({
  id,displayName:id,shortName:'Owner',providerKind:'bank',countryCode:'GR',sortOrder:2,
  logoAssetKey:null,wordmarkAssetKey:null,logoUrl:null,wordmarkUrl:null,assets:[],bindings:[],
});
const asset=(key:string)=>({
  assetKey:key,recurringId:'service',fileName:'mark.png',mimeType:'image/png',sizeBytes:20,
  url:'https://example.supabase.co/storage/v1/object/public/recurring-service-assets/services/'+key+'.png',
  updatedAt:iso,
});
const path=(scope:'iban'|'provider'|'service')=>scope==='iban'?
  '../src/lib/accountMetadataClient.js':scope==='provider'?
    '../src/lib/financialProviderClient.js':'../src/lib/recurringServiceAssetClient.js';
describe('#649 I22.02 owner-scoped metadata caches and stale-read provenance',()=>{
  it.each([
    'rheomiq:auth-expired','rheomiq:mfa-required',
    'myfinhub:auth-completed','myfinhub:auth-scope-reset',
  ] as const)('invalidates IBAN/custom providers/recurring images and discards older GET on %s',async boundary=>{
    const oldKey='service-asset-aaaaaaaaaaaaaaaaaaaaaaaa';
    const newKey='service-asset-bbbbbbbbbbbbbbbbbbbbbbbb';
    const scopes=['iban','provider','service'] as const;
    for(const scope of scopes){
      // Each dynamic import owns an independent authoritative snapshot.
      const initial=scope==='iban'?{records:[acc('before')]}:
        scope==='provider'?{providers:[provider('before')]}:{assets:[asset(oldKey)]};
      const latest=scope==='iban'?{records:[acc('after')]}:
        scope==='provider'?{providers:[provider('after')]}:{assets:[asset(newKey)]};
      let resolveOld:(response:Response)=>void=()=>{};
      const older=new Promise<Response>(resolve=>{resolveOld=resolve});
      let count=0;
      const calls:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');
        calls.push(method);
        if(++count===1)return older;
        return new Response(JSON.stringify(latest),{status:200,headers:{'content-type':'application/json'}});
      }));
      // Avoid importing all clients at test module initialization; ensure
      // each store observes the window EventTarget installed above.
      const target:string=path(scope);
      const client=await import(target);
      const refresh=scope==='iban'?client.refreshAccountMetadata:
        scope==='provider'?client.refreshFinancialProviders:client.refreshRecurringServiceAssets;
      const get=scope==='iban'?client.getAccountMetadataSnapshot:
        scope==='provider'?client.getFinancialProviderSnapshot:client.getRecurringServiceAssetSnapshot;
      const stale=refresh(true);
      (window as EventTarget).dispatchEvent(new Event(boundary));
      const cleared=get();
      if(scope==='iban')expect(Object.keys(cleared.records)).toHaveLength(0);
      if(scope==='provider')expect(cleared.providers.some((r:{id:string})=>r.id==='before')).toBe(false);
      if(scope==='service')expect(cleared.assets).toEqual([]);
      const fresh=await refresh(true);
      expect(fresh.error).toBeNull();
      resolveOld(new Response(JSON.stringify(initial),{status:200,headers:{'content-type':'application/json'}}));
      await stale;
      const current=get();
      if(scope==='iban')expect(Object.keys(current.records)).toEqual(['after']);
      if(scope==='provider')expect(current.providers.map((r:{id:string})=>r.id)).toEqual(['after']);
      if(scope==='service')expect(current.assets.map((r:{assetKey:string})=>r.assetKey)).toEqual([newKey]);
      expect(calls).toEqual(['GET','GET']);
    }
  });
  it('wires successful logout and unverified anonymous session into the cache-reset contract',()=>{
    const hook=readFileSync(new URL('../src/hooks/useSession.ts',import.meta.url),'utf8');
    const watch=readFileSync(new URL('../src/lib/authScopedCache.ts',import.meta.url),'utf8');
    expect(hook).toContain("window.dispatchEvent(new Event('myfinhub:auth-scope-reset'))");
    expect(hook).toContain("window.dispatchEvent(new Event('myfinhub:auth-completed'))");
    for(const name of [
      'rheomiq:auth-expired','rheomiq:mfa-required',
      'myfinhub:auth-completed','myfinhub:auth-scope-reset',
    ])expect(watch).toContain(name);
    const workflow=readFileSync(new URL('../.github/workflows/fb-focused-rendered-qa.yml',import.meta.url),'utf8');
    expect(workflow).toContain('<!-- run-649-recurring-asset-qa -->');
    expect(workflow).toContain("'recurring-service-brand'");
  });
});
