import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

const key='service-asset-1234567890abcdef12345678';
const row=()=>({
  assetKey:key,recurringId:'qa-recurring',fileName:'brand.png',
  url:'https://example.supabase.co/storage/v1/object/public/recurring-service-assets/services/'+key+'.png',
  mimeType:'image/png',sizeBytes:32,updatedAt:'2026-11-19T21:00:00Z',
});
async function client(){
  const path:string='../src/lib/recurringServiceAssetClient.js';
  return import(path) as Promise<typeof import('../src/lib/recurringServiceAssetClient.js')>;
}

describe('#649 I19.04 recurring image catalog and write-readback integrity',()=>{
  it('requires the public Storage path to identify this key and MIME, including normalized JPEG',async()=>{
    const service=await client();
    expect(service.parseRecurringServiceAsset(row())).toMatchObject(row());
    const jpeg={...row(),mimeType:'image/jpeg',url:row().url.replace(/\.png$/,'.jpg')};
    expect(service.parseRecurringServiceAsset(jpeg)).toMatchObject(jpeg);
    for(const url of [
      row().url.replace(key,'service-asset-aaaaaaaaaaaaaaaaaaaaaaaa'),
      row().url.replace('/recurring-service-assets/','/financial-provider-assets/'),
      row().url.replace(/\.png$/,'.jpeg'),
      row().url.replace('/services/','/services/nested/'),
      row().url+'%2Fother.png',
    ])expect(service.parseRecurringServiceAsset({...row(),url})).toBeNull();
  });

  it.each([
    'missing-list','object-list','invalid-extra','duplicate','numeric-text',
    'unsafe-bytes','negative-bytes','foreign-key-url','wrong-bucket-url','wrong-mime-extension',
  ] as const)('fails closed on incomplete HTTP 200 %s, then recovers using GET only',async scenario=>{
    const original=row();
    const bad:Record<string,unknown>={...original};
    if(scenario==='invalid-extra')bad.assetKey='invalid-key';
    if(scenario==='numeric-text')bad.sizeBytes='32';
    if(scenario==='unsafe-bytes')bad.sizeBytes=Number.MAX_SAFE_INTEGER+1;
    if(scenario==='negative-bytes')bad.sizeBytes=-1;
    if(scenario==='foreign-key-url')bad.url=String(original.url).replace(key,'service-asset-aaaaaaaaaaaaaaaaaaaaaaaa');
    if(scenario==='wrong-bucket-url')bad.url=String(original.url).replace('/recurring-service-assets/','/financial-provider-assets/');
    if(scenario==='wrong-mime-extension')bad.url=String(original.url).replace(/\.png$/,'.jpg');
    const broken=scenario==='missing-list'?{}:
      scenario==='object-list'?{assets:bad}:
        scenario==='duplicate'?{assets:[original,{...original}]}:
          scenario==='invalid-extra'?{assets:[original,bad]}:{assets:[bad]};
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');calls.push(method);
      if(method!=='GET')throw new Error('Catalog GET must never write');
      return new Response(JSON.stringify(calls.length===1?broken:{assets:[original]}),{
        status:200,headers:{'content-type':'application/json'},
      });
    }));
    const service=await client();
    const rejected=await service.refreshRecurringServiceAssets(true);
    expect(rejected.error).toBeTruthy();
    expect(rejected.assets).toEqual([]);
    const verified=await service.refreshRecurringServiceAssets(true);
    expect(verified.error).toBeNull();
    expect(verified.assets).toMatchObject([original]);
    expect(calls).toEqual(['GET','GET']);
  });

  it.each([
    'valid','foreign-recurring','wrong-name','wrong-type','wrong-bytes',
    'catalog-missing','catalog-wrong','catalog-unavailable',
    'receipt-foreign-key-url','catalog-foreign-key-url',
  ] as const)('verifies uploaded binary + fresh registration for %s without extra PUT/DELETE',async scenario=>{
    const file={name:'brand.png',type:'image/png',size:32} as File;
    const receipt:Record<string,unknown>={...row()};
    if(scenario==='foreign-recurring')receipt.recurringId='other-recurring';
    if(scenario==='wrong-name')receipt.fileName='other.png';
    if(scenario==='wrong-type')receipt.mimeType='image/jpeg';
    if(scenario==='wrong-bytes')receipt.sizeBytes=31;
    if(scenario==='receipt-foreign-key-url')receipt.url=String(receipt.url).replace(key,'service-asset-aaaaaaaaaaaaaaaaaaaaaaaa');
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');calls.push(method+' '+String(input));
      if(method==='PUT')return new Response(JSON.stringify({asset:receipt}),{
        status:200,headers:{'content-type':'application/json'},
      });
      if(method!=='GET')throw new Error('No duplicate upload or cleanup');
      if(scenario==='catalog-unavailable')return new Response('{}',{status:503});
      const asset=scenario==='catalog-missing'?[]:
        scenario==='catalog-wrong'?[{...row(),sizeBytes:31}]:
          scenario==='catalog-foreign-key-url'?[{...row(),url:String(row().url).replace(key,'service-asset-aaaaaaaaaaaaaaaaaaaaaaaa')}]:[row()];
      return new Response(JSON.stringify({assets:asset}),{
        status:200,headers:{'content-type':'application/json'},
      });
    }));
    const service=await client();
    if(scenario==='valid'){
      const stored=await service.uploadRecurringServiceAsset({recurringId:'qa-recurring',file});
      expect(stored).toMatchObject(row());
      expect(service.getRecurringServiceAssetSnapshot().assets).toMatchObject([row()]);
    }else{
      await expect(service.uploadRecurringServiceAsset({recurringId:'qa-recurring',file}))
        .rejects.toThrow('Η καταχώριση της εικόνας υπηρεσίας δεν επιβεβαιώθηκε.');
    }
    const methods=calls.map(c=>c.split(' ')[0]);
    const receiptInvalid=['foreign-recurring','wrong-name','wrong-type','wrong-bytes','receipt-foreign-key-url'].includes(scenario);
    expect(methods).toEqual(receiptInvalid?['PUT']:['PUT','GET']);
    expect(methods.filter(m=>m==='PUT')).toHaveLength(1);
    expect(methods).not.toContain('DELETE');
  });

  it.each(['network-loss','408','429','503'] as const)(
    'fails closed on ambiguous recurring release %s without false active-catalog purge proof',async scenario=>{
      const methods:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
        const method=init?.method??'GET';
        methods.push(method);
        if(method==='DELETE'){
          if(scenario==='network-loss')throw new Error('Connection lost after release');
          return new Response('{}',{status:Number(scenario)});
        }
        // Even an empty active-only catalog would not prove purge: the release
        // RPC may have set active=false before Storage DELETE failed.
        if(method==='GET')return new Response(JSON.stringify({assets:[]}),{status:200});
        throw new Error('Unexpected write');
      }));
      const service=await client();
      await expect(service.deleteRecurringServiceAsset(key)).rejects.toThrow('δεν επιβεβαιώθηκε');
      await expect(service.deleteRecurringServiceAsset(key)).rejects.toThrow('δεν επιβεβαιώθηκε');
      expect(methods).toEqual(['DELETE']);
    }
  );

  it('does not let an old session DELETE completion release a new-session in-flight key',async()=>{
    const scopeWindow=new EventTarget();
    vi.stubGlobal('window',scopeWindow);
    let finishOld:(response:Response)=>void=()=>{throw new Error('Old DELETE not sent')};
    let finishFresh:(response:Response)=>void=()=>{throw new Error('Fresh DELETE not sent')};
    let deletes=0;
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      const method=init?.method??'GET';
      if(method!=='DELETE')throw new Error('No catalog GET for unverified or rejected release');
      deletes++;
      if(deletes===1)return new Promise<Response>(resolve=>{finishOld=resolve});
      if(deletes===2)return new Promise<Response>(resolve=>{finishFresh=resolve});
      return new Response(JSON.stringify({error:'Invalid key'}),{status:400});
    }));
    const service=await client();
    const old=service.deleteRecurringServiceAsset(key);
    expect(deletes).toBe(1);
    scopeWindow.dispatchEvent(new Event('myfinhub:auth-scope-reset'));
    const fresh=service.deleteRecurringServiceAsset(key);
    expect(deletes).toBe(2);
    finishOld(new Response('{}',{status:503}));
    await expect(old).rejects.toThrow('δεν επιβεβαιώθηκε');
    await expect(service.deleteRecurringServiceAsset(key)).rejects.toThrow('ήδη σε εξέλιξη');
    expect(deletes).toBe(2);
    finishFresh(new Response(JSON.stringify({error:'Invalid key'}),{status:400}));
    await expect(fresh).rejects.toThrow('Invalid key');
    await expect(service.deleteRecurringServiceAsset(key)).rejects.toThrow('Invalid key');
    expect(deletes).toBe(3);
  });

  it('serializes same-key release before any response, but permits retry after definite 400',async()=>{
    const methods:string[]=[];
    let finish:(response:Response)=>void=()=>{throw new Error('Missing first release')};
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      const method=init?.method??'GET';methods.push(method);
      if(method!=='DELETE')throw new Error('No catalog read for definite 400');
      if(methods.length===1)return new Promise<Response>(resolve=>{finish=resolve});
      return new Response(JSON.stringify({error:'Invalid key'}),{status:400});
    }));
    const service=await client();
    const first=service.deleteRecurringServiceAsset(key);
    expect(methods).toEqual(['DELETE']);
    await expect(service.deleteRecurringServiceAsset(key)).rejects.toThrow('ήδη σε εξέλιξη');
    expect(methods).toEqual(['DELETE']);
    finish(new Response(JSON.stringify({error:'Invalid key'}),{status:400}));
    await expect(first).rejects.toThrow('Invalid key');
    await expect(service.deleteRecurringServiceAsset(key)).rejects.toThrow('Invalid key');
    expect(methods).toEqual(['DELETE','DELETE']);
  });

  it.each(['valid','unconfirmed-status','retained-row','unavailable-GET'] as const)(
    'never claims a successful deletion without verified absence for %s',async scenario=>{
      const calls:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');calls.push(method+' '+String(input));
        if(method==='DELETE')return new Response(JSON.stringify({
          ok:scenario!=='unconfirmed-status',
        }),{status:200,headers:{'content-type':'application/json'}});
        if(method!=='GET')throw new Error('No repeated deletion');
        if(scenario==='unavailable-GET')return new Response('{}',{status:503});
        return new Response(JSON.stringify({assets:scenario==='retained-row'?[row()]:[]}),{
          status:200,headers:{'content-type':'application/json'},
        });
      }));
      const service=await client();
      if(scenario==='valid')await expect(service.deleteRecurringServiceAsset(key)).resolves.toBeUndefined();
      else await expect(service.deleteRecurringServiceAsset(key))
        .rejects.toThrow('Η αποδέσμευση της εικόνας δεν επιβεβαιώθηκε.');
      const methods=calls.map(c=>c.split(' ')[0]);
      expect(methods).toEqual(scenario==='unconfirmed-status'?['DELETE']:['DELETE','GET']);
      expect(methods.filter(m=>m==='DELETE')).toHaveLength(1);
    }
  );
});
