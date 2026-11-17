import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I19.04 provider catalog read-back recovery',()=>{
  it('keeps an acknowledged provider catalog unverified on 503 and verifies it on a later GET without replaying writes',async()=>{
    const requests:string[]=[];
    let failReadBack=true;
    const fetchMock=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const address=String(input);
      const method=(init?.method||'GET').toUpperCase();
      requests.push(method+' '+address);
      expect(method).toBe('GET');
      expect(address).toContain('/api/account-metadata?resource=financial-providers');
      if(failReadBack){
        failReadBack=false;
        return new Response(JSON.stringify({error:'Synthetic 503 after acknowledged provider writes'}),{status:503,headers:{'content-type':'application/json'}});
      }
      return new Response(JSON.stringify({providers:[{
        id:'qa-verified-bank',displayName:'QA Verified Bank',shortName:'QA Bank',
        providerKind:'bank',countryCode:'GR',sortOrder:100,logoAssetKey:null,
        wordmarkAssetKey:null,logoUrl:null,wordmarkUrl:null,assets:[],bindings:[]
      }]}),{status:200,headers:{'content-type':'application/json'}});
    });
    vi.stubGlobal('fetch',fetchMock);
    // Resolve at runtime: the NodeNext test-hygiene project must not pull the
    // browser/Vite-only provider module into its static TypeScript dependency graph.
    type CatalogSnapshot={loaded:boolean;loading:boolean;error:string|null;providers:Array<{id:string}>};
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {getFinancialProviderSnapshot,refreshFinancialProviders}=await import(clientPath) as {
      getFinancialProviderSnapshot:()=>CatalogSnapshot;
      refreshFinancialProviders:(force?:boolean)=>Promise<CatalogSnapshot>;
    };
    const unverified=await refreshFinancialProviders(true);
    expect(unverified.loaded).toBe(true);
    expect(unverified.loading).toBe(false);
    expect(unverified.error).toBeTruthy();
    expect(unverified.providers.some(item=>item.id==='qa-verified-bank')).toBe(false);
    expect(getFinancialProviderSnapshot().error).toBeTruthy();

    const recovered=await refreshFinancialProviders(true);
    expect(recovered.loaded).toBe(true);
    expect(recovered.loading).toBe(false);
    expect(recovered.error).toBeNull();
    expect(recovered.providers.map(item=>item.id)).toContain('qa-verified-bank');
    expect(getFinancialProviderSnapshot()).toBe(recovered);
    expect(requests).toHaveLength(2);
    expect(requests.every(item=>item.startsWith('GET '))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('separates an acknowledged metadata POST from a failed catalog GET and recovers by read only',async()=>{
    const requests:Array<{method:string;url:string;body:string|null}>=[];
    let reads=0;
    const record={
      id:'qa-partial-bank',displayName:'QA Partial Bank',shortName:'QA Partial',
      providerKind:'bank' as const,countryCode:'GR',sortOrder:101
    };
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=(init?.method||'GET').toUpperCase();
      requests.push({method,url,body:typeof init?.body==='string'?init.body:null});
      expect(url).toContain('/api/account-metadata?resource=financial-providers');
      if(method==='POST'){
        expect(JSON.parse(String(init?.body))).toMatchObject(record);
        return new Response(JSON.stringify({provider:record}),{status:200,headers:{'content-type':'application/json'}});
      }
      expect(method).toBe('GET');
      reads++;
      if(reads===1)return new Response(JSON.stringify({error:'Catalog read-back unavailable'}),{status:503,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({providers:[{
        ...record,logoAssetKey:null,wordmarkAssetKey:null,logoUrl:null,wordmarkUrl:null,
        assets:[],bindings:[]
      }]}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const activityPath:string='../src/lib/databaseSaveActivity.js';
    type CatalogSnapshot={loaded:boolean;loading:boolean;error:string|null;providers:Array<{id:string}>};
    const {saveFinancialProvider,refreshFinancialProviders,getFinancialProviderSnapshot}=await import(clientPath) as {
      saveFinancialProvider:(value:typeof record)=>Promise<typeof record>;
      refreshFinancialProviders:(force?:boolean)=>Promise<CatalogSnapshot>;
      getFinancialProviderSnapshot:()=>CatalogSnapshot;
    };
    const {getDatabaseSaveSnapshot}=await import(activityPath) as {
      getDatabaseSaveSnapshot:()=>{pending:number;failed:boolean;completion:number};
    };
    const before=getDatabaseSaveSnapshot().completion;
    const acknowledged=await saveFinancialProvider(record);
    expect(acknowledged.id).toBe(record.id);
    const unverified=getFinancialProviderSnapshot();
    expect(unverified.error).toBeTruthy();
    expect(unverified.providers.some(provider=>provider.id===record.id)).toBe(false);
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:before+1});
    expect(requests.map(x=>x.method)).toEqual(['POST','GET']);
    const recovered=await refreshFinancialProviders(true);
    expect(recovered.error).toBeNull();
    expect(recovered.providers.map(provider=>provider.id)).toContain(record.id);
    expect(requests.map(x=>x.method)).toEqual(['POST','GET','GET']);
    expect(getDatabaseSaveSnapshot().completion).toBe(before+1);
  });

  it('fails closed on an ambiguous metadata POST 503 without retrying or reporting a completed write',async()=>{
    const requests:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requests.push((init?.method||'GET').toUpperCase()+' '+String(input));
      return new Response(JSON.stringify({error:'Ambiguous upstream write failure'}),{
        status:503,headers:{'content-type':'application/json'}
      });
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const activityPath:string='../src/lib/databaseSaveActivity.js';
    const {saveFinancialProvider}=await import(clientPath) as {
      saveFinancialProvider:(value:{id:string;displayName:string;shortName:string;providerKind:'bank';countryCode:string;sortOrder:number})=>Promise<unknown>;
    };
    const {getDatabaseSaveSnapshot}=await import(activityPath) as {
      getDatabaseSaveSnapshot:()=>{pending:number;failed:boolean;completion:number};
    };
    const before=getDatabaseSaveSnapshot().completion;
    await expect(saveFinancialProvider({
      id:'qa-ambiguous-bank',displayName:'QA Ambiguous Bank',shortName:'QA Ambiguous',
      providerKind:'bank',countryCode:'GR',sortOrder:102
    })).rejects.toThrow();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('POST /api/account-metadata?resource=financial-providers');
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:before});
  });

});
