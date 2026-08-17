import type { FinanceData } from '../src/types.js';
import { migrateData } from '../src/lib/domain.js';
import { ApiError } from './http.js';
import { validateFinanceData } from './validation.js';

export const DATA_SOURCE = 'Supabase/PostgreSQL';

type StateRow = { data: FinanceData; revision: number | string; updated_at: string };
type BackupRow = { id: number | string; created_at: string };

function config(accessToken?: string) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!url) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Supabase is not configured.', false);

  if (accessToken) {
    const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!publishable) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Supabase authentication is not configured.', false);
    return { url, apiKey: publishable, authorization: `Bearer ${accessToken}` };
  }

  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Admin Supabase key is unavailable. This operation is offline-only.', false);
  }
  return { url, apiKey: secret, authorization: '' };
}

async function supabase<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const { url, apiKey, authorization } = config(accessToken);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      ...(authorization ? { authorization } : {}),
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null) as { message?: string; code?: string } | T | null;
  if (!response.ok) {
    const upstreamCode = payload && typeof payload === 'object' && 'code' in payload ? payload.code : '';
    const upstreamMessage = payload && typeof payload === 'object' && 'message' in payload ? payload.message : '';
    const marker = `${upstreamCode || ''} ${upstreamMessage || ''}`;
    if (/REVISION_CONFLICT|40001/i.test(marker)) throw new ApiError(409, 'REVISION_CONFLICT', 'The data changed in another session. Reload before saving.');
    if (/MFA_REQUIRED/i.test(marker)) throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    if (/FORBIDDEN|42501/i.test(marker) || response.status === 403) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    if (response.status === 401) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    if (/INVALID_DATA|INVALID_SCHEMA_VERSION|22023/i.test(marker)) throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
    throw new ApiError(502, 'SUPABASE_ERROR', 'Database request failed.', false);
  }
  return payload as T;
}

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function envelope(row: StateRow) {
  if (!row) throw new ApiError(500, 'EMPTY_DATABASE', 'RheomIQ database is empty.', false);
  const migrated = migrateData(row.data);
  return {
    data: migrated,
    revision: String(row.revision),
    filePath: DATA_SOURCE,
    lastSavedAt: row.updated_at,
  };
}

export async function isOwner(accessToken: string) {
  const value = await supabase<boolean>('rpc/rheomiq_is_owner', {
    method: 'POST',
    body: '{}',
  }, accessToken);
  return value === true;
}

export async function readStore(accessToken?: string) {
  const rows = await supabase<StateRow[] | StateRow>('rpc/rheomiq_read_state', {
    method: 'POST',
    body: '{}',
  }, accessToken);
  return envelope(first(rows));
}

export async function backupStore(accessToken?: string, reason = 'manual') {
  const result = first(await supabase<BackupRow[] | BackupRow>('rpc/rheomiq_create_backup', {
    method: 'POST',
    body: JSON.stringify({ p_reason: reason }),
  }, accessToken));
  if (!result) throw new ApiError(500, 'BACKUP_FAILED', 'Backup failed.', false);
  return `supabase://rheomiq_backups/${result.id}`;
}

export async function writeStore(data: FinanceData, expectedRevision?: string, force = false, accessToken?: string) {
  validateFinanceData(data);
  const next = migrateData({ ...data, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() });
  validateFinanceData(next);

  const path = force ? 'rpc/rheomiq_import_state' : 'rpc/rheomiq_save_state';
  const body = force
    ? { p_data: next }
    : { p_data: next, p_expected_revision: expectedRevision ? Number(expectedRevision) : null };
  const row = first(await supabase<StateRow[] | StateRow>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }, accessToken));
  return envelope(row);
}
