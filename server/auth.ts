import { Buffer } from 'node:buffer';
import { ApiError, requestHeader } from './http.js';
import { fetchUpstream, isAuthRejection } from './upstream.js';

const PROD_ACCESS = '__Host-rheomiq_access';
const PROD_REFRESH = '__Host-rheomiq_refresh';
const DEV_ACCESS = 'rheomiq_access';
const DEV_REFRESH = 'rheomiq_refresh';

type AuthFactor = {
  id: string;
  factor_type?: string;
  type?: string;
  status?: string;
  friendly_name?: string | null;
};
type AuthUser = { id: string; email?: string | null; factors?: AuthFactor[] | null };
export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  user?: AuthUser;
};
type TotpEnrollment = {
  id: string;
  type: string;
  friendly_name?: string | null;
  totp?: { qr_code?: string; secret?: string; uri?: string };
};
type ChallengeResponse = { id: string; expires_at?: number };

type JwtClaims = { aal?: string };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Authentication is not configured.', false);
  return { url, publishable };
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, publishable } = config();
  const response = await fetchUpstream(`${url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishable,
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  }, 'AUTH');
  const payload = await response.json().catch(() => null) as T | { message?: string; msg?: string; error_description?: string } | null;
  if (!response.ok) {
    if (response.status === 429) {
      throw new ApiError(429, 'AUTH_RATE_LIMITED', 'Too many authentication attempts. Try again later.');
    }
    if (response.status >= 500) {
      throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication service is temporarily unavailable. Try again.');
    }
    if (response.status >= 400 && response.status < 500) {
      const message = payload && typeof payload === 'object'
        ? ('message' in payload && payload.message) || ('msg' in payload && payload.msg) || ('error_description' in payload && payload.error_description)
        : null;
      throw new ApiError(response.status, 'AUTH_REJECTED', message || 'Authentication rejected.', false);
    }
    throw new ApiError(502, 'AUTH_UPSTREAM_ERROR', 'Authentication service returned an unexpected response.', false);
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
  return process.env.VERCEL === '1' || requestHeader(req, 'x-forwarded-proto') === 'https';
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

function jwtClaims(accessToken: string): JwtClaims {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtClaims;
  } catch {
    return {};
  }
}

export function accessTokenAal(accessToken: string) {
  const aal = jwtClaims(accessToken).aal;
  return aal === 'aal2' ? 'aal2' : 'aal1';
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

export async function getTotpFactors(accessToken: string) {
  const user = await getUser(accessToken);
  return (user.factors || []).filter(factor => (factor.factor_type || factor.type) === 'totp');
}

export async function beginTotpEnrollment(accessToken: string) {
  const factors = await getTotpFactors(accessToken);
  if (factors.some(factor => factor.status === 'verified')) {
    throw new ApiError(409, 'MFA_ALREADY_ENROLLED', 'A verification method is already configured.');
  }
  for (const factor of factors.filter(item => item.status !== 'verified')) {
    try {
      await authRequest<unknown>(`factors/${encodeURIComponent(factor.id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      if (!isAuthRejection(error)) throw error;
      // A stale unverified factor that is already gone must not block a fresh enrollment attempt.
    }
  }
  const enrollment = await authRequest<TotpEnrollment>('factors', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ factor_type: 'totp', friendly_name: 'RheomIQ Authenticator' }),
  });
  if (!enrollment.id || !enrollment.totp?.qr_code || !enrollment.totp.secret) {
    throw new ApiError(502, 'MFA_ENROLLMENT_FAILED', 'Could not start verification setup.', false);
  }
  return enrollment;
}

export async function challengeTotp(accessToken: string, factorId: string) {
  const challenge = await authRequest<ChallengeResponse>(`factors/${encodeURIComponent(factorId)}/challenge`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!challenge.id) throw new ApiError(502, 'MFA_CHALLENGE_FAILED', 'Could not start verification.', false);
  return challenge;
}

export async function verifyTotp(accessToken: string, factorId: string, challengeId: string, code: string) {
  return authRequest<TokenResponse>(`factors/${encodeURIComponent(factorId)}/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ challenge_id: challengeId, code }),
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
    // Local logout still clears HttpOnly cookies even if upstream revocation is unavailable.
  }
}

export async function requireSession(req: any, res: any) {
  const tokens = tokenCookies(req);
  if (tokens.accessToken) {
    try {
      const user = await getUser(tokens.accessToken);
      return { accessToken: tokens.accessToken, user };
    } catch (error) {
      if (!isAuthRejection(error)) throw error;
      // Only a genuine Auth rejection is eligible for refresh fallback.
    }
  }

  if (tokens.refreshToken) {
    try {
      const refreshed = await refreshWithToken(tokens.refreshToken);
      setSessionCookies(req, res, refreshed);
      const user = refreshed.user || await getUser(refreshed.access_token);
      return { accessToken: refreshed.access_token, user };
    } catch (error) {
      if (!isAuthRejection(error)) throw error;
      clearSessionCookies(req, res);
    }
  }

  throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
}
