import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, API_REQUEST_TIMEOUT_MS, apiRequest } from '../src/lib/api.js';
import { cardVaultErrorMessage, revealCardSecret } from '../src/lib/cardVaultClient.js';

const CLIENTS=[
  'src/lib/accountMetadataClient.ts',
  'src/lib/cardVaultClient.ts',
  'src/lib/financialProviderClient.ts',
];

describe('shared client network boundary',()=>{
  afterEach(()=>{
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(CLIENTS)('%s uses the bounded API request instead of raw fetch',(path)=>{
    const source=readFileSync(path,'utf8');
    expect(source).toContain('apiRequest');
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('reports a stable timeout from the shared boundary',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn((_input:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
      init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
    })));
    const rejection=expect(apiRequest('/api/example')).rejects.toMatchObject({status:0,code:'NETWORK_TIMEOUT'} satisfies Partial<ApiError>);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await rejection;
  });

  it('keeps card-vault network failures actionable without exposing runtime detail',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('fetch failed at internal stack')}));
    let error:unknown;
    try{await revealCardSecret('card-1')}catch(reason){error=reason}
    expect(error).toMatchObject({status:0,code:'NETWORK_ERROR'});
    expect(cardVaultErrorMessage(error)).toBe('Δεν ήταν δυνατή η σύνδεση με το ασφαλές vault. Τα αποθηκευμένα στοιχεία δεν άλλαξαν.');
  });
});
