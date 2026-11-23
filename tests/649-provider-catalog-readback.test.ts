import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I19.04 provider catalog read-back recovery',()=>{

  it('serializes same-slot provider binary uploads and permits independent slots',async()=>{
    const operations:string[]=[];
    let finishFirst:(response:Response)=>void=()=>{throw new Error('First PUT missing')};
    vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');
      operations.push(method+' '+String(url));
      if(method!=='PUT')throw new Error('Unexpected provider readback');
      if(operations.length===1)return new Promise<Response>(resolve=>{finishFirst=resolve});
      return new Response(JSON.stringify({error:'Invalid binary'}),{status:400});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {uploadFinancialProviderAsset}=await import(clientPath);
    const data={providerId:'qa-binary-slot-bank',role:'logo' as const,variant:'light',
      file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false};
    const first=uploadFinancialProviderAsset(data);
    expect(operations).toHaveLength(1);
    await expect(uploadFinancialProviderAsset(data)).rejects.toMatchObject({name:'FinancialProviderAssetUploadInProgress'});
    expect(operations).toHaveLength(1);
    await expect(uploadFinancialProviderAsset({...data,variant:'dark'}))
      .rejects.not.toMatchObject({name:'FinancialProviderAssetUploadInProgress'});
    expect(operations).toHaveLength(2);
    finishFirst(new Response(JSON.stringify({error:'Invalid binary'}),{status:400}));
    await expect(first).rejects.not.toMatchObject({name:'UnverifiedFinancialProviderWrite'});
    await expect(uploadFinancialProviderAsset(data)).rejects.not.toMatchObject({name:'FinancialProviderAssetUploadInProgress'});
    expect(operations.map(value=>value.split(' ',1)[0])).toEqual(['PUT','PUT','PUT']);
  });

  it('does not let a retired provider PUT clear the new session in-flight slot',async()=>{
    const scopeWindow=new EventTarget();
    vi.stubGlobal('window',scopeWindow);
    let finishOld:(response:Response)=>void=()=>{throw new Error('Old PUT missing')};
    let finishFresh:(response:Response)=>void=()=>{throw new Error('Fresh PUT missing')};
    let sent=0;
    vi.stubGlobal('fetch',vi.fn(async()=>{
      sent++;
      if(sent===1)return new Promise<Response>(resolve=>{finishOld=resolve});
      if(sent===2)return new Promise<Response>(resolve=>{finishFresh=resolve});
      return new Response(JSON.stringify({error:'Invalid binary'}),{status:400});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {uploadFinancialProviderAsset}=await import(clientPath);
    const data={providerId:'qa-binary-slot-bank',role:'logo' as const,variant:'light',
      file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false};
    const old=uploadFinancialProviderAsset(data);
    scopeWindow.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
    const fresh=uploadFinancialProviderAsset(data);
    expect(sent).toBe(2);
    finishOld(new Response(JSON.stringify({error:'Old committed outcome uncertain'}),{status:503}));
    await expect(old).rejects.toMatchObject({name:'UnverifiedFinancialProviderWrite',operation:'asset'});
    await expect(uploadFinancialProviderAsset(data)).rejects.toMatchObject({name:'FinancialProviderAssetUploadInProgress'});
    expect(sent).toBe(2);
    finishFresh(new Response(JSON.stringify({error:'Invalid binary'}),{status:400}));
    await expect(fresh).rejects.not.toMatchObject({name:'UnverifiedFinancialProviderWrite'});
    await expect(uploadFinancialProviderAsset(data)).rejects.not.toMatchObject({name:'FinancialProviderAssetUploadInProgress'});
    expect(sent).toBe(3);
  });


  it.each(['create','update','asset','binding'] as const)(
    'does not accept a late %s receipt from a retired owner auth scope',async scenario=>{
      const scopeWindow=new EventTarget();
      vi.stubGlobal('window',scopeWindow);
      const operations:string[]=[];
      const input={
        id:'qa-scope-bank',displayName:'QA Scope Bank',shortName:'QA Scope',
        providerKind:'bank' as const,countryCode:'GR',sortOrder:117,
      };
      vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
        operations.push((init?.method??'GET')+' '+String(request));
        // The first store can commit, but its receipt arrives after a new
        // authentication scope begins. There must be no catalog GET or retry.
        scopeWindow.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
        const payload=scenario==='asset'?{asset:{
          assetKey:'qa-scope-bank-asset-112233aabbcc',role:'logo',variant:'light',
          fileName:'logo.png',mimeType:'image/png',sizeBytes:2,
          url:'https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-scope-bank/qa-scope-bank-asset-112233aabbcc.png?v=2026-11-23',
        }}:scenario==='binding'?{ok:true}:{provider:input};
        return new Response(JSON.stringify(payload),{
          status:200,headers:{'content-type':'application/json'},
        });
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const {
        saveFinancialProvider,updateFinancialProvider,
        uploadFinancialProviderAsset,setFinancialProviderAssetBinding,
      }=await import(clientPath);
      const action=scenario==='create'?saveFinancialProvider(input,false):
        scenario==='update'?updateFinancialProvider(input,false):
          scenario==='asset'?uploadFinancialProviderAsset({
            providerId:input.id,role:'logo',variant:'light',
            file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),
            refreshCatalog:false,
          }):setFinancialProviderAssetBinding({
            providerId:input.id,role:'logo',variant:'light',
            assetKey:'qa-scope-bank-asset-112233aabbcc',refreshCatalog:false,
          });
      await expect(action).rejects.toMatchObject({
        name:'UnverifiedFinancialProviderWrite',
        operation:scenario==='create'||scenario==='update'?'metadata':scenario,
      });
      expect(operations).toHaveLength(1);
      expect(operations[0]).toContain('/api/account-metadata?resource=');
    },
  );

  it('rejects a provider metadata write when auth scope changes during catalog readback',async()=>{
    const scopeWindow=new EventTarget();
    vi.stubGlobal('window',scopeWindow);
    const input={
      id:'qa-scope-bank',displayName:'QA Scope Bank',shortName:'QA Scope',
      providerKind:'bank' as const,countryCode:'GR',sortOrder:117,
    };
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');
      operations.push(method+' '+String(request));
      if(method==='POST')
        return new Response(JSON.stringify({provider:input}),{status:200});
      if(method==='GET'){
        scopeWindow.dispatchEvent(new Event('myfinhub:auth-completed'));
        return new Response(JSON.stringify({providers:[{
          ...input,logoAssetKey:null,wordmarkAssetKey:null,
          logoUrl:null,wordmarkUrl:null,assets:[],bindings:[],
        }]}),{status:200});
      }
      throw new Error('No speculative provider replay');
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {saveFinancialProvider}=await import(clientPath);
    await expect(saveFinancialProvider(input)).rejects.toMatchObject({
      name:'UnverifiedFinancialProviderWrite',operation:'metadata',
    });
    expect(operations.map(value=>value.split(' ',1)[0])).toEqual(['POST','GET']);
  });

  it('confirms the exact uploaded key set, not just equal counts and existing catalog objects',async()=>{
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {providerCatalogMatchesWrite}=await import(clientPath);
    const primaryKey='qa-receipt-bank-asset-aaaaaaaaaaaa';
    const otherKey='qa-receipt-bank-asset-bbbbbbbbbbbb';
    const input={
      id:'qa-receipt-bank',displayName:'QA Receipt Bank',shortName:'QA Receipt',
      providerKind:'bank' as const,countryCode:'GR',sortOrder:124,
    };
    const expected={
      assetKey:primaryKey,role:'logo' as const,variant:'light' as const,
      fileName:'logo.png',mimeType:'image/png',sizeBytes:2,
      url:'https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-receipt-bank/qa-receipt-bank-asset-aaaaaaaaaaaa.png?v=2026-11-23',
    };
    const other={...expected,assetKey:otherKey,fileName:'other.png',sizeBytes:3,
      url:'https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-receipt-bank/qa-receipt-bank-asset-bbbbbbbbbbbb.png?v=2026-11-23'};
    const catalog={
      loaded:true,loading:false,error:null,providers:[{
        id:input.id,displayName:input.displayName,shortName:input.shortName,
        kind:'bank',countryCode:'GR',sortOrder:124,
        assets:[expected,other],
        bindings:[{role:'logo',variant:'light',assetKey:primaryKey}],
      }],
    };
    const slots=[{role:'logo',variant:'light',assetKey:primaryKey}];
    expect(providerCatalogMatchesWrite(catalog,input,slots,[primaryKey],[expected])).toBe(true);
    // A genuine pair of distinct uploads may be returned in either order.
    expect(providerCatalogMatchesWrite(catalog,input,slots,[otherKey,primaryKey],[expected,other])).toBe(true);
    // Both keys exist, and both array lengths match: this must still fail.
    expect(providerCatalogMatchesWrite(catalog,input,slots,[otherKey],[expected])).toBe(false);
    // Duplicate acknowledged keys cannot prove two independent uploads.
    expect(providerCatalogMatchesWrite(catalog,input,slots,[primaryKey,primaryKey],[expected,other])).toBe(false);
  });

  it.each(['asset','binding'] as const)(
    'rejects a %s success after owner auth changes while catalog GET is in flight',async scenario=>{
      const scopeWindow=new EventTarget();
      vi.stubGlobal('window',scopeWindow);
      const key='qa-scope-bank-asset-112233aabbcc';
      const asset={
        assetKey:key,role:'logo',variant:'light',fileName:'logo.png',
        mimeType:'image/png',sizeBytes:2,url:'https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-scope-bank/qa-scope-bank-asset-112233aabbcc.png?v=2026-11-23',
      };
      const operations:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');
        operations.push(method+' '+String(request));
        if(method==='PUT'){
          return new Response(JSON.stringify(scenario==='asset'?{asset}:{ok:true}),{
            status:200,headers:{'content-type':'application/json'},
          });
        }
        if(method==='GET'){
          // The readback itself is well formed. Its response belongs to the
          // retired session and cannot validate a write in the new scope.
          scopeWindow.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
          return new Response(JSON.stringify({providers:[{
            id:'qa-scope-bank',displayName:'QA Scope Bank',shortName:'QA Scope',
            providerKind:'bank',countryCode:'GR',sortOrder:117,
            logoAssetKey:null,wordmarkAssetKey:null,logoUrl:null,wordmarkUrl:null,
            assets:[asset],
            bindings:[{role:'logo',variant:'light',assetKey:key}],
          }]}),{status:200,headers:{'content-type':'application/json'}});
        }
        throw new Error('No speculative provider retry');
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const {uploadFinancialProviderAsset,setFinancialProviderAssetBinding}=await import(clientPath);
      const action=scenario==='asset'
        ?uploadFinancialProviderAsset({
          providerId:'qa-scope-bank',role:'logo',variant:'light',
          file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),
        })
        :setFinancialProviderAssetBinding({
          providerId:'qa-scope-bank',role:'logo',variant:'light',assetKey:key,
        });
      await expect(action).rejects.toMatchObject({
        name:'UnverifiedFinancialProviderWrite',operation:scenario,
      });
      expect(operations.map(value=>value.split(' ',1)[0])).toEqual(['PUT','GET']);
    },
  );

  it.each([false,true] as const)(
    'preserves binding transport semantics after network loss (retired auth=%s)',async retired=>{
      const scopeWindow=new EventTarget();
      vi.stubGlobal('window',scopeWindow);
      const operations:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL,init?:RequestInit)=>{
        operations.push(String(init?.method??'GET')+' '+String(request));
        if(retired)scopeWindow.dispatchEvent(new Event('rheomiq:auth-expired'));
        throw new TypeError('Synthetic lost binding response');
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const {setFinancialProviderAssetBinding}=await import(clientPath);
      const operation=setFinancialProviderAssetBinding({
        providerId:'qa-scope-bank',role:'logo',variant:'light',
        assetKey:'qa-scope-bank-asset-112233aabbcc',refreshCatalog:false,
      });
      if(retired){
        await expect(operation).rejects.toMatchObject({
          name:'UnverifiedFinancialProviderWrite',operation:'binding',
        });
      }else{
        await expect(operation).rejects.toMatchObject({
          name:'ApiError',status:0,code:'NETWORK_ERROR',
        });
      }
      expect(operations).toHaveLength(1);
      expect(operations[0]).toContain('PUT /api/account-metadata?resource=financial-provider-asset-binding');
    },
  );

  it('skips acknowledged provider metadata on asset-only retry but detects every changed field',async()=>{
    // Keep the runtime import dynamic: the NodeNext hygiene check does not
    // resolve the browser-only provider client's extensionless imports.
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {providerMetadataMatchesInput}=await import(clientPath);
    const payload={
      id:'qa-metadata-bank',displayName:' QA Bank ',shortName:' QA ',
      providerKind:'bank' as const,countryCode:'gr',sortOrder:105,
    };
    expect(providerMetadataMatchesInput(null,payload)).toBe(false);
    expect(providerMetadataMatchesInput({...payload,displayName:'QA Bank',shortName:'QA',countryCode:'GR'},payload)).toBe(true);
    for(const changed of [
      {id:'other-bank'}, {displayName:'Changed'}, {shortName:'Changed'},
      {providerKind:'wallet' as const},{countryCode:'US'},{sortOrder:106},
    ])expect(providerMetadataMatchesInput({...payload,...changed},payload)).toBe(false);
    const editor=readFileSync(new URL('../src/components/FinancialProviderManagementSettings.tsx',import.meta.url),'utf8');
    expect(editor).toContain('acknowledgedMetadata:FinancialProviderWriteInput|null');
    expect(editor).toContain('if(!providerMetadataMatchesInput(editor.acknowledgedMetadata,payload))');
    expect(editor).toContain("...current,source:'existing',acknowledgedMetadata:payload");
    expect(editor).toContain("if(editor.source==='new')await saveFinancialProvider(payload,false)");
    expect(editor).toContain('else await updateFinancialProvider(payload,false)');
    expect(editor).toContain('metadataCommitted=true');
    expect(editor).toContain('acknowledgedMetadata:null,pendingAssets:[]');
  });


  it('stages the genuine 1440/375px failed-catalog, no-edit and read-only recovery browser proof',()=>{
    const qa=readFileSync(new URL('../scripts/provider-brand-management-qa.mjs',import.meta.url),'utf8');
    const client=readFileSync(new URL('../src/lib/financialProviderClient.ts',import.meta.url),'utf8');
    expect(client).toContain("QA_MODE&&new URLSearchParams(location.search).has('qaProviderCatalogFallback')");
    expect(client).toContain("error:QA_CATALOG_FAILURE?");
    expect(qa).toContain("fallbackUrl.searchParams.set('qaProviderCatalogFallback','1')");
    expect(qa).toContain("'provider-catalog-fallback-blocked-desktop'");
    expect(qa).toContain("'provider-catalog-fallback-blocked-mobile'");
    expect(qa).toContain("'provider-catalog-recovered-mobile'");
    expect(qa).toContain("blockedCatalog.alert==='alert'&&blockedCatalog.error&&blockedCatalog.newDisabled&&blockedCatalog.editDisabled");
    expect(qa).toContain("'read-only catalog recovery re-enables real provider editing'");
  });
  it('blocks catalog edits during fallback/error and permits only an explicit read-only recovery',()=>{
    const owner=readFileSync(new URL('../src/components/FinancialProviderManagementSettings.tsx',import.meta.url),'utf8');
    expect(owner).toContain('const catalogUnavailable=!catalog.loaded||catalog.loading||Boolean(catalog.error)');
    expect(owner).toContain('mutationInFlight.current||requiresCatalogReview||catalogUnavailable||!validateDetails()');
    expect(owner).toContain('disabled={busy||catalogUnavailable} onClick={openNew}');
    expect(owner).toContain('disabled={busy||catalogUnavailable} onClick={()=>openEdit(provider)}');
    expect(owner).toContain('disabled={busy||requiresCatalogReview||catalogUnavailable} onClick={()=>void save()}');
    expect(owner).toContain('catalog.error?<OperationFeedback tone="error"');
    expect(owner).toContain('onClick={()=>void refreshFinancialProviders(true)}');
    expect(owner).toContain('Η δημιουργία και επεξεργασία έχουν απενεργοποιηθεί');
  });
  it.each(['duplicate-asset-key','duplicate-binding-slot','object-assets','object-bindings','null-assets','null-bindings','missing-assets','missing-bindings'] as const)(
    'rejects a superficially successful catalog with %s and recovers with GET only',async failure=>{
      const asset={
        assetKey:'qa-integrity-asset-aabbccddee11',role:'logo' as const,
        variant:'universal',url:'https://assets.example/logo.png',
        fileName:'logo.png',mimeType:'image/png',sizeBytes:2,
      };
      const binding={role:'logo' as const,variant:'universal' as const,assetKey:asset.assetKey};
      const record={
        id:'qa-integrity-bank',displayName:'QA Integrity Bank',shortName:'QA Integrity',
        providerKind:'bank',countryCode:'GR',sortOrder:119,
        logoAssetKey:null,wordmarkAssetKey:null,logoUrl:null,wordmarkUrl:null,
        assets:[asset],bindings:[binding],
      };
      const corrupted=failure==='duplicate-asset-key'
        ?{...record,assets:[asset,{...asset,variant:'dark'}]}
        :failure==='duplicate-binding-slot'
          ?{...record,bindings:[binding,{...binding,assetKey:'qa-integrity-asset-other'}]}
          :failure==='object-assets'
            ?{...record,assets:{...asset}}
            :failure==='object-bindings'
              ?{...record,bindings:{...binding}}
              :failure==='null-assets'
                ?{...record,assets:null}
                :failure==='null-bindings'
                  ?{...record,bindings:null}
                  :failure==='missing-assets'
                    ?{...record,assets:undefined}
                    :{...record,bindings:undefined};
      const operations:string[]=[];
      let reads=0;
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const method=(init?.method||'GET').toUpperCase();
        operations.push(method+' '+String(input));
        expect(method).toBe('GET');
        return new Response(JSON.stringify({providers:[reads++===0?corrupted:record]}),{
          status:200,headers:{'content-type':'application/json'},
        });
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const {refreshFinancialProviders}=await import(clientPath) as {
        refreshFinancialProviders:(force?:boolean)=>Promise<{error:string|null;providers:Array<{id:string}>}>;
      };
      const invalid=await refreshFinancialProviders(true);
      expect(invalid.error).toBeTruthy();
      expect(invalid.providers.some(row=>row.id===record.id)).toBe(false);
      const recovered=await refreshFinancialProviders(true);
      expect(recovered.error).toBeNull();
      expect(recovered.providers.filter(row=>row.id===record.id)).toHaveLength(1);
      expect(operations).toHaveLength(2);
      expect(operations.every(operation=>operation.startsWith('GET '))).toBe(true);
    }
  );

  it.each([
    'orphaned-binding','orphaned-primary-logo','orphaned-primary-wordmark',
    'text-size-bytes','fractional-size-bytes','text-sort-order','null-sort-order',
  ] as const)('fails closed for %s in a complete HTTP-200 provider catalog without replaying writes',async failure=>{
    const asset={
      assetKey:'qa-integrity-asset-aabbccddee11',role:'logo' as const,
      variant:'universal',url:'https://assets.example/logo.png',
      fileName:'logo.png',mimeType:'image/png',sizeBytes:2,
    };
    const record={
      id:'qa-integrity-bank',displayName:'QA Integrity Bank',shortName:'QA Integrity',
      providerKind:'bank',countryCode:'GR',sortOrder:119,
      logoAssetKey:null as string|null,wordmarkAssetKey:null as string|null,
      logoUrl:null,wordmarkUrl:null,
      assets:[asset],bindings:[{role:'logo' as const,variant:'universal' as const,assetKey:asset.assetKey}],
    };
    const absentKey='qa-integrity-asset-001122334455';
    const corrupted:Record<string,unknown>=failure==='orphaned-binding'
      ?{...record,bindings:[{...record.bindings[0],assetKey:absentKey}]}
      :failure==='orphaned-primary-logo'
        ?{...record,logoAssetKey:absentKey}
        :failure==='orphaned-primary-wordmark'
          ?{...record,wordmarkAssetKey:absentKey}
          :failure==='text-size-bytes'
            ?{...record,assets:[{...asset,sizeBytes:'2'}]}
            :failure==='fractional-size-bytes'
              ?{...record,assets:[{...asset,sizeBytes:2.5}]}
              :failure==='text-sort-order'
                ?{...record,sortOrder:'119'}
                :{...record,sortOrder:null};
    let reads=0;
    const methods:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async (_input:RequestInfo|URL,init?:RequestInit)=>{
      const method=(init?.method??'GET').toUpperCase();
      methods.push(method);
      expect(method).toBe('GET');
      return new Response(JSON.stringify({providers:[reads++===0?corrupted:record]}),{
        status:200,headers:{'content-type':'application/json'},
      });
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {refreshFinancialProviders}=await import(clientPath) as {
      refreshFinancialProviders:(force?:boolean)=>Promise<{
        error:string|null;providers:Array<{id:string}>;
      }>;
    };
    const rejected=await refreshFinancialProviders(true);
    expect(rejected.error).toBeTruthy();
    expect(rejected.providers.some(row=>row.id===record.id)).toBe(false);
    const recovered=await refreshFinancialProviders(true);
    expect(recovered.error).toBeNull();
    expect(recovered.providers.filter(row=>row.id===record.id)).toHaveLength(1);
    expect(methods).toEqual(['GET','GET']);
  });

  it('accepts one same-provider image reused as logo and wordmark without weakening orphan rejection',async()=>{
    const key='qa-reuse-asset-aabbccddee11';
    const asset={
      assetKey:key,role:'logo',variant:'universal',url:'https://assets.example/logo.png',
      fileName:'shared-logo.png',mimeType:'image/png',sizeBytes:42,
    };
    const record={
      id:'qa-reuse-bank',displayName:'QA Reuse Bank',shortName:'QA Reuse',
      providerKind:'bank',countryCode:'GR',sortOrder:119,
      logoAssetKey:key,wordmarkAssetKey:key,
      logoUrl:asset.url,wordmarkUrl:asset.url,
      assets:[asset],bindings:[
        {role:'logo',variant:'universal',assetKey:key},
        {role:'wordmark',variant:'universal',assetKey:key},
      ],
    };
    const requests:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requests.push(String(init?.method??'GET')+' '+String(input));
      return new Response(JSON.stringify({providers:[record]}),{
        status:200,headers:{'content-type':'application/json'},
      });
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {refreshFinancialProviders}=await import(clientPath);
    const snapshot=await refreshFinancialProviders(true);
    expect(snapshot).toMatchObject({loaded:true,loading:false,error:null});
    expect(snapshot.providers.find((provider:{id:string})=>provider.id===record.id)).toMatchObject({
      logoAssetKey:key,wordmarkAssetKey:key,
      bindings:[{role:'logo',assetKey:key},{role:'wordmark',assetKey:key}],
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^GET /);
  });

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
    })).rejects.toMatchObject({name:'UnverifiedFinancialProviderWrite',operation:'metadata'});
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

  it.each([
    ['other-provider-directory',(url:string):string=>url.replace('/providers/qa-brand/','/providers/other-bank/')],
    ['different-asset-key',(url:string):string=>url.replace('qa-brand-asset-123456abcdef','qa-brand-asset-ffffffffffff')],
    ['other-storage-bucket',(url:string):string=>url.replace('/financial-provider-assets/','/recurring-service-assets/')],
    ['wrong-mime-extension',(url:string):string=>url.replace('.png?','.svg?')],
    ['unrelated-legacy-image',(_url:string):string=>'https://assets.example/legacy-unrelated.png'],
    ['nested-path',(url:string):string=>url.replace('/providers/qa-brand/','/providers/qa-brand/nested/')],
  ] as const)('rejects a forged HTTP-200 provider upload URL for %s without binding or replay',async(_label,change)=>{
    const calls:string[]=[];
    const valid='https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-brand/qa-brand-asset-123456abcdef.png?v=2026-11-23';
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      calls.push((init?.method??'GET')+' '+String(input));
      return new Response(JSON.stringify({asset:{
        assetKey:'qa-brand-asset-123456abcdef',role:'logo',variant:'universal',
        fileName:'logo.png',mimeType:'image/png',sizeBytes:2,url:change(valid),
      }}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {uploadFinancialProviderAsset}=await import(clientPath);
    await expect(uploadFinancialProviderAsset({
      providerId:'qa-brand',role:'logo',variant:'universal',
      file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false,
    })).rejects.toMatchObject({name:'UnverifiedFinancialProviderWrite',operation:'asset'});
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('PUT /api/account-metadata?resource=financial-provider-assets');
  });

  it('accepts a matching asset receipt with one binary upload',async()=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET')+' '+String(input));
      return new Response(JSON.stringify({asset:{
        assetKey:'qa-brand-asset-123456abcdef',role:'logo',variant:'universal',
        fileName:'logo.png',mimeType:'image/png',sizeBytes:2,url:'https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-brand/qa-brand-asset-123456abcdef.png?v=2026-11-23',
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

  it('requires complete durable provider metadata, registered assets and all intended slots after an acknowledged write',async()=>{
    const modulePath:string='../src/lib/financialProviderClient.js';
    const {providerCatalogMatchesWrite}=await import(modulePath) as {
      providerCatalogMatchesWrite:(snapshot:unknown,input:unknown,slots:unknown[],uploads:string[],expectedUploads?:Array<{assetKey:string;role:string;variant:string;fileName:string;mimeType:string;sizeBytes:number}>)=>boolean;
    };
    const input={
      id:'qa-checked',displayName:'QA Checked Bank',shortName:'QA Checked',
      providerKind:'bank',countryCode:'GR',sortOrder:126,
    };
    const assetKey='qa-checked-asset-aabbccddeeff';
    const asset={
      assetKey,role:'logo',variant:'universal',url:'https://assets.example/storage/v1/object/public/financial-provider-assets/providers/qa-checked/qa-checked-asset-aabbccddeeff.svg?v=2026-11-23',
      fileName:'checked.svg',mimeType:'image/svg+xml',sizeBytes:51,
    };
    const provider={
      id:input.id,displayName:input.displayName,shortName:input.shortName,
      kind:'bank',kindLabel:'Τράπεζα',countryCode:'GR',sortOrder:input.sortOrder,
      logoAssetKey:assetKey,wordmarkAssetKey:assetKey as string|null,
      assets:[asset],bindings:[
        {role:'logo',variant:'universal',assetKey},
        {role:'wordmark',variant:'universal',assetKey},
      ],
    };
    const slots:Array<{role:string;variant:string;assetKey:string|null}>=[
      {role:'logo',variant:'universal',assetKey},
      {role:'wordmark',variant:'universal',assetKey},
      {role:'card-mark',variant:'light',assetKey:null},
    ];
    const snapshot=(value:typeof provider|null,error:string|null=null)=>({
      loaded:true,loading:false,error,providers:value?[value]:[],
    });
    expect(providerCatalogMatchesWrite(snapshot(provider),input,slots,[assetKey])).toBe(true);
    const registeredBinary={assetKey,role:'logo',variant:'universal',fileName:'checked.svg',mimeType:'image/svg+xml',sizeBytes:51};
    expect(providerCatalogMatchesWrite(snapshot(provider),input,slots,[assetKey],[registeredBinary])).toBe(true);
    // New-key upload receipts must not turn a mismatched registry binary into
    // a full-green save merely because the identifier and slot are unchanged.
    for(const wrong of [
      {...registeredBinary,role:'wordmark'},
      {...registeredBinary,variant:'dark'},
      {...registeredBinary,fileName:'other.svg'},
      {...registeredBinary,mimeType:'image/png'},
      {...registeredBinary,sizeBytes:52},
      {...registeredBinary,assetKey:'unregistered-asset'},
    ]){
      expect(providerCatalogMatchesWrite(snapshot(provider),input,slots,[assetKey],[wrong])).toBe(false);
    }
    expect(providerCatalogMatchesWrite(snapshot(provider),input,slots,[assetKey],[])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot({...provider,assets:[{...asset,mimeType:'image/png'}]}),input,slots,[assetKey],[registeredBinary])).toBe(false);
    for(const wrongUrl of [
      asset.url.replace('/providers/qa-checked/','/providers/other-bank/'),
      asset.url.replace(assetKey,'qa-checked-asset-ffffffffffff'),
      asset.url.replace('/financial-provider-assets/','/recurring-service-assets/'),
      asset.url.replace('.svg?','.png?'),
      'https://assets.example/legacy-unrelated.svg',
    ])expect(providerCatalogMatchesWrite(snapshot({...provider,assets:[{...asset,url:wrongUrl}]}),input,slots,[assetKey],[registeredBinary])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot({...provider,displayName:'Stale Provider Name'}),input,slots,[assetKey])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot({...provider,sortOrder:1}),input,slots,[assetKey])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot(null),input,slots,[assetKey])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot(provider,'Unverified'),input,slots,[assetKey])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot({...provider,assets:[]}),input,slots,[assetKey])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot({...provider,bindings:provider.bindings.filter(row=>row.role!=='wordmark'),wordmarkAssetKey:null}),input,slots,[assetKey])).toBe(false);
    expect(providerCatalogMatchesWrite(snapshot(provider),input,slots,['unregistered-asset'])).toBe(false);
  });

  it.each([408,429,500,502,503])(
    'does not automatically replay an uncertain asset upload after HTTP %i',async status=>{
      const operations:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        operations.push((init?.method||'GET')+' '+String(input));
        return new Response(JSON.stringify({error:'Synthetic uncertain upstream outcome'}),{
          status,headers:{'content-type':'application/json'}
        });
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const activityPath:string='../src/lib/databaseSaveActivity.js';
      const {uploadFinancialProviderAsset,UnverifiedFinancialProviderWrite}=await import(clientPath);
      const {getDatabaseSaveSnapshot}=await import(activityPath);
      const before=getDatabaseSaveSnapshot().completion;
      await expect(uploadFinancialProviderAsset({
        providerId:'qa-brand',role:'logo',variant:'universal',
        file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false,
      })).rejects.toBeInstanceOf(UnverifiedFinancialProviderWrite);
      expect(operations).toHaveLength(1);
      expect(operations[0]).toContain('PUT /api/account-metadata?resource=financial-provider-assets');
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:before});
    }
  );

  it('treats a dropped upload connection as unverified, without retrying a fresh-key write',async()=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET')+' '+String(input));
      throw new TypeError('Synthetic network disconnect after request transmission');
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

  it('preserves a definite 403 asset rejection as a normal error, not an uncertain write',async()=>{
    const operations:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      operations.push((init?.method||'GET')+' '+String(input));
      return new Response(JSON.stringify({error:'FORBIDDEN'}),{
        status:403,headers:{'content-type':'application/json'}
      });
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {uploadFinancialProviderAsset,UnverifiedFinancialProviderWrite}=await import(clientPath);
    try{
      await uploadFinancialProviderAsset({
        providerId:'qa-brand',role:'logo',variant:'universal',
        file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'}),refreshCatalog:false,
      });
      throw new Error('Expected rejection');
    }catch(error){
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(UnverifiedFinancialProviderWrite);
      expect((error as Error).message).toContain('FORBIDDEN');
    }
    expect(operations).toHaveLength(1);
  });

  it.each(['POST','PATCH'] as const)(
    'treats a disconnected %s metadata write as uncertain rather than safe to replay',async method=>{
      const requests:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        requests.push((init?.method||'GET').toUpperCase()+' '+String(input));
        throw new TypeError('Response lost after request transmission');
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const activityPath:string='../src/lib/databaseSaveActivity.js';
      const {saveFinancialProvider,updateFinancialProvider,UnverifiedFinancialProviderWrite}=await import(clientPath);
      const {getDatabaseSaveSnapshot}=await import(activityPath);
      const before=getDatabaseSaveSnapshot().completion;
      const write=method==='POST'?saveFinancialProvider:updateFinancialProvider;
      try{
        await write({id:'qa-uncertain-bank',displayName:'Uncertain',shortName:'Uncertain',providerKind:'bank',countryCode:'GR',sortOrder:200},false);
        throw new Error('Expected uncertain metadata outcome');
      }catch(error){
        expect(error).toBeInstanceOf(UnverifiedFinancialProviderWrite);
        expect((error as InstanceType<typeof UnverifiedFinancialProviderWrite>).operation).toBe('metadata');
      }
      expect(requests).toHaveLength(1);
      expect(requests[0]).toContain(method+' /api/account-metadata?resource=financial-providers');
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:before});
    }
  );

  it.each(['POST','PATCH'] as const)(
    'blocks blind repeat of ambiguous %s metadata outcomes after HTTP 408/429/5xx',async method=>{
      for(const status of [408,429,503]){
        vi.resetModules();
        const requests:string[]=[];
        vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
          requests.push((init?.method||'GET').toUpperCase()+' '+String(input));
          return new Response(JSON.stringify({error:'Uncertain commit'}),{status,headers:{'content-type':'application/json'}});
        }));
        const clientPath:string='../src/lib/financialProviderClient.js';
        const activityPath:string='../src/lib/databaseSaveActivity.js';
        const {saveFinancialProvider,updateFinancialProvider,UnverifiedFinancialProviderWrite}=await import(clientPath);
        const {getDatabaseSaveSnapshot}=await import(activityPath);
        const before=getDatabaseSaveSnapshot().completion;
        const write=method==='POST'?saveFinancialProvider:updateFinancialProvider;
        try{
          await write({id:'qa-uncertain-bank',displayName:'Uncertain',shortName:'Uncertain',providerKind:'bank',countryCode:'GR',sortOrder:200},false);
          throw new Error('Expected uncertain metadata outcome');
        }catch(error){
          expect(error).toBeInstanceOf(UnverifiedFinancialProviderWrite);
          expect((error as InstanceType<typeof UnverifiedFinancialProviderWrite>).operation).toBe('metadata');
        }
        expect(requests).toHaveLength(1);
        expect(requests[0]).toContain(method+' /api/account-metadata?resource=financial-providers');
        expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:before});
      }
    }
  );

  it.each(['server-503','lost-connection'] as const)(
    'permits deliberate idempotent slot-binding retry after %s without automatically repeating the first attempt',async mode=>{
      const requests:Array<{method:string;url:string;body:string}>=[];
      let attempts=0;
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const method=(init?.method||'GET').toUpperCase(),url=String(input);
        const body=String(init?.body||'');
        requests.push({method,url,body});
        expect(method).toBe('PUT');
        expect(url).toContain('resource=financial-provider-asset-binding');
        attempts++;
        if(attempts===1){
          if(mode==='lost-connection')throw new TypeError('Response lost after binding PUT');
          return new Response(JSON.stringify({error:'Binding outcome uncertain'}),{status:503,headers:{'content-type':'application/json'}});
        }
        return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
      }));
      const clientPath:string='../src/lib/financialProviderClient.js';
      const activityPath:string='../src/lib/databaseSaveActivity.js';
      const {setFinancialProviderAssetBinding,UnverifiedFinancialProviderWrite}=await import(clientPath);
      const {getDatabaseSaveSnapshot}=await import(activityPath);
      const original=getDatabaseSaveSnapshot().completion;
      const input={providerId:'qa-uncertain-bank',role:'logo' as const,variant:'universal' as const,assetKey:'qa-uncertain-bank-asset-112233aabbcc',refreshCatalog:false};
      try{
        await setFinancialProviderAssetBinding(input);
        throw new Error('Expected failed first attempt');
      }catch(error){
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(UnverifiedFinancialProviderWrite);
      }
      expect(requests).toHaveLength(1);
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:true,completion:original});
      // Only a deliberate user-requested retry reissues this idempotent PUT.
      await setFinancialProviderAssetBinding(input);
      expect(requests).toHaveLength(2);
      expect(requests[0]).toEqual(requests[1]);
      expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:original+1});
    }
  );

  it('does not turn a definitive metadata 403 into an unverified commit',async()=>{
    const requests:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requests.push((init?.method||'GET').toUpperCase()+' '+String(input));
      return new Response(JSON.stringify({error:'FORBIDDEN'}),{status:403,headers:{'content-type':'application/json'}});
    }));
    const clientPath:string='../src/lib/financialProviderClient.js';
    const {saveFinancialProvider,UnverifiedFinancialProviderWrite}=await import(clientPath);
    await expect(saveFinancialProvider({
      id:'qa-denied-bank',displayName:'Denied',shortName:'Denied',providerKind:'bank',countryCode:'GR',sortOrder:201,
    },false)).rejects.not.toBeInstanceOf(UnverifiedFinancialProviderWrite);
    expect(requests).toEqual(['POST /api/account-metadata?resource=financial-providers']);
  });


});
