import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSession, signInWithPassword } from '../server/auth.js';

function response(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function request(cookie: string) {
  return { headers: { cookie } };
}

function requestWithHeaders(headers: Record<string, string>) {
  return { headers };
}

function responseRecorder() {
  const headers = new Map<string, unknown>();
  return {
    headers,
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), value); },
  };
}

describe('Supabase Auth failure resilience', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    delete process.env.VERCEL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
  });

  it('preserves session cookies when Supabase Auth is temporarily unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503, { message: 'maintenance' })));
    const res = responseRecorder();

    await expect(requireSession(request('rheomiq_access=access-token; rheomiq_refresh=refresh-token'), res))
      .rejects.toMatchObject({ status: 503, code: 'AUTH_UNAVAILABLE' });

    expect(res.headers.has('set-cookie')).toBe(false);
  });

  it('clears cookies only after access and refresh tokens are genuinely rejected', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response(401, { message: 'invalid jwt' }))
      .mockResolvedValueOnce(response(400, { message: 'invalid refresh token' })));
    const res = responseRecorder();

    await expect(requireSession(request('rheomiq_access=bad-access; rheomiq_refresh=bad-refresh'), res))
      .rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });

    const cookies = res.headers.get('set-cookie');
    expect(Array.isArray(cookies)).toBe(true);
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining('rheomiq_access='),
      expect.stringContaining('rheomiq_refresh='),
    ]));
  });

  it('uses an explicitly enabled bearer token without creating or refreshing cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { id: 'owner-id', email: 'owner@example.com' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = responseRecorder();

    const session = await requireSession(requestWithHeaders({ authorization: 'Bearer native-access-token' }), res, { allowBearer: true });

    expect(session).toMatchObject({ accessToken: 'native-access-token', source: 'bearer', user: { id: 'owner-id' } });
    expect(res.headers.has('set-cookie')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed on an invalid explicit bearer instead of falling back to a valid cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(401, { message: 'invalid jwt' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = responseRecorder();

    await expect(requireSession(requestWithHeaders({
      authorization: 'Bearer bad-native-token',
      cookie: 'rheomiq_access=valid-cookie-token; rheomiq_refresh=valid-refresh-token',
    }), res, { allowBearer: true })).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.headers.has('set-cookie')).toBe(false);
  });

  it('keeps browser auth endpoints cookie-only unless bearer mode is explicitly enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { id: 'cookie-owner' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = responseRecorder();

    const session = await requireSession(requestWithHeaders({
      authorization: 'Bearer ignored-on-cookie-only-endpoint',
      cookie: 'rheomiq_access=cookie-access-token',
    }), res);

    expect(session).toMatchObject({ accessToken: 'cookie-access-token', source: 'cookie', user: { id: 'cookie-owner' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('distinguishes rate limiting from rejected credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, { message: 'too many requests' })));
    await expect(signInWithPassword('owner@example.com', 'correct-horse-battery-staple'))
      .rejects.toMatchObject({ status: 429, code: 'AUTH_RATE_LIMITED' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, { message: 'invalid login credentials' })));
    await expect(signInWithPassword('owner@example.com', 'wrong-password'))
      .rejects.toMatchObject({ status: 400, code: 'AUTH_REJECTED' });
  });
});
