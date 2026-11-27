import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSessionCookies } from '../server/auth.js';

const storage = vi.hoisted(() => ({ isOwner: vi.fn() }));
const devices = vi.hoisted(() => ({
  ensureDeviceSessionAccess: vi.fn(),
  listDeviceSessions: vi.fn(),
  renameDeviceSession: vi.fn(),
  revokeDeviceSession: vi.fn(),
  revokeOtherDeviceSessions: vi.fn(),
  endCurrentDeviceSession: vi.fn(),
}));
vi.mock('../server/storage.js', () => storage);
vi.mock('../server/deviceSessionRegistry.js', () => devices);

import sessionHandler from '../api/auth/session.js';
import loginHandler from '../api/auth/login.js';
import logoutHandler from '../api/auth/logout.js';
import enrollHandler from '../api/auth/mfa/enroll.js';
import verifyHandler from '../api/auth/mfa/verify.js';

const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';
const EMAIL = 'owner@example.test';
const safeOrigin = { origin: 'https://app.example.test', host: 'app.example.test', 'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin' };

function accessToken(aal: 'aal1' | 'aal2') {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({ aal, session_id: SESSION_ID })).toString('base64url');
  return header + '.' + claims + '.synthetic';
}
function cookieRequest(method: string, aal: 'aal1' | 'aal2', marker?: string, origin: Record<string, string> = {}) {
  return {
    method,
    headers: { cookie: 'rheomiq_access=' + accessToken(aal), ...origin },
    query: marker ? { __myfinhub_route: marker } : {},
  };
}
function recorder() {
  const headers = new Map<string, unknown>();
  return {
    headers, statusCode: 0, body: '',
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    end(value = '') { this.body = String(value); },
  };
}
function payload(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function userFetch() {
  const calls: Array<{ url: string; method: string; authorization: string }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers || {}) as Record<string, string>;
    calls.push({ url, method: init?.method || 'GET', authorization: headers.authorization || '' });
    if (url.endsWith('/auth/v1/user') && init?.method === 'PUT') {
      return payload(200, { id: 'owner-id', email: EMAIL, new_email: 'new@example.test' });
    }
    if (url.endsWith('/auth/v1/user')) {
      return payload(200, {
        id: 'owner-id', email: EMAIL,
        factors: [{ id: 'synthetic-totp', factor_type: 'totp', status: 'verified' }],
      });
    }
    return payload(500, { message: 'Unexpected Auth endpoint in synthetic profile provenance test' });
  }));
  return calls;
}
function noWrites() {
  for (const action of [
    devices.listDeviceSessions, devices.renameDeviceSession,
    devices.revokeDeviceSession, devices.revokeOtherDeviceSessions,
    devices.endCurrentDeviceSession,
  ]) expect(action).not.toHaveBeenCalled();
}

