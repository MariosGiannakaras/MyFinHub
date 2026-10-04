import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY='11'.repeat(32);
let stored:any=null;

beforeEach(()=>{
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  process.env.CARD_VAULT_KEY=KEY;
  process.env.CARD_VAULT_KEY_VERSION='1';
  stored=null;
  vi.stubGlobal('fetch',vi.fn(async(input:string|URL,init:RequestInit={})=>{
    const url=String(input);
    const method=String(init.method||'GET').toUpperCase();
    if(!url.includes('/rest/v1/rheomiq_card_secrets'))return new Response('{}',{status:404});
    if(method==='GET')return new Response(JSON.stringify(stored?[stored]:[]),{status:200,headers:{'content-type':'application/json'}});
    if(method==='POST'){
      const row=JSON.parse(String(init.body||'{}'));
      stored={ciphertext:row.ciphertext,iv:row.iv,auth_tag:row.auth_tag,key_version:row.key_version};
      return new Response('',{status:201,headers:{'content-type':'application/json'}});
    }
    if(method==='DELETE'){stored=null;return new Response(null,{status:204})}
    return new Response('{}',{status:405});
  }));
});

afterEach(()=>{
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.CARD_VAULT_KEY;
  delete process.env.CARD_VAULT_KEY_VERSION;
});

describe('card vault encrypted persistence round trip',()=>{
  it('writes, reveals, partially updates and deletes encrypted card secrets through the real store',async()=>{
    const {writeCardSecrets,readCardSecrets,deleteCardSecrets}=await import('../server/cardVaultStore.js');
    const first=await writeCardSecrets('owner-1','card-1',{pan:'4242424242424242',expiry:'12/31',cvv:'123'},'jwt');
    expect(first).toEqual({pan:'4242424242424242',expiry:'12/31',cvv:'123'});
    expect(stored).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain('4242424242424242');
    expect(JSON.stringify(stored)).not.toContain('123');

    await expect(readCardSecrets('owner-1','card-1','jwt')).resolves.toEqual(first);

    const updated=await writeCardSecrets('owner-1','card-1',{pan:'5555555555554444',expiry:'09/32'},'jwt');
    expect(updated).toEqual({pan:'5555555555554444',expiry:'09/32',cvv:'123'});
    await expect(readCardSecrets('owner-1','card-1','jwt')).resolves.toEqual(updated);

    await deleteCardSecrets('owner-1','card-1','jwt');
    await expect(readCardSecrets('owner-1','card-1','jwt')).resolves.toBeNull();
  });

  it('fails with a distinct safe configuration error when encryption material is missing',async()=>{
    delete process.env.CARD_VAULT_KEY;
    const {writeCardSecrets}=await import('../server/cardVaultStore.js');
    await expect(writeCardSecrets('owner-1','card-1',{pan:'4242',expiry:'12/31'},'jwt')).rejects.toMatchObject({
      status:503,
      code:'CARD_VAULT_CONFIG_ERROR',
    });
  });
});
