import { clearSessionCookies, requireSession } from '../../server/auth.js';
import { ApiError, handleApi, methodNotAllowed, sendJson } from '../../server/http.js';
import { isOwner } from '../../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
      throw new ApiError(403, 'NOT_OWNER', 'This account is not authorized for RheomIQ.');
    }
    return sendJson(res, 200, { authenticated: true, email: session.user.email || null });
  });
}
