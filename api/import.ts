import { accessTokenAal, clearSessionCookies, requireSession } from '../server/auth.js';
import { assertSameOrigin, handleApi, methodNotAllowed, readJsonBody, requestHeader, sendJson, ApiError } from '../server/http.js';
import { isOwner, writeStore } from '../server/storage.js';
import { validateFinanceData } from '../server/validation.js';

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    assertSameOrigin(req);
    const session = await requireSession(req, res);
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
    if (requestHeader(req, 'x-rheomiq-confirm-import') !== 'replace') {
      throw new ApiError(400, 'IMPORT_CONFIRMATION_REQUIRED', 'Import confirmation is required.');
    }
    const body = await readJsonBody(req, 5 * 1024 * 1024);
    validateFinanceData(body);
    return sendJson(res, 200, await writeStore(body, undefined, true, session.accessToken));
  });
}
