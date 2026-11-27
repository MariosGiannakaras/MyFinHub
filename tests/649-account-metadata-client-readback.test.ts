import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(()=>vi.resetModules());
afterEach(()=>vi.unstubAllGlobals());

const iban='GR1601101250000000012300695';
const record=()=>({accountId:'account-one',iban,revision:1,updatedAt:'2026-11-19T12:00:00Z'});
const importClient=async()=>{
  // Browser-only extensionless imports require a runtime NodeNext-compatible path.
  const path:string='../src/lib/accountMetadataClient.js';
  return import(path) as Promise<typeof import('../src/lib/accountMetadataClient.js')>;
};
describe('#649 I19.04 IBAN client catalog and revision acknowledgement',()=>{
  it.each([
    'missing-list','object-list','malformed-row','duplicate-id',
    'invalid-iban','unsafe-revision',
  ] as const)('rejects incomplete HTTP 200 %s, then recovers with read-only GET',async scenario=>{
    const good=record();
    const bad:Record<string,unknown>={...good};
    if(scenario==='malformed-row')bad.accountId='../invalid';
    if(scenario==='invalid-iban')bad.iban='GR1601101250000000012300694';
    if(scenario==='unsafe-revision')bad.revision=Number.MAX_SAFE_INTEGER+1;
    const broken=scenario==='missing-list'?{}:
      scenario==='object-list'?{records:bad}:
      scenario==='duplicate-id'?{records:[bad,{...bad}]}:{records:[bad]};
    let hits=0;
    const methods:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');
      methods.push(method);
      return new Response(JSON.stringify(hits++===0?broken:{records:[good]}),{
        status:200,headers:{'content-type':'application/json'},
      });
    }));
    const client=await importClient();
    const failed=await client.refreshAccountMetadata(true);
    expect(failed.error).toBeTruthy();
    expect(Object.keys(failed.records)).toHaveLength(0);
    const recovered=await client.refreshAccountMetadata(true);
    expect(recovered.error).toBeNull();
    expect(recovered.records['account-one']).toMatchObject(good);
    expect(methods).toEqual(['GET','GET']);
  });

  it.each(['valid','wrong-account','wrong-iban','skipped-revision'] as const)(
    'verifies exact HTTP 200 IBAN save acknowledgement for %s',async scenario=>{
      const reply:Record<string,unknown>={...record()};
      if(scenario==='wrong-account')reply.accountId='other-account';
      if(scenario==='wrong-iban')reply.iban='GB82WEST12345698765432';
      if(scenario==='skipped-revision')reply.revision=2;
      const requests:Array<{method:string;body:string}>=[];
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');
        requests.push({method,body:String(init?.body??'')});
        return new Response(JSON.stringify(method==='GET'?{records:[]}:{record:reply}),{
          status:200,headers:{'content-type':'application/json'},
        });
      }));
      const client=await importClient();
      if(scenario==='valid'){
        const receipt=await client.saveAccountMetadata('account-one',iban);
        expect(receipt).toMatchObject(record());
        expect(client.getAccountMetadataSnapshot().records['account-one']).toMatchObject(record());
      }else{
        await expect(client.saveAccountMetadata('account-one',iban))
          .rejects.toThrow('Η απάντηση αποθήκευσης IBAN δεν είναι έγκυρη.');
        expect(client.getAccountMetadataSnapshot().records['account-one']).toBeUndefined();
      }
      expect(requests.map(x=>x.method)).toEqual(['GET','PUT']);
      expect(JSON.parse(requests[1]?.body??'{}')).toEqual({accountId:'account-one',iban});
    }
  );
  it.each(['failed-GET','invalid-GET','prior-stale-GET'] as const)(
    'never POSTs an IBAN using invented revision zero after %s',async scenario=>{
      const methods:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');methods.push(method);
        if(method!=='GET')throw new Error('No IBAN write without verified readback');
        const payload=scenario==='invalid-GET'?{}:{records:[]};
        return new Response(JSON.stringify(payload),{
          status:scenario==='failed-GET'?503:200,headers:{'content-type':'application/json'},
        });
      }));
      const client=await importClient();
      if(scenario==='prior-stale-GET'){
        // Create a retained error with a prior successful read. A later
        // write still must not trust the old revision when refresh fails.
        let count=0;
        vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
          const method=String(init?.method??'GET');methods.push(method);
          if(method!=='GET')throw new Error('No unsafe mutation on stale catalog');
          return new Response(JSON.stringify(++count===1?{records:[record()]}:{}),{
            status:200,headers:{'content-type':'application/json'},
          });
        }));
        await client.refreshAccountMetadata(true);
        const bad=await client.refreshAccountMetadata(true);
        expect(bad.error).toBeTruthy();
        expect(bad.records['account-one']).toMatchObject(record());
      }
      await expect(client.saveAccountMetadata('account-one',iban))
        .rejects.toThrow('Η τρέχουσα έκδοση IBAN δεν έχει επιβεβαιωθεί.');
      expect(methods.every(method=>method==='GET')).toBe(true);
      expect(methods).toHaveLength(scenario==='prior-stale-GET'?3:1);
    }
  );

  it('uses the exact verified account revision after a cold catalog GET',async()=>{
    const methods:string[]=[],headers:Record<string,string>[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');methods.push(method);
      headers.push(Object.fromEntries(new Headers(init?.headers).entries()));
      return new Response(JSON.stringify(method==='GET'?
        {records:[{...record(),revision:4}]}:
        {record:{...record(),revision:5}}),{
        status:200,headers:{'content-type':'application/json'},
      });
    }));
    const client=await importClient();
    const result=await client.saveAccountMetadata('account-one',iban);
    expect(result.revision).toBe(5);
    expect(headers[1]?.['if-match']).toBe('4');
    expect(methods).toEqual(['GET','PUT']);
  });

  it.each(['network-loss','timeout','408','429','500','503','invalid-200'] as const)(
    'does not replay an IBAN PUT after an unverified %s receipt',async scenario=>{
      const methods:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
        const method=String(init?.method??'GET');
        methods.push(method);
        if(method==='GET')return new Response(JSON.stringify({records:[]}),{status:200});
        if(scenario==='network-loss')throw new TypeError('Synthetic lost write response');
        if(scenario==='timeout')throw new DOMException('Synthetic timeout','AbortError');
        if(scenario==='invalid-200')return new Response(JSON.stringify({record:{...record(),revision:2}}),{status:200});
        return new Response(JSON.stringify({code:'TEMPORARY_FAILURE'}),{status:Number(scenario)});
      }));
      const client=await importClient();
      await expect(client.saveAccountMetadata('account-one',iban))
        .rejects.toMatchObject({name:'UnverifiedAccountMetadataWrite'});
      await expect(client.saveAccountMetadata('account-one',iban))
        .rejects.toMatchObject({name:'UnverifiedAccountMetadataWrite'});
      expect(methods).toEqual(['GET','PUT']);
    }
  );
  it('retains a definite 400 IBAN rejection as a correctable write',async()=>{
    const methods:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      const method=String(init?.method??'GET');methods.push(method);
      if(method==='GET')return new Response(JSON.stringify({records:[]}),{status:200});
      return new Response(JSON.stringify({code:'INVALID_IBAN',error:'Invalid IBAN'}),{status:400});
    }));
    const client=await importClient();
    await expect(client.saveAccountMetadata('account-one',iban))
      .rejects.not.toMatchObject({name:'UnverifiedAccountMetadataWrite'});
    await expect(client.saveAccountMetadata('account-one',iban))
      .rejects.not.toMatchObject({name:'UnverifiedAccountMetadataWrite'});
    expect(methods).toEqual(['GET','PUT','PUT']);
  });
  it('clears the uncertainty guard on a fresh authenticated scope',async()=>{
    const handlers=new Map<string,()=>void>();
    vi.stubGlobal('window',{addEventListener:(name:string,callback:()=>void)=>{handlers.set(name,callback)}});
    let puts=0,gets=0;
    vi.stubGlobal('fetch',vi.fn(async(_url:RequestInfo|URL,init?:RequestInit)=>{
      if((init?.method??'GET')==='GET'){gets++;return new Response(JSON.stringify({records:[]}),{status:200})}
      puts++;
      return new Response(JSON.stringify({code:'INVALID_IBAN'}),{status:puts===1?503:400});
    }));
    const client=await importClient();
    await expect(client.saveAccountMetadata('account-one',iban))
      .rejects.toMatchObject({name:'UnverifiedAccountMetadataWrite'});
    const reset=handlers.get('myfinhub:auth-scope-reset');
    expect(reset).toBeTypeOf('function');
    reset!();
    await expect(client.saveAccountMetadata('account-one',iban))
      .rejects.not.toMatchObject({name:'UnverifiedAccountMetadataWrite'});
    expect(puts).toBe(2);
    expect(gets).toBe(2);
  });

});
