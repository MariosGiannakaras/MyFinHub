import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../server/http.js';

const registry = vi.hoisted(() => ({ ensureDeviceSessionAccess: vi.fn() }));
vi.mock('../server/deviceSessionRegistry.js', () => registry);

import { requireSession } from '../server/auth.js';

const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';
const UNLOCK_TICKET = 'a'.repeat(43);
const JWT = 'eyJhbGciOiJub25lIn0.' + Buffer.from(
  JSON.stringify({ sub: 'synthetic-owner', session_id: SESSION_ID, aal: 'aal2' }),
).toString('base64url') + '.synthetic';

function recorder() {
  const headers = new Map<string, unknown>();
  return {
    headers,
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), value); },
  };
}
function financeRequest(source: 'cookie' | 'bearer') {
  const authorization = source === 'bearer' ? { authorization: 'Bearer ' + JWT } : {};
  const cookie = source === 'cookie'
    ? { cookie: 'rheomiq_access=' + JWT + '; rheomiq_refresh=synthetic-refresh' }
    : { cookie: 'rheomiq_access=unrelated-browser-cookie; rheomiq_refresh=unrelated-refresh' };
  return {
    url: '/api/data',
    method: 'GET',
    headers: { ...authorization, ...cookie, 'x-myfinhub-app-unlock': UNLOCK_TICKET },
  };
}
function upstream(allowed: boolean, entries: string[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith('/auth/v1/user')) {
      entries.push('gotrue-auth');
      return new Response(JSON.stringify({ id: 'synthetic-owner', email: 'owner@example.test' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    if (path.endsWith('/rest/v1/rpc/myfinhub_app_lock_ticket')) {
      entries.push('pin-ticket');
      const headers = (init?.headers || {}) as Record<string, string>;
      expect(headers.authorization).toBe('Bearer ' + JWT);
      expect(headers.apikey).toBe('sb_publishable_synthetic');
      expect(JSON.parse(String(init?.body))).toEqual({
        p_action: 'validate',
        p_token_hash: createHash('sha256').update(UNLOCK_TICKET).digest('hex'),
      });
      return new Response(JSON.stringify(allowed), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error('Unexpected network operation in synthetic PIN/device session proof.');
  }));
}

describe('#649 I03.06 active-device revocation and App Lock ticket timing', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.test';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_synthetic';
    registry.ensureDeviceSessionAccess.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  });

  it.each(['cookie', 'bearer'] as const)(
    'checks the current %s Auth device before accepting any server PIN ticket',
    async source => {
      const sequence: string[] = [];
      upstream(true, sequence);
      registry.ensureDeviceSessionAccess.mockImplementation(async () => { sequence.push('device-registry'); });
      const res = recorder();
      const session = await requireSession(financeRequest(source), res, { allowBearer: true });
      expect(session).toMatchObject({ accessToken: JWT, source, user: { id: 'synthetic-owner' } });
      expect(sequence).toEqual(['gotrue-auth', 'device-registry', 'pin-ticket']);
      expect(registry.ensureDeviceSessionAccess).toHaveBeenCalledTimes(1);
      expect(res.headers.has('set-cookie')).toBe(false);
    },
  );

  it.each(['cookie', 'bearer'] as const)(
    'blocks a revoked %s session before even consulting a previously valid PIN ticket',
    async source => {
      const sequence: string[] = [];
      upstream(true, sequence);
      registry.ensureDeviceSessionAccess.mockImplementation(async () => {
        sequence.push('device-registry');
        throw new ApiError(401, 'DEVICE_ACCESS_REVOKED', 'Device session revoked.');
      });
      const res = recorder();
      await expect(requireSession(financeRequest(source), res, { allowBearer: true }))
        .rejects.toMatchObject({ status: 401, code: 'DEVICE_ACCESS_REVOKED' });
      expect(sequence).toEqual(['gotrue-auth', 'device-registry']);
      expect(res.headers.has('set-cookie')).toBe(source === 'cookie');
    },
  );

  it.each(['cookie', 'bearer'] as const)(
    'denies an expired %s PIN lease without logging out the valid device session',
    async source => {
      const sequence: string[] = [];
      upstream(false, sequence);
      registry.ensureDeviceSessionAccess.mockImplementation(async () => { sequence.push('device-registry'); });
      const res = recorder();
      await expect(requireSession(financeRequest(source), res, { allowBearer: true }))
        .rejects.toMatchObject({ status: 423, code: 'APP_LOCK_REQUIRED' });
      expect(sequence).toEqual(['gotrue-auth', 'device-registry', 'pin-ticket']);
      expect(res.headers.has('set-cookie')).toBe(false);
    },
  );

  it('does not reuse a just-approved ticket after the same owner device is revoked', async () => {
    const sequence: string[] = [];
    upstream(true, sequence);
    registry.ensureDeviceSessionAccess.mockImplementationOnce(async () => { sequence.push('device-registry'); })
      .mockImplementationOnce(async () => {
        sequence.push('device-revoked');
        throw new ApiError(401, 'DEVICE_ACCESS_REVOKED', 'Device session revoked.');
      });
    await expect(requireSession(financeRequest('bearer'), recorder(), { allowBearer: true }))
      .resolves.toMatchObject({ source: 'bearer' });
    await expect(requireSession(financeRequest('bearer'), recorder(), { allowBearer: true }))
      .rejects.toMatchObject({ status: 401, code: 'DEVICE_ACCESS_REVOKED' });
    expect(sequence).toEqual(['gotrue-auth', 'device-registry', 'pin-ticket', 'gotrue-auth', 'device-revoked']);
  });
});
