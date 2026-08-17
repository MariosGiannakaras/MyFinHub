import { accessTokenAal, clearSessionCookies, getTotpFactors, requireSession } from '../../server/auth.js';
import { ApiError, handleApi, methodNotAllowed, sendJson } from '../../server/http.js';
import { isOwner } from '../../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    const factors = await getTotpFactors(session.accessToken);
    const hasVerifiedTotp = factors.some(factor => factor.status === 'verified');
    const aal2 = accessTokenAal(session.accessToken) === 'aal2';
    return sendJson(res, 200, {
      authenticated: aal2,
      email: session.user.email || null,
      mfaRequired: !aal2 && hasVerifiedTotp,
      mfaEnrollmentRequired: !aal2 && !hasVerifiedTotp,
    });
  });
}
