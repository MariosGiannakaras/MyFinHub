import type { FinanceData } from '../src/types.js';
import { migrateData } from '../src/lib/domain.js';

export const DATA_SOURCE = 'Supabase/PostgreSQL';

type StateRow = { data: FinanceData; revision: number | string; updated_at: string };
type BackupRow = { id: number | string; created_at: string };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on the server.');
  }
  return { url, secret };
}

async function supabase<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, secret } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null) as { message?: string; code?: string } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && payload.message
      ? payload.message
      : `Supabase request failed (${response.status})`;
    const error = new Error(message) as Error & { code?: string };
    if (/REVISION_CONFLICT|40001/i.test(`${message} ${(payload as { code?: string } | null)?.code || ''}`)) {
      error.code = 'REVISION_CONFLICT';
    }
    throw error;
  }
  return payload as T;
}

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function envelope(row: StateRow) {
  const migrated = migrateData(row.data);
  return {
    data: migrated,
    revision: String(row.revision),
    filePath: DATA_SOURCE,
    lastSavedAt: row.updated_at,
  };
}

export async function readStore() {
  const rows = await supabase<StateRow[]>('rheomiq_app_state?id=eq.primary&select=data,revision,updated_at', {
    headers: { 'cache-control': 'no-store' },
  });
  if (!rows.length) throw new Error('RheomIQ database is empty. Run the JSON-to-Supabase migration first.');
  return envelope(rows[0]);
}

export async function backupStore(reason = 'manual') {
  const result = first(await supabase<BackupRow[] | BackupRow>('rpc/rheomiq_create_backup', {
    method: 'POST',
    body: JSON.stringify({ p_reason: reason }),
  }));
  if (!result) throw new Error('Backup failed: no application state exists.');
  return `supabase://rheomiq_backups/${result.id}`;
}

export async function writeStore(data: FinanceData, expectedRevision?: string, force = false) {
  const next = migrateData({ ...data, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() });
  const path = force ? 'rpc/rheomiq_import_state' : 'rpc/rheomiq_save_state';
  const body = force
    ? { p_data: next }
    : { p_data: next, p_expected_revision: expectedRevision ? Number(expectedRevision) : null };
  const row = first(await supabase<StateRow[] | StateRow>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }));
  return envelope(row);
}
