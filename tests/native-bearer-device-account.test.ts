import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { ApiError } from '../server/http.js';

const storage = vi.hoisted(() => ({ isOwner: vi.fn() }));
const devices = vi.hoisted(() => ({
  ensureDeviceSessionAccess: vi.fn(), listDeviceSessions: vi.fn(),
  renameDeviceSession: vi.fn(), revokeDeviceSession: vi.fn(), revokeOtherDeviceSessions: vi.fn(),
}));
vi.mock('../server/storage.js', () => storage);
vi.mock('../server/deviceSessionRegistry.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../server/deviceSessionRegistry.js')>(), ...devices,
}));
vi.mock('../server/appLockHandler.js', () => ({ handleAppLockRequest: vi.fn() }));
import { handleDeviceSessionsRequest } from '../server/deviceSessionsHandler.js';
import { handleAccountSecurityRequest } from '../server/accountSecurityHandler.js';
import sessionRoute from '../api/auth/session.js';

const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const ticket = 'a'.repeat(43);
const temporarySessionId = '123e4567-e89b-42d3-a456-426614174001';
const token = (aal = 'aal2', sid = sessionId) => `test.${Buffer.from(JSON.stringify({ aal, session_id: sid })).toString('base64url')}.test`;
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
  let proofUser = 'owner-id';
  let proofSession = temporarySessionId;
  let proofAal = 'aal1';
  let proofStatus = 200;
  let logoutStatus = 204;
  const headers = (aal = 'aal2') => ({ authorization: `Bearer ${token(aal)}`, 'x-myfinhub-app-unlock': ticket });
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://project.example.test');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_synthetic');
    allowTicket = true; allowAuth = true;
    proofUser = 'owner-id'; proofSession = temporarySessionId; proofAal = 'aal1'; proofStatus = 200; logoutStatus = 204;
    vi.clearAllMocks();
    storage.isOwner.mockReset().mockResolvedValue(true);
    devices.ensureDeviceSessionAccess.mockReset().mockResolvedValue({});
    devices.listDeviceSessions.mockResolvedValue({ rows: [], currentSessionId: sessionId });
    upstream = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/v1/token?grant_type=password')) {
        if (proofStatus !== 200) return json(proofStatus, { error_code: 'invalid_credentials', msg: 'Synthetic auth rejection' });
        if (JSON.parse(String(init?.body)).password !== 'old-synthetic') return json(400, { error_code: 'invalid_credentials' });
        return json(200, { access_token: token(proofAal, proofSession), refresh_token: 'temporary-synthetic', expires_in: 3600, user: {id: proofUser, email: 'owner@example.test'} });
      }
      if (url.endsWith('/auth/v1/logout?scope=local')) return new Response(null, { status: logoutStatus });
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
    const proofIndex = upstream.mock.calls.findIndex(([url]) => url.endsWith('/auth/v1/token?grant_type=password'));
    const logoutIndex = upstream.mock.calls.findIndex(([url]) => url.endsWith('/auth/v1/logout?scope=local'));
    const updateIndex = upstream.mock.calls.findIndex(([, init]) => init?.method === 'PUT' && JSON.parse(String(init.body)).password);
    expect(proofIndex).toBeGreaterThanOrEqual(0);
    expect(logoutIndex).toBeGreaterThan(proofIndex);
    expect(updateIndex).toBeGreaterThan(logoutIndex);
    expect(upstream.mock.calls[proofIndex][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ email: 'owner@example.test', password: 'old-synthetic' }) });
    expect(upstream.mock.calls[logoutIndex][1]).toMatchObject({ method: 'POST', headers: { authorization: `Bearer ${token('aal1', temporarySessionId)}` } });
    expect(upstream.mock.calls[updateIndex][1]).toMatchObject({ method: 'PUT', headers: { authorization: `Bearer ${token()}` }, body: JSON.stringify({ current_password: 'old-synthetic', password: 'New-Synthetic-2026!' }) });
    expect(upstream.mock.calls.filter(([url]) => url.includes('/auth/v1/logout'))).toHaveLength(1);
  });

  it('requires correct current password and fail-closed independent proof for every password mutation', async () => {
    const change = { action: 'password', currentPassword: 'old-synthetic', newPassword: 'New-Synthetic-2026!' };
    const denied = async (status: number, code: string, currentPassword = change.currentPassword, expectedLogout = false) => {
      upstream.mockClear();
      const res = response();
      await invoke('account', request('account', rewrite, headers(), 'PATCH', { ...change, currentPassword }), res);
      expect(res.statusCode).toBe(status);
      expect(JSON.parse(res.body).code).toBe(code);
      expect(res.headers.has('set-cookie')).toBe(false);
      expect(upstream.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
      const logouts = upstream.mock.calls.filter(([url]) => url.includes('/auth/v1/logout'));
      expect(logouts).toHaveLength(expectedLogout ? 1 : 0);
      if (expectedLogout) {
        expect(logouts[0][0].endsWith('/auth/v1/logout?scope=local')).toBe(true);
        expect(logouts[0][1]).toMatchObject({ headers: { authorization: `Bearer ${token(proofAal, proofSession)}` } });
      }
    };
    await denied(400, 'INVALID_CURRENT_PASSWORD', 'incorrect-synthetic');
    proofUser = 'different-user'; await denied(403, 'ACCOUNT_CHANGE_REJECTED', change.currentPassword, true); proofUser = 'owner-id';
    proofAal = 'aal2'; await denied(403, 'ACCOUNT_CHANGE_REJECTED', change.currentPassword, true); proofAal = 'aal1';
    proofSession = sessionId.toUpperCase(); await denied(503, 'AUTH_UNAVAILABLE'); proofSession = temporarySessionId;
    proofSession = ''; await denied(503, 'AUTH_UNAVAILABLE'); proofSession = temporarySessionId;
    logoutStatus = 500; await denied(503, 'AUTH_UNAVAILABLE', change.currentPassword, true); logoutStatus = 204;
    proofStatus = 429; await denied(429, 'AUTH_RATE_LIMITED'); proofStatus = 200;
    // Same-origin cookie clients use the same proof without replacing their AAL2 cookie.
    const res = response();
    const cookie = `rheomiq_access=${encodeURIComponent(token())}`;
    await invoke('account', request('account', rewrite, { cookie, 'sec-fetch-site': 'same-origin', 'x-myfinhub-app-unlock': ticket }, 'PATCH', change), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers.has('set-cookie')).toBe(false);
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
