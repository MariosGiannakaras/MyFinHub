import { afterEach, describe, expect, it, vi } from 'vitest';

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
});
