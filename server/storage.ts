import type { FinanceData } from '../src/types.js';
import { migrateProductData } from '../src/lib/productMigration.js';
import { ApiError } from './http.js';
import { validateRecurringCadenceData } from './recurringCadenceValidation.js';
import { fetchUpstream } from './upstream.js';
import { validateFinanceState } from './stateValidation.js';
import { validateFinanceData } from './validation.js';

export const DATA_SOURCE = 'Supabase/PostgreSQL';

export type HistoryPointSummary = {
  id: string;
  parentId: string | null;
  label: string;
  createdAt: string;
  current: boolean;
};
export type HistoryEnvelope = {
  available: boolean;
  generation: string;
  financeRevision: string;
  currentPointId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
  points: HistoryPointSummary[];
};

type StateRow = { data: FinanceData; revision: number | string; updated_at: string };
type MutableStateRow = { revision: number | string; updated_at: string; history?: unknown };
type HistoryMoveRow = StateRow & { history?: unknown };
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
  const response = await fetchUpstream(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      ...(authorization ? { authorization } : {}),
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  }, 'DATA');

  const payload = await response.json().catch(() => null) as { message?: string; code?: string } | T | null;
  if (!response.ok) {
    const upstreamCode = payload && typeof payload === 'object' && 'code' in payload ? payload.code : '';
    const upstreamMessage = payload && typeof payload === 'object' && 'message' in payload ? payload.message : '';
    const marker = `${upstreamCode || ''} ${upstreamMessage || ''}`;
    if (/HISTORY_CURSOR_CONFLICT/i.test(marker)) throw new ApiError(409, 'HISTORY_CURSOR_CONFLICT', 'The change history moved in another session. Reload before continuing.');
    if (/HISTORY_UNAVAILABLE/i.test(marker)) throw new ApiError(409, 'HISTORY_UNAVAILABLE', 'There is no change available in that direction. Reload the history.');
    if (/EXPECTED_HISTORY_GENERATION_REQUIRED/i.test(marker)) throw new ApiError(428, 'HISTORY_PRECONDITION_REQUIRED', 'A current history generation is required before saving.');
    if (/REVISION_CONFLICT|40001/i.test(marker)) throw new ApiError(409, 'REVISION_CONFLICT', 'The data changed in another session. Reload before saving.');
    if (/EXPECTED_REVISION_REQUIRED/i.test(marker)) throw new ApiError(428, 'PRECONDITION_REQUIRED', 'A current revision is required before saving.');
    if (/MFA_REQUIRED/i.test(marker)) throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    if (/FORBIDDEN|42501/i.test(marker) || response.status === 403) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    if (response.status === 401) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    if (/INVALID_HISTORY_(LABEL|DIRECTION)/i.test(marker)) throw new ApiError(400, 'INVALID_HISTORY', 'The change-history request is invalid.');
    if (/INVALID_DATA|INVALID_SCHEMA_VERSION|22023/i.test(marker)) throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
    if (/NO_STATE|P0002/i.test(marker)) throw new ApiError(500, 'EMPTY_DATABASE', 'RheomIQ database is empty.', false);
    if (response.status === 429) throw new ApiError(429, 'DATA_RATE_LIMITED', 'Data service is busy. Try again shortly.');
    if (response.status >= 500) throw new ApiError(503, 'DATA_UNAVAILABLE', 'Data service is temporarily unavailable. Try again.');
    throw new ApiError(502, 'SUPABASE_ERROR', 'Database request failed.', false);
  }
  return payload as T;
}

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function envelope(row: StateRow) {
  if (!row) throw new ApiError(500, 'EMPTY_DATABASE', 'RheomIQ database is empty.', false);
  const migrated = migrateProductData(row.data);
  validateFinanceData(migrated);
  validateRecurringCadenceData(migrated);
  validateFinanceState(migrated.state);
  return {
    data: migrated,
    revision: String(row.revision),
    filePath: DATA_SOURCE,
    lastSavedAt: row.updated_at,
  };
}

function historyEnvelope(value: unknown): HistoryEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(502, 'HISTORY_RESPONSE_INVALID', 'Change history could not be read.', false);
  }
  const raw = value as Record<string, unknown>;
  const generation = typeof raw.generation === 'string' ? raw.generation : String(raw.generation ?? '0');
  const financeRevision = typeof raw.financeRevision === 'string' ? raw.financeRevision : String(raw.financeRevision ?? '');
  if (!/^\d+$/.test(generation) || !/^\d+$/.test(financeRevision)) throw new ApiError(502, 'HISTORY_RESPONSE_INVALID', 'Change history could not be read.', false);
  const pointsRaw = Array.isArray(raw.points) ? raw.points : [];
  const points: HistoryPointSummary[] = pointsRaw.map((point) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) throw new ApiError(502, 'HISTORY_RESPONSE_INVALID', 'Change history could not be read.', false);
    const item = point as Record<string, unknown>;
    const id = String(item.id ?? '');
    const parentId = item.parentId === null || item.parentId === undefined ? null : String(item.parentId);
    const label = typeof item.label === 'string' ? item.label : '';
    const createdAt = typeof item.createdAt === 'string' ? item.createdAt : '';
    if (!/^\d+$/.test(id) || !label || label.length > 180 || !createdAt) throw new ApiError(502, 'HISTORY_RESPONSE_INVALID', 'Change history could not be read.', false);
    if (parentId !== null && !/^\d+$/.test(parentId)) throw new ApiError(502, 'HISTORY_RESPONSE_INVALID', 'Change history could not be read.', false);
    return { id, parentId, label, createdAt, current: item.current === true };
  });
  const bounded = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100 ? Number(value) : 0;
  const currentPointId = raw.currentPointId === null || raw.currentPointId === undefined ? null : String(raw.currentPointId);
  if (currentPointId !== null && !/^\d+$/.test(currentPointId)) throw new ApiError(502, 'HISTORY_RESPONSE_INVALID', 'Change history could not be read.', false);
  return {
    available: raw.available === true,
    generation,
    financeRevision,
    currentPointId,
    canUndo: raw.canUndo === true,
    canRedo: raw.canRedo === true,
    undoDepth: bounded(raw.undoDepth),
    redoDepth: bounded(raw.redoDepth),
    points,
  };
}

