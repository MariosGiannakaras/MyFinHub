import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I19.04 provider catalog read-back recovery',()=>{
  it.each(['malformed-extra-provider','duplicate-provider-id'] as const)(
    'rejects a 200 catalog with %s instead of silently publishing an incomplete provider list',async failure=>{
      const record={
        id:'qa-valid-recovered-bank',displayName:'QA Valid Bank',shortName:'QA Valid',
        providerKind:'bank',countryCode:'GR',sortOrder:109,
        logoAssetKey:null,wordmarkAssetKey:null,logoUrl:null,wordmarkUrl:null,
        assets:[],bindings:[],
      };
      const operations:string[]=[];
      let damaged=true;
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const method=(init?.method||'GET').toUpperCase();
        operations.push(method+' '+String(input));
        expect(method).toBe('GET');
        const records=damaged?[record,failure==='malformed-extra-provider'?{id:'qa-broken-without-required-fields'}:{...record}]:[record];
        damaged=false;
        return new Response(JSON.stringify({providers:records}),{status:200,headers:{'content-type':'application/json'}});
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const {refreshFinancialProviders,getFinancialProviderSnapshot}=await import(clientPath) as {
        refreshFinancialProviders:(force?:boolean)=>Promise<{loaded:boolean;loading:boolean;error:string|null;providers:Array<{id:string}>}>;
        getFinancialProviderSnapshot:()=>{error:string|null};
      };
      const bad=await refreshFinancialProviders(true);
      expect(bad).toMatchObject({loaded:true,loading:false});
      expect(bad.error).toBeTruthy();
      expect(bad.providers.some(row=>row.id===record.id)).toBe(false);
      expect(getFinancialProviderSnapshot().error).toBeTruthy();

      const recovered=await refreshFinancialProviders(true);
      expect(recovered.error).toBeNull();
      expect(recovered.providers.map(row=>row.id)).toContain(record.id);
      expect(recovered.providers.filter(row=>row.id===record.id)).toHaveLength(1);
      expect(operations).toHaveLength(2);
      expect(operations.every(row=>row.startsWith('GET '))).toBe(true);
    }
  );

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

  it.each([
    ['empty provider receipt',{}],
    ['different provider receipt',{id:'another-bank',displayName:'QA Receipt Bank',shortName:'QA Receipt',providerKind:'bank',countryCode:'GR',sortOrder:111}],
    ['stale metadata receipt',{id:'qa-receipt-bank',displayName:'Previous Name',shortName:'QA Receipt',providerKind:'bank',countryCode:'GR',sortOrder:111}],
  ])('never treats HTTP 200 with %s as a verified provider write',async(_case,provider)=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const method=(init?.method||'GET').toUpperCase();
      operations.push(method+' '+String(input));
      if(method!=='POST')throw new Error('An unverified receipt must not trigger catalog readback or asset writes');
      return new Response(JSON.stringify({provider}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const activityPath:string='../src/lib/databaseSaveActivity.js';
    const {saveFinancialProvider}=await import(clientPath) as {
      saveFinancialProvider:(input:{id:string;displayName:string;shortName:string;providerKind:'bank';countryCode:string;sortOrder:number},refresh?:boolean)=>Promise<unknown>;
    };
    const {getDatabaseSaveSnapshot}=await import(activityPath) as {
      getDatabaseSaveSnapshot:()=>{pending:number;failed:boolean;completion:number};
    };
    const before=getDatabaseSaveSnapshot().completion;
    await expect(saveFinancialProvider({
      id:'qa-receipt-bank',displayName:'QA Receipt Bank',shortName:'QA Receipt',
      providerKind:'bank',countryCode:'GR',sortOrder:111
    })).rejects.toThrow(/δεν επιβεβαιώθηκε με έγκυρη απόκριση/);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toContain('POST /api/account-metadata?resource=financial-providers');
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:before});
  });

  it('requires the confirmed PATCH receipt to match the exact edited provider fields before reporting success',async()=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET').toUpperCase()+' '+String(input));
      return new Response(JSON.stringify({provider:{
        id:'qa-edited-bank',displayName:'QA Edited Bank',shortName:'QA Edited',
        providerKind:'bank',countryCode:'GR',sortOrder:123
      }}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {updateFinancialProvider}=await import(clientPath) as {
      updateFinancialProvider:(input:{id:string;displayName:string;shortName:string;providerKind:'bank';countryCode:string;sortOrder:number},refresh?:boolean)=>Promise<{id:string;displayName:string}>;
    };
    const confirmed=await updateFinancialProvider({
      id:'qa-edited-bank',displayName:'QA Edited Bank',shortName:'QA Edited',
      providerKind:'bank',countryCode:'gr',sortOrder:123
    },false);
    expect(confirmed).toMatchObject({id:'qa-edited-bank',displayName:'QA Edited Bank'});
    expect(operations).toHaveLength(1);
    expect(operations[0]).toContain('PATCH /api/account-metadata?resource=financial-providers');
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

  it.each([
    ['missing asset receipt',{}],
    ['foreign asset',{asset:{assetKey:'wrong-brand-asset-123456abcdef',role:'logo',variant:'universal',fileName:'logo.png',mimeType:'image/png',sizeBytes:2,url:'https://assets.example/brand.png'}}],
    ['incorrect file length',{asset:{assetKey:'qa-brand-asset-123456abcdef',role:'logo',variant:'universal',fileName:'logo.png',mimeType:'image/png',sizeBytes:3,url:'https://assets.example/brand.png'}}],
  ])('rejects HTTP 200 with %s and does not automatically upload another binary',async(_label,receipt)=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET')+' '+String(input));
      return new Response(JSON.stringify(receipt),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {uploadFinancialProviderAsset,UnverifiedFinancialProviderWrite}=await import(clientPath);
    await expect(uploadFinancialProviderAsset({
      providerId:'qa-brand',role:'logo',variant:'universal',
      file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false,
    })).rejects.toBeInstanceOf(UnverifiedFinancialProviderWrite);
    expect(operations).toHaveLength(1);
    expect(operations[0]).toContain('PUT /api/account-metadata?resource=financial-provider-assets');
  });

  it('accepts a matching asset receipt with one binary upload',async()=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET')+' '+String(input));
      return new Response(JSON.stringify({asset:{
        assetKey:'qa-brand-asset-123456abcdef',role:'logo',variant:'universal',
        fileName:'logo.png',mimeType:'image/png',sizeBytes:2,url:'https://assets.example/brand.png',
      }}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {uploadFinancialProviderAsset}=await import(clientPath);
    const asset=await uploadFinancialProviderAsset({
      providerId:'qa-brand',role:'logo',variant:'universal',
      file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false,
    });
    expect(asset.assetKey).toBe('qa-brand-asset-123456abcdef');
    expect(operations).toHaveLength(1);
  });

  it.each([{}, {ok:false}, {ok:'true'}])(
    'rejects unverified HTTP 200 slot binding receipt %j',async(receipt)=>{
      const operations:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        operations.push((init?.method||'GET')+' '+String(input));
        return new Response(JSON.stringify(receipt),{status:200,headers:{'content-type':'application/json'}});
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const {setFinancialProviderAssetBinding,UnverifiedFinancialProviderWrite}=await import(clientPath);
      await expect(setFinancialProviderAssetBinding({
        providerId:'qa-brand',role:'logo',variant:'universal',assetKey:'qa-brand-asset-123456abcdef',refreshCatalog:false,
      })).rejects.toBeInstanceOf(UnverifiedFinancialProviderWrite);
      expect(operations).toHaveLength(1);
      expect(operations[0]).toContain('PUT /api/account-metadata?resource=financial-provider-asset-binding');
    }
  );

  it('accepts only explicit {ok:true} binding acknowledgement, once',async()=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET')+' '+String(input));
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {setFinancialProviderAssetBinding}=await import(clientPath);
    await setFinancialProviderAssetBinding({providerId:'qa-brand',role:'logo',variant:'universal',assetKey:null,refreshCatalog:false});
    expect(operations).toHaveLength(1);
  });

});
