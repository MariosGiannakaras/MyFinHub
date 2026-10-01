import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUpstream } from '../server/upstream.js';
import { readStore } from '../server/storage.js';
import { readAccountMetadata } from '../server/accountMetadataStore.js';
import { readCardSecrets } from '../server/cardVaultStore.js';

function response(status:number,body:unknown={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
}

describe('backend outage and rate-limit contracts',()=>{
  const originalUrl=process.env.SUPABASE_URL;
  const originalKey=process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(()=>{
    process.env.SUPABASE_URL='https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  });

  afterEach(()=>{
    vi.unstubAllGlobals();
    if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
    if(originalKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=originalKey;
  });

  it('maps data/auth transport failures to stable 503 public contracts',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('socket contains private upstream detail')));
    await expect(fetchUpstream('https://project.example/data',{},'DATA',50))
      .rejects.toMatchObject({status:503,code:'DATA_UNAVAILABLE',expose:true});
    await expect(fetchUpstream('https://project.example/auth',{},'AUTH',50))
      .rejects.toMatchObject({status:503,code:'AUTH_UNAVAILABLE',expose:true});
  });

  it('maps upstream timeouts to stable 504 contracts',async()=>{
    vi.stubGlobal('fetch',vi.fn((_input:unknown,init?:RequestInit)=>new Promise((_resolve,reject)=>{
      const signal=init?.signal;
      if(signal?.aborted){reject(new DOMException('aborted','AbortError'));return}
      signal?.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true});
    })));
    await expect(fetchUpstream('https://project.example/data',{},'DATA',1))
      .rejects.toMatchObject({status:504,code:'DATA_TIMEOUT'});
    await expect(fetchUpstream('https://project.example/auth',{},'AUTH',1))
      .rejects.toMatchObject({status:504,code:'AUTH_TIMEOUT'});
  });

  it('keeps data 429 distinct from generic upstream failure',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(429,{message:'busy'})));
    await expect(readStore('access-token'))
      .rejects.toMatchObject({status:429,code:'DATA_RATE_LIMITED'});
  });

  it('maps unexpected data rejection to a redacted 502 contract',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(418,{message:'raw internal upstream marker'})));
    await expect(readStore('access-token'))
      .rejects.toMatchObject({status:502,code:'SUPABASE_ERROR',expose:false});
  });

  it('maps metadata service outage to a stable 503 contract',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(503,{message:'storage internals'})));
    await expect(readAccountMetadata('access-token'))
      .rejects.toMatchObject({status:503,code:'ACCOUNT_METADATA_UNAVAILABLE'});
  });

  it('maps card-vault throttling to actionable retry guidance',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response(429,{message:'throttled'})));
    await expect(readCardSecrets('owner-1','card-1','access-token'))
      .rejects.toMatchObject({status:429,code:'CARD_VAULT_RATE_LIMITED'});
  });
});
