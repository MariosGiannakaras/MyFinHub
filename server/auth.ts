import { ApiError, requestHeader } from './http.js';

const PROD_ACCESS = '__Host-rheomiq_access';
const PROD_REFRESH = '__Host-rheomiq_refresh';
const DEV_ACCESS = 'rheomiq_access';
const DEV_REFRESH = 'rheomiq_refresh';

type AuthUser = { id: string; email?: string | null };
type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  user?: AuthUser;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Authentication is not configured.', false);
  return { url, publishable };
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, publishable } = config();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishable,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null) as T | { message?: string; error_description?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object'
      ? ('message' in payload && payload.message) || ('error_description' in payload && payload.error_description)
      : null;
    const error = new ApiError(response.status === 400 ? 401 : response.status, 'AUTH_FAILED', message || 'Authentication failed.', false);
    throw error;
  }
  return payload as T;
}

function parseCookies(req: any) {
  const raw = requestHeader(req, 'cookie');
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); }
    catch { out[key] = value; }
  }
  return out;
}

function secureRuntime(req: any) {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' || requestHeader(req, 'x-forwarded-proto') === 'https';
}

function serializeCookie(name: string, value: string, maxAge: number, secure: boolean) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export function setSessionCookies(req: any, res: any, tokens: TokenResponse) {
  const secure = secureRuntime(req);
  const accessName = secure ? PROD_ACCESS : DEV_ACCESS;
  const refreshName = secure ? PROD_REFRESH : DEV_REFRESH;
  const accessAge = Math.max(60, Number(tokens.expires_in || 3600) - 30);
  res.setHeader('set-cookie', [
    serializeCookie(accessName, tokens.access_token, accessAge, secure),
    serializeCookie(refreshName, tokens.refresh_token, 60 * 60 * 24 * 30, secure),
  ]);
}

export function clearSessionCookies(req: any, res: any) {
  const secure = secureRuntime(req);
  res.setHeader('set-cookie', [
    serializeCookie(PROD_ACCESS, '', 0, true),
    serializeCookie(PROD_REFRESH, '', 0, true),
    serializeCookie(DEV_ACCESS, '', 0, secure),
    serializeCookie(DEV_REFRESH, '', 0, secure),
  ]);
}

function tokenCookies(req: any) {
  const cookies = parseCookies(req);
  return {
    accessToken: cookies[PROD_ACCESS] || cookies[DEV_ACCESS] || '',
    refreshToken: cookies[PROD_REFRESH] || cookies[DEV_REFRESH] || '',
  };
}

export async function signInWithPassword(email: string, password: string) {
  return authRequest<TokenResponse>('token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshWithToken(refreshToken: string) {
  return authRequest<TokenResponse>('token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function getUser(accessToken: string) {
  if (!accessToken) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  return authRequest<AuthUser>('user', {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

export async function revokeSession(accessToken: string) {
  if (!accessToken) return;
  try {
    await authRequest<unknown>('logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Logout remains successful locally even if the upstream session was already invalid.
  }
}

export async function requireSession(req: any, res: any) {
  const tokens = tokenCookies(req);
  if (tokens.accessToken) {
    try {
      const user = await getUser(tokens.accessToken);
      return { accessToken: tokens.accessToken, user };
    } catch {
      // Try the refresh token once below.
    }
  }

  if (tokens.refreshToken) {
    try {
      const refreshed = await refreshWithToken(tokens.refreshToken);
      setSessionCookies(req, res, refreshed);
      const user = refreshed.user || await getUser(refreshed.access_token);
      return { accessToken: refreshed.access_token, user };
    } catch {
      clearSessionCookies(req, res);
    }
  }

  throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
}
