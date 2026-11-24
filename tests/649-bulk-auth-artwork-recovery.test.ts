import { readFileSync } from 'node:fs';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

const boundary=()=>window.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const deferred=<T>()=>{let resolve!:(value:T)=>void;let reject!:(reason:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}};
beforeEach(()=>{vi.resetModules();vi.stubGlobal('window',new EventTarget())});
afterEach(()=>{boundary();vi.unstubAllGlobals()});

describe('#649 consolidated finance/metadata session and artwork recovery',()=>{
  it.each([200,401,403,423])('rejects a retired JSON response (%i) after its body settles without expiring/locking the new workspace',async status=>{
    const body=deferred<unknown>(),entered=deferred<void>();
    const staleResponse=response({},status);
    vi.spyOn(staleResponse,'json').mockImplementation(async()=>{entered.resolve();return body.promise});
    const fetcher=vi.fn().mockResolvedValueOnce(staleResponse).mockImplementation(async()=>response({financeRevision:'19'}));
    vi.stubGlobal('fetch',fetcher);
    const api=await import('../src/lib/api.js');
    const events=vi.fn();
    for(const name of ['rheomiq:auth-expired','rheomiq:mfa-required','myfinhub:app-lock-now'])window.addEventListener(name,events);
    const stale=api.loadHistory();
    await entered.promise;
    boundary();
    await expect(api.loadHistory()).resolves.toMatchObject({financeRevision:'19'});
    body.resolve({financeRevision:'18',code:status===401?'AUTH_REQUIRED':status===403?'MFA_REQUIRED':'APP_LOCK_REQUIRED'});
    await expect(stale).rejects.toMatchObject({status:0,code:'AUTH_SCOPE_CHANGED'});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(events).not.toHaveBeenCalled();
  });
  it('keeps the current scope authorization event and error',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response({code:'DEVICE_ACCESS_REVOKED'},401)));
    const api=await import('../src/lib/api.js');
    const expired=vi.fn();window.addEventListener('rheomiq:auth-expired',expired);
    await expect(api.loadHistory()).rejects.toMatchObject({status:401,code:'DEVICE_ACCESS_REVOKED'});
    expect(expired).toHaveBeenCalledTimes(1);
  });
  it.each(['success','failure'] as const)('ignores old shared save %s while a fresh scope has a live write',async outcome=>{
    const {trackDatabaseWrite,getDatabaseSaveSnapshot}=await import('../src/lib/databaseSaveActivity.js');
    const old=deferred<number>(),fresh=deferred<number>();
    const retired=trackDatabaseWrite(()=>old.promise);
    boundary();
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:0});
    const current=trackDatabaseWrite(()=>fresh.promise);
    if(outcome==='success')old.resolve(1);else old.reject(new Error('old error'));
    await expect(retired).rejects.toThrow();
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:1,failed:false,completion:0});
    fresh.resolve(2);
    await expect(current).resolves.toBe(2);
    expect(getDatabaseSaveSnapshot()).toMatchObject({pending:0,failed:false,completion:1});
  });
  it('forces a provider read initiated after the older catalog request has settled',async()=>{
    const older=deferred<Response>(),calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      calls.push(String(init?.method??'GET'));
      if(calls.length===1)return older.promise;
      return response({providers:[{id:'qa-bank',displayName:'New',shortName:'New',providerKind:'bank',sortOrder:1,assets:[],bindings:[]}]});
    }));
    const provider=await import('../src/lib/financialProviderClient.js');
    const old=provider.refreshFinancialProviders();
    const fresh=provider.refreshFinancialProviders(true);
    older.resolve(response({providers:[{id:'qa-bank',displayName:'Old',shortName:'Old',providerKind:'bank',sortOrder:1,assets:[],bindings:[]}]}));
    await old;
    expect((await fresh).providers[0]?.displayName).toBe('New');
    expect(calls).toEqual(['GET','GET']);
  });
  it.each(['iban','provider','recurring'] as const)('does not dispatch a retired %s catalog GET from a synchronous loading subscriber',async kind=>{
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      calls.push(String(init?.method??'GET'));
      return response(kind==='iban'?{records:[]}:kind==='provider'?{providers:[{id:'qa-bank',displayName:'Fresh',shortName:'Fresh',providerKind:'bank',sortOrder:1,assets:[],bindings:[]}]}:{assets:[]});
    }));
    const iban=await import('../src/lib/accountMetadataClient.js');
    const provider=await import('../src/lib/financialProviderClient.js');
    const recurring=await import('../src/lib/recurringServiceAssetClient.js');
    const refresh=kind==='iban'?iban.refreshAccountMetadata:kind==='provider'?provider.refreshFinancialProviders:recurring.refreshRecurringServiceAssets;
    const get=kind==='iban'?iban.getAccountMetadataSnapshot:kind==='provider'?provider.getFinancialProviderSnapshot:recurring.getRecurringServiceAssetSnapshot;
    const subscribe=kind==='iban'?iban.subscribeAccountMetadata:kind==='provider'?provider.subscribeFinancialProviders:recurring.subscribeRecurringServiceAssets;
    let retired=false;
    const stop=subscribe(()=>{if(!retired&&get().loading){retired=true;boundary()}});
    try{await refresh(true)}finally{stop()}
    expect(retired).toBe(true);
    expect(calls).toEqual([]);
    expect(get().loaded).toBe(false);
    expect((await refresh(true)).error).toBeNull();
    expect(calls).toEqual(['GET']);
  });
  it.each(['upload','release'] as const)('requires recurring %s readback after an older GET, but never starts a new-scope GET from retired work',async kind=>{
    const client=await import('../src/lib/recurringServiceAssetClient.js');
    const key='service-asset-'+'a'.repeat(24);
    const asset={assetKey:key,recurringId:'qa-recurring',fileName:'logo.png',mimeType:'image/png',sizeBytes:2,
      updatedAt:'2026-11-24T00:00:00Z',url:'https://example.test/storage/v1/object/public/recurring-service-assets/services/'+key+'.png'};
    for(const retire of [false,true]){
      boundary();
      const older=deferred<Response>(),writeBody=deferred<unknown>(),entered=deferred<void>();
      const calls:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');calls.push(method);
        if(calls.length===1)return older.promise;
        if(calls.length===2){
          const receipt=response({});
          vi.spyOn(receipt,'json').mockImplementation(async()=>{entered.resolve();return writeBody.promise});
          return receipt;
        }
        if(method==='GET'&&!retire)return response({assets:kind==='upload'?[asset]:[]});
        throw new Error('Retired work must not issue another GET or write');
      }));
      const old=client.refreshRecurringServiceAssets(true);
      const action=kind==='upload'?client.uploadRecurringServiceAsset({recurringId:'qa-recurring',file:new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'})}):client.deleteRecurringServiceAsset(key);
      const settled=action.then(value=>({value}),error=>({error}));
      await entered.promise;
      writeBody.resolve(kind==='upload'?{asset}:{ok:true});
      // Allow the write receipt and pending-catalog continuation to settle.
      await new Promise(resolve=>setTimeout(resolve,0));
      if(retire)boundary();
      older.resolve(response({assets:kind==='upload'?[]:[asset]}));
      await old;
      const result=await settled;
      expect(calls).toEqual(retire?['GET',kind==='upload'?'PUT':'DELETE']:['GET',kind==='upload'?'PUT':'DELETE','GET']);
      if(retire)expect(result).toHaveProperty('error');
      else if(kind==='upload')expect(result).toMatchObject({value:asset});
      else expect(result).toEqual({value:undefined});
    }
  });
  it.each(['provider','recurring-upload','recurring-release'] as const)('excludes a competing %s tab and retains uncertainty until auth retirement (simulated Web Lock manager)',async kind=>{
    Object.defineProperty(window,'isSecureContext',{value:true});
    const held=new Set<string>();
    const request=vi.fn(async(name:string,options:{ifAvailable:boolean},work:(lock:object|null)=>Promise<unknown>)=>{
      expect(options.ifAvailable).toBe(true);
      if(held.has(name))return work(null);
      held.add(name);
      try{return await work({name})}finally{held.delete(name)}
    });
    vi.stubGlobal('navigator',{locks:{request}});
    const provider=await import('../src/lib/financialProviderClient.js');
    const recurring=await import('../src/lib/recurringServiceAssetClient.js');
    const file=new File([new Uint8Array([1,2])],'logo.png',{type:'image/png'});
    const key='service-asset-'+'a'.repeat(24);
    const name='myfinhub:artwork:'+(kind==='provider'?'provider:'+JSON.stringify(['qa-bank','logo','light']):kind==='recurring-upload'?'recurring-upload:qa-recurring':'recurring-release:'+key);
    let calls=0;
    vi.stubGlobal('fetch',vi.fn(async()=>response({error:'Synthetic uncertainty'},++calls===1?503:400)));
    const run=()=>kind==='provider'?provider.uploadFinancialProviderAsset({providerId:'qa-bank',role:'logo',variant:'light',file,refreshCatalog:false}):kind==='recurring-upload'?recurring.uploadRecurringServiceAsset({recurringId:'qa-recurring',file}):recurring.deleteRecurringServiceAsset(key);
    const external=deferred<void>();
    const heldByOther=request(name,{ifAvailable:true},async()=>external.promise);
    await expect(run()).rejects.toThrow();
    expect(calls).toBe(0);
    external.resolve();await heldByOther;
    await expect(run()).rejects.toThrow();
    expect(calls).toBe(1);
    expect(held.has(name)).toBe(true);
    await expect(request(name,{ifAvailable:true},async lock=>Boolean(lock))).resolves.toBe(false);
    await expect(request(name+'-independent',{ifAvailable:true},async lock=>Boolean(lock))).resolves.toBe(true);
    boundary();
    await vi.waitFor(()=>expect(held.has(name)).toBe(false));
    await expect(run()).rejects.toThrow();
    expect(calls).toBe(2);
    expect(held.has(name)).toBe(false);
  });
  it('rechecks the original scope after a deferred Web Lock acquisition',async()=>{
    Object.defineProperty(window,'isSecureContext',{value:true});
    const wait=deferred<void>(),entered=deferred<void>();
    vi.stubGlobal('navigator',{locks:{request:async(_name:string,_options:unknown,work:(lock:object)=>Promise<unknown>)=>{entered.resolve();await wait.promise;return work({})}}});
    const {withArtworkMutationLock}=await import('../src/lib/artworkMutationLock.js');
    const {authScopeEpoch}=await import('../src/lib/authScopedCache.js');
    const work=vi.fn(async()=>true);
    const result=withArtworkMutationLock('synthetic',authScopeEpoch(),()=>new Error('busy'),()=>false,work);
    await entered.promise;boundary();wait.resolve();
    await expect(result).rejects.toThrow('Η συνεδρία άλλαξε πριν σταλεί');
    expect(work).not.toHaveBeenCalled();
  });
  it('keeps all compound finance and editor stages bound to the initiating scope',()=>{
    const hook=readFileSync('src/hooks/useFinance.ts','utf8');
    const provider=readFileSync('src/components/FinancialProviderManagementSettings.tsx','utf8');
    const recurring=readFileSync('src/pages/RecurringPage.tsx','utf8');
    expect(hook).toContain('const scope=useRef(authScopeEpoch()).current');
    expect(hook).toContain('assertCurrentAuthScope(scope);\n        const res = await saveData');
    expect(hook).toContain('const isCurrent=()=>scope===authScopeEpoch()&&canApplyFinanceReload');
    expect(hook).toContain('for(const expectedPoint of plan.pointIds){\n        assertCurrentAuthScope(scope);');
    expect(hook).toContain('await coordinator.whenIdle();\n    assertCurrentAuthScope(scope);\n    if(!canStartFinanceMaintenance');
    expect(hook).toContain("await import('../lib/historyView')");
    expect(provider).toContain('assertCurrentAuthScope(scope);\n        const asset=await uploadFinancialProviderAsset');
    expect(provider).toContain('assertCurrentAuthScope(scope);\n          await setFinancialProviderAssetBinding');
    expect(provider).toContain('const reloaded=await refreshFinancialProviders(true);\n      assertCurrentAuthScope(scope);');
    expect(recurring).toContain('await onUpsertDurably(normalized);\n      persisted=true;\n      assertCurrentAuthScope(scope);');
    expect(recurring).toContain('if(scope!==authScopeEpoch())return;\n      let cleanupWarning');
    const browser=readFileSync('scripts/provider-brand-management-qa.mjs','utf8');
    expect(browser).toContain('const second=new Cdp(secondTarget.webSocketDebuggerUrl)');
    expect(browser).toContain("await import('/src/lib/financialProviderClient.ts')");
    expect(browser).toContain("observed.same==='FinancialProviderAssetUploadInProgress'&&observed.sameUploads===0");
    expect(browser).toContain("observed.independent==='Error'&&observed.uploads===1");
    expect(browser).toContain('PASS native cross-tab artwork lock retained after ambiguous receipt and editor close');
    const locks=readFileSync('src/lib/artworkWebLock.ts','utf8')+readFileSync('src/lib/artworkMutationLock.ts','utf8');
    expect(locks).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});
