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
        requests.push({method:String(init?.method??'GET'),body:String(init?.body??'')});
        return new Response(JSON.stringify({record:reply}),{
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
      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe('PUT');
      expect(JSON.parse(requests[0]?.body??'{}')).toEqual({accountId:'account-one',iban});
    }
  );
});
