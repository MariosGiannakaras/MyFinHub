import { Buffer } from 'node:buffer';
import os from 'node:os';
import { ApiError, requestHeader } from './http.js';
import { fetchUpstream } from './upstream.js';

export type DeviceSessionRecord = {
  session_id: string;
  user_id: string;
  platform: 'windows' | 'android' | 'web' | 'unknown';
  device_label: string;
  app_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

type ClientMetadata = Pick<DeviceSessionRecord, 'platform' | 'device_label' | 'app_version'>;
const TOUCH_INTERVAL_MS = 5 * 60_000;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Device access is not configured.', false);
  return { url, publishable };
}

function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizePlatform(value: string): ClientMetadata['platform'] {
  const normalized = value.toLowerCase();
  if (normalized === 'windows' || normalized === 'android' || normalized === 'web') return normalized;
  return 'unknown';
}

function clientMetadata(req: any): ClientMetadata {
  if (process.env.RHEOMIQ_DESKTOP === '1') {
    const host = cleanText(os.hostname(), 72) || 'Windows PC';
    return { platform: 'windows', device_label: `Windows · ${host}`, app_version: cleanText(process.env.MYFINHUB_APP_VERSION, 40) || null };
  }
  const platformHeader = cleanText(requestHeader(req, 'x-myfinhub-client-platform'), 24);
  const nameHeader = cleanText(requestHeader(req, 'x-myfinhub-device-name'), 96);
  const versionHeader = cleanText(requestHeader(req, 'x-myfinhub-app-version'), 40);
  const userAgent = cleanText(requestHeader(req, 'user-agent'), 200).toLowerCase();
  const platform = platformHeader ? normalizePlatform(platformHeader) : userAgent.includes('android') ? 'android' : 'web';
  const fallback = platform === 'android' ? 'Android συσκευή' : platform === 'windows' ? 'Windows PC' : 'Web browser';
  return { platform, device_label: nameHeader || fallback, app_version: versionHeader || null };
}

export function accessTokenSessionId(accessToken: string) {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return '';
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { session_id?: unknown };
    const value = typeof claims.session_id === 'string' ? claims.session_id.trim() : '';
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : '';
  } catch {
    return '';
  }
}

async function rest<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const { url, publishable } = config();
  const response = await fetchUpstream(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishable,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  }, 'DATA');
  const payload = await response.json().catch(() => null) as T | { message?: string; code?: string } | null;
  if (!response.ok) {
    const details = payload && typeof payload === 'object' ? payload as { message?: string; code?: string } : {};
    if (response.status === 404 && (details.code === 'PGRST205' || /myfinhub_device_sessions/i.test(details.message || ''))) {
      throw new ApiError(503, 'DEVICE_REGISTRY_NOT_MIGRATED', 'Device registry migration is not active yet.', false);
    }
    if (response.status === 401 || response.status === 403) throw new ApiError(401, 'DEVICE_ACCESS_REVOKED', 'Η πρόσβαση αυτής της συσκευής δεν είναι ενεργή.');
    throw new ApiError(response.status >= 500 ? 503 : response.status, 'DEVICE_REGISTRY_UNAVAILABLE', 'Η διαχείριση συσκευών δεν είναι προσωρινά διαθέσιμη.', false);
  }
  return payload as T;
}

function rowPath(sessionId: string) {
  return `myfinhub_device_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=session_id,user_id,platform,device_label,app_version,first_seen_at,last_seen_at,revoked_at`;
}

