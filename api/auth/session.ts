import { handleAccountSecurityRequest } from '../../server/accountSecurityHandler.js';
import { accessTokenAal, clearSessionCookies, getTotpFactors, requireSession } from '../../server/auth.js';
import { handleDeviceSessionsRequest } from '../../server/deviceSessionsHandler.js';
import { ApiError, handleApi, methodNotAllowed, sendJson } from '../../server/http.js';
import { isOwner } from '../../server/storage.js';

function routeMarker(req: any) {
  const value = req?.query?.__myfinhub_route;
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
}

export default async function handler(req: any, res: any) {
  const marker = routeMarker(req);
  if (marker === 'account') {
    await handleAccountSecurityRequest(req, res);
    return;
  }
  if (marker === 'devices') {
    await handleDeviceSessionsRequest(req, res);
    return;
  }

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
