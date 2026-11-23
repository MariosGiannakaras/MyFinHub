import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const path:string='../src/lib/recurringServiceAssetClient.js';
type Client={uploadRecurringServiceAsset:(input:{recurringId:string;file:File})=>Promise<unknown>};
const input=()=>({recurringId:'rec-qa-streaming',
  file:new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'logo.svg',{type:'image/svg+xml'})});
beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I19.04 uncertain recurring logo upload receipts',()=>{

  it('blocks same-turn duplicate binary PUT before the first response and releases after a definite 400',async()=>{
    const calls:string[]=[];
    let finishFirst:(response:Response)=>void=()=>{throw new Error('No first request')};
    vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');
      calls.push(method+' '+String(url));
      if(method!=='PUT')throw new Error('Unexpected upload catalog request');
      if(calls.length===1)return new Promise<Response>(resolve=>{finishFirst=resolve});
      return new Response(JSON.stringify({error:'Invalid binary'}),{status:400});
    }));
    const {uploadRecurringServiceAsset}=await import(path) as Client;
    const first=uploadRecurringServiceAsset(input());
    expect(calls).toHaveLength(1);
    await expect(uploadRecurringServiceAsset(input())).rejects.toMatchObject({name:'RecurringServiceUploadInProgress'});
    expect(calls).toHaveLength(1);
    // Independent recurring items retain parallel-upload capacity.
    await expect(uploadRecurringServiceAsset({...input(),recurringId:'rec-independent'}))
      .rejects.not.toMatchObject({name:'RecurringServiceUploadInProgress'});
    expect(calls).toHaveLength(2);
    finishFirst(new Response(JSON.stringify({error:'Invalid binary'}),{status:400}));
    await expect(first).rejects.not.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    await expect(uploadRecurringServiceAsset(input())).rejects.not.toMatchObject({name:'RecurringServiceUploadInProgress'});
    expect(calls.filter(value=>value.startsWith('PUT '))).toHaveLength(3);
  });

  it('cannot release a new auth scope upload when an old request resolves late',async()=>{
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
    const {uploadRecurringServiceAsset}=await import(path) as Client;
    const old=uploadRecurringServiceAsset(input());
    scopeWindow.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
    const fresh=uploadRecurringServiceAsset(input());
    expect(sent).toBe(2);
    finishOld(new Response(JSON.stringify({error:'Lost old receipt'}),{status:503}));
    await expect(old).rejects.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    await expect(uploadRecurringServiceAsset(input())).rejects.toMatchObject({name:'RecurringServiceUploadInProgress'});
    expect(sent).toBe(2);
    finishFresh(new Response(JSON.stringify({error:'Invalid binary'}),{status:400}));
    await expect(fresh).rejects.not.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    await expect(uploadRecurringServiceAsset(input())).rejects.not.toMatchObject({name:'RecurringServiceUploadInProgress'});
    expect(sent).toBe(3);
  });

  it.each(['network-loss','timeout','408','429','500','503','invalid-200'] as const)(
    'fails closed and prevents a second binary upload for %s',async scenario=>{
      const calls:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
        calls.push(String(init?.method||'GET')+' '+String(url));
        if(scenario==='network-loss')throw new Error('Dropped upload response');
        if(scenario==='timeout')throw new DOMException('Timed out','AbortError');
        if(scenario==='invalid-200')return new Response(JSON.stringify({asset:{assetKey:'invalid'}}),{status:200});
        return new Response(JSON.stringify({error:'Uncertain commit'}),{status:Number(scenario)});
      }));
      const {uploadRecurringServiceAsset}=await import(path) as Client;
      await expect(uploadRecurringServiceAsset(input())).rejects.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
      await expect(uploadRecurringServiceAsset(input())).rejects.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain('PUT ');
      expect(calls[0]).toContain('resource=recurring-service-assets');
    });
  it('keeps late old-auth uncertainty out of a newly authenticated scope',async()=>{
    const handlers=new Map<string,()=>void>();
    vi.stubGlobal('window',{addEventListener:(name:string,fn:()=>void)=>{handlers.set(name,fn)}});
    let finishFirst:(value:Response)=>void=()=>{throw new Error('First upload not started')};
    let sent=0;
    vi.stubGlobal('fetch',vi.fn(async()=>{
      sent++;
      if(sent===1)return new Promise<Response>(resolve=>{finishFirst=resolve});
      return new Response(JSON.stringify({error:'Definite invalid file'}),{status:400});
    }));
    const {uploadRecurringServiceAsset}=await import(path) as Client;
    const first=uploadRecurringServiceAsset(input());
    expect(sent).toBe(1);
    const change=handlers.get('myfinhub:auth-scope-reset');
    expect(change).toBeTypeOf('function');
    change!();
    finishFirst(new Response(JSON.stringify({error:'Old response lost'}),{status:503}));
    await expect(first).rejects.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    await expect(uploadRecurringServiceAsset(input())).rejects.not.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    expect(sent).toBe(2);
  });
  it('does not block corrected retries after a definite HTTP 400',async()=>{
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
      calls.push(String(init?.method||'GET')+' '+String(url));
      return new Response(JSON.stringify({error:'Invalid file'}),{status:400});
    }));
    const {uploadRecurringServiceAsset}=await import(path) as Client;
    await expect(uploadRecurringServiceAsset(input())).rejects.not.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    await expect(uploadRecurringServiceAsset(input())).rejects.not.toMatchObject({name:'UnverifiedRecurringServiceAssetWrite'});
    expect(calls).toHaveLength(2);
  });
});
