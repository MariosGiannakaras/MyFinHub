import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const path:string='../src/lib/recurringServiceAssetClient.js';
type Client={uploadRecurringServiceAsset:(input:{recurringId:string;file:File})=>Promise<unknown>};
const input=()=>({recurringId:'rec-qa-streaming',
  file:new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'logo.svg',{type:'image/svg+xml'})});
beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I19.04 uncertain recurring logo upload receipts',()=>{
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
