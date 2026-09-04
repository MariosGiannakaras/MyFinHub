import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accessTokenSessionId } from '../server/deviceSessionRegistry.js';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const token=(claims:Record<string,unknown>)=>`header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

describe('connected device access',()=>{
  it('uses the canonical Supabase session_id claim as the device-session identity',()=>{
    const id='123e4567-e89b-42d3-a456-426614174000';
    expect(accessTokenSessionId(token({session_id:id,aal:'aal2'}))).toBe(id);
    expect(accessTokenSessionId(token({session_id:'not-a-uuid'}))).toBe('');
    expect(accessTokenSessionId('invalid')).toBe('');
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
    const route=read('api/auth/devices.ts');
    const client=read('src/lib/api.ts');
    const ui=read('src/components/DeviceAccessSettings.tsx');
    expect(auth).toContain('ensureDeviceSessionAccess(req, accessToken, user.id)');
    expect(auth).toContain("accessTokenAal(accessToken) === 'aal2'");
    expect(handler).toContain('isOwner(session.accessToken)');
    expect(handler).toContain("accessTokenAal(session.accessToken) !== 'aal2'");
    expect(handler).toContain('assertMutationSessionOrigin(req, session)');
    expect(handler).toContain("body?.action === 'revoke'");
    expect(handler).toContain("body?.action === 'revoke-others'");
    expect(route).toContain('handleDeviceSessionsRequest');
    expect(client).toContain('getConnectedDevices');
    expect(client).toContain('revokeConnectedDevice');
    expect(client).toContain('revokeOtherConnectedDevices');
    expect(ui).toContain('Συνδεδεμένες συσκευές');
    expect(ui).toContain('Αφαίρεση όλων των άλλων');
    expect(ui).toContain('Αυτή η συσκευή');
  });
});
