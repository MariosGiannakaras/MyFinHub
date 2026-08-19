import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveCardSecret } from '../src/lib/cardVaultClient.js';

afterEach(()=>{vi.unstubAllGlobals()});

describe('card vault client',()=>{
  it('whitelists PAN and expiry even when the runtime object carries a CVV-like extra property',async()=>{
    let sent='';
    vi.stubGlobal('fetch',vi.fn(async (_url:string,init?:RequestInit)=>{
      sent=String(init?.body||'');
      return new Response(JSON.stringify({saved:true,last4:'4242'}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const unsafeRuntimeObject={pan:'4242424242424242',expiry:'12/30',cvv:'123'} as unknown as {pan?:string;expiry?:string};
    await saveCardSecret('card-1',unsafeRuntimeObject);
    expect(JSON.parse(sent)).toEqual({cardId:'card-1',pan:'4242424242424242',expiry:'12/30'});
    expect(sent.toLowerCase()).not.toContain('cvv');
    expect(sent).not.toContain('123');
  });
});
