import {afterEach,describe,expect,it,vi} from 'vitest';
import {ApiError,backupOutcomeMayBeCommitted,createBackup} from '../src/lib/api.js';

const response=(status:number,payload:unknown)=>new Response(JSON.stringify(payload),{
  status,headers:{'content-type':'application/json'},
});
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I18.04 uncertain backup RPC receipt',()=>{
  it('accepts only a nonempty server-issued backup path, never a bare HTTP success',async()=>{
    const methods:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      methods.push((init?.method||'GET')+' '+String(input));
      return response(200,{path:'supabase://rheomiq_backups/qa-only'});
    }));
    await expect(createBackup()).resolves.toEqual({path:'supabase://rheomiq_backups/qa-only'});
    expect(methods).toEqual(['POST /api/backup']);
  });

  it.each([
    {label:'empty object',payload:{}},
    {label:'null',payload:null},
    {label:'array',payload:[]},
    {label:'blank path',payload:{path:'  '}},
    {label:'nonstring path',payload:{path:42}},
  ])('refuses an unverified backup receipt despite HTTP 200 ($label)',async({payload})=>{
    let posts=0;
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe('/api/backup');
      expect(init?.method).toBe('POST');
      posts+=1;
      return response(200,payload);
    }));
    const result=await createBackup().then(
      ()=>({ok:true as const}),
      (error:unknown)=>({ok:false as const,error}),
    );
    expect(result.ok).toBe(false);
    if(!result.ok){
      expect(result.error).toBeInstanceOf(ApiError);
      expect(result.error).toMatchObject({status:503,code:'BACKUP_RECEIPT_UNVERIFIED'});
      expect(backupOutcomeMayBeCommitted(result.error)).toBe(true);
    }
    expect(posts).toBe(1);
  });

  it('does not treat an upstream 503 after a possible commit as a definite failed backup',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>response(503,{error:'Upstream response lost',code:'BACKUP_UNAVAILABLE'})));
    await expect(createBackup()).rejects.toMatchObject({status:503,code:'BACKUP_UNAVAILABLE'});
    expect(backupOutcomeMayBeCommitted(new ApiError('upstream',503,'BACKUP_UNAVAILABLE'))).toBe(true);
  });

  it('classifies a lost transport response as uncertain while preserving definite 4xx rejection',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Connection dropped after backup RPC')}));
    const lost=await createBackup().catch((error:unknown)=>error);
    expect(lost).toBeInstanceOf(ApiError);
    expect(lost).toMatchObject({status:0,code:'NETWORK_ERROR'});
    expect(backupOutcomeMayBeCommitted(lost)).toBe(true);
    expect(backupOutcomeMayBeCommitted(new ApiError('not authorized',403,'FORBIDDEN'))).toBe(false);
    expect(backupOutcomeMayBeCommitted(new Error('local validation'))).toBe(false);
  });
});
