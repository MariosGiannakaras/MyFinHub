import { accessTokenAal, assertMutationSessionOrigin, clearSessionCookiesIfCookie, requireSession } from '../server/auth.js';
import { ApiError, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../server/http.js';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';
import { parseMutableWrite } from '../server/stateValidation.js';
import { isOwner, parseExpectedRevision, readStore, writeMutableState } from '../server/storage.js';

function duration(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

function setServerTiming(res: any, timings: { session: number; owner: number; data: number; total: number }) {
  res.setHeader('server-timing', [
    `session;dur=${timings.session}`,
    `owner;dur=${timings.owner}`,
    `data;dur=${timings.data}`,
    `total;dur=${timings.total}`,
  ].join(', '));
}

function header(req: any, name: string) {
  const value = req.headers?.[name];
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
}

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET' && req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);

    const totalStarted = Date.now();
    const sessionStarted = Date.now();
    const session = await requireSession(req, res, { allowBearer: true });
    const sessionMs = duration(sessionStarted);

    const ownerStarted = Date.now();
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookiesIfCookie(req, res, session);
      throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
    }
    const ownerMs = duration(ownerStarted);

    if (accessTokenAal(session.accessToken) !== 'aal2') throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');

    if (req.method === 'GET') {
      const dataStarted = Date.now();
      const result = await readStore(session.accessToken);
      const dataMs = duration(dataStarted);
      setServerTiming(res, { session: sessionMs, owner: ownerMs, data: dataMs, total: duration(totalStarted) });
      return sendJson(res, 200, result);
    }

    assertMutationSessionOrigin(req, session);
    const expectedRevision = String(parseExpectedRevision(header(req, 'if-match')));
    const expectedHistoryGeneration = header(req, 'x-rheomiq-history-generation');
    const body = parseMutableWrite(await readJsonBody(req, MAX_FINANCE_DOCUMENT_BYTES));

    const dataStarted = Date.now();
    const result = await writeMutableState(body.state, body.updatedAt, expectedRevision, expectedHistoryGeneration, body.historyLabel, session.accessToken);
    const dataMs = duration(dataStarted);
    setServerTiming(res, { session: sessionMs, owner: ownerMs, data: dataMs, total: duration(totalStarted) });
    return sendJson(res, 200, result);
  });
}