describe('#649 I03.04 profile, MFA and device cookie/bearer provenance', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const oldVercel = process.env.VERCEL;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.test';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_synthetic';
    delete process.env.VERCEL;
    storage.isOwner.mockReset().mockResolvedValue(true);
    for (const action of Object.values(devices)) action.mockReset();
    devices.ensureDeviceSessionAccess.mockResolvedValue({});
    devices.listDeviceSessions.mockResolvedValue({ rows: [], currentSessionId: SESSION_ID });
    devices.renameDeviceSession.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
    if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = oldVercel;
  });

  it('does not accept bearer-only access for browser profile, devices or the session page', async () => {
    const fetchCalls = userFetch();
    const paths = [
      { marker: 'account', method: 'PATCH', body: { action: 'email', email: 'new@example.test' } },
      { marker: 'devices', method: 'POST', body: { action: 'rename', sessionId: SESSION_ID, nickname: 'Office' } },
      { marker: undefined, method: 'GET', body: undefined },
    ];
    for (const path of paths) {
      const res = recorder();
      await sessionHandler({
        method: path.method, query: path.marker ? { __myfinhub_route: path.marker } : {},
        headers: { authorization: 'Bearer ' + accessToken('aal2'), ...safeOrigin },
        body: path.body,
      }, res);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toMatchObject({ code: 'AUTH_REQUIRED' });
      expect(res.headers.has('set-cookie')).toBe(false);
    }
    expect(fetchCalls).toHaveLength(0);
    expect(storage.isOwner).not.toHaveBeenCalled();
    noWrites();
  });

  it('keeps owner AAL1 outside profile and device mutations but allows an MFA-pending session status', async () => {
    const fetchCalls = userFetch();
    for (const marker of ['account', 'devices']) {
      const req = cookieRequest(marker === 'account' ? 'PATCH' : 'POST', 'aal1', marker, safeOrigin);
      const res = recorder();
      await sessionHandler({
        ...req,
        body: marker === 'account' ? { action: 'email', email: 'new@example.test' } : { action: 'revoke-others' },
      }, res);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toMatchObject({ code: 'MFA_REQUIRED' });
    }
    const res = recorder();
    await sessionHandler(cookieRequest('GET', 'aal1'), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      authenticated: false, mfaRequired: true, mfaEnrollmentRequired: false, email: EMAIL,
    });
    expect(fetchCalls.every(call => call.method === 'GET')).toBe(true);
    expect(devices.ensureDeviceSessionAccess).not.toHaveBeenCalled();
    noWrites();
  });

  it('rejects nonowner AAL2 cookies for profile, devices and session reads without downstream writes', async () => {
    const fetchCalls = userFetch();
    storage.isOwner.mockResolvedValue(false);
    for (const [method, marker, body] of [
      ['PATCH', 'account', { action: 'email', email: 'new@example.test' }],
      ['POST', 'devices', { action: 'revoke-others' }],
      ['GET', undefined, undefined],
    ] as const) {
      const res = recorder();
      await sessionHandler({ ...cookieRequest(method, 'aal2', marker, safeOrigin), body }, res);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body)).toMatchObject({ code: 'AUTH_REQUIRED' });
      expect(res.headers.has('set-cookie')).toBe(true);
    }
    expect(fetchCalls.every(call => call.method === 'GET')).toBe(true);
    noWrites();
  });

  it('rejects missing or cross-site origins on authorized cookie profile/device writes', async () => {
    const calls = userFetch();
    for (const origin of [{}, { ...safeOrigin, origin: 'https://hostile.example.test', 'sec-fetch-site': 'cross-site' }]) {
      for (const marker of ['account', 'devices']) {
        const req = cookieRequest(marker === 'account' ? 'PATCH' : 'POST', 'aal2', marker, origin);
        const res = recorder();
        await sessionHandler({
          ...req,
          body: marker === 'account' ? { action: 'email', email: 'new@example.test' } : { action: 'revoke-others' },
        }, res);
        expect(res.statusCode).toBe(403);
        expect(JSON.parse(res.body).code).toMatch(/ORIGIN_REQUIRED|CROSS_SITE_REQUEST/);
      }
    }
    expect(calls.every(call => call.method === 'GET')).toBe(true);
    noWrites();
  });

  it('does not let an Authorization header replace a real cookie on browser-only profile/device routes', async () => {
    const calls = userFetch();
    const token = accessToken('aal2');
    const profile = cookieRequest('PATCH', 'aal2', 'account', safeOrigin);
    const profileRes = recorder();
    await sessionHandler({
      ...profile, headers: { ...profile.headers, authorization: 'Bearer invalid-synthetic-credential' },
      body: { action: 'email', email: 'new@example.test' },
    }, profileRes);
    expect(profileRes.statusCode).toBe(200);
    expect(JSON.parse(profileRes.body)).toMatchObject({ ok: true, pendingEmail: 'new@example.test' });

    const device = cookieRequest('POST', 'aal2', 'devices', safeOrigin);
    const deviceRes = recorder();
    await sessionHandler({
      ...device, headers: { ...device.headers, authorization: 'Bearer invalid-synthetic-credential' },
      body: { action: 'rename', sessionId: SESSION_ID, nickname: 'Office' },
    }, deviceRes);
    expect(deviceRes.statusCode).toBe(200);
    expect(devices.renameDeviceSession).toHaveBeenCalledWith(token, 'owner-id', SESSION_ID, 'Office');
    expect(calls.some(call => call.method === 'PUT' && call.authorization === 'Bearer ' + token)).toBe(true);
    expect(calls.every(call => call.authorization === 'Bearer ' + token)).toBe(true);
    expect(deviceRes.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('requires same Origin on login, TOTP enrollment/challenge and logout before any Auth/network mutation', async () => {
    const calls = userFetch();
    const handlers = [loginHandler, enrollHandler, verifyHandler, logoutHandler];
    for (const handler of handlers) {
      const res = recorder();
      await handler({
        method: 'POST',
        headers: { cookie: 'rheomiq_access=' + accessToken('aal2') },
        body: { email: EMAIL, password: 'synthetic-password', code: '123456', factorId: 'synthetic-totp' },
      }, res);
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toMatchObject({ code: 'ORIGIN_REQUIRED' });
    }
    expect(calls).toHaveLength(0);
    noWrites();
  });

  it('sets production cookies as Secure, HttpOnly, SameSite=Strict host-only credentials', () => {
    process.env.VERCEL = '1';
    const res = recorder();
    setSessionCookies({ headers: { 'x-forwarded-proto': 'https' } }, res, {
      access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 3600,
    });
    const cookies = res.headers.get('set-cookie');
    expect(Array.isArray(cookies)).toBe(true);
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies as string[]) {
      expect(cookie).toMatch(/^__Host-rheomiq_(access|refresh)=/);
      expect(cookie).toContain('; Path=/;');
      expect(cookie).toContain('; Secure');
      expect(cookie).toContain('; HttpOnly');
      expect(cookie).toContain('; SameSite=Strict');
      expect(cookie).not.toMatch(/;\s*Domain=/i);
    }
  });
});
