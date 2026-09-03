import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../server/http.js';
import { readLatestAndroidRelease } from '../server/androidUpdates.js';

function upstream(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('private Android release metadata reader', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('maps a valid release to a bearer-authenticated private Storage URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream(200, [{
      version_code: 17,
      version_name: '1.7.0',
      storage_path: '1.7.0/MyFinHub-1.7.0.apk',
      sha256: 'ABCDEF0123456789'.repeat(4),
      size_bytes: 42_000_000,
      mandatory: false,
      notes: 'Corrections and improvements',
      published_at: '2026-09-03T12:00:00.000Z',
    }]));
    vi.stubGlobal('fetch', fetchMock);

    const release = await readLatestAndroidRelease('owner-token');

    expect(release).toMatchObject({
      versionCode: 17,
      versionName: '1.7.0',
      downloadUrl: 'https://project.example.supabase.co/storage/v1/object/authenticated/android-releases/1.7.0/MyFinHub-1.7.0.apk',
      sha256: 'abcdef0123456789'.repeat(4),
      sizeBytes: 42_000_000,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer owner-token');
    expect((init.headers as Record<string, string>).apikey).toBe('sb_publishable_test');
  });

  it('returns null when no release has been published', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, [])));
    await expect(readLatestAndroidRelease('owner-token')).resolves.toBeNull();
  });

  it.each([
    [{ version_code: 0 }, 'invalid version'],
    [{ storage_path: '../escape.apk' }, 'unsafe path'],
    [{ sha256: 'not-a-digest' }, 'bad digest'],
    [{ size_bytes: 0 }, 'bad size'],
  ])('rejects malformed release metadata (%s)', async (override) => {
    const row = {
      version_code: 2,
      version_name: '0.2.0',
      storage_path: '0.2.0/MyFinHub.apk',
      sha256: 'a'.repeat(64),
      size_bytes: 1024,
      mandatory: false,
      notes: '',
      published_at: '2026-09-03T12:00:00.000Z',
      ...override,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, [row])));

    await expect(readLatestAndroidRelease('owner-token')).rejects.toMatchObject<ApiError>({
      code: 'UPDATE_METADATA_INVALID',
    });
  });

  it('does not accept update metadata without an authenticated bearer', async () => {
    await expect(readLatestAndroidRelease('')).rejects.toMatchObject<ApiError>({ code: 'AUTH_REQUIRED' });
  });
});
