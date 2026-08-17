import { accessTokenAal, clearSessionCookies, requireSession } from '../server/auth.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, readJsonBody, sendJson } from '../server/http.js';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';
import { isOwner, parseExpectedRevision, readStore, writeMutableState } from '../server/storage.js';
import { validateFinanceState } from '../server/stateValidation.js';

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

function parseMutableWrite(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(['state', 'updatedAt']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  if (typeof body.updatedAt !== 'string' || !body.updatedAt || body.updatedAt.length > 64) {
    throw new ApiError(400, 'INVALID_DATA', 'The finance data is invalid.');
  }
  validateFinanceState(body.state);
  return { state: body.state, updatedAt: body.updatedAt };
}

export default async function handler(req: any, res: any) {
  await handleApi(res, async () => {
    if (req.method !== 'GET' && req.method !== 'PUT') return methodNotAllowed(res, ['GET', 'PUT']);

    const totalStarted = Date.now();
    const sessionStarted = Date.now();
    const session = await requireSession(req, res);
    const sessionMs = duration(sessionStarted);

    const ownerStarted = Date.now();
    if (!(await isOwner(session.accessToken))) {
      clearSessionCookies(req, res);
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

    assertSameOrigin(req);
    const expectedHeader = Array.isArray(req.headers?.['if-match']) ? req.headers['if-match'][0] : req.headers?.['if-match'];
    const expectedRevision = String(parseExpectedRevision(typeof expectedHeader === 'string' ? expectedHeader : undefined));
    const body = parseMutableWrite(await readJsonBody(req, MAX_FINANCE_DOCUMENT_BYTES));

    const dataStarted = Date.now();
    const result = await writeMutableState(body.state, body.updatedAt, expectedRevision, session.accessToken);
    const dataMs = duration(dataStarted);
    setServerTiming(res, { session: sessionMs, owner: ownerMs, data: dataMs, total: duration(totalStarted) });
    return sendJson(res, 200, result);
  });
}