export async function ensureDeviceSessionAccess(req: any, accessToken: string, userId: string) {
  const sessionId = accessTokenSessionId(accessToken);
  if (!sessionId) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  let rows: DeviceSessionRecord[];
  try {
    rows = await rest<DeviceSessionRecord[]>(rowPath(sessionId), accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'DEVICE_REGISTRY_NOT_MIGRATED') return null;
    throw error;
  }
  const existing = rows[0];
  if (existing?.revoked_at) throw new ApiError(401, 'DEVICE_ACCESS_REVOKED', 'Η πρόσβαση αυτής της συσκευής έχει αφαιρεθεί.');
  const metadata = clientMetadata(req);
  const now = new Date().toISOString();
  if (!existing) {
    const created = await rest<DeviceSessionRecord[]>('myfinhub_device_sessions', accessToken, {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ session_id: sessionId, user_id: userId, ...metadata, first_seen_at: now, last_seen_at: now }),
    });
    return created[0] ?? { session_id: sessionId, user_id: userId, ...metadata, first_seen_at: now, last_seen_at: now, revoked_at: null };
  }
  const lastSeen = Date.parse(existing.last_seen_at || '');
  const metadataChanged = existing.platform !== metadata.platform || existing.device_label !== metadata.device_label || existing.app_version !== metadata.app_version;
  if (metadataChanged || !Number.isFinite(lastSeen) || Date.now() - lastSeen >= TOUCH_INTERVAL_MS) {
    const updated = await rest<DeviceSessionRecord[]>(`${rowPath(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`, accessToken, {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ ...metadata, last_seen_at: now }),
    });
    return updated[0] ?? existing;
  }
  return existing;
}

export async function listDeviceSessions(accessToken: string, userId: string) {
  const currentSessionId = accessTokenSessionId(accessToken);
  const rows = await rest<DeviceSessionRecord[]>(
    `myfinhub_device_sessions?user_id=eq.${encodeURIComponent(userId)}&revoked_at=is.null&select=session_id,user_id,platform,device_label,app_version,first_seen_at,last_seen_at,revoked_at&order=last_seen_at.desc`,
    accessToken,
  );
  return { currentSessionId, rows };
}

export async function revokeDeviceSession(accessToken: string, userId: string, targetSessionId: string) {
  const currentSessionId = accessTokenSessionId(accessToken);
  if (!currentSessionId) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  if (targetSessionId === currentSessionId) throw new ApiError(400, 'CURRENT_DEVICE_REVOKE_UNSUPPORTED', 'Χρησιμοποίησε αποσύνδεση για την τρέχουσα συσκευή.');
  const now = new Date().toISOString();
  const updated = await rest<DeviceSessionRecord[]>(
    `myfinhub_device_sessions?user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(targetSessionId)}&revoked_at=is.null&select=session_id,user_id,platform,device_label,app_version,first_seen_at,last_seen_at,revoked_at`,
    accessToken,
    { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ revoked_at: now }) },
  );
  if (!updated.length) throw new ApiError(404, 'DEVICE_SESSION_NOT_FOUND', 'Η συσκευή δεν είναι πλέον ενεργή.');
  return updated[0];
}

export async function revokeOtherDeviceSessions(accessToken: string, userId: string) {
  const currentSessionId = accessTokenSessionId(accessToken);
  if (!currentSessionId) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  const now = new Date().toISOString();
  return rest<DeviceSessionRecord[]>(
    `myfinhub_device_sessions?user_id=eq.${encodeURIComponent(userId)}&session_id=neq.${encodeURIComponent(currentSessionId)}&revoked_at=is.null&select=session_id,user_id,platform,device_label,app_version,first_seen_at,last_seen_at,revoked_at`,
    accessToken,
    { method: 'PATCH', headers: { prefer: 'return=representation' }, body: JSON.stringify({ revoked_at: now }) },
  );
}

export async function endCurrentDeviceSession(accessToken: string, userId: string) {
  const sessionId = accessTokenSessionId(accessToken);
  if (!sessionId) return;
  try {
    await rest<DeviceSessionRecord[]>(
      `myfinhub_device_sessions?user_id=eq.${encodeURIComponent(userId)}&session_id=eq.${encodeURIComponent(sessionId)}&revoked_at=is.null`,
      accessToken,
      { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) },
    );
  } catch {
    // Normal logout must still clear the Auth session even if the device registry is unavailable.
  }
}
