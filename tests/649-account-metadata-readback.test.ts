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
});