function writeReceipt(row: MutableStateRow) {
  if (!row) throw new ApiError(500, 'EMPTY_DATABASE', 'RheomIQ database is empty.', false);
  return {
    revision: String(row.revision),
    filePath: DATA_SOURCE,
    lastSavedAt: row.updated_at,
    history: historyEnvelope(row.history),
  };
}

export function parseExpectedRevision(value?: string) {
  if (value === undefined || value === '') {
    throw new ApiError(428, 'PRECONDITION_REQUIRED', 'A current revision is required before saving.');
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new ApiError(400, 'INVALID_REVISION', 'Invalid data revision.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new ApiError(400, 'INVALID_REVISION', 'Invalid data revision.');
  }
  return parsed;
}

export function parseExpectedHistoryGeneration(value?: string) {
  if (value === undefined || value === '') {
    throw new ApiError(428, 'HISTORY_PRECONDITION_REQUIRED', 'A current history generation is required before saving.');
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new ApiError(400, 'INVALID_HISTORY_GENERATION', 'Invalid history generation.');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new ApiError(400, 'INVALID_HISTORY_GENERATION', 'Invalid history generation.');
  return parsed;
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

export async function readHistory(accessToken?: string) {
  const payload = await supabase<unknown>('rpc/rheomiq_read_history', {
    method: 'POST',
    body: '{}',
  }, accessToken);
  return historyEnvelope(payload);
}

export async function backupStore(accessToken?: string, reason = 'manual') {
  const result = first(await supabase<BackupRow[] | BackupRow>('rpc/rheomiq_create_backup', {
    method: 'POST',
    body: JSON.stringify({ p_reason: reason }),
  }, accessToken));
  if (!result) throw new ApiError(500, 'BACKUP_FAILED', 'Backup failed.', false);
  return `supabase://rheomiq_backups/${result.id}`;
}

export async function writeMutableState(
  state: FinanceData['state'],
  updatedAt: string,
  expectedRevision: string,
  expectedHistoryGeneration: string,
  historyLabel: string,
  accessToken?: string,
) {
  validateFinanceState(state);
  if (!updatedAt || updatedAt.length > 64) throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  const label = historyLabel.trim() || 'Οικονομική αλλαγή';
  if (label.length > 180) throw new ApiError(400, 'INVALID_HISTORY', 'The change-history label is invalid.');

  const row = first(await supabase<MutableStateRow[] | MutableStateRow>('rpc/rheomiq_save_mutable_state_history', {
    method: 'POST',
    body: JSON.stringify({
      p_state: state,
      p_expected_revision: parseExpectedRevision(expectedRevision),
      p_expected_history_generation: parseExpectedHistoryGeneration(expectedHistoryGeneration),
      p_updated_at: updatedAt,
      p_history_label: label,
    }),
  }, accessToken));
  return writeReceipt(row);
}

export async function moveHistory(
  direction: 'undo' | 'redo',
  updatedAt: string,
  expectedRevision: string,
  expectedHistoryGeneration: string,
  accessToken?: string,
) {
  const row = first(await supabase<HistoryMoveRow[] | HistoryMoveRow>('rpc/rheomiq_move_history', {
    method: 'POST',
    body: JSON.stringify({
      p_direction: direction,
      p_expected_revision: parseExpectedRevision(expectedRevision),
      p_expected_history_generation: parseExpectedHistoryGeneration(expectedHistoryGeneration),
      p_updated_at: updatedAt,
    }),
  }, accessToken));
  const dataEnvelope = envelope(row);
  return { ...dataEnvelope, history: historyEnvelope(row.history) };
}

export async function writeStore(data: FinanceData, expectedRevision?: string, force = false, accessToken?: string) {
  validateFinanceData(data);
  validateRecurringCadenceData(data);
  validateFinanceState(data.state);
  const next = migrateProductData({ ...data, app: 'RheomIQ', schemaVersion: 3, updatedAt: new Date().toISOString() });
  validateFinanceData(next);
  validateRecurringCadenceData(next);
  validateFinanceState(next.state);

  const path = force ? 'rpc/rheomiq_import_state' : 'rpc/rheomiq_save_state';
  const body = force
    ? { p_data: next }
    : { p_data: next, p_expected_revision: parseExpectedRevision(expectedRevision) };
  const row = first(await supabase<StateRow[] | StateRow>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  }, accessToken));
  return envelope(row);
}