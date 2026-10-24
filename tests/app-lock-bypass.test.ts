import {afterEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {assertAppUnlock,requiresAppUnlock} from '../server/appUnlockAccess.js';
import {ApiError} from '../server/http.js';

const request=(path:string,token?:string)=>({
  url:path,
  headers: token?{'x-myfinhub-app-unlock':token}:{},
});

afterEach(()=>{
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
});

describe('app lock server-side bypass prevention',()=>{
  it('covers all financial and owner-device handlers even through Vercel route rewrite markers',()=>{
    for(const path of ['/api/data','/api/data?revision=1','/api/import','/api/history',
      '/api/backup','/api/card-secrets','/api/account-metadata','/api/auth/devices',
      '/api/auth/account','/api/android-update','/api/auth/session?__myfinhub_route=devices',
      '/api/auth/session?__myfinhub_route=account']){
      expect(requiresAppUnlock(request(path)),path).toBe(true);
    }
    expect(requiresAppUnlock({url:'/api/auth/session',headers:{}})).toBe(false);
    expect(requiresAppUnlock({url:'/api/auth/app-lock',headers:{}})).toBe(false);
    expect(requiresAppUnlock({url:'/api/auth/logout',headers:{}})).toBe(false);
    expect(requiresAppUnlock({url:'/api/auth/session',query:{__myfinhub_route:'devices'},headers:{}})).toBe(true);
  });

  it('rejects requests without an accepted server ticket even if they carry authenticated cookies',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
    const fake=vi.fn(async()=>new Response('false',{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fake);
    await expect(assertAppUnlock(request('/api/data'),'test-session')).rejects.toMatchObject({status:423,code:'APP_LOCK_REQUIRED'});
    expect(fake).toHaveBeenCalledTimes(1);
    const args=fake.mock.calls[0] as unknown as [string,RequestInit];
    expect(args[0]).toContain('/rest/v1/rpc/myfinhub_app_lock_ticket');
    expect(JSON.parse(String(args[1].body))).toEqual({p_action:'validate',p_token_hash:''});
    expect(String((args[1].headers as Record<string,string>).authorization)).toContain('test-session');
  });

  it('does not treat a forged, tampered or malformed DevTools unlock header as a valid PIN',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
    const fake=vi.fn(async()=>new Response('false',{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fake);
    await expect(assertAppUnlock(request('/api/data','javascript:alert(1)'),'token')).rejects.toMatchObject({status:423});
    expect(fake).not.toHaveBeenCalled();
    const forged='a'.repeat(43);
    await expect(assertAppUnlock(request('/api/data',forged),'token')).rejects.toMatchObject({status:423});
    const args=fake.mock.calls[0] as unknown as [string,RequestInit];
    expect(JSON.parse(String(args[1].body)).p_token_hash).toBe(createHash('sha256').update(forged).digest('hex'));
  });

  it('accepts only the authenticated server receipt and fails closed when upstream is unavailable',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
    const token='f'.repeat(43);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('true',{status:200,headers:{'content-type':'application/json'}})));
    await expect(assertAppUnlock(request('/api/data',token),'test-access-token')).resolves.toBeUndefined();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('error',{status:503,headers:{'content-type':'application/json'}})));
    await expect(assertAppUnlock(request('/api/data',token),'test-access-token')).rejects.toMatchObject({status:503,code:'APP_LOCK_UNAVAILABLE'});
  });

  it('keeps authentication and PIN unlock separate from presentation-only UI',async()=>{
    const source=await import('node:fs').then(fs=>fs.readFileSync(new URL('../src/components/DesktopAppLockGate.tsx',import.meta.url),'utf8'));
    expect(source).toContain('clearAppUnlockToken()');
    expect(source).toContain('getAppUnlockToken()');
    expect(source).toContain('phase===\'unlocked\'');
    expect(source).toContain('Unmount the financial workspace');
    expect(source).toContain("'pagehide'");
  });
});
