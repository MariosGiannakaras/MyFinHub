import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_REQUEST_TIMEOUT_MS, ApiError, getSession } from '../src/lib/api.js';

describe('client API network resilience',()=>{
  afterEach(()=>{
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('turns an offline fetch failure into a stable task-level network error',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Failed to fetch')}));
    await expect(getSession()).rejects.toMatchObject({
      name:'ApiError',
      status:0,
      code:'NETWORK_ERROR',
    } satisfies Partial<ApiError>);
  });

  it('bounds a hung request and reports a timeout instead of saving forever',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn((_input:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
      init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
    })));

    const rejection=expect(getSession()).rejects.toMatchObject({
      name:'ApiError',
      status:0,
      code:'NETWORK_TIMEOUT',
    } satisfies Partial<ApiError>);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await rejection;
  });

  it('clears the timeout after a normal response',async()=>{
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({authenticated:false,email:null}),{
      status:200,
      headers:{'content-type':'application/json'},
    })));
    await expect(getSession()).resolves.toEqual({authenticated:false,email:null});
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS*2);
  });
});
