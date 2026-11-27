import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession, signInWithPassword } from './auth.js';
import { accessTokenSessionId } from './deviceSessionRegistry.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from './http.js';
import { isOwner } from './storage.js';
import { fetchUpstream } from './upstream.js';
import { accountPasswordPolicyError } from '../src/lib/passwordPolicy.js';

const MAX_ACCOUNT_SECURITY_BODY_BYTES = 4 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccountSecurityWrite =
  | { action: 'email'; email: string }
  | { action: 'password'; currentPassword: string; newPassword: string };

type AuthUserUpdate = {
  id?: string;
  email?: string | null;
  new_email?: string | null;
};

function authConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishable) throw new ApiError(500, 'SERVER_CONFIG_ERROR', 'Authentication is not configured.', false);
  return { url, publishable };
}

async function updateAuthenticatedUser(accessToken: string, attributes: Record<string, string>) {
  const { url, publishable } = authConfig();
  const response = await fetchUpstream(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: publishable,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(attributes),
  }, 'AUTH');
  const payload = await response.json().catch(() => null) as AuthUserUpdate | null;
  if (response.ok) return payload ?? {};
  if (response.status === 429) throw new ApiError(429, 'AUTH_RATE_LIMITED', 'Έγιναν πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.');
  if (response.status >= 500) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Η υπηρεσία σύνδεσης δεν είναι προσωρινά διαθέσιμη.');
  throw new ApiError(response.status, 'ACCOUNT_CHANGE_REJECTED', 'Η αλλαγή απορρίφθηκε από την υπηρεσία σύνδεσης. Έλεγξε τα στοιχεία και τις απαιτήσεις ασφαλείας.');
}

// GoTrue versions may accept a password update without enforcing current_password.
// Prove possession independently using a new password-grant session, never the
// caller's AAL2 session. Retire that temporary session locally before updating.
async function verifyCurrentPassword(session: Awaited<ReturnType<typeof requireSession>>, currentPassword: string) {
  const activeSessionId = accessTokenSessionId(session.accessToken).toLowerCase();
  const email = session.user.email;
  if (!activeSessionId || !email) throw new ApiError(403, 'ACCOUNT_CHANGE_REJECTED', 'Δεν είναι δυνατή η επαλήθευση του λογαριασμού.');

  let proof: Awaited<ReturnType<typeof signInWithPassword>>;
  try {
    proof = await signInWithPassword(email, currentPassword);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'AUTH_REJECTED') {
      throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Ο τρέχων κωδικός δεν είναι έγκυρος.');
    }
    throw error;
  }
  const proofToken = proof?.access_token;
  const proofSessionId = typeof proofToken === 'string' ? accessTokenSessionId(proofToken).toLowerCase() : '';
  if (!proofToken || !proofSessionId || proofSessionId === activeSessionId) {
    throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Δεν είναι δυνατή η ασφαλής επαλήθευση του κωδικού.');
  }
  const { url, publishable } = authConfig();
  const logout = await fetchUpstream(`${url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: publishable, authorization: `Bearer ${proofToken}` },
  }, 'AUTH');
  if (logout.status === 429) throw new ApiError(429, 'AUTH_RATE_LIMITED', 'Έγιναν πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.');
  if (!logout.ok) throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Δεν είναι δυνατή η ασφαλής επαλήθευση του κωδικού.');

  if (proof.user?.id !== session.user.id || accessTokenAal(proofToken) !== 'aal1') {
    throw new ApiError(403, 'ACCOUNT_CHANGE_REJECTED', 'Δεν είναι δυνατή η επαλήθευση του λογαριασμού.');
  }
}

export function parseAccountSecurityWrite(value: unknown): AccountSecurityWrite {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'INVALID_ACCOUNT_CHANGE', 'Μη έγκυρη αλλαγή λογαριασμού.');
  const body = value as Record<string, unknown>;
  const action = body.action;
  if (action === 'email') {
    if (Object.keys(body).some(key => key !== 'action' && key !== 'email')) throw new ApiError(400, 'INVALID_ACCOUNT_CHANGE', 'Μη έγκυρη αλλαγή email.');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) throw new ApiError(400, 'INVALID_EMAIL', 'Το νέο email δεν είναι έγκυρο.');
    return { action, email };
  }
  if (action === 'password') {
    if (Object.keys(body).some(key => key !== 'action' && key !== 'currentPassword' && key !== 'newPassword')) throw new ApiError(400, 'INVALID_ACCOUNT_CHANGE', 'Μη έγκυρη αλλαγή κωδικού.');
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || currentPassword.length > 512) throw new ApiError(400, 'INVALID_CURRENT_PASSWORD', 'Ο τρέχων κωδικός δεν είναι έγκυρος.');
    const passwordError=accountPasswordPolicyError(newPassword);
    if (passwordError) throw new ApiError(400, 'INVALID_NEW_PASSWORD', passwordError);
    if (newPassword === currentPassword) throw new ApiError(400, 'PASSWORD_UNCHANGED', 'Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον τρέχοντα.');
    return { action, currentPassword, newPassword };
  }
  throw new ApiError(400, 'INVALID_ACCOUNT_CHANGE', 'Μη έγκυρη αλλαγή λογαριασμού.');
}

export async function handleAccountSecurityRequest(req: any, res: any) {
  await handleApi(res, async () => {
    const method = String(req.method || '').toUpperCase();
    if (method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
    const session = await requireSession(req, res, { allowBearer: true });
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookiesIfCookie(req, res, session);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    assertMutationSessionOrigin(req, session);
    const change = parseAccountSecurityWrite(await readJsonBody(req, MAX_ACCOUNT_SECURITY_BODY_BYTES));
    if (change.action === 'email') {
      if ((session.user.email || '').trim().toLowerCase() === change.email) throw new ApiError(400, 'EMAIL_UNCHANGED', 'Το νέο email είναι ίδιο με το τρέχον.');
      const updated = await updateAuthenticatedUser(session.accessToken, { email: change.email });
      return sendJson(res, 200, {
        ok: true,
        email: updated.email ?? session.user.email ?? null,
        pendingEmail: updated.new_email ?? (updated.email === change.email ? null : change.email),
      });
    }
    await verifyCurrentPassword(session, change.currentPassword);
    await updateAuthenticatedUser(session.accessToken, {
      current_password: change.currentPassword,
      password: change.newPassword,
    });
    return sendJson(res, 200, { ok: true });
  });
}
