import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from '../server/auth.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../server/http.js';
import { isOwner, moveHistory, readHistory } from '../server/storage.js';

function header(req: any, name: string) {
  const value = req.headers?.[name];
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
}

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET' && req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    const session = await requireSession(req, res, { allowBearer: true });
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookiesIfCookie(req, res, session);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');

    if (req.method === 'GET') return sendJson(res, 200, await readHistory(session.accessToken));

    assertMutationSessionOrigin(req, session);
    const body = await readJsonBody(req, 4096) as Record<string, unknown>;
    const action = body?.action;
    const updatedAt = body?.updatedAt;
    if ((action !== 'undo' && action !== 'redo') || typeof updatedAt !== 'string' || !updatedAt || updatedAt.length > 64 || Object.keys(body).some(key=>key!=='action'&&key!=='updatedAt')) {
      throw new ApiError(400, 'INVALID_HISTORY', 'The change-history request is invalid.');
    }
    const result = await moveHistory(action, updatedAt, header(req, 'if-match'), header(req, 'x-rheomiq-history-generation'), session.accessToken);
    return sendJson(res, 200, result);
  });
}
