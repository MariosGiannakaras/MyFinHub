import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { ApiError } from '../server/http.js';

const storage = vi.hoisted(() => ({ isOwner: vi.fn() }));
const devices = vi.hoisted(() => ({
  ensureDeviceSessionAccess: vi.fn(), listDeviceSessions: vi.fn(),
  renameDeviceSession: vi.fn(), revokeDeviceSession: vi.fn(), revokeOtherDeviceSessions: vi.fn(),
}));
vi.mock('../server/storage.js', () => storage);
vi.mock('../server/deviceSessionRegistry.js', () => devices);
vi.mock('../server/appLockHandler.js', () => ({ handleAppLockRequest: vi.fn() }));
import { handleDeviceSessionsRequest } from '../server/deviceSessionsHandler.js';
import { handleAccountSecurityRequest } from '../server/accountSecurityHandler.js';
import sessionRoute from '../api/auth/session.js';

const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const ticket = 'a'.repeat(43);
const token = (aal = 'aal2') => `test.${Buffer.from(JSON.stringify({ aal, session_id: sessionId })).toString('base64url')}.test`;
const response = () => ({ statusCode: 0, body: '', headers: new Map<string, unknown>(),
  setHeader(name: string, value: unknown) { this.headers.set(name.toLowerCase(), value); },
  end(value = '') { this.body = String(value); },
});
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const request = (route: 'devices' | 'account', rewrite: boolean, headers: Record<string, string>, method?: string, body?: unknown) => ({
  method: method ?? (route === 'devices' ? 'POST' : 'PATCH'),
  url: rewrite ? `/api/auth/session?__myfinhub_route=${route}` : `/api/auth/${route}`,
  ...(rewrite ? { query: { __myfinhub_route: route } } : {}),
  headers, body: body ?? (route === 'devices' ? { action: 'rename', sessionId, nickname: 'Synthetic phone' } : { action: 'email', email: 'new@example.test' }),
});

for (const rewrite of [false, true]) describe(`native access settings ${rewrite ? 'Vercel rewrite' : 'direct Express handler'}`, () => {
  const invoke = (route: 'devices' | 'account', req: ReturnType<typeof request>, res: ReturnType<typeof response>) =>
    rewrite ? sessionRoute(req, res) : route === 'devices' ? handleDeviceSessionsRequest(req, res) : handleAccountSecurityRequest(req, res);
  let allowTicket = true;
  let allowAuth = true;
  let upstream = vi.fn();
  const headers = (aal = 'aal2') => ({ authorization: `Bearer ${token(aal)}`, 'x-myfinhub-app-unlock': ticket });
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://project.example.test');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_synthetic');
    allowTicket = true; allowAuth = true;
    vi.clearAllMocks();
    storage.isOwner.mockReset().mockResolvedValue(true);
    devices.ensureDeviceSessionAccess.mockReset().mockResolvedValue({});
    devices.listDeviceSessions.mockResolvedValue({ rows: [], currentSessionId: sessionId });
    upstream = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/v1/user') && init?.method === 'PUT') return json(200, { id: 'owner-id', email: 'new@example.test' });
      if (url.endsWith('/auth/v1/user')) return allowAuth ? json(200, { id: 'owner-id', email: 'owner@example.test' }) : json(401, {});
      if (url.endsWith('/rest/v1/rpc/myfinhub_app_lock_ticket')) return json(200, allowTicket);
      throw new Error('Unexpected upstream path');
    });
    vi.stubGlobal('fetch', upstream);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('lists, renames, resets and revokes devices using the validated owner bearer', async () => {
    for (const [method, body] of [ ['GET', null], ['POST', { action: 'rename', sessionId, nickname: 'Synthetic phone' }], ['POST', { action: 'rename', sessionId, nickname: '' }], ['POST', { action: 'revoke', sessionId }], ['POST', { action: 'revoke-others' }] ] as const) {
      const res = response();
      await invoke('devices', request('devices', rewrite, headers(), method, body), res);
      expect(res.statusCode).toBe(200);
      expect(res.headers.has('set-cookie')).toBe(false);
    }
    expect(devices.listDeviceSessions).toHaveBeenCalledTimes(5);
    expect(devices.renameDeviceSession).toHaveBeenCalledWith(token(), 'owner-id', sessionId, 'Synthetic phone');
    expect(devices.renameDeviceSession).toHaveBeenCalledWith(token(), 'owner-id', sessionId, null);
    expect(devices.revokeDeviceSession).toHaveBeenCalledWith(token(), 'owner-id', sessionId);
    expect(devices.revokeOtherDeviceSessions).toHaveBeenCalledWith(token(), 'owner-id');
  });

  it('passes email and password changes only to the authenticated owner upstream', async () => {
    for (const body of [{ action: 'email', email: 'new@example.test' }, { action: 'password', currentPassword: 'old-synthetic', newPassword: 'New-Synthetic-2026!' }]) {
      const res = response();
      await invoke('account', request('account', rewrite, headers(), 'PATCH', body), res);
      expect(res.statusCode).toBe(200);
      expect(res.headers.has('set-cookie')).toBe(false);
    }
    expect(upstream).toHaveBeenCalledWith(expect.stringContaining('/rest/v1/rpc/myfinhub_app_lock_ticket'), expect.objectContaining({ body: JSON.stringify({ p_action: 'validate', p_token_hash: createHash('sha256').update(ticket).digest('hex') }) }));
    expect(upstream).toHaveBeenCalledWith(expect.stringContaining('/auth/v1/user'), expect.objectContaining({ method: 'PUT', body: JSON.stringify({ current_password: 'old-synthetic', password: 'New-Synthetic-2026!' }) }));
  });

  for (const route of ['devices', 'account'] as const) {
    it(`denies ${route} AAL1, non-owner, revoked, locked, invalid bearer and foreign cookie origin`, async () => {
      const check = async (h: Record<string, string>, status: number, code: string) => {
        const res = response(); await invoke(route, request(route, rewrite, h), res);
        expect(res.statusCode).toBe(status); expect(JSON.parse(res.body).code).toBe(code); expect(res.headers.has('set-cookie')).toBe(false);
      };
      await check(headers('aal1'), 403, 'MFA_REQUIRED');
      storage.isOwner.mockResolvedValueOnce(false); await check(headers(), 401, 'AUTH_REQUIRED');
      devices.ensureDeviceSessionAccess.mockRejectedValueOnce(new ApiError(403, 'DEVICE_ACCESS_REVOKED', 'Revoked')); await check(headers(), 403, 'DEVICE_ACCESS_REVOKED');
      allowTicket = false; await check(headers(), 423, 'APP_LOCK_REQUIRED'); allowTicket = true;
      const cookie = `rheomiq_access=${encodeURIComponent(token())}`;
      await check({ authorization: 'invalid', cookie }, 401, 'AUTH_REQUIRED');
      allowAuth = false; await check({ ...headers(), cookie }, 401, 'AUTH_REQUIRED'); allowAuth = true;
      await check({ cookie, 'sec-fetch-site': 'cross-site', 'x-myfinhub-app-unlock': ticket }, 403, 'CROSS_SITE_REQUEST');
      expect(devices.renameDeviceSession).not.toHaveBeenCalled();
      expect(upstream.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
      const res = response();
      await invoke(route, request(route, rewrite, { cookie, 'sec-fetch-site': 'same-origin', 'x-myfinhub-app-unlock': ticket }), res);
      expect(res.statusCode).toBe(200);
    });
  }
});
