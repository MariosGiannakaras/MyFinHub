import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessTokenSessionId, ensureDeviceSessionAccess } from '../server/deviceSessionRegistry.js';
import { parseDeviceSessionAction } from '../server/deviceSessionsHandler.js';
import { ApiError } from '../server/http.js';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const token=(claims:Record<string,unknown>)=>`header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

afterEach(()=>{
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
});

describe('connected device access',()=>{
  it('accepts only exact device revoke payloads with canonical session ids',()=>{
    const id='123e4567-e89b-42d3-a456-426614174000';
    expect(parseDeviceSessionAction({action:'revoke',sessionId:id})).toEqual({action:'revoke',sessionId:id});
    expect(parseDeviceSessionAction({action:'revoke-others'})).toEqual({action:'revoke-others'});
    for(const value of [
      {action:'revoke',sessionId:'not-a-uuid'},
      {action:'revoke',sessionId:id,extra:true},
      {action:'revoke-others',sessionId:id},
      {action:'unknown'},
      [],
    ])expect(()=>parseDeviceSessionAction(value)).toThrow(ApiError);
  });

  it('uses the canonical Supabase session_id claim as the device-session identity',()=>{
    const id='123e4567-e89b-42d3-a456-426614174000';
    expect(accessTokenSessionId(token({session_id:id,aal:'aal2'}))).toBe(id);
    expect(accessTokenSessionId(token({session_id:'not-a-uuid'}))).toBe('');
    expect(accessTokenSessionId('invalid')).toBe('');
  });

  it('keeps AAL2 sessions usable before the registry migration exists',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='publishable';
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({code:'PGRST205',message:"Could not find the table 'public.myfinhub_device_sessions'"}),{status:404,headers:{'content-type':'application/json'}})));
    const access=token({session_id:'123e4567-e89b-42d3-a456-426614174000',aal:'aal2'});
    await expect(ensureDeviceSessionAccess({headers:{}},access,'owner-1')).resolves.toBeNull();
  });

  it('bootstraps with minimal return, recovers a same-session race and fails closed for a hidden revoked row',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='publishable';
    const sessionId='123e4567-e89b-42d3-a456-426614174000';const access=token({session_id:sessionId,aal:'aal2'});
    const activeRow={session_id:sessionId,user_id:'owner-1',platform:'web',device_label:'Web browser',app_version:null,first_seen_at:'2026-09-28T00:00:00.000Z',last_seen_at:'2026-09-28T00:00:00.000Z',revoked_at:null};

    const bootstrapFetch=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(null,{status:201}));
    vi.stubGlobal('fetch',bootstrapFetch);
    await expect(ensureDeviceSessionAccess({headers:{}},access,'owner-1')).resolves.toMatchObject({session_id:sessionId,revoked_at:null});
    expect(bootstrapFetch).toHaveBeenCalledTimes(2);
    const bootstrapInit=bootstrapFetch.mock.calls[1]?.[1] as RequestInit;
    expect((bootstrapInit.headers as Record<string,string>).prefer).toBe('return=minimal');

    const raceFetch=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({code:'23505',message:'duplicate key'}),{status:409,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify([activeRow]),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',raceFetch);
    await expect(ensureDeviceSessionAccess({headers:{}},access,'owner-1')).resolves.toMatchObject({session_id:sessionId,revoked_at:null});

    const revokedFetch=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({code:'23505',message:'duplicate key'}),{status:409,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',revokedFetch);
    try{await ensureDeviceSessionAccess({headers:{}},access,'owner-1');throw new Error('expected revoked access to fail')}catch(error){expect(error).toBeInstanceOf(ApiError);expect((error as ApiError).code).toBe('DEVICE_ACCESS_REVOKED')}
  });

  it('keeps the registry owner/AAL2 scoped and folds active device access into finance RLS',()=>{
    const migration=read('supabase/migrations/20260904083000_add_device_session_registry.sql');
    expect(migration).toContain('create table if not exists public.myfinhub_device_sessions');
    expect(migration).toContain('session_id uuid primary key');
    expect(migration).toContain("session_id::text = coalesce((select auth.jwt() ->> 'session_id'), '')");
    expect(migration).toContain('public.rheomiq_is_owner()');
    expect(migration).toContain('public.rheomiq_has_aal2()');
    expect(migration).toContain('create or replace function public.myfinhub_session_is_active()');
    expect(migration).toContain('and public.myfinhub_session_is_active()');
    expect(migration).toContain('alter table public.myfinhub_device_sessions enable row level security');
    expect(migration).not.toMatch(/security\s+definer/i);
  });

  it('hardens sensitive RLS to the current active device without blocking session bootstrap',()=>{
    const migration=read('supabase/migrations/20260930062504_harden_active_device_sensitive_rls.sql');
    const privateHelper=read('supabase/migrations/20260930062619_move_active_device_rls_helper_private.sql');
    expect(migration).toContain('security definer');
    expect(migration).toContain("coalesce(((select auth.jwt()) ->> 'session_id'), '')");
    expect(migration).toContain('and (select public.myfinhub_session_is_active())');
    expect(migration).toContain('rheomiq_card_secrets_owner_aal2_select');
    expect(migration).toContain('rheomiq_account_metadata_owner_aal2_select');
    expect(migration).toContain('and (select public.rheomiq_is_owner_aal2())');
    expect(migration).toContain('if v_uid is null or not (select public.rheomiq_is_owner_aal2()) then');
    const insertPolicy=migration.slice(migration.indexOf('create policy myfinhub_device_sessions_owner_insert'),migration.indexOf('create policy myfinhub_device_sessions_owner_update'));
    expect(insertPolicy).not.toContain('myfinhub_session_is_active');
    expect(privateHelper).toContain('create schema if not exists private');
    expect(privateHelper).toContain('create or replace function private.myfinhub_session_is_active()');
    expect(privateHelper).toContain('security definer');
    expect(privateHelper).toContain('and (select private.myfinhub_session_is_active())');
    expect(privateHelper).toContain('drop function if exists public.myfinhub_session_is_active()');
  });

  it('uses only publishable-key plus user JWT and supports Android device metadata',()=>{
    const registry=read('server/deviceSessionRegistry.ts');
    expect(registry).toContain('SUPABASE_PUBLISHABLE_KEY');
    expect(registry).toContain('authorization: `Bearer ${accessToken}`');
    expect(registry).toContain("'x-myfinhub-client-platform'");
    expect(registry).toContain("'x-myfinhub-device-name'");
    expect(registry).toContain("'x-myfinhub-app-version'");
    expect(registry).toContain("platform === 'android'");
    expect(registry).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(registry).not.toContain('SUPABASE_SECRET_KEY');
  });

  it('enforces device access centrally and exposes owner-controlled revoke actions',()=>{
    const auth=read('server/auth.ts');
    const handler=read('server/deviceSessionsHandler.ts');
    const route=read('api/auth/session.ts');
    const config=JSON.parse(read('vercel.json')) as {rewrites?:Array<{source:string;destination:string}>};
    const client=read('src/lib/api.ts');
    const ui=read('src/components/DeviceAccessSettings.tsx');
    expect(auth).toContain('ensureDeviceSessionAccess(req, accessToken, user.id)');
    expect(auth).toContain("accessTokenAal(accessToken) === 'aal2'");
    expect(handler).toContain('isOwner(session.accessToken)');
    expect(handler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(handler).toContain('assertMutationSessionOrigin(req, session)');
    expect(handler).toContain('parseDeviceSessionAction');
    expect(handler).toContain("action.action==='revoke'");
    expect(route).toContain('handleDeviceSessionsRequest');
    expect(route).toContain("marker === 'devices'");
    expect(config.rewrites).toContainEqual({source:'/api/auth/devices',destination:'/api/auth/session?__myfinhub_route=devices'});
    expect(existsSync(new URL('../api/auth/devices.ts',import.meta.url))).toBe(false);
    expect(client).toContain('getConnectedDevices');
    expect(client).toContain('revokeConnectedDevice');
    expect(client).toContain('revokeOtherConnectedDevices');
    expect(ui).toContain('Συνδεδεμένες συσκευές');
    expect(ui).toContain('Αφαίρεση όλων των άλλων');
    expect(ui).toContain('Αυτή η συσκευή');
    expect(ui).toContain("role={messageTone==='error'?'alert':'status'}");
    expect(ui).toContain("aria-live={messageTone==='error'?'assertive':'polite'}");
    expect(ui).toContain("role={message&&messageTone==='error'?'alert':undefined}");
  });
});
