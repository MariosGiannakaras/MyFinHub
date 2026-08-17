import { clearSessionCookies, revokeSession, setSessionCookies, signInWithPassword } from '../../server/auth.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../../server/http.js';
import { isOwner } from '../../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    assertSameOrigin(req);

    const body = await readJsonBody<{ email?: unknown; password?: unknown }>(req, 16 * 1024);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || email.length > 254 || !email.includes('@') || password.length < 8 || password.length > 512) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    let tokens;
    try { tokens = await signInWithPassword(email, password); }
    catch { throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'); }

    if (!tokens.access_token || !tokens.refresh_token || !(await isOwner(tokens.access_token))) {
      await revokeSession(tokens.access_token);
      clearSessionCookies(req, res);
      throw new ApiError(403, 'NOT_OWNER', 'This account is not authorized for RheomIQ.');
    }

    setSessionCookies(req, res, tokens);
    return sendJson(res, 200, { authenticated: true, email: tokens.user?.email || email });
  });
}
