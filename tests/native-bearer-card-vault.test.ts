import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  isOwner: vi.fn(),
}));

const vault = vi.hoisted(() => ({
  readCardSecrets: vi.fn(),
  writeCardSecrets: vi.fn(),
  deleteCardSecrets: vi.fn(),
}));

vi.mock('../server/storage.js', () => storage);
vi.mock('../server/cardVaultStore.js', () => vault);

import { handleCardVaultRequest } from '../server/cardVaultHandler.js';

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

function request(method: 'POST' | 'PUT' | 'DELETE', token: string, body: Record<string, unknown>) {
  return {
    method,
    headers: { authorization: `Bearer ${token}` },
    body,
  };
}

describe('native bearer card-vault boundary', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://project.example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
    storage.isOwner.mockReset().mockResolvedValue(true);
    vault.readCardSecrets.mockReset().mockResolvedValue({ pan: '4111111111111111', expiry: '12/30' });
    vault.writeCardSecrets.mockReset().mockResolvedValue({ pan: '4111111111111111', expiry: '12/30' });
    vault.deleteCardSecrets.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it('allows owner AAL2 bearer reveal without browser Origin metadata', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await handleCardVaultRequest(request('POST', token, { cardId: 'card-1' }), res);

    expect(res.statusCode).toBe(200);
    expect(vault.readCardSecrets).toHaveBeenCalledWith('owner-id', 'card-1', token);
    expect(JSON.parse(res.body)).toEqual({ pan: '4111111111111111', expiry: '12/30' });
    expect(res.headers.has('access-control-allow-origin')).toBe(false);
  });

  it('denies AAL1 bearer before vault access', async () => {
    const token = tokenWithAal('aal1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await handleCardVaultRequest(request('POST', token, { cardId: 'card-1' }), res);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'MFA_REQUIRED' });
    expect(vault.readCardSecrets).not.toHaveBeenCalled();
  });

  it('denies a non-owner bearer without clearing browser cookies', async () => {
    const token = tokenWithAal('aal2');
    storage.isOwner.mockResolvedValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'other-user' })));
    const res = responseRecorder();

    await handleCardVaultRequest(request('POST', token, { cardId: 'card-1' }), res);

    expect(res.statusCode).toBe(401);
    expect(res.headers.has('set-cookie')).toBe(false);
    expect(vault.readCardSecrets).not.toHaveBeenCalled();
  });

  it('keeps CVV persistence forbidden for native bearer requests', async () => {
    const token = tokenWithAal('aal2');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(200, { id: 'owner-id' })));
    const res = responseRecorder();

    await handleCardVaultRequest(request('PUT', token, {
      cardId: 'card-1',
      pan: '4111111111111111',
      expiry: '12/30',
      cvv: '123',
    }), res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'CVV_PERSISTENCE_DISABLED' });
    expect(vault.writeCardSecrets).not.toHaveBeenCalled();
  });
});
