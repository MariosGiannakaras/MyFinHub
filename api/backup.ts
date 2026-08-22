import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from '../server/auth.js';
import { ApiError, handleApi, methodNotAllowed, sendJson } from '../server/http.js';
import { backupStore, isOwner } from '../server/storage.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const session = await requireSession(req, res, { allowBearer: true });
    assertMutationSessionOrigin(req, session);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookiesIfCookie(req, res, session);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    return sendJson(res, 200, { path: await backupStore(session.accessToken) });
  });
}
