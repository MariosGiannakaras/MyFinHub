import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAccountMetadata, writeAccountMetadata } from '../server/accountMetadataStore.js';

const savedUrl=process.env.SUPABASE_URL;
const savedKey=process.env.SUPABASE_PUBLISHABLE_KEY;
afterEach(()=>{
  vi.unstubAllGlobals();
  if(savedUrl===undefined)delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL=savedUrl;
  if(savedKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY=savedKey;
});
const iban='GR1601101250000000012300695';
const validRow=()=>({account_id:'account-one',iban,revision:5,updated_at:'2026-11-19T12:00:00Z'});
function configure(){
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='public-test-key';
}
describe('#649 I19.04 account metadata read/write response integrity',()=>{
  it.each(['valid','null-iban','invalid-id','invalid-iban','unsafe-revision','text-revision','duplicate'] as const)(
    'reads %s without accepting malformed or ambiguous account rows',async scenario=>{
      configure();
      const row:Record<string,unknown>=validRow();
      if(scenario==='null-iban')row.iban=null;
      if(scenario==='invalid-id')row.account_id='../account-one';
      if(scenario==='invalid-iban')row.iban='GR1601101250000000012300694';
      if(scenario==='unsafe-revision')row.revision=Number.MAX_SAFE_INTEGER+1;
      if(scenario==='text-revision')row.revision='5';
      const payload=scenario==='duplicate'?[row,{...row}]:[row];
      const methods:string[]=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const url=String(input);methods.push(String(init?.method??'GET'));
        if(!url.includes('/rheomiq_account_metadata?'))throw new Error('Unexpected metadata GET');
        return new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
      }));
      if(scenario==='valid'||scenario==='null-iban'){
        const result=await readAccountMetadata('owner-token');
        expect(result).toHaveLength(1);
        expect(result[0]?.iban).toBe(scenario==='valid'?iban:null);
        expect(result[0]?.revision).toBe(5);
      }else{
        await expect(readAccountMetadata('owner-token')).rejects.toMatchObject({
          status:500,code:scenario==='duplicate'?'ACCOUNT_METADATA_INVALID_RESPONSE':'ACCOUNT_METADATA_INVALID_ROW',
        });
      }
      expect(methods).toEqual(['GET']);
    }
  );
  it.each(['valid','wrong-account','wrong-iban','stale','skipped','unsafe','empty','duplicate'] as const)(
    'verifies the single expected optimistic write receipt for %s',async scenario=>{
      configure();
      const row:Record<string,unknown>=validRow();
      if(scenario==='wrong-account')row.account_id='account-two';
      if(scenario==='wrong-iban')row.iban='GB82WEST12345698765432';
      if(scenario==='stale')row.revision=4;
      if(scenario==='skipped')row.revision=6;
      if(scenario==='unsafe')row.revision=Number.MAX_SAFE_INTEGER+1;
      const response=scenario==='empty'?[]:scenario==='duplicate'?[row,{...row}]:[row];
      const observed:Array<{method:string;path:string;body:string}>=[];
      vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        const url=String(input),method=String(init?.method??'GET');
        observed.push({method,path:url,body:String(init?.body??'')});
        if(!url.includes('/rpc/rheomiq_upsert_account_metadata'))throw new Error('Unexpected metadata RPC');
        return new Response(JSON.stringify(response),{status:200,headers:{'content-type':'application/json'}});
      }));
      if(scenario==='valid'){
        const result=await writeAccountMetadata('account-one',iban,4,'owner-token');
        expect(result.revision).toBe(5);
        expect(result.iban).toBe(iban);
      }else{
        await expect(writeAccountMetadata('account-one',iban,4,'owner-token')).rejects.toMatchObject({
          status:scenario==='unsafe'?500:503,
          code:scenario==='unsafe'?'ACCOUNT_METADATA_INVALID_ROW':'ACCOUNT_METADATA_WRITE_UNVERIFIED',
        });
      }
      expect(observed).toHaveLength(1);
      expect(observed[0]?.method).toBe('POST');
      expect(JSON.parse(observed[0]?.body??'{}')).toMatchObject({
        p_account_id:'account-one',p_iban:iban,p_expected_revision:4,
      });
    }
  );

  it.each([
    'committed-503','committed-timeout','owner-revoked','owner-unavailable',
    'missing-row','duplicate-rows','wrong-account','wrong-iban',
    'stale-revision','advanced-revision','invalid-row','read-unavailable',
    'definite-conflict','definite-invalid',
  ] as const)('reconciles IBAN $scenario at exact revision without replay',async scenario=>{
    configure();
    const calls:Array<{url:string;method:string;body:string;authorization:string|null}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input),method=String(init?.method??'GET');
      calls.push({url,method,body:String(init?.body??''),
        authorization:new Headers(init?.headers).get('authorization')});
      if(url.includes('/rpc/rheomiq_upsert_account_metadata')){
        if(scenario==='committed-timeout')throw new TypeError('Synthetic postcommit response loss');
        if(scenario==='definite-conflict')
          return new Response(JSON.stringify({code:'40001',message:'REVISION_CONFLICT'}),{status:409});
        if(scenario==='definite-invalid')
          return new Response(JSON.stringify({code:'22023',message:'INVALID_IBAN'}),{status:400});
        return new Response('{}',{status:503});
      }
      if(url.includes('/rpc/rheomiq_is_owner_aal2')){
        if(scenario==='owner-unavailable')return new Response('{}',{status:503});
        return new Response(scenario==='owner-revoked'?'false':'true',{status:200});
      }
      if(url.includes('/rheomiq_account_metadata?')){
        if(scenario==='read-unavailable')return new Response('{}',{status:503});
        const record:Record<string,unknown>=validRow();
        if(scenario==='wrong-account')record.account_id='account-two';
        if(scenario==='wrong-iban')record.iban='GB82WEST12345698765432';
        if(scenario==='stale-revision')record.revision=4;
        if(scenario==='advanced-revision')record.revision=6;
        if(scenario==='invalid-row')record.revision='5';
        const rows=scenario==='missing-row'?[]:scenario==='duplicate-rows'?[record,{...record}]:[record];
        return new Response(JSON.stringify(rows),{status:200});
      }
      throw new Error('Unexpected downstream endpoint: '+url);
    }));
    const promise=writeAccountMetadata('account-one',iban,4,'owner-token');
    if(scenario==='committed-503'||scenario==='committed-timeout'){
      await expect(promise).resolves.toMatchObject({accountId:'account-one',iban,revision:5});
    }else{
      await expect(promise).rejects.toMatchObject({
        status:scenario==='definite-conflict'?409:scenario==='definite-invalid'?400:503,
        code:scenario==='definite-conflict'?'REVISION_CONFLICT':
          scenario==='definite-invalid'?'INVALID_IBAN':'ACCOUNT_METADATA_WRITE_UNVERIFIED',
      });
    }
    const expected=scenario.startsWith('definite-')?['POST']:
      scenario==='owner-revoked'||scenario==='owner-unavailable'?['POST','POST']:
        ['POST','POST','GET'];
    expect(calls.map(call=>call.method)).toEqual(expected);
    expect(calls.filter(call=>call.url.includes('/rpc/rheomiq_upsert_account_metadata'))).toHaveLength(1);
    expect(calls.every(call=>call.authorization==='Bearer owner-token')).toBe(true);
    if(expected.includes('GET')){
      expect(calls[2]?.url).toContain('account_id=eq.account-one');
      expect(calls[2]?.url).toContain('select=account_id,iban,revision,updated_at');
    }
    expect(JSON.parse(calls[0]?.body??'{}')).toMatchObject({
      p_account_id:'account-one',p_iban:iban,p_expected_revision:4,
    });
  });
});
