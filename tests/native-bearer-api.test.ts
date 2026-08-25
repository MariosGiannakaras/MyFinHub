import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../server/http.js';

const storage = vi.hoisted(() => ({
  isOwner: vi.fn(),
  parseExpectedRevision: vi.fn((value: string | undefined) => Number(value)),
  readStore: vi.fn(),
  writeMutableState: vi.fn(),
}));

const stateValidation = vi.hoisted(() => ({
  parseMutableWrite: vi.fn((value: any) => value),
}));

vi.mock('../server/storage.js', () => storage);
vi.mock('../server/stateValidation.js', () => stateValidation);

import dataHandler from '../api/data.js';

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

function bearerRequest(method: 'GET' | 'PUT', token: string, extraHeaders: Record<string, string> = {}) {
  return {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
    ...(method === 'PUT' ? { body: { state: {}, updatedAt: '2026-08-22T00:00:00.000Z' } } : {}),
  };
}

describe('native bearer finance API boundary', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    storage.isOwner.mockReset().mockResolvedValue(true);
    storage.parseExpectedRevision.mockReset().mockImplementation((value: string | undefined) => Number(value));
    storage.readStore.mockReset().mockResolvedValue({ data: { app: 'RheomIQ' }, revision: 7, updatedAt: '2026-08-22T00:00:00.000Z' });
    storage.writeMutableState.mockReset().mockResolvedValue({ revision: 8, updatedAt: '2026-08-22T00:01:00.000Z' });
    stateValidation.parseMutableWrite.mockReset().mockImplementation((value: any) => value);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('accepts an owner AAL2 bearer read without browser Origin metadata', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id', email: 'owner@example.com' })));
    const res = responseRecorder();

    await dataHandler(bearerRequest('GET', token), res);

    expect(res.statusCode).toBe(200);
    expect(storage.isOwner).toHaveBeenCalledWith(token);
    expect(storage.readStore).toHaveBeenCalledWith(token);
    expect(res.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('accepts an owner AAL2 bearer mutation without weakening revision or history-generation preconditions', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await dataHandler(bearerRequest('PUT', token, { 'if-match': '7', 'x-rheomiq-history-generation': '4' }), res);

    expect(res.statusCode).toBe(200);
    expect(storage.parseExpectedRevision).toHaveBeenCalledWith('7');
    expect(storage.writeMutableState).toHaveBeenCalledWith({}, '2026-08-22T00:00:00.000Z', '7', '4', 'Οικονομική αλλαγή', token);
    expect(res.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('preserves the existing same-origin requirement for cookie mutations', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();
    const req = {
      method: 'PUT',
      headers: {
        cookie: `rheomiq_access=${encodeURIComponent(token)}`,
        'if-match': '7',
        'x-rheomiq-history-generation': '4',
      },
      body: { state: {}, updatedAt: '2026-08-22T00:00:00.000Z' },
    };

    await dataHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'ORIGIN_REQUIRED' });
    expect(storage.writeMutableState).not.toHaveBeenCalled();
  });

  it('denies an AAL1 bearer before finance storage access', async () => {
    const token = tokenWithAal('aal1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await dataHandler(bearerRequest('GET', token), res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'MFA_REQUIRED' });
    expect(storage.readStore).not.toHaveBeenCalled();
  });

  it('denies a non-owner bearer without clearing unrelated browser cookies', async () => {
    const token = tokenWithAal('aal2');
    storage.isOwner.mockResolvedValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'other-user' })));
    const res = responseRecorder();

    await dataHandler(bearerRequest('GET', token), res);

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(res.headers.has('set-cookie')).toBe(false);
    expect(storage.readStore).not.toHaveBeenCalled();
  });

  it('preserves stale revision conflicts for bearer mutations', async () => {
    const token = tokenWithAal('aal2');
    storage.writeMutableState.mockRejectedValue(new ApiError(409, 'REVISION_CONFLICT', 'State changed on another client.'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await dataHandler(bearerRequest('PUT', token, { 'if-match': '7', 'x-rheomiq-history-generation': '4' }), res);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'REVISION_CONFLICT' });
  });
});
