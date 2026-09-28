import { ApiError } from './http.js';
import { fetchUpstream } from './upstream.js';

const ANDROID_RELEASE_BUCKET = 'android-releases';
const MAX_ANDROID_APK_BYTES = 300 * 1024 * 1024;

export type AndroidReleaseChannel = 'production' | 'phase6-test';

export type AndroidRelease = {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
  mandatory: boolean;
  notes: string;
  publishedAt: string;
};

type AndroidReleaseRow = {
  version_code: unknown;
  version_name: unknown;
  storage_path: unknown;
  sha256: unknown;
  size_bytes: unknown;
  mandatory: unknown;
  notes: unknown;
  published_at: unknown;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Android updates are not configured.', false);
  return { url, publishable };
}

async function updateData<T>(path: string, accessToken: string): Promise<T> {
  const { url, publishable } = config();
  const response = await fetchUpstream(`${url}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: publishable,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
  }, 'DATA');
  const payload = await response.json().catch(() => null) as T | { message?: string; code?: string } | null;
  if (!response.ok) {
    if (response.status === 401) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    if (response.status === 403) throw new ApiError(403, 'FORBIDDEN', 'Access denied.');
    if (response.status === 429) throw new ApiError(429, 'UPDATE_RATE_LIMITED', 'Update service is busy. Try again shortly.');
    if (response.status >= 500) throw new ApiError(503, 'UPDATE_UNAVAILABLE', 'Update service is temporarily unavailable. Try again.');
    throw new ApiError(502, 'UPDATE_SERVICE_ERROR', 'Update information could not be read.', false);
  }
  return payload as T;
}

function boundedText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.length <= maxLength ? value : null;
}

function validStoragePath(value: unknown) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 240) return null;
  if (value.startsWith('/') || value.includes('..') || value.includes('\\') || /[?#]/.test(value)) return null;
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return value;
}

function authenticatedDownloadUrl(storagePath: string) {
  const { url } = config();
  const encodedPath = storagePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${url}/storage/v1/object/authenticated/${ANDROID_RELEASE_BUCKET}/${encodedPath}`;
}

function parseRelease(row: AndroidReleaseRow): AndroidRelease {
  const versionCode = Number(row.version_code);
  const versionName = boundedText(row.version_name, 64);
  const storagePath = validStoragePath(row.storage_path);
  const sha256 = typeof row.sha256 === 'string' ? row.sha256.toLowerCase() : '';
  const sizeBytes = Number(row.size_bytes);
  const notes = boundedText(row.notes, 8_000);
  const publishedAt = boundedText(row.published_at, 64);

  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || !versionName || !storagePath) {
    throw new ApiError(502, 'UPDATE_METADATA_INVALID', 'Update information is invalid.', false);
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ApiError(502, 'UPDATE_METADATA_INVALID', 'Update information is invalid.', false);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_ANDROID_APK_BYTES) {
    throw new ApiError(502, 'UPDATE_METADATA_INVALID', 'Update information is invalid.', false);
  }
  if (notes === null || !publishedAt || Number.isNaN(Date.parse(publishedAt))) {
    throw new ApiError(502, 'UPDATE_METADATA_INVALID', 'Update information is invalid.', false);
  }
  if (row.mandatory !== true && row.mandatory !== false) {
    throw new ApiError(502, 'UPDATE_METADATA_INVALID', 'Update information is invalid.', false);
  }

  return {
    versionCode,
    versionName,
    downloadUrl: authenticatedDownloadUrl(storagePath),
    sha256,
    sizeBytes,
    mandatory: row.mandatory,
    notes,
    publishedAt,
  };
}

export function parseAndroidReleaseChannel(value: unknown): AndroidReleaseChannel {
  if (value === undefined || value === null || value === '') return 'production';
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new ApiError(400, 'UPDATE_CHANNEL_INVALID', 'Update channel is invalid.', false);
    return parseAndroidReleaseChannel(value[0]);
  }
  if (value === 'production' || value === 'phase6-test') return value;
  throw new ApiError(400, 'UPDATE_CHANNEL_INVALID', 'Update channel is invalid.', false);
}

export async function readLatestAndroidRelease(
  accessToken: string,
  channel: AndroidReleaseChannel = 'production',
): Promise<AndroidRelease | null> {
  if (!accessToken) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  const encodedChannel = encodeURIComponent(channel);
  const rows = await updateData<AndroidReleaseRow[]>(
    `rheomiq_android_releases?select=version_code,version_name,storage_path,sha256,size_bytes,mandatory,notes,published_at&channel=eq.${encodedChannel}&enabled=eq.true&order=version_code.desc&limit=1`,
    accessToken,
  );
  if (!Array.isArray(rows)) throw new ApiError(502, 'UPDATE_METADATA_INVALID', 'Update information is invalid.', false);
  if (rows.length === 0) return null;
  return parseRelease(rows[0]!);
}
