import { accessTokenAal, clearSessionCookies, requireSession } from '../server/auth.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../server/http.js';
import { isOwner, readStore, writeStore } from '../server/storage.js';
import { validateFinanceData } from '../server/validation.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET' && req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);

    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    if (req.method === 'GET') return sendJson(res, 200, await readStore(session.accessToken));

    assertSameOrigin(req);
    const body = await readJsonBody(req, 5 * 1024 * 1024);
    validateFinanceData(body);
    const expected = Array.isArray(req.headers?.['if-match']) ? req.headers['if-match'][0] : req.headers?.['if-match'];
    return sendJson(res, 200, await writeStore(body, expected || undefined, false, session.accessToken));
  });
}
