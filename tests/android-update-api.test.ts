import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  isOwner: vi.fn(),
}));
const updates = vi.hoisted(() => ({
  readLatestAndroidRelease: vi.fn(),
}));

vi.mock('../server/storage.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/storage.js')>();
  return { ...actual, isOwner: storage.isOwner };
});
vi.mock('../server/androidUpdates.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/androidUpdates.js')>();
  return { ...actual, readLatestAndroidRelease: updates.readLatestAndroidRelease };
});

import dataHandler from '../api/data.js';
import { handleAndroidUpdateApi } from '../server/androidUpdateApi.js';

const updateHandler = handleAndroidUpdateApi;

function tokenWithAal(aal: 'aal1' | 'aal2') {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aal })).toString('base64url');
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

function request(method: string, token?: string, channel?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (channel) headers['x-myfinhub-android-update-channel'] = channel;
  return { method, headers };
}

describe('private Android update API boundary', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
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

  it('defaults legacy callers to production first and disables caching', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token), res);

    expect(res.statusCode).toBe(200);
    expect(storage.isOwner).toHaveBeenCalledWith(token);
    expect(updates.readLatestAndroidRelease).toHaveBeenCalledTimes(1);
    expect(updates.readLatestAndroidRelease).toHaveBeenCalledWith(token, 'production');
    expect(JSON.parse(res.body)).toMatchObject({ available: true, release: { versionCode: 2 } });
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(res.headers.get('vary')).toBe('authorization, cookie, x-myfinhub-android-update-channel');
  });

  it('routes the public updater path through the existing data function without a standalone serverless function', async () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    expect(config.rewrites).toContainEqual({
      source: '/api/android-update',
      destination: '/api/data?__myfinhub_route=android-update',
    });
    expect(existsSync(new URL('../api/android-update.ts', import.meta.url))).toBe(false);

    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await dataHandler({ ...request('GET', token, 'phase6-test'), query: { __myfinhub_route: 'android-update' } }, res);

    expect(res.statusCode).toBe(200);
    expect(updates.readLatestAndroidRelease).toHaveBeenCalledWith(token, 'phase6-test');
    expect(JSON.parse(res.body)).toMatchObject({ available: true, release: { versionCode: 2 } });
  });

  it('temporarily bridges a legacy no-header client to phase6-test only when production is empty', async () => {
    const token = tokenWithAal('aal2');
    const testRelease = {
      versionCode: 6010,
      versionName: '0.1.0-phase6.10',
      downloadUrl: 'https://project.example.supabase.co/storage/v1/object/authenticated/android-releases/phase6-test/6010/MyFinHub.apk',
      sha256: 'b'.repeat(64),
      sizeBytes: 2048,
      mandatory: false,
      notes: 'Phase 6 test',
      publishedAt: '2026-09-04T12:00:00.000Z',
    };
    updates.readLatestAndroidRelease
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(testRelease);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token), res);

    expect(updates.readLatestAndroidRelease.mock.calls).toEqual([
      [token, 'production'],
      [token, 'phase6-test'],
    ]);
    expect(JSON.parse(res.body)).toMatchObject({ available: true, release: { versionCode: 6010 } });
  });

  it('never lets an explicit production caller fall through to phase6-test', async () => {
    const token = tokenWithAal('aal2');
    updates.readLatestAndroidRelease.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token, 'production'), res);

    expect(updates.readLatestAndroidRelease).toHaveBeenCalledTimes(1);
    expect(updates.readLatestAndroidRelease).toHaveBeenCalledWith(token, 'production');
    expect(JSON.parse(res.body)).toEqual({ available: false });
  });

  it('routes Phase 6 test builds only to the isolated test channel', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token, 'phase6-test'), res);

    expect(res.statusCode).toBe(200);
    expect(updates.readLatestAndroidRelease).toHaveBeenCalledWith(token, 'phase6-test');
  });

  it('rejects unknown channels instead of falling back to production', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token, 'preview'), res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'UPDATE_CHANNEL_INVALID' });
    expect(updates.readLatestAndroidRelease).not.toHaveBeenCalled();
  });

  it('returns an explicit no-release state when the selected private channel is empty', async () => {
    const token = tokenWithAal('aal2');
    updates.readLatestAndroidRelease.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await updateHandler(request('GET', token, 'phase6-test'), res);

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
