import { accessTokenAal, challengeTotp, clearSessionCookies, getTotpFactors, requireSession, setSessionCookies, verifyTotp } from '../../../server/auth.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../../../server/http.js';
import { isOwner } from '../../../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    assertSameOrigin(req);
    const body = await readJsonBody<{ code?: unknown; factorId?: unknown }>(req, 8 * 1024);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const requestedFactorId = typeof body.factorId === 'string' ? body.factorId.trim() : '';
    if (!/^\d{6}$/.test(code)) throw new ApiError(401, 'INVALID_MFA_CODE', 'Invalid verification code.');

    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }

    const factors = await getTotpFactors(session.accessToken);
    const factor = requestedFactorId
      ? factors.find(item => item.id === requestedFactorId)
      : factors.find(item => item.status === 'verified') || factors.find(item => item.status !== 'verified');
    if (!factor) throw new ApiError(401, 'MFA_NOT_CONFIGURED', 'Verification is unavailable.');

    try {
      const challenge = await challengeTotp(session.accessToken, factor.id);
      const tokens = await verifyTotp(session.accessToken, factor.id, challenge.id, code);
      if (!tokens.access_token || !tokens.refresh_token || accessTokenAal(tokens.access_token) !== 'aal2' || !(await isOwner(tokens.access_token))) {
        throw new Error('MFA verification did not produce an owner AAL2 session.');
      }
      setSessionCookies(req, res, tokens);
      return sendJson(res, 200, { authenticated: true, email: tokens.user?.email || session.user.email || null });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') throw error;
      throw new ApiError(401, 'INVALID_MFA_CODE', 'Invalid verification code.');
    }
  });
}
