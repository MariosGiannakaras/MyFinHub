import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAppLockAction } from '../server/appLockHandler.js';
import { ApiError } from '../server/http.js';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

describe('shared owner app privacy PIN',()=>{
  it('rejects unbounded and extra fields while keeping the allowed idle intervals',()=>{
    expect(parseAppLockAction({action:'configure',newPin:'1234',idleMinutes:5})).toEqual({action:'configure',newPin:'1234',idleMinutes:5});
    expect(parseAppLockAction({action:'verify',pin:'1234'})).toEqual({action:'verify',pin:'1234'});
    expect(parseAppLockAction({action:'change',pin:'1234',newPin:'2345'})).toEqual({action:'change',pin:'1234',newPin:'2345'});
    expect(parseAppLockAction({action:'disable',pin:'1234'})).toEqual({action:'disable',pin:'1234'});
    expect(parseAppLockAction({action:'lock',unlockToken:'a'.repeat(43)})).toEqual({action:'lock',unlockToken:'a'.repeat(43)});
    expect(parseAppLockAction({action:'timeout',pin:'1234',idleMinutes:60})).toEqual({action:'timeout',pin:'1234',idleMinutes:60});
    for(const body of [
      {},[],{action:'verify',pin:'12345'},{action:'verify',pin:'abcd'},
      {action:'verify',pin:'1234',secret:true},{action:'timeout',pin:'1234',idleMinutes:0},
      {action:'configure',newPin:'1234',idleMinutes:10},{action:'change',pin:'1234',newPin:'12'},
      {action:'disable',pin:12},{action:'lock',unlockToken:'invalid'},{action:'unblock',pin:'1234'},
    ])expect(()=>parseAppLockAction(body)).toThrow(ApiError);
  });

  it('keeps a non-queryable verifier and a strictly owner/AAL2 scoped RPC',()=>{
    const sql=read('supabase/migrations/20261024160000_shared_owner_app_lock.sql');
    expect(sql).toContain('revoke all on public.myfinhub_app_lock from public, anon, authenticated');
    expect(sql).toContain('security definer');
    expect(sql).toContain('public.rheomiq_is_owner_aal2()');
    expect(sql).toContain('for update');
    expect(sql).toContain('myfinhub_app_lock_tickets');
    expect(sql).toContain("p_action='validate'");
    expect(sql).toContain("p_action='revoke'");
    expect(sql).toContain("interval '30 seconds'");
    expect(sql).toContain("extensions.crypt");
    expect(sql).not.toMatch(/grant\s+select\s+on\s+(table\s+)?public\.myfinhub_app_lock\s+to\s+authenticated/i);
    expect(sql).not.toContain('SUPABASE_SECRET_KEY');
  });

  it('exposes an authenticated, same-origin, bounded web and Windows PIN contract',()=>{
    const api=read('server/appLockHandler.ts');
    const vercel=JSON.parse(read('vercel.json')) as {rewrites:Array<{source:string;destination:string}>};
    const route=read('api/auth/session.ts');
    const main=read('server/index.ts');
    const gate=read('src/components/DesktopAppLockGate.tsx');
    const settings=read('src/components/AccountSecuritySettings.tsx');
    const entry=read('src/main.tsx');
    expect(api).toContain('requireSession(req,res)');
    expect(api).toContain('isOwner(session.accessToken)');
    expect(api).toContain("accessTokenAal(session.accessToken)!=='aal2'");
    expect(api).toContain('assertMutationSessionOrigin(req,session)');
    expect(api).toContain('readJsonBody(req,512)');
    expect(api).toContain('revokeUnlockTicket');
    expect(read('server/auth.ts')).toContain('requiresAppUnlock(req)');
    expect(read('src/lib/api.ts')).toContain('getAppUnlockToken');
    expect(read('src/components/DesktopAppLockGate.tsx')).toContain('clearAppUnlockToken');
    expect(api).toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(api).not.toContain('SUPABASE_SECRET_KEY');
    expect(vercel.rewrites).toContainEqual({source:'/api/auth/app-lock',destination:'/api/auth/session?__myfinhub_route=app-lock'});
    expect(route).toContain("marker === 'app-lock'");
    expect(main).toContain("app.all('/api/auth/app-lock'");
    expect(entry).toContain("import './components/DesktopAppLockGate.css'");
    expect(gate).toContain('getSharedAppLockState');
    expect(gate).toContain("action:'verify'");
    expect(gate).toContain('Unmount the financial workspace');
    expect(gate).toContain("'visibilitychange'");
    expect(settings).toContain('getSharedAppLockState');
    expect(settings).toContain('Τρέχον 4ψήφιο PIN');
  });
});
