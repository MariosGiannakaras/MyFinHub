import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  isOwner: vi.fn(),
}));
const devices = vi.hoisted(() => ({ ensureDeviceSessionAccess: vi.fn() }));
const updates = vi.hoisted(() => ({
  readLatestAndroidRelease: vi.fn(),
}));

vi.mock('../server/storage.js', () => storage);
vi.mock('../server/deviceSessionRegistry.js', () => devices);
vi.mock('../server/androidUpdates.js', () => updates);

import updateHandler from '../api/android-update.js';

const TEST_SESSION_ID = '123e4567-e89b-42d3-a456-426614174000';
function tokenWithAal(aal: 'aal1' | 'aal2') {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aal, session_id: TEST_SESSION_ID })).toString('base64url');
  return `${header}.${payload}.test`;
}

function upstream(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function responseRecorder() {
  const headers = new Map<string, unknown>();
  return {
    statusCode: 0,
    body: '',
    headers,
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), value); },
    end(value = '') { this.body = String(value); },
  };
}

function request(method: string, token?: string) {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

describe('private Android update API boundary', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    devices.ensureDeviceSessionAccess.mockReset().mockResolvedValue({});
    storage.isOwner.mockReset().mockResolvedValue(true);
    updates.readLatestAndroidRelease.mockReset().mockResolvedValue({
      versionCode: 2,
      versionName: '0.2.0',
      downloadUrl: 'https://project.example.supabase.co/storage/v1/object/authenticated/android-releases/0.2.0/MyFinHub.apk',
      sha256: 'a'.repeat(64),
      sizeBytes: 1_024,
      mandatory: false,
      notes: 'Update notes',
      publishedAt: '2026-09-03T12:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('returns private release metadata to the owner AAL2 bearer and disables caching', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token), res);

    expect(res.statusCode).toBe(200);
    expect(devices.ensureDeviceSessionAccess).toHaveBeenCalledWith(expect.anything(), token, 'owner-id');
    expect(storage.isOwner).toHaveBeenCalledWith(token);
    expect(updates.readLatestAndroidRelease).toHaveBeenCalledWith(token);
    expect(JSON.parse(res.body)).toMatchObject({ available: true, release: { versionCode: 2 } });
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(res.headers.get('vary')).toBe('authorization, cookie');
  });

  it('returns an explicit no-release state when the private channel is empty', async () => {
    const token = tokenWithAal('aal2');
    updates.readLatestAndroidRelease.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token), res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ available: false });
  });

  it('denies AAL1 before reading release metadata', async () => {
    const token = tokenWithAal('aal1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token), res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'MFA_REQUIRED' });
    expect(devices.ensureDeviceSessionAccess).not.toHaveBeenCalled();
    expect(updates.readLatestAndroidRelease).not.toHaveBeenCalled();
  });

  it('denies a non-owner bearer without exposing release metadata', async () => {
    const token = tokenWithAal('aal2');
    storage.isOwner.mockResolvedValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'other-user' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token), res);

    expect(res.statusCode).toBe(401);
    expect(updates.readLatestAndroidRelease).not.toHaveBeenCalled();
  });

  it('rejects non-GET methods before auth or storage work', async () => {
    const res = responseRecorder();

    await updateHandler(request('POST'), res);

    expect(res.statusCode).toBe(405);
    expect(storage.isOwner).not.toHaveBeenCalled();
    expect(updates.readLatestAndroidRelease).not.toHaveBeenCalled();
  });
});
